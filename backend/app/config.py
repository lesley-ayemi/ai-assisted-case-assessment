from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Product naming lives in one place so a rename is a one-line change.
    product_name: str = "CaseIQ"
    assistant_name: str = "Lauretha"

    database_url: str = "postgresql+psycopg://caseiq:caseiq@localhost:5432/caseiq"
    upload_dir: str = "uploads"

    llm_model: str = "claude-opus-5-5"
    llm_effort: str = "high"

    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
