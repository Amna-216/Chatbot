from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.groq_client import ask_groq
from app.models import ChatSession, Message
from app.schemas import ChatCreate, ChatOut, ChatWithMessages, MessageCreate, MessageOut

app = FastAPI(title="Chatbot Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/chats", response_model=list[ChatOut])
def list_chats(db: Session = Depends(get_db)):
    chats = db.execute(select(ChatSession).order_by(desc(ChatSession.updated_at))).scalars().all()
    return chats


@app.post("/api/chats", response_model=ChatOut)
def create_chat(payload: ChatCreate, db: Session = Depends(get_db)):
    chat = ChatSession(title=payload.title or "New chat")
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat


@app.get("/api/chats/{chat_id}", response_model=ChatWithMessages)
def get_chat(chat_id: int, db: Session = Depends(get_db)):
    chat = db.get(ChatSession, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = db.execute(
        select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at.asc())
    ).scalars().all()

    return {"chat": chat, "messages": messages}


@app.post("/api/chats/{chat_id}/messages", response_model=list[MessageOut])
def send_message(chat_id: int, payload: MessageCreate, db: Session = Depends(get_db)):
    chat = db.get(ChatSession, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    user_message = Message(
        chat_id=chat_id,
        role="user",
        content=payload.content,
        image_base64=payload.image_base64,
    )
    db.add(user_message)
    db.flush()

    if chat.title == "New chat":
        chat.title = payload.content[:40] if payload.content else "Image chat"
    chat.updated_at = datetime.now(timezone.utc)

    try:
        ai_content = ask_groq(payload.content, payload.image_base64)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Groq request failed: {exc}")

    assistant_message = Message(chat_id=chat_id, role="assistant", content=ai_content)
    db.add(assistant_message)
    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)

    return [user_message, assistant_message]
