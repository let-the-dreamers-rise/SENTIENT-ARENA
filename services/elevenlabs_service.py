"""
Sentient Arena — ElevenLabs Voice Synthesis Service
Text → ElevenLabs API → MP3 file → served as static URL.
"""

from __future__ import annotations
import os, uuid, logging
import httpx

logger = logging.getLogger("sentient.elevenlabs")

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
AUDIO_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

# Use turbo model for lower latency
TTS_MODEL = "eleven_turbo_v2"


async def synthesize_speech(
    text: str,
    voice_id: str,
    stability: float = 0.5,
    similarity_boost: float = 0.75,
) -> str | None:
    """Synthesize speech via ElevenLabs. Returns filename on success, None on failure."""

    if not ELEVENLABS_API_KEY:
        logger.warning("ELEVENLABS_API_KEY not set — skipping voice synthesis.")
        return None

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    body = {
        "text": text,
        "model_id": TTS_MODEL,
        "voice_settings": {
            "stability": stability,
            "similarity_boost": similarity_boost,
        },
    }

    filename = f"{uuid.uuid4().hex}.mp3"
    filepath = os.path.join(AUDIO_DIR, filename)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=body, headers=headers)
            resp.raise_for_status()
            with open(filepath, "wb") as f:
                f.write(resp.content)
            logger.info(f"Voice synthesized: {filename} ({len(resp.content)} bytes)")
            return filename

    except httpx.TimeoutException:
        logger.error("ElevenLabs request timed out.")
    except httpx.HTTPStatusError as e:
        logger.error(f"ElevenLabs HTTP error {e.response.status_code}: {e.response.text[:200]}")
    except Exception as e:
        logger.error(f"ElevenLabs unexpected error: {e}")

    # Fallback: try standard (non-turbo) model once
    try:
        body["model_id"] = "eleven_monolingual_v1"
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=body, headers=headers)
            resp.raise_for_status()
            with open(filepath, "wb") as f:
                f.write(resp.content)
            logger.info(f"Voice synthesized (fallback model): {filename}")
            return filename
    except Exception as e:
        logger.error(f"ElevenLabs fallback also failed: {e}")

    return None


async def synthesize_or_skip(text: str, voice_id: str, stability: float = 0.5, similarity_boost: float = 0.75) -> str:
    """Convenience wrapper: returns audio URL path or empty string."""
    filename = await synthesize_speech(text, voice_id, stability, similarity_boost)
    if filename:
        return f"/static/audio/{filename}"
    return ""
