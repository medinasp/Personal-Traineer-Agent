from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://fit:fit@localhost:5434/fitness"

    # Token de acesso a API. Vazio = auth desligada (dev local).
    # Em producao defina um valor forte; o app deve mandar "Authorization: Bearer <token>".
    api_token: str = ""

    # Agente Coach (Groq)
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"

    # RAG — modelo de embeddings (fastembed, ONNX). Multilingue e leve.
    embed_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

    # CORS: "*" libera tudo (dev) ou lista separada por virgula
    cors_origins: str = "*"

    @property
    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]


settings = Settings()
