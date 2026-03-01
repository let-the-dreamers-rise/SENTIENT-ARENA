// ═══════════════════════════════════════════════════════════
// SENTIENT ARENA — Game Logic
// Combat, abilities, API client, state management, UI updates
// ═══════════════════════════════════════════════════════════

// ─── API Client ──────────────────────────────────────────
const API_BASE = window.location.origin;

export const API = {
    async health() {
        const r = await fetch(`${API_BASE}/health`);
        return r.json();
    },
    async getState() {
        const r = await fetch(`${API_BASE}/api/state`);
        return r.json();
    },
    async resetState() {
        const r = await fetch(`${API_BASE}/api/state/reset`, { method: 'POST' });
        return r.json();
    },
    async dialogue(charId, message, context = 'house') {
        const r = await fetch(`${API_BASE}/api/dialogue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ character_id: charId, player_message: message, context })
        });
        return r.json();
    },
    async recalibrateEmotions(charId, outcome, details) {
        const r = await fetch(`${API_BASE}/api/emotion/recalibrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ character_id: charId, battle_outcome: outcome, event_details: details })
        });
        return r.json();
    },
    async bossAdapt(playerActions, currentPhase) {
        const r = await fetch(`${API_BASE}/api/boss/adapt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_actions_summary: playerActions, boss_current_phase: currentPhase })
        });
        return r.json();
    },
    async generateAbility(charId, situation) {
        const r = await fetch(`${API_BASE}/api/ability/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ character_id: charId, situation_context: situation })
        });
        return r.json();
    },
    async mutateRule(gameState) {
        const r = await fetch(`${API_BASE}/api/rule/mutate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_state_summary: gameState })
        });
        return r.json();
    }
};

// ─── Character Definitions ───────────────────────────────
const CHAR_CONFIG = {
    VEX: {
        name: 'Vex', class: 'Striker', color: '#00FFFF', icon: '⚡',
        position: { x: -3, y: 0, z: 1 }
    },
    LYRA: {
        name: 'Lyra', class: 'Support', color: '#AA44FF', icon: '🔮',
        position: { x: -3, y: 0, z: 0 }
    },
    KAEL: {
        name: 'Kael', class: 'Tank', color: '#4488FF', icon: '🛡',
        position: { x: -3, y: 0, z: -1 }
    }
};

const BOSS_CONFIG = {
    name: 'Nexus Prime', color: '#FF4488', icon: '👾',
    position: { x: 3, y: 0, z: 0 }
};

// ─── Ability Type Colors ─────────────────────────────────
const ABILITY_COLORS = {
    offensive: '#FF4444',
    defensive: '#4488FF',
    support: '#00FF88',
    aoe: '#FFD700'
};

// ─── Status Effect Definitions ───────────────────────────
const STATUS_EFFECTS = {
    burn: { name: 'Burn', icon: '🔥', color: '#FF6600', duration: 3, tickDmg: 8 },
    stun: { name: 'Stun', icon: '⚡', color: '#FFDD00', duration: 1 },
    shield: { name: 'Shield', icon: '🛡', color: '#4488FF', duration: 2, dmgReduce: 0.5 },
    regen: { name: 'Regen', icon: '💚', color: '#00FF88', duration: 3, tickHeal: 10 },
    weaken: { name: 'Weaken', icon: '💀', color: '#884444', duration: 2, dmgMult: 0.7 },
    empower: { name: 'Empower', icon: '⚔', color: '#FFD700', duration: 2, dmgMult: 1.5 }
};

// ─── Combat Commentary ───────────────────────────────────
const COMBAT_LINES = {
    VEX: {
        attack: ['Engaging target!', 'Lightning strikes twice.', 'No hesitation.', 'Feel the surge!'],
        hurt: ['Just a scratch.', 'I can take it.', 'That stung...', 'Not enough to stop me.'],
        kill: ['Target eliminated.', 'One less problem.'],
        low: ['Systems critical...', 'Running on fumes.'],
        combo: ['Together now!', 'Syncing protocols!']
    },
    LYRA: {
        attack: ['Channeling...', 'The void answers.', 'Cosmic alignment.', 'Feel the resonance.'],
        hurt: ['The pain... I feel it.', 'My shield falters.', 'I must endure.'],
        kill: ['Peace at last.', 'The cycle ends.'],
        low: ['Fading... help me.', 'I cannot hold...'],
        combo: ['Our spirits unite!', 'I feel your strength!']
    },
    KAEL: {
        attack: ['For the squad!', 'Heavy impact!', 'Breaking through!', 'Shield slam!'],
        hurt: ['My armor holds.', 'Hit me harder.', 'I am the wall.'],
        kill: ['Threat neutralized.', 'Stand down.'],
        low: ['Armor failing...', 'Still standing...'],
        combo: ['Formation!', 'United we fight!']
    }
};

// ─── Combo Definitions ───────────────────────────────────
const COMBOS = [
    {
        name: 'Neon Convergence', chars: ['VEX', 'LYRA'], trust: 0.65, damage: 65, cooldown: 5,
        desc: 'Devastating focused beam', currentCd: 0
    },
    {
        name: 'Thunderstrike Protocol', chars: ['VEX', 'KAEL'], trust: 0.6, damage: 55, cooldown: 4,
        desc: 'Barrier-breaking strike', currentCd: 0
    },
    {
        name: 'Phoenix Guard', chars: ['LYRA', 'KAEL'], trust: 0.7, damage: 35, cooldown: 6,
        desc: 'Damage + team heal', effect: 'heal_all_25', currentCd: 0
    },
    {
        name: 'Sentient Resonance', chars: ['VEX', 'LYRA', 'KAEL'], trust: 0.85, damage: 120, cooldown: 10,
        desc: 'Reality-shattering ultimate', currentCd: 0
    }
];

// ─── Game State ──────────────────────────────────────────
export class GameState {
    constructor() {
        this.mode = 'loading'; // loading, house, battle, dialogue
        this.characters = {};
        this.boss = {};
        this.turnQueue = [];
        this.currentTurnIndex = 0;
        this.turnNumber = 1;
        this.battleLog = [];
        this.combos = JSON.parse(JSON.stringify(COMBOS));
        this.battleStartTime = 0;
        this.isAnimating = false;
        this.selectedAbility = null;

        // Status effects per entity: { targetId: [{ type, turnsLeft, ... }] }
        this.statusEffects = {};

        // ═══ NEW: Energy / AP System ═══
        this.energy = { VEX: 3, LYRA: 3, KAEL: 3 };
        this.maxEnergy = 3;

        // ═══ NEW: Combo Multiplier ═══
        this.comboCounter = 0;
        this.comboMultiplier = 1.0;

        // ═══ NEW: Threat Table ═══
        this.threatTable = { VEX: 0, LYRA: 0, KAEL: 0 };

        // ═══ NEW: Wave System ═══
        this.wave = 1;
        this.maxWaves = 3;
        this.waveEnemies = []; // For waves 1-2 (minions)
        this.waveCleared = false;

        // Battle Stats
        this.battleStats = {
            VEX: { dmgDealt: 0, dmgTaken: 0, healsGiven: 0, abilities: 0, kills: 0 },
            LYRA: { dmgDealt: 0, dmgTaken: 0, healsGiven: 0, abilities: 0, kills: 0 },
            KAEL: { dmgDealt: 0, dmgTaken: 0, healsGiven: 0, abilities: 0, kills: 0 },
            BOSS: { dmgDealt: 0, dmgTaken: 0, abilities: 0 }
        };
    }

    async initialize() {
        try {
            const state = await API.getState();
            this.characters = {};
            for (const char of state.characters) {
                this.characters[char.character_id] = {
                    ...char,
                    abilities: char.abilities.map((a, i) => ({
                        ...a,
                        currentCooldown: 0,
                        // AP costs: first ability=1, second=1, third=2, fourth=2, fifth=3
                        apCost: [1, 1, 2, 2, 3][i] || 1
                    }))
                };
            }
            this.boss = {
                ...state.boss,
                abilities: state.boss.boss_abilities.map(a => ({ ...a, currentCooldown: 0 }))
            };
            return true;
        } catch (e) {
            console.error('Failed to load state:', e);
            return false;
        }
    }

    getActiveCharacter() {
        if (this.turnQueue.length === 0) return null;
        return this.turnQueue[this.currentTurnIndex % this.turnQueue.length];
    }

    isPlayerTurn() {
        const active = this.getActiveCharacter();
        return active && active !== 'BOSS';
    }

    getCombosAvailable() {
        return this.combos.filter(c => {
            if (c.currentCd > 0) return false;
            return c.chars.every(charId => {
                const char = this.characters[charId];
                if (!char) return false;
                const hp = char.base_stats?.current_health || 0;
                const trust = char.emotions?.trust_in_team || 0;
                return hp > 0 && trust >= c.trust;
            });
        });
    }

    getBossPhase() {
        const hp = this.boss.base_stats?.current_health || 0;
        const maxHp = this.boss.base_stats?.max_health || 1;
        const pct = hp / maxHp;
        if (pct <= 0.30) return 3;
        if (pct <= 0.65) return 2;
        return 1;
    }

    startBattle() {
        this.mode = 'battle';
        this.battleStartTime = Date.now();
        this.turnNumber = 1;
        this.currentTurnIndex = 0;
        this.battleLog = [];
        this.comboCounter = 0;
        this.comboMultiplier = 1.0;
        this.threatTable = { VEX: 0, LYRA: 0, KAEL: 0 };

        // Reset energy
        for (const id of Object.keys(this.characters)) {
            this.energy[id] = this.maxEnergy;
        }

        // Set up wave enemies for wave 1-2, boss for wave 3
        this._setupWave();

        // Build turn queue sorted by speed
        const entries = [];
        for (const [id, char] of Object.entries(this.characters)) {
            if ((char.base_stats?.current_health || 0) > 0) {
                entries.push({ id, speed: char.base_stats?.speed || 0 });
            }
        }
        entries.push({ id: 'BOSS', speed: this.boss.base_stats?.speed || 0 });
        entries.sort((a, b) => b.speed - a.speed);
        this.turnQueue = entries.map(e => e.id);
    }

    _setupWave() {
        if (this.wave <= 2) {
            // Scale minion stats by wave
            const mult = 0.4 + (this.wave - 1) * 0.3; // wave1=0.4x, wave2=0.7x of boss
            const bossStats = this.boss.base_stats;
            this.waveEnemies = [
                {
                    id: 'MINION_A',
                    name: this.wave === 1 ? 'Sentinel Drone' : 'Void Knight',
                    hp: Math.round((bossStats?.max_health || 200) * mult * 0.4),
                    maxHp: Math.round((bossStats?.max_health || 200) * mult * 0.4),
                    attack: Math.round((bossStats?.attack || 20) * mult),
                    defense: Math.round((bossStats?.defense || 10) * mult * 0.5),
                    alive: true
                },
                {
                    id: 'MINION_B',
                    name: this.wave === 1 ? 'Sentinel Drone' : 'Void Knight',
                    hp: Math.round((bossStats?.max_health || 200) * mult * 0.4),
                    maxHp: Math.round((bossStats?.max_health || 200) * mult * 0.4),
                    attack: Math.round((bossStats?.attack || 20) * mult),
                    defense: Math.round((bossStats?.defense || 10) * mult * 0.5),
                    alive: true
                }
            ];
            this.waveCleared = false;
        } else {
            this.waveEnemies = [];
            this.waveCleared = false;
        }
    }

    nextTurn() {
        this.currentTurnIndex++;
        if (this.currentTurnIndex >= this.turnQueue.length) {
            this.currentTurnIndex = 0;
            this.turnNumber++;
            // Tick cooldowns
            for (const char of Object.values(this.characters)) {
                char.abilities?.forEach(a => { if (a.currentCooldown > 0) a.currentCooldown--; });
            }
            this.boss.abilities?.forEach(a => { if (a.currentCooldown > 0) a.currentCooldown--; });
            this.combos.forEach(c => { if (c.currentCd > 0) c.currentCd--; });

            // ═══ Refresh energy for all characters each round ═══
            for (const id of Object.keys(this.characters)) {
                this.energy[id] = this.maxEnergy;
            }
        }

        // Skip dead characters
        const active = this.getActiveCharacter();
        if (!active) return;
        if (active === 'BOSS') {
            if ((this.boss.base_stats?.current_health || 0) <= 0) return this.nextTurn();
            // ═══ Reset combo on boss turn ═══
            this.comboCounter = 0;
            this.comboMultiplier = 1.0;
        } else {
            const char = this.characters[active];
            if (!char || (char.base_stats?.current_health || 0) <= 0) return this.nextTurn();
        }
    }

    applyDamage(targetId, damage, sourceId = null) {
        // Check for shield status
        const effects = this.statusEffects[targetId] || [];
        let finalDmg = damage;
        const shield = effects.find(e => e.type === 'shield');
        if (shield) finalDmg = Math.round(damage * STATUS_EFFECTS.shield.dmgReduce);
        // Check for weaken on source
        if (sourceId) {
            const srcEffects = this.statusEffects[sourceId] || [];
            const weaken = srcEffects.find(e => e.type === 'weaken');
            if (weaken) finalDmg = Math.round(finalDmg * STATUS_EFFECTS.weaken.dmgMult);
            const empower = srcEffects.find(e => e.type === 'empower');
            if (empower) finalDmg = Math.round(finalDmg * STATUS_EFFECTS.empower.dmgMult);
        }

        if (targetId === 'BOSS') {
            this.boss.base_stats.current_health = Math.max(0,
                this.boss.base_stats.current_health - finalDmg);
        } else {
            const char = this.characters[targetId];
            if (char) {
                char.base_stats.current_health = Math.max(0,
                    char.base_stats.current_health - finalDmg);
            }
        }
        // Track stats
        if (sourceId && this.battleStats[sourceId]) this.battleStats[sourceId].dmgDealt += finalDmg;
        if (this.battleStats[targetId]) this.battleStats[targetId].dmgTaken += finalDmg;
        return finalDmg;
    }

    applyHeal(targetId, amount, sourceId = null) {
        const char = this.characters[targetId];
        if (char) {
            char.base_stats.current_health = Math.min(
                char.base_stats.max_health,
                char.base_stats.current_health + amount
            );
        }
        if (sourceId && this.battleStats[sourceId]) this.battleStats[sourceId].healsGiven += amount;
    }

    // ─── Status Effects ──────────────────────────────
    applyStatus(targetId, type, sourceId = null) {
        if (!this.statusEffects[targetId]) this.statusEffects[targetId] = [];
        // Remove existing of same type
        this.statusEffects[targetId] = this.statusEffects[targetId].filter(e => e.type !== type);
        const def = STATUS_EFFECTS[type];
        if (!def) return;
        this.statusEffects[targetId].push({ type, turnsLeft: def.duration, source: sourceId });
    }

    removeStatus(targetId, type) {
        if (!this.statusEffects[targetId]) return;
        this.statusEffects[targetId] = this.statusEffects[targetId].filter(e => e.type !== type);
    }

    getStatusEffects(targetId) {
        return this.statusEffects[targetId] || [];
    }

    tickStatusEffects(targetId) {
        const effects = this.statusEffects[targetId] || [];
        const results = [];
        for (const eff of effects) {
            const def = STATUS_EFFECTS[eff.type];
            if (def.tickDmg) {
                const dmg = def.tickDmg;
                if (targetId === 'BOSS') {
                    this.boss.base_stats.current_health = Math.max(0, this.boss.base_stats.current_health - dmg);
                } else if (this.characters[targetId]) {
                    this.characters[targetId].base_stats.current_health = Math.max(0, this.characters[targetId].base_stats.current_health - dmg);
                }
                results.push({ type: eff.type, effect: 'damage', amount: dmg });
            }
            if (def.tickHeal && this.characters[targetId]) {
                this.characters[targetId].base_stats.current_health = Math.min(
                    this.characters[targetId].base_stats.max_health,
                    this.characters[targetId].base_stats.current_health + def.tickHeal
                );
                results.push({ type: eff.type, effect: 'heal', amount: def.tickHeal });
            }
            eff.turnsLeft--;
        }
        // Remove expired
        this.statusEffects[targetId] = effects.filter(e => e.turnsLeft > 0);
        return results;
    }

    isStunned(targetId) {
        return (this.statusEffects[targetId] || []).some(e => e.type === 'stun');
    }

    // ─── Combat Commentary ───────────────────────────
    getCommentary(charId, event) {
        const lines = COMBAT_LINES[charId]?.[event];
        if (!lines || lines.length === 0) return null;
        return lines[Math.floor(Math.random() * lines.length)];
    }

    selectBossAbility() {
        const available = this.boss.abilities.filter(a => (a.currentCooldown || 0) <= 0);
        if (available.length === 0) return this.boss.abilities[0]; // Fallback

        const bossHpPct = this.boss.base_stats.current_health / this.boss.base_stats.max_health;
        const phase = this.getBossPhase();

        // Priority scoring
        let best = available[0];
        let bestScore = -1;
        for (const ab of available) {
            let score = ab.damage || 0;
            if (ab.type === 'defensive' && bossHpPct < 0.4) score += 50;
            if (ab.type === 'ultimate' && bossHpPct < 0.2) score += 100;
            if (ab.type === 'aoe') score += 20 * phase;
            score += Math.random() * 10; // Some randomness
            if (score > bestScore) { bestScore = score; best = ab; }
        }
        return best;
    }

    selectBossTarget() {
        // ═══ Threat-based targeting ═══
        // 60% chance target highest threat, 20% lowest HP, 20% random
        const roll = Math.random();
        const alive = Object.entries(this.characters)
            .filter(([_, c]) => (c.base_stats?.current_health || 0) > 0);
        if (alive.length === 0) return Object.keys(this.characters)[0];

        if (roll < 0.6) {
            // Highest threat
            let highest = alive[0][0];
            let maxThreat = this.threatTable[highest] || 0;
            for (const [id] of alive) {
                if ((this.threatTable[id] || 0) > maxThreat) {
                    maxThreat = this.threatTable[id];
                    highest = id;
                }
            }
            return highest;
        } else if (roll < 0.8) {
            // Lowest HP
            let lowest = alive[0][0];
            let lowestHp = alive[0][1].base_stats?.current_health || 999;
            for (const [id, char] of alive) {
                const hp = char.base_stats?.current_health || 0;
                if (hp < lowestHp) { lowestHp = hp; lowest = id; }
            }
            return lowest;
        } else {
            // Random
            return alive[Math.floor(Math.random() * alive.length)][0];
        }
    }

    // ═══ Wave Check for Game Over ═══
    isWaveCleared() {
        if (this.wave <= 2) {
            return this.waveEnemies.every(e => !e.alive);
        }
        return false; // Wave 3 = boss, check boss HP
    }

    advanceWave() {
        this.wave++;
        if (this.wave <= this.maxWaves) {
            this._setupWave();
            // Heal all characters 50%
            for (const char of Object.values(this.characters)) {
                if ((char.base_stats?.current_health || 0) > 0) {
                    const heal = Math.round(char.base_stats.max_health * 0.5);
                    char.base_stats.current_health = Math.min(
                        char.base_stats.max_health,
                        char.base_stats.current_health + heal
                    );
                }
            }
            // Reset cooldowns
            for (const char of Object.values(this.characters)) {
                char.abilities?.forEach(a => { a.currentCooldown = 0; });
            }
            // Reset energy
            for (const id of Object.keys(this.characters)) {
                this.energy[id] = this.maxEnergy;
            }
            this.comboCounter = 0;
            this.comboMultiplier = 1.0;
            return true;
        }
        return false; // No more waves
    }

    // ═══ Energy / AP Helpers ═══
    getEnergy(charId) { return this.energy[charId] || 0; }
    canAfford(charId, cost) { return this.getEnergy(charId) >= cost; }
    spendEnergy(charId, cost) {
        this.energy[charId] = Math.max(0, (this.energy[charId] || 0) - cost);
    }

    // ═══ Combo Multiplier ═══
    incrementCombo() {
        this.comboCounter++;
        if (this.comboCounter <= 1) this.comboMultiplier = 1.0;
        else if (this.comboCounter === 2) this.comboMultiplier = 1.2;
        else if (this.comboCounter === 3) this.comboMultiplier = 1.5;
        else this.comboMultiplier = 2.0;
        return this.comboMultiplier;
    }
    getComboMultiplier() { return this.comboMultiplier; }

    // ═══ Threat System ═══
    addThreat(charId, amount) {
        if (this.threatTable[charId] !== undefined) {
            this.threatTable[charId] += amount;
        }
    }

    // ═══ Morale & Betrayal System ═══
    checkBetrayal(charId) {
        const char = this.characters[charId];
        if (!char) return null;
        const morale = char.emotions?.morale ?? 0.65;
        const trust = char.emotions?.trust_in_team ?? 0.6;
        const stress = char.emotions?.stress ?? 0.3;

        // Calculate betrayal chance based on morale + trust + stress
        const betrayalScore = (1 - morale) * 0.4 + (1 - trust) * 0.3 + stress * 0.3;

        if (betrayalScore > 0.6 && Math.random() < betrayalScore * 0.5) {
            // Character refuses or goes rogue
            const actions = [
                { type: 'refuse', text: `I won't follow your orders anymore.` },
                { type: 'refuse', text: `You don't care about us. Figure it out yourself.` },
                { type: 'rogue', text: `I'll do this MY way!` },
                { type: 'hesitate', text: `I... I can't do this right now.` }
            ];
            return actions[Math.floor(Math.random() * actions.length)];
        }
        return null; // No betrayal
    }

    getMoraleModifier(charId) {
        const char = this.characters[charId];
        const morale = char?.emotions?.morale ?? 0.65;
        // Low morale = weak attacks (0.5x), high morale = strong attacks (1.3x)
        if (morale < 0.2) return 0.5;
        if (morale < 0.4) return 0.7;
        if (morale < 0.6) return 0.9;
        if (morale >= 0.8) return 1.3;
        return 1.0;
    }

    degradeMorale(charId, amount) {
        const char = this.characters[charId];
        if (!char?.emotions) return;
        char.emotions.morale = Math.max(0, (char.emotions.morale || 0.65) - amount);
        char.emotions.trust_in_team = Math.max(0, (char.emotions.trust_in_team || 0.6) - amount * 0.5);
        char.emotions.stress = Math.min(1, (char.emotions.stress || 0.3) + amount * 0.3);
    }

    boostMorale(charId, amount) {
        const char = this.characters[charId];
        if (!char?.emotions) return;
        char.emotions.morale = Math.min(1, (char.emotions.morale || 0.65) + amount);
        char.emotions.trust_in_team = Math.min(1, (char.emotions.trust_in_team || 0.6) + amount * 0.3);
        char.emotions.stress = Math.max(0, (char.emotions.stress || 0.3) - amount * 0.2);
    }

    // ═══ Game Over (wave-aware) ═══
    isGameOver() {
        // Wave 1-2: check if minions are all dead (= wave clear, not game over)
        // Wave 3: check boss
        if (this.wave >= 3) {
            if ((this.boss.base_stats?.current_health || 0) <= 0) return 'win';
        }
        // Check if all characters dead
        const anyAlive = Object.values(this.characters).some(
            c => (c.base_stats?.current_health || 0) > 0);
        if (!anyAlive) return 'lose';
        return null;
    }
}

