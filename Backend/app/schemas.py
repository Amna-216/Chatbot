from datetime import datetime

from pydantic import BaseModel, EmailStr


class ChatCreate(BaseModel):
    title: str | None = None


class ChatOut(BaseModel):
    id: int
    user_id: int | None
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    content: str = ""
    image_base64: str | None = None
    pdf_base64: str | None = None
    pdf_filename: str | None = None


class MessageOut(BaseModel):
    id: int
    chat_id: int
    role: str
    content: str
    image_base64: str | None
    pdf_filename: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatWithMessages(BaseModel):
    chat: ChatOut
    messages: list[MessageOut]


class UserSignup(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    identifier: str
    password: str


class ChangePasswordPayload(BaseModel):
    email: str
    new_password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserOut
