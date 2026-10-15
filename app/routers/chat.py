from fastapi import APIRouter, Depends, File, UploadFile, status
from groq import Groq
from sqlalchemy.orm import Session

from app.agent import runner
from app.config import settings
from app.database import get_db
from app.schemas.chat import ChatMessageRead, ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)) -> dict[str, str]:
    """Transcreve audio (Groq Whisper) -> texto, para o prompt do Coach."""
    if not settings.groq_api_key.strip():
        return {"text": ""}
    data = await file.read()
    client = Groq(api_key=settings.groq_api_key)
    tr = client.audio.transcriptions.create(
        file=(file.filename or "audio.m4a", data),
        model="whisper-large-v3-turbo",
        language="pt",
    )
    return {"text": tr.text.strip()}


@router.post("", response_model=ChatResponse)
def chat(data: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    out = runner.run_chat(db, data.message.strip())
    return ChatResponse(**out)


@router.get("/history", response_model=list[ChatMessageRead])
def history(db: Session = Depends(get_db)) -> list[ChatMessageRead]:
    return [ChatMessageRead(**m) for m in runner.get_history(db)]


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear(db: Session = Depends(get_db)) -> None:
    runner.clear_history(db)