// ─── Voice System (Web Speech API + ElevenLabs fallback) ──
const VOICE_PROFILES = {
    VEX: { pitch: 1.1, rate: 1.15, voiceKeywords: ['male', 'daniel', 'james', 'david'] },
    LYRA: { pitch: 1.4, rate: 0.95, voiceKeywords: ['female', 'zira', 'samantha', 'jenny'] },
    KAEL: { pitch: 0.7, rate: 0.85, voiceKeywords: ['male', 'mark', 'richard', 'george'] },
    BOSS: { pitch: 0.4, rate: 0.75, voiceKeywords: ['male', 'daniel', 'mark', 'david'] },
};

let cachedVoices = [];
function loadVoices() {
    cachedVoices = window.speechSynthesis?.getVoices() || [];
}
if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
}

function pickVoice(keywords) {
    if (!cachedVoices.length) loadVoices();
    for (const kw of keywords) {
        const v = cachedVoices.find(v => v.name.toLowerCase().includes(kw) && v.lang.startsWith('en'));
        if (v) return v;
    }
    return cachedVoices.find(v => v.lang.startsWith('en')) || cachedVoices[0] || null;
}

function speakAs(charId, text) {
    if (!window.speechSynthesis || !text) return;
    // Cancel any current speech to avoid overlap
    window.speechSynthesis.cancel();
    const profile = VOICE_PROFILES[charId] || VOICE_PROFILES.VEX;
    const utter = new SpeechSynthesisUtterance(text);
    const v = pickVoice(profile.voiceKeywords);
    if (v) utter.voice = v;
    utter.pitch = profile.pitch;
    utter.rate = profile.rate;
    utter.volume = 0.8;
    window.speechSynthesis.speak(utter);
}
// Expose globally
window.speakAs = speakAs;

