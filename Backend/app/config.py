import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    database_url: str = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@db:5432/chatbot_db")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    backend_url: str = os.getenv("BACKEND_URL", "http://localhost:8000")


settings = Settings()
