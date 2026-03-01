"""
Sentient Arena — Ability Generation Router
POST /api/ability/generate → Mistral generates new character abilities
Smart fallback when no API key is set.
"""

import random, re
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from models.schemas import AbilityGenerateResponse, Ability
from services.state_manager import state
from services.mistral_service import call_mistral_json, build_ability_system_prompt

router = APIRouter(prefix="/api/ability", tags=["ability"])


# Flexible request model that accepts arbitrary battle_context dicts
class SynapseRequest(BaseModel):
    character_id: str
    battle_context: list[dict] = []
    player_prompt: str = ""


# ─── Smart Fallback Generator ────────────────────────────
PROMPT_THEMES = {
    "fire": {"names": ["Inferno Burst", "Pyro Cascade", "Flame Vortex"], "type": "offensive", "dmg": (30, 45)},
    "ice": {"names": ["Cryo Shatter", "Frost Nova", "Glacial Spike"], "type": "offensive", "dmg": (25, 40)},
    "heal": {"names": ["Vital Surge", "Quantum Mend", "Photon Restore"], "type": "support", "dmg": (0, 0)},
    "shield": {"names": ["Aegis Protocol", "Barrier Matrix", "Fortress Shell"], "type": "defensive", "dmg": (0, 0)},
    "lightning": {"names": ["Skyfall Voltage", "Thunderclap Surge", "Ion Storm"], "type": "offensive", "dmg": (35, 50)},
    "dark": {"names": ["Void Rend", "Shadow Eater", "Abyssal Tear"], "type": "offensive", "dmg": (30, 45)},
    "speed": {"names": ["Chrono Slash", "Temporal Strike", "Phase Rush"], "type": "offensive", "dmg": (20, 35)},
    "aoe": {"names": ["Seismic Pulse", "Shockwave Nova", "Blast Radius"], "type": "offensive", "dmg": (25, 40)},
    "buff": {"names": ["Neural Overclock", "Adrenaline Spike", "War Cry"], "type": "support", "dmg": (0, 0)},
}

DEFAULT_THEME = {"names": ["Synapse Overload", "Neural Spike", "Data Breach", "Glitch Strike"], "type": "offensive", "dmg": (25, 40)}


def smart_fallback(player_prompt: str, char_name: str) -> dict:
    """Generate a thematic fallback ability based on keywords in the player's prompt."""
    prompt_lower = player_prompt.lower()
    theme = DEFAULT_THEME
    matched_key = "neural"

    for key, t in PROMPT_THEMES.items():
        if key in prompt_lower:
            theme = t
            matched_key = key
            break

    # Also check for common synonyms
    synonym_map = {
        "burn": "fire", "flame": "fire", "blaze": "fire",
        "freeze": "ice", "cold": "ice", "frost": "ice",
        "cure": "heal", "restore": "heal", "mend": "heal", "recovery": "heal",
        "protect": "shield", "guard": "shield", "block": "shield", "defense": "shield",
        "thunder": "lightning", "electric": "lightning", "shock": "lightning", "volt": "lightning",
        "shadow": "dark", "void": "dark", "death": "dark",
        "fast": "speed", "quick": "speed", "rush": "speed",
        "explode": "aoe", "blast": "aoe", "nuke": "aoe", "massive": "aoe",
        "boost": "buff", "empower": "buff", "strength": "buff",
    }
    for word, key in synonym_map.items():
        if word in prompt_lower and key in PROMPT_THEMES:
            theme = PROMPT_THEMES[key]
            matched_key = key
            break

    name = random.choice(theme["names"])
    dmg = random.randint(*theme["dmg"]) if theme["dmg"][1] > 0 else 0
    ab_type = theme["type"]

    desc = f"{char_name}'s neural core synthesized this {matched_key}-type adaptation."
    if player_prompt:
        desc = f"Born from tactical command: \"{player_prompt[:60]}\""

    return {
        "character_id": "",
        "new_ability": {
            "name": name,
            "description": desc,
            "damage": dmg,
            "cooldown": random.choice([2, 3]),
            "type": ab_type,
            "trigger_condition": None,
            "emotional_requirement": None,
        },
        "reasoning": f"Synapse Link synthesized a {matched_key}-themed ability from the player's tactical command.",
    }


@router.post("/generate", response_model=AbilityGenerateResponse)
async def generate(req: SynapseRequest):
    char = state.get_character(req.character_id)
    if not char:
        return AbilityGenerateResponse(
            character_id=req.character_id,
            new_ability=Ability(name="Error", damage=0, cooldown=99),
            reasoning="Character not found.",
        )

    char_dict = char.model_dump(by_alias=True)
    char_name = char.display_name

    # Build smart fallback using player prompt
    fallback = smart_fallback(req.player_prompt, char_name)
    fallback["character_id"] = char.character_id

    # Try Mistral first (will use fallback if no API key)
    system_prompt = build_ability_system_prompt(char_dict, req.battle_context, req.player_prompt)
    result = await call_mistral_json(system_prompt, "Generate now.", fallback=fallback)

    # Parse the new ability
    ab_raw = result.get("new_ability", fallback["new_ability"])
    new_ability = Ability(
        name=ab_raw.get("name", "Unknown"),
        description=ab_raw.get("description", ""),
        damage=ab_raw.get("damage", 20),
        cooldown=ab_raw.get("cooldown", 3),
        type=ab_raw.get("type", "offensive"),
        trigger_condition=ab_raw.get("trigger_condition"),
        emotional_requirement=ab_raw.get("emotional_requirement"),
    )

    # Add to character's ability list
    char.abilities.append(new_ability)

    return AbilityGenerateResponse(
        character_id=char.character_id,
        new_ability=new_ability,
        reasoning=result.get("reasoning", ""),
    )