// ─── UI Controller ───────────────────────────────────────
export class UIController {
    constructor(engine, state) {
        this.engine = engine;
        this.state = state;
        this.damageNumberId = 0;
    }

    // Update all character panels
    updateCharacterPanels() {
        for (const [id, char] of Object.entries(this.state.characters)) {
            const hp = char.base_stats?.current_health || 0;
            const maxHp = char.base_stats?.max_health || 1;
            const pct = (hp / maxHp) * 100;

            // HP bar
            const hpBar = document.getElementById(`hp-${id}`);
            if (hpBar) hpBar.style.width = `${pct}%`;

            const hpVal = document.getElementById(`hpVal-${id}`);
            if (hpVal) hpVal.textContent = hp;

            // Emotions
            const emotions = char.emotions || {};
            this._setEmo(id, 'conf', emotions.confidence || 0);
            this._setEmo(id, 'stress', emotions.stress || 0);
            this._setEmo(id, 'trust', emotions.trust_in_team || 0);
            this._setEmo(id, 'morale', emotions.morale || 0);

            // Update 3D character
            const engineChar = this.engine.characters[id];
            if (engineChar) {
                engineChar.hpPercent = hp / maxHp;
                engineChar.emotions = {
                    confidence: emotions.confidence || 0.5,
                    stress: emotions.stress || 0.3,
                    trust: emotions.trust_in_team || 0.6,
                    morale: emotions.morale || 0.65
                };
            }

            // Panel state
            const panel = document.getElementById(`panel-${id}`);
            if (panel) {
                panel.classList.toggle('dead', hp <= 0);
                panel.classList.toggle('active-turn',
                    this.state.getActiveCharacter() === id);
            }
        }
    }

