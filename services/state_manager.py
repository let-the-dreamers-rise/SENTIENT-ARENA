"""
Sentient Arena — State Manager
In-memory game state with optional JSON file persistence.
Manages character states, boss state, battle history, and player tendencies.
"""

from __future__ import annotations
import json, os, copy
from typing import Optional

from models.schemas import (
    CharacterState, BossState, Personality, VoiceProfile, VisualAura,
    BaseStats, Emotions, BehaviorBias, Ability, PlayerTendencyScores,
    BossAdaptation, BossPersonality, MemoryEntry,
)


# ─── Default Character Definitions ──────────────────────────

_DEFAULT_CHARACTERS: list[dict] = [
    {
        "character_id": "VEX",
        "display_name": "Vex",
        "class": "Striker",
        "base_stats": {"max_health": 100, "current_health": 100, "attack": 18, "defense": 10, "speed": 14},
        "personality": {
            "archetype": "reckless_aggressor",
            "traits": ["impulsive", "loyal", "sarcastic", "adrenaline-junkie", "secretly-insecure"],
            "speech_style": "short punchy sentences, uses slang, occasionally self-deprecating, drops one-liners mid-combat",
        },
        "emotions": {"confidence": 0.7, "stress": 0.3, "trust_in_team": 0.6, "morale": 0.65},
        "behavior_bias": {"aggression": 0.8, "caution": 0.2, "support_tendency": 0.1},
        "voice_profile": {"elevenlabs_voice_id": "pNInz6obpgDQGcFmaJgB", "stability": 0.5, "similarity_boost": 0.75},
        "visual_aura": {
            "base_color_hex": "#00FFFF",
            "intensity_driver": "confidence",
            "pulse_speed_driver": "stress",
            "color_shift_rules": {
                "confidence_below_0.3": "#FF4444",
                "stress_above_0.8": "#FFAA00",
                "morale_above_0.9": "#00FF88",
            },
        },
        "abilities": [
            {"name": "Volt Strike", "damage": 25, "cooldown": 2, "type": "offensive",
             "description": "Lightning-charged melee strike", "effect": "stress_target_+0.05"},
            {"name": "Neon Dash", "damage": 18, "cooldown": 1, "type": "offensive",
             "description": "High-speed gap closer, ignores 50% defense", "effect": "ignore_half_defense"},
            {"name": "Shield Pulse", "damage": 0, "cooldown": 3, "type": "defensive",
             "description": "Electromagnetic barrier that blocks incoming damage", "effect": "block_15"},
            {"name": "Overclock", "damage": 35, "cooldown": 4, "type": "offensive",
             "description": "Pushes systems past limits — massive damage but increases own stress",
             "effect": "self_stress_+0.1", "trigger_condition": ""},
            {"name": "Desperation Blitz", "damage": 50, "cooldown": 6, "type": "offensive",
             "description": "Last-resort attack that scales with missing health — maximum damage at low HP",
             "effect": "scales_with_missing_hp", "trigger_condition": "health_below_30_percent"},
        ],
    },
    {
        "character_id": "LYRA",
        "display_name": "Lyra",
        "class": "Support",
        "base_stats": {"max_health": 90, "current_health": 90, "attack": 10, "defense": 12, "speed": 12},
        "personality": {
            "archetype": "calm_strategist",
            "traits": ["analytical", "compassionate", "measured", "philosophical", "quietly-fierce"],
            "speech_style": "measured and warm, uses precise language, occasionally philosophical, quietly motivational",
        },
        "emotions": {"confidence": 0.6, "stress": 0.3, "trust_in_team": 0.8, "morale": 0.7},
        "behavior_bias": {"aggression": 0.2, "caution": 0.5, "support_tendency": 0.8},
        "voice_profile": {"elevenlabs_voice_id": "21m00Tcm4TlvDq8ikWAM", "stability": 0.6, "similarity_boost": 0.8},
        "visual_aura": {
            "base_color_hex": "#AA44FF",
            "intensity_driver": "confidence",
            "pulse_speed_driver": "stress",
            "color_shift_rules": {
                "confidence_below_0.3": "#FF4444",
                "stress_above_0.8": "#FFAA00",
                "morale_above_0.9": "#00FF88",
            },
        },
        "abilities": [
            {"name": "Nano Heal", "damage": 0, "cooldown": 2, "type": "support",
             "description": "Nanobots repair target's wounds", "effect": "heal_25"},
            {"name": "Mind Lance", "damage": 15, "cooldown": 1, "type": "offensive",
             "description": "Psychic projectile that disrupts target's focus", "effect": "reduce_target_attack_10%"},
            {"name": "Mass Restore", "damage": 0, "cooldown": 4, "type": "support",
             "description": "Heals entire team with a wave of restorative energy", "effect": "heal_all_15"},
            {"name": "Neural Link", "damage": 0, "cooldown": 3, "type": "support",
             "description": "Boosts an ally's confidence and removes stress", "effect": "boost_confidence_0.15_reduce_stress_0.1"},
            {"name": "Psychic Storm", "damage": 30, "cooldown": 5, "type": "offensive",
             "description": "Unleashes accumulated psychic energy — damage scales with team morale",
             "effect": "scales_with_team_morale", "trigger_condition": "team_morale_above_0.7"},
        ],
    },
    {
        "character_id": "KAEL",
        "display_name": "Kael",
        "class": "Tank",
        "base_stats": {"max_health": 140, "current_health": 140, "attack": 12, "defense": 20, "speed": 7},
        "personality": {
            "archetype": "stoic_protector",
            "traits": ["stoic", "protective", "laconic", "duty-bound", "hidden-warmth"],
            "speech_style": "very few words, deadpan delivery, protective of teammates, rare moments of dry humor",
        },
        "emotions": {"confidence": 0.6, "stress": 0.2, "trust_in_team": 0.7, "morale": 0.6},
        "behavior_bias": {"aggression": 0.3, "caution": 0.7, "support_tendency": 0.5},
        "voice_profile": {"elevenlabs_voice_id": "AZnzlk1XvdvUeBnXmlld", "stability": 0.7, "similarity_boost": 0.65},
        "visual_aura": {
            "base_color_hex": "#4488FF",
            "intensity_driver": "confidence",
            "pulse_speed_driver": "stress",
            "color_shift_rules": {
                "confidence_below_0.3": "#FF4444",
                "stress_above_0.8": "#FFAA00",
                "morale_above_0.9": "#00FF88",
            },
        },
        "abilities": [
            {"name": "Iron Wall", "damage": 0, "cooldown": 2, "type": "defensive",
             "description": "Deploys a team-wide barrier that absorbs damage", "effect": "team_block_12"},
            {"name": "Seismic Slam", "damage": 22, "cooldown": 3, "type": "offensive",
             "description": "Ground-shaking attack that stuns the target", "effect": "stun_1_turn"},
            {"name": "Fortress", "damage": 0, "cooldown": 4, "type": "defensive",
             "description": "Becomes immovable — reduces incoming damage by 70% for 2 turns",
             "effect": "reduce_damage_70%_2turns"},
            {"name": "Tectonic Shatter", "damage": 28, "cooldown": 4, "type": "offensive",
             "description": "Shatters the ground beneath the enemy — AOE damage to all enemies",
             "effect": "aoe_ground"},
            {"name": "Last Stand", "damage": 0, "cooldown": 8, "type": "defensive",
             "description": "Sacrifices own HP to fully heal lowest-health ally and grant them immunity for 1 turn",
             "effect": "sacrifice_40hp_heal_ally_full_immunity_1turn", "trigger_condition": "ally_health_below_20_percent"},
        ],
    },
]

