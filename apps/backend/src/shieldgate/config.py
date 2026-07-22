from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_db_url: str = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    supabase_jwt_secret: str = "super-secret-jwt-token-with-at-least-32-characters-long"
    # `supabase start`'s default local project signs real access tokens asymmetrically
    # (ES256, auto-generated per-project key) and only keeps the legacy shared secret
    # around for backward compatibility; see jwt_auth.py's require_user for why both
    # verification paths are needed.
    supabase_auth_url: str = "http://127.0.0.1:54321"
    # ollama | regex-only | fake. regex-only is the shipped default here: the accuracy eval
    # (apps/backend/tests/test_classifier_eval.py, run 2026-07-22) measured 3 false blocks on
    # the clean-text subset with gemma4:12b (pub-03, pub-07, pub-08, all misclassified as
    # "internal") — see that run's output for details. ollama remains fully implemented and
    # selectable; it is not the default until that is resolved (a different model, a prompt
    # change, or a decision to accept the risk).
    classifier_provider: str = "regex-only"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "gemma4:12b"
    cors_extra_origins: str = ""
    decision_api_key: str = "test-internal-key"


@lru_cache
def get_settings() -> Settings:
    return Settings()
