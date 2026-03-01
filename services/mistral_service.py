"""
Sentient Arena — Mistral AI Service
Wraps Mistral chat completions with JSON enforcement, retry, and fallback.
Uses mistralai SDK v1.x (async client).
"""

from __future__ import annotations
import json, os, logging
from mistralai import Mistral

logger = logging.getLogger("sentient.mistral")

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MODEL = "mistral-small-latest"  # Good balance of speed + quality for hackathon


async def call_mistral_json(
    system_prompt: str,
    user_prompt: str,
    fallback: dict | None = None,
    max_retries: int = 2,
) -> dict:
    """Call Mistral and parse the JSON response. Retries on parse failure.
    Returns parsed dict or fallback if all retries fail.
    """
    if not MISTRAL_API_KEY:
        logger.warning("MISTRAL_API_KEY not set — returning fallback immediately.")
        return fallback or {}

    client = Mistral(api_key=MISTRAL_API_KEY)
    raw = ""

    for attempt in range(max_retries):
        try:
            response = await client.chat.complete_async(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
                max_tokens=1024,
            )

            raw = response.choices[0].message.content.strip()
            parsed = json.loads(raw)
            return parsed

        except json.JSONDecodeError as e:
            logger.warning(f"Mistral JSON parse error (attempt {attempt + 1}): {e}")
            logger.debug(f"Raw response: {raw}")
        except Exception as e:
            logger.error(f"Mistral API error (attempt {attempt + 1}): {e}")

    logger.error("All Mistral retries exhausted, returning fallback.")
    return fallback or {}


# ─── Prompt Builders ──────────────────────────────────────────

def build_dialogue_system_prompt(char_state: dict) -> str:
    p = char_state.get("personality", {})
    e = char_state.get("emotions", {})
    recent_mem = char_state.get("memory", [])[-5:]

    memories_text = "\n".join(
        f"- Turn {m.get('turn', '?')}: {m.get('event', '')} → {m.get('summary', '')}"
        for m in recent_mem
    ) or "No recent memories."

    return f"""You are {char_state['display_name']}, a {char_state.get('class', 'fighter')} with a {p.get('archetype', 'neutral')} personality.
Your traits: {', '.join(p.get('traits', []))}. Speech style: {p.get('speech_style', 'normal')}.

Current emotional state:
- Confidence: {e.get('confidence', 0.5)}
- Stress: {e.get('stress', 0.5)}
- Trust in team: {e.get('trust_in_team', 0.5)}
- Morale: {e.get('morale', 0.5)}

Recent memories:
{memories_text}

Rules:
- Stay in character at all times
- Reflect your emotional state in tone and word choice
- If stressed, be shorter and more tense
- If confident, be bolder
- Reference specific memories when relevant
- Keep responses under 3 sentences
- You MUST respond with valid JSON only

Respond as JSON:
{{
  "reply_text": "<your in-character response>",
  "emotion_delta": {{"confidence": <float>, "stress": <float>, "trust_in_team": <float>, "morale": <float>}},
  "suggested_action": "<what you'd suggest the player do next>",
  "memory_entry": {{"event": "player_conversation", "summary": "<1-line summary>", "emotional_impact": {{<deltas>}}}}
}}"""


def build_dialogue_user_prompt(player_message: str) -> str:
    return f'The player says: "{player_message}"'


def build_emotion_system_prompt(char_state: dict, battle_result: str, battle_events: list[dict]) -> str:
    p = char_state.get("personality", {})
    e = char_state.get("emotions", {})
    stats = char_state.get("base_stats", {})

    events_text = "\n".join(
        f"- Turn {ev.get('turn', '?')}: {ev.get('event', '')} — {ev.get('summary', '')}"
        for ev in battle_events
    ) or "No events recorded."

    return f"""You are the emotional processing engine for {char_state['display_name']}.
Personality: {p.get('archetype', 'neutral')}, traits: {', '.join(p.get('traits', []))}.

Battle result: {battle_result}
Battle events for this character:
{events_text}

Current emotional state:
- Confidence: {e.get('confidence', 0.5)}
- Stress: {e.get('stress', 0.5)}
- Trust in team: {e.get('trust_in_team', 0.5)}
- Morale: {e.get('morale', 0.5)}

Current stats: HP {stats.get('current_health', 100)}/{stats.get('max_health', 100)}, ATK {stats.get('attack', 10)}, DEF {stats.get('defense', 10)}, SPD {stats.get('speed', 10)}

Rules:
- Adjust each emotion value by -0.3 to +0.3 max per recalibration
- Provide reasoning for each shift
- Calculate stat modifiers: attack_modifier, defense_modifier, speed_modifier (range -0.2 to +0.2)
- Compute visual aura update: color_hex, intensity (0-2), pulse_speed (0.5-3)
- You MUST respond with valid JSON only

Respond as JSON:
{{
  "character_id": "{char_state['character_id']}",
  "previous_emotions": {json.dumps(e)},
  "updated_emotions": {{"confidence": <float>, "stress": <float>, "trust_in_team": <float>, "morale": <float>}},
  "reasoning": "<explanation>",
  "stat_modifiers": {{"attack_modifier": <float>, "defense_modifier": <float>, "speed_modifier": <float>}},
  "visual_aura_update": {{"color_hex": "<hex>", "intensity": <float>, "pulse_speed": <float>}}
}}"""


