"""
Sentient Arena — Emotion Recalibration Router
POST /api/emotion/recalibrate → Mistral emotional update after battle
"""

from fastapi import APIRouter
from models.schemas import (
    EmotionRecalibrateRequest, EmotionalUpdateResponse,
    Emotions, StatModifiers, AuraUpdate,
)
from services.state_manager import state
from services.mistral_service import call_mistral_json, build_emotion_system_prompt

router = APIRouter(prefix="/api/emotion", tags=["emotion"])


@router.post("/recalibrate", response_model=EmotionalUpdateResponse)
async def recalibrate(req: EmotionRecalibrateRequest):
    char = state.get_character(req.character_id)
    if not char:
        return EmotionalUpdateResponse(
            character_id=req.character_id,
            previous_emotions=Emotions(),
            updated_emotions=Emotions(),
            reasoning="Character not found.",
        )

    char_dict = char.model_dump(by_alias=True)
    events = [e.model_dump() for e in req.battle_events]
    previous = char.emotions.model_copy()

    system_prompt = build_emotion_system_prompt(char_dict, req.battle_result, events)

    fallback = {
        "character_id": char.character_id,
        "previous_emotions": previous.model_dump(),
        "updated_emotions": previous.model_dump(),
        "reasoning": "No recalibration performed (fallback).",
        "stat_modifiers": {"attack_modifier": 0, "defense_modifier": 0, "speed_modifier": 0},
        "visual_aura_update": {
            "color_hex": char.visual_aura.base_color_hex,
            "intensity": 1.0,
            "pulse_speed": 1.0,
        },
    }

    result = await call_mistral_json(system_prompt, "Recalibrate now.", fallback=fallback)

    # Parse updated emotions
    ue = result.get("updated_emotions", {})
    updated = Emotions(
        confidence=max(0, min(1, ue.get("confidence", previous.confidence))),
        stress=max(0, min(1, ue.get("stress", previous.stress))),
        trust_in_team=max(0, min(1, ue.get("trust_in_team", previous.trust_in_team))),
        morale=max(0, min(1, ue.get("morale", previous.morale))),
    )
    state.update_emotions(char.character_id, updated)

    # Parse modifiers
    sm = result.get("stat_modifiers", {})
    modifiers = StatModifiers(
        attack_modifier=sm.get("attack_modifier", 0),
        defense_modifier=sm.get("defense_modifier", 0),
        speed_modifier=sm.get("speed_modifier", 0),
    )

    # Parse aura update
    au = result.get("visual_aura_update", {})
    aura = AuraUpdate(
        color_hex=au.get("color_hex", char.visual_aura.base_color_hex),
        intensity=au.get("intensity", 1.0),
        pulse_speed=au.get("pulse_speed", 1.0),
    )

    return EmotionalUpdateResponse(
        character_id=char.character_id,
        previous_emotions=previous,
        updated_emotions=updated,
        reasoning=result.get("reasoning", ""),
        stat_modifiers=modifiers,
        visual_aura_update=aura,
    )
