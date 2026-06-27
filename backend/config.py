from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    sf_username: str
    sf_password: str
    sf_security_token: str
    sf_domain: str = "login"

    anthropic_api_key: str
    anthropic_model: str = "claude-sonnet-4-6"

    knowledge_base_dir: Path = Path("./knowledge_base/articles")
    vector_store_dir: Path = Path("./knowledge_base/vectors")
    company_knowledge_dir: Path = Path("./company_knowledge")

    embedding_model: str = "all-MiniLM-L6-v2"
    vector_search_top_k: int = 5
    confidence_threshold: float = 0.75

    log_level: str = "INFO"
    host: str = "0.0.0.0"
    port: int = 8000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