    _setEmo(charId, emoKey, value) {
        const el = document.getElementById(`emo-${charId}-${emoKey}`);
        if (el) el.style.width = `${value * 100}%`;
    }

    // Update boss panel
    updateBossPanel() {
        const boss = this.state.boss;
        const hp = boss.base_stats?.current_health || 0;
        const maxHp = boss.base_stats?.max_health || 1;
        const pct = (hp / maxHp) * 100;

        const hpBar = document.getElementById('bossHpBar');
        if (hpBar) hpBar.style.width = `${pct}%`;

        const hpVal = document.getElementById('bossHpVal');
        if (hpVal) hpVal.textContent = hp;

        const phase = this.state.getBossPhase();
        const phaseNames = ['Sentinel', 'Rage Protocol', 'Singularity'];
        const phaseText = document.getElementById('bossPhaseText');
        if (phaseText) phaseText.textContent = `Phase ${phase} — ${phaseNames[phase - 1]}`;

        // Update 3D boss
        if (this.engine.characters.BOSS) {
            this.engine.characters.BOSS.hpPercent = hp / maxHp;
        }
    }

    // Show abilities for active character
    showAbilities(charId) {
        const row = document.getElementById('abilitiesRow');
        if (!row) return;
        row.innerHTML = '';

        const activeLabel = document.getElementById('activeCharName');
        if (activeLabel) activeLabel.textContent = CHAR_CONFIG[charId]?.name || charId;

        const char = this.state.characters[charId];
        if (!char) return;

        const currentAP = this.state.getEnergy(charId);

        char.abilities.forEach((ab, i) => {
            const btn = document.createElement('div');
            btn.className = 'ability-btn';
            const typeColor = ABILITY_COLORS[ab.type] || '#ffffff';
            btn.style.setProperty('--ab-color', typeColor);

            const apCost = ab.apCost || 1;
            const canAfford = currentAP >= apCost;

            if (ab.currentCooldown > 0) btn.classList.add('on-cooldown');
            if (!canAfford) btn.classList.add('no-ap');

            btn.innerHTML = `
                <div class="ab-top">
                    <div class="ab-name">${ab.name}</div>
                    ${ab.damage ? `<div class="ab-damage">${ab.damage}</div>` : ''}
                </div>
                <div class="ab-bottom">
                    <div class="ab-type">${ab.type}</div>
                    <div class="ab-ap-cost">${apCost} AP</div>
                </div>
                ${ab.currentCooldown > 0 ? `<div class="ab-cooldown">${ab.currentCooldown}</div>` : ''}
            `;
            btn.title = `${ab.description || ab.name} (${apCost} AP)`;

            btn.addEventListener('click', () => {
                if (ab.currentCooldown > 0 || this.state.isAnimating || !canAfford) return;
                this.onAbilitySelected?.(charId, ab, i);
            });

            row.appendChild(btn);
        });

        // Always show an "End Turn / Guard" button
        const passBtn = document.createElement('div');
        passBtn.className = 'ability-btn pass-btn';
        passBtn.style.setProperty('--ab-color', '#888888');
        passBtn.innerHTML = `
            <div class="ab-top">
                <div class="ab-name">Pass Turn</div>
            </div>
            <div class="ab-bottom">
                <div class="ab-type">DEFENSIVE</div>
                <div class="ab-ap-cost" style="color:#fff; border-color:#fff; background:rgba(255,255,255,0.1)">0 AP</div>
            </div>
        `;
        passBtn.title = "Rest to recover 1 AP and pass your turn to the next unit.";
        passBtn.addEventListener('click', () => {
            if (this.state.isAnimating) return;
            if (typeof executePassTurn === 'function') {
                executePassTurn(charId);
            }
        });
        row.appendChild(passBtn);

        // Update combos
        this.showCombos();
    }