_DEFAULT_BOSS: dict = {
    "boss_id": "NEXUS_PRIME",
    "display_name": "Nexus Prime",
    "base_stats": {"max_health": 350, "current_health": 350, "attack": 24, "defense": 16, "speed": 9},
    "phase": 1,
    "adaptation": {
        "player_tendency_scores": {
            "aggression_frequency": 0.0,
            "defensive_frequency": 0.0,
            "support_frequency": 0.0,
            "most_targeted_character": "",
            "most_used_ability_type": "offensive",
        },
        "current_strategy": "balanced",
        "counter_abilities": [],
        "difficulty_scalar": 1.0,
    },
    "boss_abilities": [
        {"name": "Void Slam", "damage": 35, "cooldown": 3, "type": "aoe",
         "description": "Slams the arena floor, sending shockwaves that hit all characters"},
        {"name": "Mind Spike", "damage": 22, "cooldown": 1, "type": "single",
         "description": "A focused psychic attack that increases target's stress", "effect": "stress_+0.15"},
        {"name": "Data Drain", "damage": 18, "cooldown": 2, "type": "single",
         "description": "Steals confidence from target", "effect": "steal_confidence_0.1"},
        {"name": "Null Shield", "damage": 0, "cooldown": 4, "type": "defensive",
         "description": "Generates a void barrier that absorbs damage", "effect": "block_25"},
        {"name": "Reality Collapse", "damage": 50, "cooldown": 6, "type": "ultimate",
         "description": "Tears reality apart — ignores all defense", "effect": "true_damage",
         "trigger_condition": "health_below_30_percent"},
    ],
    "personality": {"tone": "cold_calculating", "taunt_style": "psychological, targets weakest emotional state, evolves taunts based on battle performance"},
    "phase_data": {
        "phases": [
            {"phase": 1, "name": "Sentinel", "health_threshold": 1.0, "color": "#FF4488",
             "arena_effect": "normal", "taunt": "You dare challenge Nexus Prime? How... quaint."},
            {"phase": 2, "name": "Rage Protocol", "health_threshold": 0.65, "color": "#FF6600",
             "arena_effect": "fire_floor", "damage_multiplier": 1.4,
             "taunt": "RAGE PROTOCOL ACTIVATED. You will regret every point of damage."},
            {"phase": 3, "name": "Singularity", "health_threshold": 0.30, "color": "#CC0000",
             "arena_effect": "gravity_distort", "damage_multiplier": 1.8,
             "taunt": "SINGULARITY ENGAGED. I will collapse reality around you."},
        ],
    },
    "combo_definitions": [
        {"name": "Neon Convergence", "characters": ["VEX", "LYRA"], "trust_threshold": 0.65,
         "damage": 65, "cooldown": 5, "description": "Vex charges while Lyra amplifies — devastating focused beam"},
        {"name": "Thunderstrike Protocol", "characters": ["VEX", "KAEL"], "trust_threshold": 0.6,
         "damage": 55, "cooldown": 4, "description": "Kael shields Vex who launches through for a barrier-breaking strike"},
        {"name": "Phoenix Guard", "characters": ["LYRA", "KAEL"], "trust_threshold": 0.7,
         "damage": 35, "cooldown": 6, "description": "Lyra heals while Kael retaliates — damage + full team heal",
         "effect": "damage+heal_all_25"},
        {"name": "Sentient Resonance", "characters": ["VEX", "LYRA", "KAEL"], "trust_threshold": 0.85,
         "damage": 120, "cooldown": 10, "description": "ALL THREE unite — reality-shattering burst of combined consciousness"},
    ],
}