def build_boss_system_prompt(boss_state: dict, tendencies: dict) -> str:
    abilities_text = json.dumps(boss_state.get("boss_abilities", []), indent=2)

    return f"""You are the tactical AI core of boss "{boss_state.get('display_name', 'Boss')}".
Current phase: {boss_state.get('phase', 1)}. Current HP: {boss_state['base_stats']['current_health']}/{boss_state['base_stats']['max_health']}.

Player tendency analysis:
- Aggression frequency: {tendencies.get('aggression_frequency', 0)}
- Defensive frequency: {tendencies.get('defensive_frequency', 0)}
- Support frequency: {tendencies.get('support_frequency', 0)}
- Most targeted character: {tendencies.get('most_targeted_character', 'unknown')}
- Most used ability type: {tendencies.get('most_used_ability_type', 'offensive')}

Current boss abilities:
{abilities_text}

Rules:
- Choose a strategy: "punish_aggression", "break_defense", or "pressure_support"
- Generate 1-2 counter abilities that address the dominant player pattern
- Each ability must have: name (str), damage (int 15-45), cooldown (int 1-4), type (str), effect (str or null)
- Keep difficulty reasonable — challenge, not annihilate
- You MUST respond with valid JSON only

Respond as JSON:
{{
  "current_strategy": "<strategy>",
  "counter_abilities": [<ability objects>],
  "difficulty_scalar": <float 1.0-1.5>,
  "taunt": "<one-liner the boss says>"
}}"""


def build_ability_system_prompt(char_state: dict, battle_context: list[dict], player_prompt: str) -> str:
    p = char_state.get("personality", {})
    e = char_state.get("emotions", {})
    abilities = json.dumps(char_state.get("abilities", []), indent=2)

    context_text = "\n".join(
        f"- Turn {ev.get('turn', '?')}: {ev.get('event', '')} — {ev.get('summary', '')}"
        for ev in battle_context[-3:]
    ) or "No recent context."

    prompt_instruction = ""
    if player_prompt:
        prompt_instruction = f"\nPLAYER'S TACTICAL COMMAND: \"{player_prompt}\"\nYou MUST design an ability that directly fulfills this tactical command while remaining in-character."

    return f"""Generate a new ability for {char_state['display_name']} ({char_state.get('class', 'fighter')}, {p.get('archetype', 'neutral')}).
{prompt_instruction}

Current emotional state:
- Confidence: {e.get('confidence', 0.5)}, Stress: {e.get('stress', 0.5)}, Morale: {e.get('morale', 0.5)}

Current abilities:
{abilities}

Battle context:
{context_text}

Rules:
- The ability must thematically fit the character's personality
- It should be emotionally gated (require a specific emotional threshold)
- Damage range: 20-50
- Include a trigger condition (e.g., "health_below_30_percent")
- Provide reasoning for why this ability emerged
- You MUST respond with valid JSON only

Respond as JSON:
{{
  "character_id": "{char_state['character_id']}",
  "new_ability": {{
    "name": "<ability name>",
    "description": "<1-line description>",
    "damage": <int>,
    "cooldown": <int>,
    "type": "<offensive|defensive|support>",
    "trigger_condition": "<condition>",
    "emotional_requirement": {{"<emotion>_above or _below": <float>}}
  }},
  "reasoning": "<why this ability emerged>"
}}"""


def build_rule_mutation_system_prompt(
    turn_number: int,
    boss_strategy: str,
    avg_conf: float,
    avg_stress: float,
    avg_morale: float,
    active_mutations: list[dict],
) -> str:
    mutations_text = json.dumps(active_mutations, indent=2) if active_mutations else "None"

    return f"""You are the rule engine for Sentient Arena.

Current battle state:
- Turn: {turn_number}
- Boss strategy: {boss_strategy}
- Team emotional averages: confidence={avg_conf:.2f}, stress={avg_stress:.2f}, morale={avg_morale:.2f}

Active mutations:
{mutations_text}

Rules:
- Generate ONE new rule mutation
- Types: "combat_modifier", "emotional_modifier", "environmental_effect"
- It must be interesting but not game-breaking
- Must be reversible
- Include clear trigger and effect
- You MUST respond with valid JSON only

Respond as JSON:
{{
  "mutation_id": "MUT_<number>",
  "rule_type": "<type>",
  "description": "<human-readable rule description>",
  "affected_scope": "all_characters" or "<character_id>",
  "parameters": {{
    "trigger": "<condition>",
    "effect": "<effect name>",
    "value": <numeric value>,
    "duration_turns": <int>
  }},
  "reasoning": "<why this mutation emerged>",
  "reversible": true
}}"""