    showCombos() {
        const row = document.getElementById('combosRow');
        if (!row) return;
        row.innerHTML = '';

        const available = this.state.getCombosAvailable();
        this.state.combos.forEach((combo, i) => {
            const isAvailable = available.includes(combo);
            const btn = document.createElement('div');
            btn.className = `combo-btn ${!isAvailable ? 'disabled' : ''}`;
            btn.innerHTML = `
                <div class="ab-top">
                    <div class="combo-name">${combo.name}</div>
                    <div class="combo-dmg">${combo.damage}</div>
                </div>
                <div class="ab-bottom">
                    <div class="combo-chars">${combo.chars.join(' + ')}</div>
                </div>
                ${combo.currentCd > 0 ? `<div class="ab-cooldown">${combo.currentCd}</div>` : ''}
            `;
            btn.title = combo.desc;

            if (isAvailable) {
                btn.addEventListener('click', () => {
                    if (this.state.isAnimating) return;
                    this.onComboSelected?.(combo, i);
                });
            }

            row.appendChild(btn);
        });
    }

    // Spawn floating damage number
    spawnDamageNumber(x, y, amount, type = 'normal') {
        const el = document.createElement('div');
        el.className = `damage-number ${type}`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.fontSize = type === 'combo' ? '42px' : type === 'crit' ? '36px' : '24px';

        const prefix = type === 'heal' ? '+' : '-';
        el.textContent = `${prefix}${amount}`;

        const colors = {
            normal: '#ffffff', crit: '#FFD700', heal: '#00FF88',
            combo: '#FFD700', boss: '#FF4488'
        };
        el.style.color = colors[type] || '#ffffff';

        // Random horizontal offset
        el.style.left = `${x + (Math.random() - 0.5) * 40}px`;

        document.getElementById('damageContainer')?.appendChild(el);
        setTimeout(() => el.remove(), 1400);
    }