class StateManager:
    """In-memory state container for one game session."""

    def __init__(self) -> None:
        self.characters: dict[str, CharacterState] = {}
        self.boss: Optional[BossState] = None
        self.battle_history: list[dict] = []
        self.active_mutations: list[dict] = []
        self._player_actions: list[dict] = []
        self._init_defaults()

    # ── Initialization ────────────────────────────────────────

    def _init_defaults(self) -> None:
        for cdata in _DEFAULT_CHARACTERS:
            char = CharacterState(**cdata)
            self.characters[char.character_id] = char
        self.boss = BossState(**_DEFAULT_BOSS)

    def reset(self) -> None:
        self.characters.clear()
        self.boss = None
        self.battle_history.clear()
        self.active_mutations.clear()
        self._player_actions.clear()
        self._init_defaults()

    # ── Character Access ──────────────────────────────────────

    def get_character(self, character_id: str) -> Optional[CharacterState]:
        return self.characters.get(character_id.upper())

    def get_all_characters(self) -> list[CharacterState]:
        return list(self.characters.values())

    # ── Emotion Helpers ───────────────────────────────────────

    def update_emotions(self, character_id: str, emotions: Emotions) -> None:
        char = self.get_character(character_id)
        if char:
            char.emotions = emotions

    def clamp_emotions(self, emotions: Emotions) -> Emotions:
        return Emotions(
            confidence=max(0.0, min(1.0, emotions.confidence)),
            stress=max(0.0, min(1.0, emotions.stress)),
            trust_in_team=max(0.0, min(1.0, emotions.trust_in_team)),
            morale=max(0.0, min(1.0, emotions.morale)),
        )

    # ── Memory ────────────────────────────────────────────────

    def add_memory(self, character_id: str, entry: MemoryEntry) -> None:
        char = self.get_character(character_id)
        if char:
            char.memory.append(entry)
            if len(char.memory) > 20:
                char.memory = char.memory[-20:]

    def get_recent_memories(self, character_id: str, count: int = 5) -> list[MemoryEntry]:
        char = self.get_character(character_id)
        if not char:
            return []
        return char.memory[-count:]

    # ── Player Tendency Tracking ──────────────────────────────

    def record_action(self, action: dict) -> None:
        """Record a player action for tendency analysis.
        action: {"type": "offensive"|"defensive"|"support", "target": "VEX", "ability_type": "offensive"}
        """
        self._player_actions.append(action)

    def compute_tendencies(self) -> PlayerTendencyScores:
        total = len(self._player_actions)
        if total == 0:
            return PlayerTendencyScores()

        offensive = sum(1 for a in self._player_actions if a.get("type") == "offensive")
        defensive = sum(1 for a in self._player_actions if a.get("type") == "defensive")
        support = sum(1 for a in self._player_actions if a.get("type") == "support")

        target_freq: dict[str, int] = {}
        ability_freq: dict[str, int] = {}
        for a in self._player_actions:
            t = a.get("target", "")
            if t:
                target_freq[t] = target_freq.get(t, 0) + 1
            at = a.get("ability_type", "")
            if at:
                ability_freq[at] = ability_freq.get(at, 0) + 1

        most_targeted = max(target_freq, key=target_freq.get) if target_freq else ""
        most_used = max(ability_freq, key=ability_freq.get) if ability_freq else "offensive"

        return PlayerTendencyScores(
            aggression_frequency=round(offensive / total, 3),
            defensive_frequency=round(defensive / total, 3),
            support_frequency=round(support / total, 3),
            most_targeted_character=most_targeted,
            most_used_ability_type=most_used,
        )

    # ── Boss ──────────────────────────────────────────────────

    def get_boss(self) -> Optional[BossState]:
        return self.boss

    def update_boss_strategy(self, strategy: str, counter_abilities: list[Ability], scalar: float) -> None:
        if self.boss:
            self.boss.adaptation.current_strategy = strategy
            self.boss.adaptation.counter_abilities = counter_abilities
            self.boss.adaptation.difficulty_scalar = scalar

    # ── Persistence (optional — bonus feature) ────────────────

    def save_to_file(self, path: str = "game_state.json") -> None:
        data = {
            "characters": {cid: c.model_dump(by_alias=True) for cid, c in self.characters.items()},
            "boss": self.boss.model_dump() if self.boss else None,
            "battle_history": self.battle_history,
            "active_mutations": self.active_mutations,
        }
        with open(path, "w") as f:
            json.dump(data, f, indent=2)

    def load_from_file(self, path: str = "game_state.json") -> bool:
        if not os.path.exists(path):
            return False
        with open(path) as f:
            data = json.load(f)
        for cid, cdata in data.get("characters", {}).items():
            self.characters[cid] = CharacterState(**cdata)
        bdata = data.get("boss")
        if bdata:
            self.boss = BossState(**bdata)
        self.battle_history = data.get("battle_history", [])
        self.active_mutations = data.get("active_mutations", [])
        return True


# ── Singleton instance ────────────────────────────────────────
state = StateManager()
