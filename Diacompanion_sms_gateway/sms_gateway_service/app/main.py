from __future__ import annotations

from collections import deque
from datetime import datetime, timedelta, timezone
import threading
import uuid

from fastapi import FastAPI, Header, HTTPException, Response, status
from .config import settings
from .db import db, init_db
from .models import EnqueueSmsRequest, EnqueueSmsResponse, PendingSmsResponse, SmsResultRequest

app = FastAPI(title="DiaCompanion SMS Gateway Service", version="1.0.0")

_rate_lock = threading.Lock()
_send_timestamps: deque[datetime] = deque()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime | None = None) -> str:
    return (value or utcnow()).isoformat()


def normalize_vn_phone(value: str) -> str:
    cleaned = "".join(ch for ch in value.strip() if ch.isdigit() or ch == "+")
    if cleaned.startswith("+84"):
        normalized = cleaned
    elif cleaned.startswith("84"):
        normalized = "+" + cleaned
    elif cleaned.startswith("0"):
        normalized = "+84" + cleaned[1:]
    else:
        raise HTTPException(status_code=400, detail="Phone must be a Vietnam number in 0xxxxxxxxx or +84xxxxxxxxx format")

    digits = normalized[1:]
    if not digits.isdigit() or not (10 <= len(digits) <= 12):
        raise HTTPException(status_code=400, detail="Invalid phone number")
    return normalized


def require_gateway_key(x_sms_gateway_key: str | None) -> None:
    if not x_sms_gateway_key or x_sms_gateway_key != settings.gateway_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid gateway key")


def require_main_backend_key(x_main_backend_key: str | None) -> None:
    if not x_main_backend_key or x_main_backend_key != settings.main_backend_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid main backend key")


def enforce_allowed_recipient(phone: str) -> None:
    allowed = settings.allowed_recipients
    if allowed and phone not in allowed:
        raise HTTPException(status_code=403, detail="Recipient is not in ALLOWED_RECIPIENTS")


def enforce_rate_limit() -> None:
    now = utcnow()
    cutoff = now - timedelta(minutes=1)
    with _rate_lock:
        while _send_timestamps and _send_timestamps[0] < cutoff:
            _send_timestamps.popleft()
        if len(_send_timestamps) >= settings.max_sms_per_minute:
            raise HTTPException(status_code=429, detail="SMS rate limit exceeded")
        _send_timestamps.append(now)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "diacompanion-sms-gateway",
        "sandbox": False,
    }


@app.post("/api/sms/enqueue", response_model=EnqueueSmsResponse)
def enqueue_sms(
    payload: EnqueueSmsRequest,
    x_main_backend_key: str | None = Header(default=None),
) -> EnqueueSmsResponse:
    require_main_backend_key(x_main_backend_key)
    phone = normalize_vn_phone(payload.phoneNumber)
    enforce_allowed_recipient(phone)
    enforce_rate_limit()

    sms_id = str(uuid.uuid4())
    with db() as connection:
        connection.execute(
            """
            INSERT INTO sms_outbox(id, phone_number, message, status, created_at, source)
            VALUES (?, ?, ?, 'pending', ?, ?)
            """,
            (sms_id, phone, payload.message, iso(), payload.source),
        )

    return EnqueueSmsResponse(id=sms_id, status="pending")


@app.get("/api/sms/{sms_id}")
def get_sms(
    sms_id: str,
    x_main_backend_key: str | None = Header(default=None),
) -> dict:
    require_main_backend_key(x_main_backend_key)
    with db() as connection:
        row = connection.execute("SELECT * FROM sms_outbox WHERE id = ?", (sms_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="SMS not found")
    return dict(row)


@app.get("/api/gateway/pending", response_model=PendingSmsResponse | None, status_code=200)
def gateway_pending(
    response: Response,
    x_sms_gateway_key: str | None = Header(default=None),
):
    require_gateway_key(x_sms_gateway_key)
    lease_cutoff = iso(utcnow() - timedelta(seconds=settings.lease_seconds))
    now = iso()

    with db() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute(
            """
            SELECT *
            FROM sms_outbox
            WHERE status = 'pending'
               OR (status = 'processing' AND leased_at IS NOT NULL AND leased_at < ?)
            ORDER BY created_at ASC
            LIMIT 1
            """,
            (lease_cutoff,),
        ).fetchone()

        if row is None:
            response.status_code = status.HTTP_204_NO_CONTENT
            return None

        connection.execute(
            "UPDATE sms_outbox SET status = 'processing', leased_at = ?, error_message = NULL WHERE id = ?",
            (now, row["id"]),
        )

    return PendingSmsResponse(id=row["id"], phoneNumber=row["phone_number"], message=row["message"])


@app.post("/api/gateway/{sms_id}/result")
def gateway_result(
    sms_id: str,
    payload: SmsResultRequest,
    x_sms_gateway_key: str | None = Header(default=None),
) -> dict:
    require_gateway_key(x_sms_gateway_key)

    with db() as connection:
        row = connection.execute("SELECT id FROM sms_outbox WHERE id = ?", (sms_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="SMS not found")

        if payload.success:
            connection.execute(
                """
                UPDATE sms_outbox
                SET status = 'sent', sent_at = ?, error_message = NULL
                WHERE id = ?
                """,
                (iso(), sms_id),
            )
        else:
            connection.execute(
                """
                UPDATE sms_outbox
                SET status = 'failed', error_message = ?
                WHERE id = ?
                """,
                (payload.errorMessage or "Unknown Android SMS error", sms_id),
            )

    return {"id": sms_id, "status": "sent" if payload.success else "failed"}


@app.post("/api/sms/{sms_id}/retry")
def retry_sms(
    sms_id: str,
    x_main_backend_key: str | None = Header(default=None),
) -> dict:
    require_main_backend_key(x_main_backend_key)
    with db() as connection:
        row = connection.execute("SELECT status FROM sms_outbox WHERE id = ?", (sms_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="SMS not found")
        if row["status"] == "sent":
            raise HTTPException(status_code=409, detail="A sent SMS cannot be retried")
        connection.execute(
            "UPDATE sms_outbox SET status = 'pending', leased_at = NULL, error_message = NULL WHERE id = ?",
            (sms_id,),
        )
    return {"id": sms_id, "status": "pending"}