    // Show announcement
    showAnnouncement(text, sub = '', duration = 2000) {
        const announce = document.getElementById('announcement');
        const textEl = document.getElementById('announceText');
        const subEl = document.getElementById('announceSub');
        if (!announce || !textEl) return;

        textEl.textContent = text;
        if (subEl) subEl.textContent = sub;
        announce.classList.remove('hidden');

        setTimeout(() => announce.classList.add('hidden'), duration);
    }

    // Show boss taunt
    showBossTaunt(text, duration = 3000) {
        const overlay = document.getElementById('tauntOverlay');
        const textEl = document.getElementById('tauntText');
        if (!overlay || !textEl) return;

        textEl.textContent = text;
        overlay.classList.remove('hidden');
        speakAs('BOSS', text);

        setTimeout(() => overlay.classList.add('hidden'), duration);
    }

    // Add battle log entry + auto-voice
    addLogEntry(text) {
        const entries = document.getElementById('logEntries');
        if (!entries) return;

        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = text;
        entries.appendChild(entry);
        entries.scrollTop = entries.scrollHeight;

        // Auto-speak: strip HTML first, then find quoted dialogue
        const stripped = text.replace(/<[^>]*>/g, '');
        const quoteMatch = stripped.match(/[""\u201c]([^""\u201d]{4,}?)[""\u201d]/);
        if (quoteMatch && quoteMatch[1].length > 3) {
            const speech = quoteMatch[1];
            let speaker = 'VEX';
            const lower = stripped.toLowerCase();
            if (lower.includes('lyra')) speaker = 'LYRA';
            else if (lower.includes('kael')) speaker = 'KAEL';
            else if (lower.includes('nexus') || lower.includes('boss')) speaker = 'BOSS';
            speakAs(speaker, speech);
        }
    }

