"""
Sentient Arena — Pydantic Schemas
All JSON contracts between UE5 ↔ Backend ↔ Mistral/ElevenLabs.
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional


# ─── Sub-models ───────────────────────────────────────────────

class BaseStats(BaseModel):
    max_health: int = 100
    current_health: int = 100
    attack: int = 15
    defense: int = 10
    speed: int = 10


class Personality(BaseModel):
    archetype: str
    traits: list[str]
    speech_style: str


class Emotions(BaseModel):
    confidence: float = Field(0.5, ge=0.0, le=1.0)
    stress: float = Field(0.5, ge=0.0, le=1.0)
    trust_in_team: float = Field(0.5, ge=0.0, le=1.0)
    morale: float = Field(0.5, ge=0.0, le=1.0)


class EmotionDelta(BaseModel):
    confidence: float = 0.0
    stress: float = 0.0
    trust_in_team: float = 0.0
    morale: float = 0.0


class MemoryEntry(BaseModel):
    turn: Optional[int] = None
    event: str
    target: Optional[str] = None
    summary: str = ""
    emotional_impact: dict[str, float] = {}


class BehaviorBias(BaseModel):
    aggression: float = Field(0.5, ge=0.0, le=1.0)
    caution: float = Field(0.5, ge=0.0, le=1.0)
    support_tendency: float = Field(0.3, ge=0.0, le=1.0)


class VoiceProfile(BaseModel):
    elevenlabs_voice_id: str
    stability: float = 0.5
    similarity_boost: float = 0.75


class VisualAura(BaseModel):
    base_color_hex: str = "#00FFFF"
    intensity_driver: str = "confidence"
    pulse_speed_driver: str = "stress"
    color_shift_rules: dict[str, str] = {}


class AuraUpdate(BaseModel):
    color_hex: str
    intensity: float
    pulse_speed: float


class Ability(BaseModel):
    name: str
    damage: int = 0
    cooldown: int = 1
    type: str = "offensive"  # offensive | defensive | support
    effect: Optional[str] = None
    trigger_condition: Optional[str] = None
    emotional_requirement: Optional[dict[str, float]] = None
    description: Optional[str] = None


class StatModifiers(BaseModel):
    attack_modifier: float = 0.0
    defense_modifier: float = 0.0
    speed_modifier: float = 0.0


class PlayerTendencyScores(BaseModel):
    aggression_frequency: float = 0.0
    defensive_frequency: float = 0.0
    support_frequency: float = 0.0
    most_targeted_character: str = ""
    most_used_ability_type: str = "offensive"


class BossAdaptation(BaseModel):
    player_tendency_scores: PlayerTendencyScores = PlayerTendencyScores()
    current_strategy: str = "balanced"
    counter_abilities: list[Ability] = []
    difficulty_scalar: float = 1.0


class BossPersonality(BaseModel):
    tone: str = "cold_calculating"
    taunt_style: str = "psychological"


# ─── Top-level State Objects ─────────────────────────────────

class CharacterState(BaseModel):
    character_id: str
    display_name: str
    character_class: str = Field(alias="class", default="Striker")
    base_stats: BaseStats = BaseStats()
    personality: Personality
    emotions: Emotions = Emotions()
    memory: list[MemoryEntry] = []
    behavior_bias: BehaviorBias = BehaviorBias()
    voice_profile: VoiceProfile
    visual_aura: VisualAura = VisualAura()
    abilities: list[Ability] = []

    class Config:
        populate_by_name = True


class BossState(BaseModel):
    boss_id: str = "NEXUS_PRIME"
    display_name: str = "Nexus Prime"
    base_stats: BaseStats = BaseStats(max_health=300, current_health=300, attack=22, defense=15, speed=8)
    phase: int = 1
    adaptation: BossAdaptation = BossAdaptation()
    boss_abilities: list[Ability] = []
    personality: BossPersonality = BossPersonality()


# ─── API Request Models ──────────────────────────────────────

class DialogueRequest(BaseModel):
    character_id: str
    player_message: str


class EmotionRecalibrateRequest(BaseModel):
    character_id: str
    battle_result: str  # "win" | "loss"
    battle_events: list[MemoryEntry] = []


class BossAdaptRequest(BaseModel):
    battle_log: list[dict] = []
    player_tendencies: PlayerTendencyScores


class AbilityGenerateRequest(BaseModel):
    character_id: str
    battle_context: list[MemoryEntry] = []
    player_prompt: str = ""


class RuleMutateRequest(BaseModel):
    turn_number: int
    boss_strategy: str
    team_avg_confidence: float
    team_avg_stress: float
    team_avg_morale: float
    active_mutations: list[dict] = []


class VoiceSynthesizeRequest(BaseModel):
    text: str
    voice_id: str
    stability: float = 0.5
    similarity_boost: float = 0.75


# ─── API Response Models ─────────────────────────────────────

class DialogueResponse(BaseModel):
    character_id: str
    reply_text: str
    emotion_delta: EmotionDelta = EmotionDelta()
    suggested_action: str = ""
    memory_entry: Optional[MemoryEntry] = None
    audio_url: str = ""


class EmotionalUpdateResponse(BaseModel):
    character_id: str
    previous_emotions: Emotions
    updated_emotions: Emotions
    reasoning: str = ""
    stat_modifiers: StatModifiers = StatModifiers()
    visual_aura_update: AuraUpdate = AuraUpdate(color_hex="#00FFFF", intensity=1.0, pulse_speed=1.0)


class BossAdaptResponse(BaseModel):
    current_strategy: str
    counter_abilities: list[Ability] = []
    difficulty_scalar: float = 1.0
    taunt: str = ""


class AbilityGenerateResponse(BaseModel):
    character_id: str
    new_ability: Ability
    reasoning: str = ""


class RuleMutationResponse(BaseModel):
    mutation_id: str
    rule_type: str
    description: str
    affected_scope: str = "all_characters"
    parameters: dict = {}
    reasoning: str = ""
    reversible: bool = True


class VoiceSynthesizeResponse(BaseModel):
    audio_url: str
    duration_estimate_ms: int = 0
