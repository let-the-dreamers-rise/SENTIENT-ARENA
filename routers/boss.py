"""
Sentient Arena — Boss Adaptation Router
POST /api/boss/adapt → Mistral boss strategy update
"""

from fastapi import APIRouter
from models.schemas import BossAdaptRequest, BossAdaptResponse, Ability
from services.state_manager import state
from services.mistral_service import call_mistral_json, build_boss_system_prompt

router = APIRouter(prefix="/api/boss", tags=["boss"])


@router.post("/adapt", response_model=BossAdaptResponse)
async def adapt(req: BossAdaptRequest):
    boss = state.get_boss()
    if not boss:
        return BossAdaptResponse(current_strategy="balanced", taunt="...")

    boss_dict = boss.model_dump()
    tendencies_dict = req.player_tendencies.model_dump()

    system_prompt = build_boss_system_prompt(boss_dict, tendencies_dict)

    fallback = {
        "current_strategy": "balanced",
        "counter_abilities": [],
        "difficulty_scalar": 1.0,
        "taunt": "You are predictable.",
    }

    result = await call_mistral_json(system_prompt, "Adapt now.", fallback=fallback)

    strategy = result.get("current_strategy", "balanced")
    scalar = min(1.5, max(1.0, result.get("difficulty_scalar", 1.0)))
    taunt = result.get("taunt", "")

    # Parse counter abilities
    counter_raw = result.get("counter_abilities", [])
    counter_abilities = []
    for ab in counter_raw:
        if isinstance(ab, dict) and "name" in ab:
            counter_abilities.append(Ability(
                name=ab["name"],
                damage=ab.get("damage", 20),
                cooldown=ab.get("cooldown", 2),
                type=ab.get("type", "offensive"),
                effect=ab.get("effect"),
            ))

    # Update boss state
    state.update_boss_strategy(strategy, counter_abilities, scalar)

    # Also update battle history
    state.battle_history.append({
        "event": "boss_adaptation",
        "strategy": strategy,
        "taunt": taunt,
    })

    return BossAdaptResponse(
        current_strategy=strategy,
        counter_abilities=counter_abilities,
        difficulty_scalar=scalar,
        taunt=taunt,
    )
