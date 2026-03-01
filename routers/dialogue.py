"""
Sentient Arena — Dialogue Router
POST /api/dialogue → Mistral character dialogue → ElevenLabs voice → response
"""

from fastapi import APIRouter
from models.schemas import DialogueRequest, DialogueResponse, EmotionDelta, MemoryEntry
from services.state_manager import state
from services.mistral_service import (
    call_mistral_json,
    build_dialogue_system_prompt,
    build_dialogue_user_prompt,
)
from services.elevenlabs_service import synthesize_or_skip

router = APIRouter(prefix="/api", tags=["dialogue"])

# Fallback if Mistral fails
_FALLBACK_REPLIES = {
    "VEX": "...I don't feel like talking right now. Maybe later.",
    "LYRA": "I need a moment to process. Give me time.",
    "KAEL": "...",
}


@router.post("/dialogue", response_model=DialogueResponse)
async def dialogue(req: DialogueRequest):
    char = state.get_character(req.character_id)
    if not char:
        return DialogueResponse(
            character_id=req.character_id,
            reply_text="Character not found.",
        )

    char_dict = char.model_dump(by_alias=True)

    # Call Mistral
    system_prompt = build_dialogue_system_prompt(char_dict)
    user_prompt = build_dialogue_user_prompt(req.player_message)

    fallback = {
        "reply_text": _FALLBACK_REPLIES.get(char.character_id, "..."),
        "emotion_delta": {"confidence": 0, "stress": 0, "trust_in_team": 0, "morale": 0},
        "suggested_action": "try_again_later",
        "memory_entry": {
            "event": "player_conversation",
            "summary": "Player tried to talk but character was unresponsive",
            "emotional_impact": {},
        },
    }

    result = await call_mistral_json(system_prompt, user_prompt, fallback=fallback)

    # Extract fields safely
    reply_text = result.get("reply_text", fallback["reply_text"])
    delta_raw = result.get("emotion_delta", {})
    emotion_delta = EmotionDelta(
        confidence=delta_raw.get("confidence", 0),
        stress=delta_raw.get("stress", 0),
        trust_in_team=delta_raw.get("trust_in_team", 0),
        morale=delta_raw.get("morale", 0),
    )
    suggested_action = result.get("suggested_action", "")

    # Apply emotion delta
    new_emotions = char.emotions.model_copy()
    new_emotions.confidence = max(0, min(1, new_emotions.confidence + emotion_delta.confidence))
    new_emotions.stress = max(0, min(1, new_emotions.stress + emotion_delta.stress))
    new_emotions.trust_in_team = max(0, min(1, new_emotions.trust_in_team + emotion_delta.trust_in_team))
    new_emotions.morale = max(0, min(1, new_emotions.morale + emotion_delta.morale))
    state.update_emotions(char.character_id, state.clamp_emotions(new_emotions))

    # Add memory entry
    mem_raw = result.get("memory_entry", fallback["memory_entry"])
    memory = MemoryEntry(
        event=mem_raw.get("event", "player_conversation"),
        summary=mem_raw.get("summary", "Player talked to character"),
        emotional_impact=mem_raw.get("emotional_impact", {}),
    )
    state.add_memory(char.character_id, memory)

    # Voice synthesis
    audio_url = await synthesize_or_skip(
        text=reply_text,
        voice_id=char.voice_profile.elevenlabs_voice_id,
        stability=char.voice_profile.stability,
        similarity_boost=char.voice_profile.similarity_boost,
    )

    return DialogueResponse(
        character_id=char.character_id,
        reply_text=reply_text,
        emotion_delta=emotion_delta,
        suggested_action=suggested_action,
        memory_entry=memory,
        audio_url=audio_url,
    )
