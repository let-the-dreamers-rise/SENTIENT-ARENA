"""
Sentient Arena — Voice Synthesis Router
POST /api/voice/synthesize → ElevenLabs TTS → returns audio URL
"""

from fastapi import APIRouter
from models.schemas import VoiceSynthesizeRequest, VoiceSynthesizeResponse
from services.elevenlabs_service import synthesize_or_skip

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.post("/synthesize", response_model=VoiceSynthesizeResponse)
async def synthesize(req: VoiceSynthesizeRequest):
    audio_url = await synthesize_or_skip(
        text=req.text,
        voice_id=req.voice_id,
        stability=req.stability,
        similarity_boost=req.similarity_boost,
    )

    # Rough estimate: ~80ms per character for TTS audio
    duration_estimate = len(req.text) * 80

    return VoiceSynthesizeResponse(
        audio_url=audio_url,
        duration_estimate_ms=duration_estimate,
    )
