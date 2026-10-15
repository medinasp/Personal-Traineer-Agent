from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ChatResponse(BaseModel):
    reply: str
    actions: list[str] = []
    conversation_id: int | None = None


class ChatMessageRead(BaseModel):
    id: int
    role: str
    content: str
    created_at: str
