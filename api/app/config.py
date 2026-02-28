from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Chronous API"
    environment: str = "development"
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    password_reset_redirect_url: str = ""
    allowed_origins: str = Field(default="http://localhost:8081,http://localhost:19006")
    upstream_timeout_seconds: float = 15.0
    max_photo_bytes: int = 10 * 1024 * 1024

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
