from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.groq_client import ask_groq
from app.models import ChatSession, Message, User
from app.pdf_service import ask_groq_with_pdf
from app.schemas import (
    AuthResponse,
    ChatCreate,
    ChatOut,
    ChatWithMessages,
    ChangePasswordPayload,
    MessageCreate,
    MessageOut,
    UserLogin,
    UserOut,
    UserSignup,
)
from app.security import create_access_token, get_current_user, hash_password, verify_password

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


@app.post("/api/auth/signup", response_model=AuthResponse)
def signup(payload: UserSignup, db: Session = Depends(get_db)):
    normalized_email = payload.email.lower()
    normalized_username = payload.username.strip().lower()

    if not normalized_username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is required")

    existing_user = db.execute(
        select(User).where(or_(User.email == normalized_email, User.username == normalized_username))
    ).scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email or username already registered")

    user = User(
        username=normalized_username,
        email=normalized_email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": user}


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    normalized_identifier = payload.identifier.strip().lower()
    user = db.execute(
        select(User).where(or_(User.email == normalized_identifier, User.username == normalized_identifier))
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"field": "identifier", "message": "Invalid email or username"},
        )
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"field": "password", "message": "Incorrect password"},
        )

    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": user}


@app.get("/api/auth/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.post("/api/auth/change-password")
def change_password(
    payload: ChangePasswordPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    normalized_email = payload.email.strip().lower()
    if not normalized_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required")

    if normalized_email != current_user.email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email verification failed")

    if len(payload.new_password) <= 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be more than 6 characters")

    current_user.password_hash = hash_password(payload.new_password)
    db.add(current_user)
    db.commit()
    return {"status": "password-updated"}


@app.delete("/api/auth/me")
def delete_account(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(current_user)
    db.commit()
    return {"status": "account-deleted"}


@app.get("/api/chats", response_model=list[ChatOut])
def list_chats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chats = db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(desc(ChatSession.updated_at))
    ).scalars().all()
    return chats


@app.post("/api/chats", response_model=ChatOut)
def create_chat(
    payload: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    chat = ChatSession(title=payload.title or "New chat", user_id=current_user.id)
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat


@app.get("/api/chats/{chat_id}", response_model=ChatWithMessages)
def get_chat(chat_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chat = db.get(ChatSession, chat_id)
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = db.execute(
        select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at.asc())
    ).scalars().all()

    return {"chat": chat, "messages": messages}


@app.delete("/api/chats/{chat_id}")
def delete_chat(chat_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chat = db.get(ChatSession, chat_id)
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chat not found")

    db.delete(chat)
    db.commit()
    return {"status": "deleted"}


@app.post("/api/chats/{chat_id}/delete")
def delete_chat_post(chat_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return delete_chat(chat_id, current_user, db)


@app.post("/api/chats/{chat_id}/messages", response_model=list[MessageOut])
def send_message(
    chat_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    chat = db.get(ChatSession, chat_id)
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chat not found")

    has_text = bool(payload.content and payload.content.strip())
    has_image = bool(payload.image_base64)
    has_pdf = bool(payload.pdf_base64)

    if not (has_text or has_image or has_pdf):
        raise HTTPException(status_code=400, detail="Message must include text, image, or PDF.")

    user_content = payload.content.strip() if has_text else "[Attachment message]"
    user_message = Message(
        chat_id=chat_id,
        role="user",
        content=user_content,
        image_base64=payload.image_base64,
        pdf_filename=payload.pdf_filename,
    )
    db.add(user_message)
    db.flush()

    if chat.title == "New chat":
        if has_text:
            chat.title = user_content[:40]
        elif payload.pdf_filename:
            chat.title = payload.pdf_filename[:40]
        else:
            chat.title = "Image chat"
    chat.updated_at = datetime.now(timezone.utc)

    try:
        if has_pdf:
            ai_content = ask_groq_with_pdf(user_content, payload.pdf_base64 or "")
        else:
            ai_content = ask_groq(user_content, payload.image_base64)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Groq request failed: {exc}")

    assistant_message = Message(chat_id=chat_id, role="assistant", content=ai_content)
    db.add(assistant_message)
    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)

    return [user_message, assistant_message]
