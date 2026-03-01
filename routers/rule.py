"""
Sentient Arena — Rule Mutation Router
POST /api/rule/mutate → Mistral generates dynamic combat rule mutations
"""

import uuid
from fastapi import APIRouter
from models.schemas import RuleMutateRequest, RuleMutationResponse
from services.state_manager import state
from services.mistral_service import call_mistral_json, build_rule_mutation_system_prompt

router = APIRouter(prefix="/api/rule", tags=["rule"])


@router.post("/mutate", response_model=RuleMutationResponse)
async def mutate(req: RuleMutateRequest):
    system_prompt = build_rule_mutation_system_prompt(
        turn_number=req.turn_number,
        boss_strategy=req.boss_strategy,
        avg_conf=req.team_avg_confidence,
        avg_stress=req.team_avg_stress,
        avg_morale=req.team_avg_morale,
        active_mutations=req.active_mutations,
    )

    fallback = {
        "mutation_id": f"MUT_{uuid.uuid4().hex[:4].upper()}",
        "rule_type": "combat_modifier",
        "description": "Attacks that miss now grant the attacker a small morale boost.",
        "affected_scope": "all_characters",
        "parameters": {
            "trigger": "attack_miss",
            "effect": "morale_boost",
            "value": 0.05,
            "duration_turns": 3,
        },
        "reasoning": "Fallback mutation to keep combat interesting.",
        "reversible": True,
    }

    result = await call_mistral_json(system_prompt, "Mutate now.", fallback=fallback)

    mutation = RuleMutationResponse(
        mutation_id=result.get("mutation_id", fallback["mutation_id"]),
        rule_type=result.get("rule_type", "combat_modifier"),
        description=result.get("description", fallback["description"]),
        affected_scope=result.get("affected_scope", "all_characters"),
        parameters=result.get("parameters", fallback["parameters"]),
        reasoning=result.get("reasoning", ""),
        reversible=result.get("reversible", True),
    )

    # Track active mutations
    state.active_mutations.append(mutation.model_dump())

    return mutation
