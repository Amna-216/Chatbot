# Full Stack Chatbot (React + FastAPI + Groq + Postgres)

## Stack
- Frontend: React (Vite) in `Frontend`
- Backend: Python FastAPI in `Backend`
- Database: PostgreSQL
- DB UI: Adminer
- AI: Groq (`meta-llama/llama-4-scout-17b-16e-instruct`)
- PDF support:
  - `<= 10` pages: PDF pages are converted to images via `PyMuPDF (fitz)` and analyzed with Groq vision.
  - `> 10` pages: fallback to `pdfplumber` text extraction and then Groq text analysis.

## Environment Files
- `Backend/.env`
- `Frontend/.env`

## Run With Docker
```bash
docker compose up --build
```

Services:
- Backend: http://localhost:8000
- Backend health: http://localhost:8000/health
- Adminer: http://localhost:8080
- PostgreSQL: localhost:5432

Frontend is not started by Docker. Run it locally from `Frontend` with `npm run dev`.

## Adminer Login
- System: `PostgreSQL`
- Server: `db`
- Username: `postgres`
- Password: `postgres`
- Database: `chatbot_db`

## Frontend Local Run
```bash
cd Frontend
npm install
npm run dev
```

## Backend Local Run (Optional Instead of Docker)
```bash
cd Backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Migration
Initial migration file:
- `Backend/app/alembic/versions/0001_initial.py`
- Added migration:
  - `Backend/app/alembic/versions/0002_add_pdf_filename.py`
