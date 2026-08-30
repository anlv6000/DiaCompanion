from dataclasses import dataclass
import os
from dotenv import load_dotenv

load_dotenv()


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = _int("PORT", 8091)
    db_path: str = os.getenv("DB_PATH", "./data/sms_gateway.db")
    gateway_key: str = os.getenv("SMS_GATEWAY_KEY", "change-this-gateway-key")
    main_backend_key: str = os.getenv("MAIN_BACKEND_KEY", "change-this-main-backend-key")
    allowed_recipients_raw: str = os.getenv("ALLOWED_RECIPIENTS", "")
    lease_seconds: int = _int("LEASE_SECONDS", 60)
    max_sms_per_minute: int = _int("MAX_SMS_PER_MINUTE", 5)

    @property
    def allowed_recipients(self) -> set[str]:
        return {
            item.strip()
            for item in self.allowed_recipients_raw.split(",")
            if item.strip()
        }


settings = Settings()