    // Update turn indicator
    updateTurnInfo() {
        const turnNum = document.getElementById('turnNumber');
        if (turnNum) turnNum.textContent = this.state.turnNumber;

        const phaseBadge = document.getElementById('phaseText');
        const active = this.state.getActiveCharacter();
        if (phaseBadge) {
            phaseBadge.textContent = this.state.isPlayerTurn() ? 'PLAYER PHASE' : 'BOSS PHASE';
        }

        // Timer
        const timer = document.getElementById('timerText');
        if (timer) {
            const elapsed = Math.floor((Date.now() - this.state.battleStartTime) / 1000);
            const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const s = (elapsed % 60).toString().padStart(2, '0');
            timer.textContent = `${m}:${s}`;
        }
    }

    // Transition screen
    showTransition(text, callback) {
        const screen = document.getElementById('transitionScreen');
        const textEl = document.getElementById('transitionText');
        if (screen && textEl) {
            textEl.textContent = text;
            screen.classList.remove('hidden');
            setTimeout(() => {
                screen.classList.add('hidden');
                callback?.();
            }, 1500);
        }
    }

    // Dialogue UI
    openDialogue(charId) {
        const char = this.state.characters[charId];
        if (!char) return;

        const config = CHAR_CONFIG[charId];
        document.getElementById('dialogueAvatar').textContent = config?.icon || '?';
        document.getElementById('dialogueCharName').textContent = config?.name || charId;
        document.getElementById('dialogueCharName').style.color = config?.color || '#fff';
        document.getElementById('dialogueAvatar').style.borderColor = config?.color || '#fff';
        document.getElementById('dialogueAvatar').style.background =
            `${config?.color || '#fff'}15`;

        // Mood text
        const conf = char.emotions?.confidence || 0.5;
        const stress = char.emotions?.stress || 0.3;
        let mood = 'Neutral';
        if (conf > 0.7 && stress < 0.4) mood = 'Confident';
        else if (stress > 0.6) mood = 'Stressed';
        else if (conf < 0.4) mood = 'Uncertain';
        else if (char.emotions?.morale > 0.8) mood = 'Inspired';
        document.getElementById('dialogueCharMood').textContent = `Feeling ${mood.toLowerCase()}`;

        // Emotion bars
        const emosDiv = document.getElementById('dialogueEmotions');
        emosDiv.innerHTML = '';
        const emos = [
            { label: 'Confidence', value: char.emotions?.confidence || 0, color: '#00FF88' },
            { label: 'Stress', value: char.emotions?.stress || 0, color: '#FFAA00' },
            { label: 'Trust', value: char.emotions?.trust_in_team || 0, color: '#4488FF' },
            { label: 'Morale', value: char.emotions?.morale || 0, color: '#AA44FF' }
        ];
        emos.forEach(e => {
            const div = document.createElement('div');
            div.className = 'dialogue-emo';
            div.innerHTML = `
                <div class="de-label">${e.label}</div>
                <div class="de-bar"><div class="de-fill" style="width:${e.value * 100}%;background:${e.color}"></div></div>
                <div class="de-val">${Math.round(e.value * 100)}%</div>
            `;
            emosDiv.appendChild(div);
        });

        // Clear messages
        document.getElementById('dialogueMessages').innerHTML = '';

        // Show
        document.getElementById('dialogueUI').classList.remove('hidden');
    }

    closeDialogue() {
        document.getElementById('dialogueUI').classList.add('hidden');
    }

    addDialogueMessage(text, type = 'character') {
        const container = document.getElementById('dialogueMessages');
        if (!container) return;

        const msg = document.createElement('div');
        msg.className = `dmsg ${type}`;
        msg.textContent = text;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    showThinking() {
        const container = document.getElementById('dialogueMessages');
        if (!container) return;

        const msg = document.createElement('div');
        msg.className = 'dmsg character';
        msg.id = 'thinkingMsg';
        msg.innerHTML = '<div class="thinking"><span></span><span></span><span></span></div>';
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    removeThinking() {
        document.getElementById('thinkingMsg')?.remove();
    }

    // House mood updates
    updateHouseMoods() {
        for (const [id, char] of Object.entries(this.state.characters)) {
            const conf = char.emotions?.confidence || 0.5;
            const stress = char.emotions?.stress || 0.3;
            let mood = 'Neutral';
            if (conf > 0.7 && stress < 0.4) mood = 'Confident';
            else if (stress > 0.6) mood = 'Stressed';
            else if (conf < 0.4) mood = 'Uncertain';
            const el = document.getElementById(`houseMood-${id}`);
            if (el) el.textContent = mood;
        }
    }
}
