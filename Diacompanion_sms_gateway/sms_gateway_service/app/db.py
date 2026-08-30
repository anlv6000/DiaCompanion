import os
import sqlite3
from contextlib import contextmanager
from .config import settings


def _connect() -> sqlite3.Connection:
    db_path = os.path.abspath(settings.db_path)
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    connection = sqlite3.connect(db_path, timeout=15, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL;")
    connection.execute("PRAGMA foreign_keys=ON;")
    return connection


@contextmanager
def db():
    connection = _connect()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db() -> None:
    with db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS sms_outbox (
                id TEXT PRIMARY KEY,
                phone_number TEXT NOT NULL,
                message TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('pending','processing','sent','failed')),
                created_at TEXT NOT NULL,
                leased_at TEXT NULL,
                sent_at TEXT NULL,
                error_message TEXT NULL,
                source TEXT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_sms_outbox_status_created
            ON sms_outbox(status, created_at);
            """
        )
