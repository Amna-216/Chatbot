from datetime import datetime

from pydantic import BaseModel


class ChatCreate(BaseModel):
    title: str | None = None


class ChatOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    content: str
    image_base64: str | None = None


class MessageOut(BaseModel):
    id: int
    chat_id: int
    role: str
    content: str
    image_base64: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatWithMessages(BaseModel):
    chat: ChatOut
    messages: list[MessageOut]
