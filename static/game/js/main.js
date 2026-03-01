// ═══════════════════════════════════════════════════════════
// SENTIENT ARENA — Main Entry Point
// Wires engine + game logic + UI + events
// ═══════════════════════════════════════════════════════════

import * as THREE from 'three';
import { GameEngine } from './engine.js?v=5';
import { API, GameState, UIController } from './game.js?v=5';

// ─── Global References ──────────────────────────────────
let engine, state, ui;
let dialogueCharId = null;
let lastPhase = 1;

// ─── Initialize ──────────────────────────────────────────
async function init() {
    updateLoadBar(10, 'Connecting to Sentient Arena backend...');

    // Check backend health
    try {
        await API.health();
        updateLoadBar(25, 'Backend connected!');
    } catch (e) {
        updateLoadBar(25, 'Backend offline — using local mode');
    }

    // Initialize 3D engine
    updateLoadBar(35, 'Loading 3D arena...');
    const canvas = document.getElementById('gameCanvas');
    engine = new GameEngine(canvas);

    // Initialize game state from backend
    updateLoadBar(50, 'Loading characters & boss data...');
    state = new GameState();
    await state.initialize();

    // Initialize UI controller
    updateLoadBar(65, 'Initializing holographic UI...');
    ui = new UIController(engine, state);

    // Create 3D characters
    updateLoadBar(75, 'Spawning AI squad...');
    const CHAR_3D_CONFIG = {
        VEX: { color: '#00FFFF', position: new THREE.Vector3(-5, 0, 4) },
        LYRA: { color: '#AA44FF', position: new THREE.Vector3(-5, 0, 0) },
        KAEL: { color: '#4488FF', position: new THREE.Vector3(-5, 0, -4) }
    };
    for (const [id, config] of Object.entries(CHAR_3D_CONFIG)) {
        engine.createCharacter(id, config);
    }

    // Create boss
    updateLoadBar(85, 'Initializing Nexus Prime...');
    engine.createBoss({
        color: '#FF4488',
        position: new THREE.Vector3(5, 0, 0)
    });

    // Bind events
    updateLoadBar(95, 'Binding neural interfaces...');
    bindEvents();

    // Start render loop
    engine.start();

    // Finish loading
    updateLoadBar(100, 'READY');
    await sleep(500);

    // Hide loading screen, show house
    const loadScreen = document.getElementById('loadingScreen');
    loadScreen.classList.add('fade-out');
    setTimeout(() => {
        loadScreen.style.display = 'none';
        enterHouseMode();
    }, 800);
}

// ─── Loading Helpers ─────────────────────────────────────
function updateLoadBar(percent, text) {
    const bar = document.getElementById('loadBar');
    const status = document.getElementById('loadStatus');
    if (bar) bar.style.width = `${percent}%`;
    if (status) status.textContent = text;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Mode: House ─────────────────────────────────────────
function enterHouseMode() {
    state.mode = 'house';
    engine.setHouseMode();

    // Position characters for house
    const housePositions = {
        VEX: new THREE.Vector3(-3.5, 0, 1.5),
        LYRA: new THREE.Vector3(0, 0, -1),
        KAEL: new THREE.Vector3(3.5, 0, 1.5)
    };
    for (const [id, pos] of Object.entries(housePositions)) {
        if (engine.characters[id]) {
            engine.characters[id].targetPosition = pos;
        }
    }
    // Hide boss in house
    if (engine.characters.BOSS) {
        engine.characters.BOSS.group.visible = false;
    }

    document.getElementById('gameUI')?.classList.add('hidden');
    document.getElementById('houseUI')?.classList.remove('hidden');
    document.getElementById('dialogueUI')?.classList.add('hidden');

    ui.updateHouseMoods();
}

// ─── Mode: Battle ────────────────────────────────────────
function enterBattleMode() {
    ui.showTransition('⚔ ENTERING ARENA', () => {
        state.mode = 'battle';
        engine.setArenaMode();

        // Reset positions
        const arenaPositions = {
            VEX: new THREE.Vector3(-5, 0, 4),
            LYRA: new THREE.Vector3(-5, 0, 0),
            KAEL: new THREE.Vector3(-5, 0, -4)
        };
        for (const [id, pos] of Object.entries(arenaPositions)) {
            if (engine.characters[id]) {
                engine.characters[id].targetPosition = pos;
                engine.characters[id].group.visible = true;
            }
        }

        // Show boss
        if (engine.characters.BOSS) {
            engine.characters.BOSS.group.visible = true;
            engine.characters.BOSS.targetPosition = new THREE.Vector3(5, 0, 0);
        }

        // ═══ Wave system — scale boss HP by wave ═══
        state.wave = 1;
        state.startBattle();

        // Wave 1: Boss acts as "Sentinel Drone" with 30% HP
        const maxHp = state.boss.base_stats?.max_health || 350;
        const waveHpScale = [0.3, 0.5, 1.0]; // wave 1/2/3
        state.boss.base_stats.current_health = Math.round(maxHp * waveHpScale[0]);
        state.boss.base_stats.max_health_wave = maxHp; // Store real max
        state.boss.base_stats.max_health = Math.round(maxHp * waveHpScale[0]);

        document.getElementById('houseUI')?.classList.add('hidden');
        document.getElementById('gameUI')?.classList.remove('hidden');
        document.getElementById('dialogueUI')?.classList.add('hidden');

        ui.updateCharacterPanels();
        ui.updateBossPanel();
        ui.updateTurnInfo();

        // ═══ Init new gameplay HUD ═══
        const active = state.getActiveCharacter();
        if (active && active !== 'BOSS') {
            ui.showAbilities(active);
            updateAPDisplay(active);
        }
        updateWaveDisplay();
        updateComboDisplay();

        // Wave 1 entrance
        setTimeout(() => {
            ui.showBossTaunt("Sentinel drones deployed. Prove your worth.");
            ui.addLogEntry('⚔ <span class="le-char">Wave 1</span> — Sentinel Drones engage!');
        }, 1000);

        setTimeout(() => {
            ui.showAnnouncement('WAVE 1', 'MINION WAVE — Clear the drones!');
        }, 2000);

        startTimerUpdate();
    });
}

let timerInterval;
function startTimerUpdate() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (state.mode === 'battle') ui.updateTurnInfo();
    }, 1000);
}

// ─── Execute Ability ─────────────────────────────────────
async function executeAbility(charId, ability, abilityIndex) {
    if (state.isAnimating) return;

    const char = state.characters[charId];
    const config = { VEX: '#00FFFF', LYRA: '#AA44FF', KAEL: '#4488FF' };
    const charColor = config[charId] || '#ffffff';

    // ═══ AP CHECK ═══
    const apCost = ability.apCost || 1;
    if (!state.canAfford(charId, apCost)) {
        ui.showAnnouncement('NOT ENOUGH AP', `Need ${apCost} AP — you have ${state.getEnergy(charId)}`, 1200);
        state.isAnimating = false;
        return;
    }

    // ═══ AI BETRAYAL CHECK ═══
    const betrayal = state.checkBetrayal(charId);
    if (betrayal) {
        state.isAnimating = true;
        state.spendEnergy(charId, apCost); // Still costs AP
        engine.focusCharacter(charId);

        // Show betrayal reaction
        const charName = char.display_name || charId;
        ui.addLogEntry(`⚠️ <span style="color:#FF4444;font-weight:bold">${charName} REFUSES!</span> <span style="color:#ff8888">"${betrayal.text}"</span>`);
        ui.showAnnouncement('MORALE BREAK', `${charName}: "${betrayal.text}"`, 2500);

        // Character shakes their head (visual)
        if (engine.characters[charId]) {
            engine.spriteTakeDamage(charId); // Reuse shake effect
        }

        await sleep(2000);

        // If rogue, attack random target (boss still) with weak damage
        if (betrayal.type === 'rogue') {
            const rogueDmg = Math.round((ability.damage || 15) * 0.3);
            state.applyDamage('BOSS', rogueDmg, charId);
            ui.addLogEntry(`💢 <span class="le-char">${charName}</span> attacks recklessly → <span class="le-dmg">-${rogueDmg}</span> (unfocused)`);
            engine.spawnEnergyBeam(charId, 'BOSS', '#FF4444');
        }

        await sleep(600);
        ui.updateCharacterPanels();
        ui.updateBossPanel();
        syncHPLabels();

        // Check if out of AP
        if (state.getEnergy(charId) <= 0) {
            state.nextTurn();
            state.isAnimating = false;
            const nextActive = state.getActiveCharacter();
            if (nextActive === 'BOSS') { await executeBossTurn(); }
            else { ui.showAbilities(nextActive); ui.updateTurnInfo(); engine.focusCharacter(nextActive, 300); updateAPDisplay(nextActive); }
        } else {
            state.isAnimating = false;
            ui.showAbilities(charId);
            updateAPDisplay(charId);
        }
        return;
    }

    state.isAnimating = true;

    // Spend AP
    state.spendEnergy(charId, apCost);

    // Set cooldown
    ability.currentCooldown = ability.cooldown;

    // Camera focus
    engine.focusCharacter(charId);

    // Announce ability
    ui.showAnnouncement(ability.name, `${char.display_name} — ${apCost} AP`, 1500);

    await sleep(500);

    // Handle by type
    if (ability.type === 'support') {
        const healAmount = parseInt(ability.effect?.match(/\d+/)?.[0] || '20');
        if (ability.effect?.includes('all')) {
            for (const id of Object.keys(state.characters)) {
                state.applyHeal(id, healAmount);
                engine.spawnHealEffect(id);
            }
            ui.addLogEntry(`💚 <span class="le-char">${char.display_name}</span> heals all for <span class="le-heal">+${healAmount}</span>`);
        } else {
            state.applyHeal(charId, healAmount);
            engine.spawnHealEffect(charId);
            ui.addLogEntry(`💚 <span class="le-char">${char.display_name}</span> heals for <span class="le-heal">+${healAmount}</span>`);
        }
        // ═══ Threat from healing ═══
        state.addThreat(charId, healAmount * 2);

        // Boost morale of healed characters
        for (const id of Object.keys(state.characters)) {
            state.boostMorale(id, 0.05);
        }
    } else if (ability.type === 'defensive') {
        engine.spawnShieldEffect(charId, parseInt(charColor.replace('#', '0x')));
        state.applyStatus(charId, 'shield', charId);
        ui.addLogEntry(`🛡 <span class="le-char">${char.display_name}</span> uses ${ability.name} — <span style="color:#4488ff">Shield active!</span>`);
        const line = state.getCommentary(charId, 'attack');
        if (line) ui.addLogEntry(`<span style = "color:${charColor};opacity:0.7" > "${line}"</span> `);
    } else {
        // ═══ Offensive / AOE — with Combo Multiplier ═══
        let damage = ability.damage || 20;
        const defense = state.boss.base_stats?.defense || 0;
        const attack = char.base_stats?.attack || 10;

        // Increment combo
        const comboMult = state.incrementCombo();

        // Apply damage formula with combo
        // Apply damage formula with combo and morale
        const moralemod = state.getMoraleModifier(charId);
        const baseDamage = Math.max(1, Math.round(
            damage * (attack / 15) * (1 - defense / 100) * (0.9 + Math.random() * 0.2) * moralemod
        ));
        const actualDamage = Math.round(baseDamage * comboMult);

        // Show morale effect
        if (moralemod < 0.9) {
            ui.addLogEntry(`😰 <span style="color:#ff8888">${char.display_name}'s low morale weakens the attack (${moralemod}x)</span>`);
        } else if (moralemod > 1.0) {
            ui.addLogEntry(`🔥 <span style="color:#00ff88">${char.display_name}'s high morale empowers the attack! (${moralemod}x)</span>`);
        }

        // VFX chain
        engine.animateAttack(charId, 'BOSS', () => {
            engine.spawnEnergyBeam(charId, 'BOSS', charColor);
        });
        await sleep(600);

        engine.spriteTakeDamage('BOSS');

        if (engine.characters.BOSS) {
            engine.spawnDamageNumber(engine.characters.BOSS.group.position, actualDamage, charColor);
        }

        if (actualDamage > 30) {
            engine.triggerCriticalHit(engine.characters.BOSS.group.position, charColor);
        }

        const finalDmg = state.applyDamage('BOSS', actualDamage, charId);

        // ═══ Threat from damage ═══
        state.addThreat(charId, finalDmg);

        // Burn chance
        if (Math.random() < 0.3) {
            state.applyStatus('BOSS', 'burn', charId);
            ui.addLogEntry(`🔥 <span style="color:#ff6600">Burn applied!</span>`);
        }

        const line = state.getCommentary(charId, 'attack');
        if (line) ui.addLogEntry(`<span style = "color:${charColor};opacity:0.7" > "${line}"</span> `);

        // ═══ Show combo counter ═══
        if (state.comboCounter > 1) {
            ui.addLogEntry(`🔥 <span style="color:#FFD700;font-weight:bold">${state.comboCounter}x COMBO! (${comboMult}x damage)</span>`);
        }

        ui.spawnDamageNumber(
            window.innerWidth * 0.7, window.innerHeight * 0.3,
            finalDmg, finalDmg > 30 ? 'crit' : 'normal'
        );
        ui.addLogEntry(`⚔ <span class="le-char">${char.display_name}</span> → ${ability.name} → <span class="le-dmg">-${finalDmg}</span>`);

        // Check boss phase change (only wave 3)
        if (state.wave >= 3) {
            const newPhase = state.getBossPhase();
            if (newPhase !== lastPhase) {
                lastPhase = newPhase;
                engine.setBossPhase(newPhase);
                engine.triggerShake(0.5, 1000);
                engine.spikeBloom(4, 800);
                engine.spikeChroma(0.02, 600);

                const phaseNames = ['Sentinel', 'Rage Protocol', 'Singularity'];
                const phaseTaunts = [
                    '',
                    'RAGE PROTOCOL ACTIVATED. You will regret every point of damage.',
                    'SINGULARITY ENGAGED. I will collapse reality around you.'
                ];

                await sleep(500);
                ui.showAnnouncement(`BOSS PHASE ${newPhase} `, phaseNames[newPhase - 1], 3000);
                if (phaseTaunts[newPhase - 1]) {
                    setTimeout(() => ui.showBossTaunt(phaseTaunts[newPhase - 1], 3500), 1500);
                }

                try { await API.bossAdapt('Player attacking aggressively', newPhase); }
                catch (e) { /* silently fail */ }
            }
        }
    }

    // Update UI
    await sleep(600);
    ui.updateCharacterPanels();
    ui.updateBossPanel();
    syncHPLabels();
    updateAPDisplay(charId);
    updateComboDisplay();
    updateWaveDisplay();

    // ═══ Check wave clear (waves 1-2): boss HP = 0 means wave cleared ═══
    if (state.wave <= 2 && (state.boss.base_stats?.current_health || 0) <= 0) {
        await handleWaveTransition();
        return;
    }

    // Check game over
    const result = state.isGameOver();
    if (result) {
        await handleGameOver(result);
        return;
    }

    // ═══ AP-based turn flow ═══
    // If character still has AP, stay on them
    if (state.getEnergy(charId) > 0) {
        state.isAnimating = false;
        ui.showAbilities(charId);
        ui.updateTurnInfo();
        updateAPDisplay(charId);
        return;
    }

    // Out of AP — advance turn
    state.nextTurn();
    state.isAnimating = false;

    const nextActive = state.getActiveCharacter();
    if (nextActive === 'BOSS') {
        await executeBossTurn();
    } else {
        ui.showAbilities(nextActive);
        ui.updateTurnInfo();
        engine.focusCharacter(nextActive, 300);
        updateAPDisplay(nextActive);
    }
}

// ─── Pass Turn (End Turn manually) ─────────────────────
window.executePassTurn = async function (charId) {
    if (state.isAnimating) return;
    state.isAnimating = true;

    const char = state.characters[charId];
    if (char) {
        ui.addLogEntry(`🛡 <span class="le-char">${char.display_name || charId}</span> rests and prepares. (+1 AP)`);
        ui.showAnnouncement('TURN PASSED', `${char.display_name || charId} recovers 1 AP`, 1500);

        // Give 1 AP
        const maxAp = state.maxEnergy || 3;
        const current = state.getEnergy(charId);
        if (current < maxAp) {
            state.energy[charId] = current + 1;
        }

        // Small heal or morale boost
        state.boostMorale(charId, 0.05);
        state.applyHeal(charId, 5); // Minor heal 5 hp
        engine.spawnHealEffect(charId);
    }

    // Spend remaining AP so turn ends
    state.spendEnergy(charId, state.getEnergy(charId));

    await sleep(800);

    // End turn
    state.nextTurn();
    state.isAnimating = false;

    const nextActive = state.getActiveCharacter();
    if (nextActive === 'BOSS') {
        await executeBossTurn();
    } else {
        ui.showAbilities(nextActive);
        ui.updateTurnInfo();
        engine.focusCharacter(nextActive, 300);
        updateAPDisplay(nextActive);
    }
}

// ─── Execute Combo ───────────────────────────────────────
async function executeCombo(combo, comboIndex) {
    if (state.isAnimating) return;
    state.isAnimating = true;

    combo.currentCd = combo.cooldown;
    state.combos[comboIndex].currentCd = combo.cooldown;

    // Epic announcement
    ui.showAnnouncement(combo.name, combo.desc, 2500);
    engine.triggerShake(0.4, 800);
    engine.spikeBloom(4, 1000);
    engine.spikeChroma(0.02, 800);

    await sleep(500);

    // Flash
    engine.triggerFlash('#FFD700');

    // Damage
    const actualDamage = Math.round(combo.damage * (0.9 + Math.random() * 0.2));
    state.applyDamage('BOSS', actualDamage);

    // VFX from each character
    for (const charId of combo.chars) {
        engine.spawnEnergyBeam(charId, 'BOSS', '#FFD700');
        await sleep(200);
    }

    engine.spawnParticleBurst(
        engine.characters.BOSS.group.position, 0xFFD700, 60, 5
    );
    engine.triggerFloorPulse(engine.characters.BOSS.group.position, 0xFFD700);

    // Heal if applicable
    if (combo.effect?.includes('heal_all')) {
        const healAmt = parseInt(combo.effect.match(/\d+/)?.[0] || '25');
        for (const id of Object.keys(state.characters)) {
            state.applyHeal(id, healAmt);
            engine.spawnHealEffect(id);
        }
    }

    // Damage number
    ui.spawnDamageNumber(
        window.innerWidth * 0.5,
        window.innerHeight * 0.3,
        actualDamage, 'combo'
    );

    ui.addLogEntry(`🔥 <span class="le-char">COMBO: ${combo.name}</span> → <span class="le-dmg">-${actualDamage}</span>`);

    await sleep(1000);

    // Check phase change
    const newPhase = state.getBossPhase();
    if (newPhase !== lastPhase) {
        lastPhase = newPhase;
        engine.setBossPhase(newPhase);
        engine.triggerShake(0.6, 1200);
        const phaseNames = ['Sentinel', 'Rage Protocol', 'Singularity'];
        ui.showAnnouncement(`BOSS PHASE ${newPhase} `, phaseNames[newPhase - 1], 3000);
    }

    // Update UI + sync labels
    ui.updateCharacterPanels();
    ui.updateBossPanel();
    syncHPLabels();

    // Check game over
    const result = state.isGameOver();
    if (result) { await handleGameOver(result); return; }

    // Next turn
    state.nextTurn();
    state.isAnimating = false;

    const nextActive = state.getActiveCharacter();
    if (nextActive === 'BOSS') {
        await executeBossTurn();
    } else {
        ui.showAbilities(nextActive);
        ui.updateTurnInfo();
    }
}

// ─── Boss Turn ───────────────────────────────────────────
async function executeBossTurn() {
    state.isAnimating = true;
    ui.updateTurnInfo();

    // Tick status effects on boss
    const bossTicks = state.tickStatusEffects('BOSS');
    for (const tick of bossTicks) {
        if (tick.effect === 'damage') {
            ui.addLogEntry(`\ud83d\udd25 <span style = "color:#ff6600" > Burn deals <b> ${tick.amount}</b> to Nexus Prime!</span> `);
            ui.spawnDamageNumber(window.innerWidth * 0.7, window.innerHeight * 0.25, tick.amount, 'boss');
        }
    }
    ui.updateBossPanel();
    syncHPLabels();

    // Check stun
    if (state.isStunned('BOSS')) {
        ui.addLogEntry(`\u26a1 <span style = "color:#ffdd00" > Nexus Prime is <b> STUNNED</b> !Turn skipped.</span> `);
        ui.showAnnouncement('STUNNED!', 'Nexus Prime cannot act', 1500);
        state.removeStatus('BOSS', 'stun');
        await sleep(1500);
        state.nextTurn();
        state.isAnimating = false;
        const nextActive = state.getActiveCharacter();
        if (nextActive === 'BOSS') { await executeBossTurn(); }
        else { ui.showAbilities(nextActive); ui.updateTurnInfo(); engine.focusCharacter(nextActive, 300); }
        return;
    }

    const ability = state.selectBossAbility();
    const targetId = state.selectBossTarget();
    const targetChar = state.characters[targetId];
    const targetName = targetChar?.display_name || targetId;

    // Camera focus on boss
    engine.focusCharacter('BOSS');

    ui.showAnnouncement('BOSS TURN', ability.name, 1500);
    await sleep(800);

    if (ability.type === 'defensive') {
        engine.spawnShieldEffect('BOSS', 0xFF4488);
        ui.addLogEntry(`🛡 <span class="le-char">Nexus Prime</span> uses ${ability.name} `);
    } else if (ability.type === 'aoe') {
        // AOE — hit all characters
        const phase = state.getBossPhase();
        const mult = [1, 1.4, 1.8][phase - 1] || 1;

        for (const [id, char] of Object.entries(state.characters)) {
            if ((char.base_stats?.current_health || 0) <= 0) continue;

            const damage = Math.round(
                (ability.damage || 20) * mult * (0.8 + Math.random() * 0.4)
                - (char.base_stats?.defense || 0) * 0.3
            );
            const actualDmg = Math.max(1, damage);

            engine.spawnEnergyBeam('BOSS', id, '#FF4488');
            state.applyDamage(id, actualDmg);
            state.degradeMorale(id, 0.1); // AoE damage lowers morale

            ui.spawnDamageNumber(
                window.innerWidth * 0.2,
                window.innerHeight * (0.25 + Math.random() * 0.3),
                actualDmg, 'boss'
            );

            // Check death
            if ((char.base_stats?.current_health || 0) <= 0) {
                engine.killCharacter(id);
                ui.addLogEntry(`💀 <span class="le-char">${char.display_name}</span> has fallen!`);
            }
        }

        engine.triggerShake(0.4, 500);
        engine.triggerFlash('#FF4488');
        engine.spikeChroma(0.015, 300);
        engine.triggerFloorPulse(engine.characters.BOSS.group.position, 0xFF4488);

        ui.addLogEntry(`💥 <span class="le-char">Nexus Prime</span> → ${ability.name} → ALL`);
    } else {
        // Single target
        const phase = state.getBossPhase();
        const mult = [1, 1.4, 1.8][phase - 1] || 1;
        const damage = Math.round(
            (ability.damage || 20) * mult * (0.9 + Math.random() * 0.2)
            - (targetChar?.base_stats?.defense || 0) * 0.3
        );
        const actualDmg = Math.max(1, damage);

        // Enhanced boss attack VFX
        engine.animateAttack('BOSS', targetId, () => {
            engine.spawnEnergyBeam('BOSS', targetId, '#FF4488');
        });
        await sleep(500);

        // Sprite takes damage — shake + flash red
        engine.spriteTakeDamage(targetId);

        // 3D floating damage number above target
        if (engine.characters[targetId]) {
            engine.spawnDamageNumber(engine.characters[targetId].group.position, actualDmg, '#FF4488');
        }

        state.applyDamage(targetId, actualDmg, 'BOSS');
        state.degradeMorale(targetId, 0.15); // Focused damage lowers morale heavily

        // Boss applies weaken debuff (25% chance)
        if (Math.random() < 0.25 && targetChar) {
            state.applyStatus(targetId, 'weaken', 'BOSS');
            ui.addLogEntry(`\ud83d\udc80 <span style = "color:#884444" > ${targetName} is weakened!</span> `);
        }

        ui.spawnDamageNumber(
            window.innerWidth * 0.2,
            window.innerHeight * 0.4,
            actualDmg, 'boss'
        );

        // Character hurt commentary
        const hurtLine = state.getCommentary(targetId, 'hurt');
        if (hurtLine) ui.addLogEntry(`<span style = "color:${state.characters[targetId]?.color || '#fff'};opacity:0.7" > "${hurtLine}"</span> `);

        ui.addLogEntry(`⚔ <span class="le-char">Nexus Prime</span> → ${ability.name} → <span class="le-char">${targetName}</span> <span class="le-dmg">-${actualDmg}</span>`);

        // Check death
        if (targetChar && (targetChar.base_stats?.current_health || 0) <= 0) {
            engine.killCharacter(targetId);
            ui.addLogEntry(`💀 <span class="le-char">${targetName}</span> has fallen!`);

            // Danger vignette if low team
            const aliveCount = Object.values(state.characters).filter(
                c => (c.base_stats?.current_health || 0) > 0).length;
            if (aliveCount <= 1) engine.setDangerVignette(true);
        }

        // Stress effect
        if (ability.effect?.includes('stress')) {
            if (targetChar) {
                targetChar.emotions = targetChar.emotions || {};
                targetChar.emotions.stress = Math.min(1,
                    (targetChar.emotions.stress || 0) + 0.15);
            }
        }
    }

    // Set cooldown
    ability.currentCooldown = ability.cooldown;

    await sleep(800);

    ui.updateCharacterPanels();
    ui.updateBossPanel();
    syncHPLabels();

    // Check game over
    const result = state.isGameOver();
    if (result) { await handleGameOver(result); return; }

    // Next turn
    state.nextTurn();
    state.isAnimating = false;

    const nextActive = state.getActiveCharacter();
    ui.updateTurnInfo();

    if (nextActive === 'BOSS') {
        await executeBossTurn();
    } else {
        // Auto-Banter system trigger (every ~3 turns)
        if (!window.banterTurnCount) window.banterTurnCount = 0;
        window.banterTurnCount++;

        if (window.banterTurnCount % 3 === 0) {
            const banter = state.getCommentary(nextActive, state.wave === 3 ? 'boss_phase' : 'attack');
            if (banter) {
                const charColor = typeof CHAR_CONFIG !== 'undefined' && CHAR_CONFIG[nextActive] ? CHAR_CONFIG[nextActive].color : '#fff';
                const charName = state.characters[nextActive]?.display_name || nextActive;
                ui.addLogEntry(`💬 <span style="color:${charColor};font-weight:bold">${charName}</span>: "${banter}"`);
                ui.showAnnouncement('', `${charName}: "${banter}"`, 2500);
            }
        }

        ui.showAbilities(nextActive);
        engine.focusCharacter(nextActive, 300);
        updateAPDisplay(nextActive);
    }
}

// ─── Game Over ───────────────────────────────────────────
async function handleGameOver(result) {
    state.isAnimating = true;
    clearInterval(timerInterval);
    engine.setDangerVignette(false);

    if (result === 'win') {
        engine.triggerFlash('#00FF88');
        engine.spikeBloom(5, 2000);
        engine.triggerShake(0.6, 1500);
        state.isAnimating = false;

        // Fireworks
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                engine.spawnParticleBurst(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 6,
                        2 + Math.random() * 2,
                        (Math.random() - 0.5) * 6
                    ),
                    [0x00ffff, 0xaa44ff, 0x4488ff, 0xffd700, 0x00ff88][i % 5],
                    40, 5
                );
            }, i * 400);
        }

        ui.showAnnouncement('VICTORY', 'Nexus Prime has been defeated!', 4000);

        // Recalibrate emotions
        for (const id of Object.keys(state.characters)) {
            try { await API.recalibrateEmotions(id, 'win', 'Boss defeated'); } catch (e) { }
        }

        await sleep(4000);
        enterHouseMode();
    } else {
        engine.spikeChroma(0.03, 3000);
        engine.triggerShake(0.3, 2000);
        ui.showAnnouncement('DEFEAT', 'Your squad has fallen...', 4000);

        for (const id of Object.keys(state.characters)) {
            try { await API.recalibrateEmotions(id, 'lose', 'Squad wiped'); } catch (e) { }
        }

        await sleep(4000);

        // Reset and return to house
        try { await API.resetState(); } catch (e) { }
        await state.initialize();
        lastPhase = 1;

        // Revive characters visually
        for (const [id, char] of Object.entries(engine.characters)) {
            if (id === 'BOSS') continue;
            char.isAlive = true;
            char.group.visible = true;
            char.group.scale.set(1, 1, 1);
            char.group.position.y = 0;
        }

        enterHouseMode();
    }
}

// ─── Dialogue ────────────────────────────────────────────
async function handleDialogue(charId, message) {
    ui.addDialogueMessage(message, 'player');
    ui.showThinking();

    try {
        const response = await API.dialogue(charId, message,
            state.mode === 'battle' ? 'battle' : 'house');

        ui.removeThinking();

        const text = response.dialogue_text || response.response || 'I have nothing to say.';
        ui.addDialogueMessage(text, 'character');

        // Update emotions if returned
        if (response.updated_emotions) {
            const char = state.characters[charId];
            if (char) char.emotions = response.updated_emotions;
            ui.updateCharacterPanels();
        }

        // Play voice if available
        if (response.voice_url) {
            const audio = document.getElementById('voiceAudio');
            audio.src = response.voice_url;
            audio.play().catch(() => { });
        }
    } catch (e) {
        ui.removeThinking();
        ui.addDialogueMessage('*neural link interrupted*', 'system');
    }
}

// ─── Event Bindings ──────────────────────────────────────
function bindEvents() {
    // Ability selection
    ui.onAbilitySelected = (charId, ability, index) => {
        executeAbility(charId, ability, index);
    };

    // Combo selection
    ui.onComboSelected = (combo, index) => {
        executeCombo(combo, index);
    };

    // Start battle button
    document.getElementById('startBattleBtn')?.addEventListener('click', async () => {
        try { await API.resetState(); } catch (e) { }
        await state.initialize();
        lastPhase = 1;
        enterBattleMode();
    });

    // House character cards
    document.querySelectorAll('.house-char-card').forEach(card => {
        card.addEventListener('click', () => {
            const charId = card.dataset.char;
            if (charId) {
                dialogueCharId = charId;
                ui.openDialogue(charId);
                engine.focusCharacter(charId);
            }
        });
    });

    // Dialogue close
    document.getElementById('dialogueClose')?.addEventListener('click', () => {
        ui.closeDialogue();
        dialogueCharId = null;
    });

    // Dialogue send
    const sendDialogue = () => {
        const input = document.getElementById('dialogueInput');
        if (!input || !dialogueCharId) return;
        const msg = input.value.trim();
        if (!msg) return;
        input.value = '';
        handleDialogue(dialogueCharId, msg);
    };

    document.getElementById('dialogueSend')?.addEventListener('click', sendDialogue);
    document.getElementById('dialogueInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendDialogue();
    });

    // Battle log toggle
    document.getElementById('logToggle')?.addEventListener('click', () => {
        const entries = document.getElementById('logEntries');
        if (entries) {
            entries.style.display = entries.style.display === 'none' ? 'block' : 'none';
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (state.mode !== 'battle' || state.isAnimating) return;

        // 1-5 for abilities
        const num = parseInt(e.key);
        if (num >= 1 && num <= 5) {
            const active = state.getActiveCharacter();
            if (active && active !== 'BOSS') {
                const char = state.characters[active];
                const ab = char?.abilities?.[num - 1];
                if (ab && ab.currentCooldown <= 0) {
                    executeAbility(active, ab, num - 1);
                }
            }
        }

        // R to rotate camera
        if (e.key === 'r' || e.key === 'R') {
            engine.targetCameraAngle += Math.PI / 4;
        }
    });

    // IN-BATTLE chat buttons
    document.querySelectorAll('.chat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const charId = btn.dataset.chat;
            if (charId && !state.isAnimating) {
                dialogueCharId = charId;
                ui.openDialogue(charId);
                engine.focusCharacter(charId, 800);
            }
        });
    });

    // Dialogue CLOSE button
    document.getElementById('dialogueClose')?.addEventListener('click', () => {
        ui.closeDialogue();
        dialogueCharId = null;
        if (state.mode === 'battle') {
            engine.targetCameraRadius = 18;
        }
    });

    // Dialogue SEND button + Enter key
    const sendDialogueMessage = async () => {
        const input = document.getElementById('dialogueInput');
        const msg = input?.value?.trim();
        if (!msg || !dialogueCharId) return;

        // Show player message
        ui.addDialogueMessage(msg, 'player');
        input.value = '';

        try {
            const resp = await fetch('/api/dialogue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    character_id: dialogueCharId,
                    player_message: msg,
                    battle_context: state.mode === 'battle' ? {
                        turn: state.currentTurn,
                        boss_hp: state.boss.base_stats?.current_health,
                        phase: state.getBossPhase()
                    } : null
                })
            });
            const data = await resp.json();

            // Show character reply
            ui.addDialogueMessage(data.reply_text || 'No response.', 'character');

            // Update emotions if provided
            if (data.emotion_delta) {
                const char = state.characters[dialogueCharId];
                if (char?.emotions) {
                    for (const [key, val] of Object.entries(data.emotion_delta)) {
                        if (char.emotions[key] !== undefined) {
                            char.emotions[key] = Math.max(0, Math.min(1, char.emotions[key] + val));
                        }
                    }
                    ui.updateCharacterPanels();
                }
            }

            // Play voice if available
            if (data.audio_url) {
                const audio = document.getElementById('voiceAudio');
                if (audio) {
                    audio.src = data.audio_url;
                    audio.play().catch(() => { });
                }
            }
        } catch (err) {
            ui.addDialogueMessage('Connection lost. Try again.', 'system');
        }
    };

    document.getElementById('dialogueSend')?.addEventListener('click', sendDialogueMessage);
    document.getElementById('dialogueInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendDialogueMessage();
    });

    // ─── Synapse Link (window-exposed for onclick) ─────────────────────
    window.openSynapseLink = function () {
        const m = document.getElementById('synapseModal');
        const inp = document.getElementById('synapseInput');
        const ct = document.getElementById('synapseCharTarget');
        if (!m) return;
        const active = state.getActiveCharacter?.() || state.turnOrder?.[0] || 'VEX';
        if (ct) ct.textContent = state.characters[active]?.display_name || active;
        if (inp) inp.value = '';
        m.classList.remove('hidden');
        if (inp) setTimeout(() => inp.focus(), 100);
    };

    window.closeSynapseLink = function () {
        const m = document.getElementById('synapseModal');
        const g = document.getElementById('synapseGenerateBtn');
        if (m) m.classList.add('hidden');
        if (g) { g.disabled = false; g.innerHTML = '<span class="gen-glow"></span>SYNTHESIZE ABILITY'; }
    };

    window.executeSynapseLink = async function () {
        const inp = document.getElementById('synapseInput');
        const g = document.getElementById('synapseGenerateBtn');
        const prompt = inp?.value?.trim();
        if (!prompt) return;
        const active = state.getActiveCharacter?.() || state.turnOrder?.[0] || 'VEX';
        if (g) { g.disabled = true; g.innerHTML = '<span class="gen-glow"></span>SYNTHESIZING...'; }
        try {
            const resp = await fetch('/api/ability/generate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ character_id: active, player_prompt: prompt, battle_context: [] })
            });
            const data = await resp.json();
            if (data.new_ability) {
                if (!state.characters[active].abilities) state.characters[active].abilities = [];
                const ab = { name: data.new_ability.name || 'Glitch Strike', damage: data.new_ability.damage || 25, cooldown: data.new_ability.cooldown || 2, type: data.new_ability.type || 'offensive', description: data.new_ability.description || 'Synthetic overload.', apCost: 2, currentCooldown: 0 };
                state.characters[active].abilities.push(ab);
                ui.showAnnouncement('SYNAPSE SUCCESS', `New ability: ${ab.name}`);
                ui.addLogEntry(`\u26a1 <span style="color:#00FFFF;font-weight:bold">SYNAPSE</span> \u2192 <span style="color:#FFD700">${ab.name}</span> (${ab.damage} DMG)`);
                ui.showAbilities(active);
            }
        } catch (err) { console.error('Synapse Error:', err); ui.showAnnouncement('SYNAPSE FAILED', 'Connection severed.'); }
        finally { window.closeSynapseLink(); }
    };
}

// ═══════════════════════════════════════════════════════════
// NEW GAMEPLAY UI HELPERS
// ═══════════════════════════════════════════════════════════

// ─── AP Display ──────────────────────────────────────────
function updateAPDisplay(charId) {
    const el = document.getElementById('apDisplay');
    if (!el) return;
    const ap = state.getEnergy(charId);
    const maxAp = state.maxEnergy;
    let pips = '';
    for (let i = 0; i < maxAp; i++) {
        pips += i < ap
            ? '<span class="ap-pip filled">◆</span>'
            : '<span class="ap-pip empty">◇</span>';
    }
    const charName = state.characters[charId]?.display_name || charId;
    el.innerHTML = `<span class="ap-label" > ${charName} AP</span> ${pips} `;
    el.classList.remove('hidden');
}

// ─── Combo Counter Display ───────────────────────────────
function updateComboDisplay() {
    const el = document.getElementById('comboDisplay');
    if (!el) return;
    if (state.comboCounter > 1) {
        el.innerHTML = `<span class="combo-count" > ${state.comboCounter}x</span><span class="combo-label">COMBO</span><span class="combo-mult">${state.comboMultiplier}x DMG</span>`;
        el.classList.remove('hidden');
        el.classList.add('combo-active');
    } else {
        el.classList.add('hidden');
        el.classList.remove('combo-active');
    }
}

// ─── Wave Display ────────────────────────────────────────
function updateWaveDisplay() {
    const el = document.getElementById('waveDisplay');
    if (!el) return;
    const w = state.wave;
    const max = state.maxWaves;
    const names = ['MINION WAVE', 'ELITE WAVE', 'BOSS FIGHT'];
    el.innerHTML = `<span class="wave-label" > WAVE ${w} /${max}</span> <span class="wave-name">${names[w - 1] || ''}</span>`;
    el.classList.remove('hidden');
}

// ─── Wave Transition ─────────────────────────────────────
async function handleWaveTransition() {
    state.isAnimating = true;

    // Dramatic announcement
    const titles = ['', 'WAVE CLEARED!', 'ELITES DEFEATED!'];
    const subtitles = ['', 'Void Knights incoming...', 'THE NEXUS PRIME EMERGES...'];

    ui.showAnnouncement(titles[state.wave] || 'WAVE CLEARED!', subtitles[state.wave] || '', 3000);
    engine.triggerShake(0.3, 800);
    engine.spikeBloom(3, 600);

    await sleep(2000);

    // Show recovery
    ui.showAnnouncement('SQUAD RECOVERY', 'Heroes healed 50% • Cooldowns reset • AP restored', 2500);

    await sleep(2500);

    // Advance wave
    state.wave++;
    const waveHpScale = [0.3, 0.5, 1.0]; // wave 1/2/3
    const realMaxHp = state.boss.base_stats.max_health_wave || 350;

    // Scale boss HP for this wave
    const newMaxHp = Math.round(realMaxHp * (waveHpScale[state.wave - 1] || 1.0));
    state.boss.base_stats.max_health = newMaxHp;
    state.boss.base_stats.current_health = newMaxHp;

    // Heal characters 50%, reset cooldowns & energy
    for (const char of Object.values(state.characters)) {
        if ((char.base_stats?.current_health || 0) > 0) {
            const heal = Math.round(char.base_stats.max_health * 0.5);
            char.base_stats.current_health = Math.min(
                char.base_stats.max_health,
                char.base_stats.current_health + heal
            );
        }
        char.abilities?.forEach(a => { a.currentCooldown = 0; });
    }
    for (const id of Object.keys(state.characters)) {
        state.energy[id] = state.maxEnergy;
    }
    state.comboCounter = 0;
    state.comboMultiplier = 1.0;

    updateWaveDisplay();

    // Wave 3 = boss appears
    if (state.wave >= 3) {
        ui.showAnnouncement('⚠ NEXUS PRIME', 'The boss has entered the arena!', 3000);
        engine.spikeBloom(5, 1000);
        engine.triggerShake(0.6, 1200);
        await sleep(2000);
        ui.showBossTaunt("You dare challenge Nexus Prime? How... quaint.");
    } else {
        ui.showAnnouncement(`WAVE ${state.wave} `, state.wave === 2 ? 'ELITE WAVE — Void Knights attack!' : 'FIGHT!', 2000);
        await sleep(1000);
    }

    // Restart turn queue
    state.startBattle();

    // Rescale boss HP again since startBattle calls _setupWave
    state.boss.base_stats.max_health = newMaxHp;
    state.boss.base_stats.current_health = newMaxHp;

    // Update all UI
    ui.updateCharacterPanels();
    ui.updateBossPanel();
    syncHPLabels();

    state.isAnimating = false;

    const nextActive = state.getActiveCharacter();
    if (nextActive && nextActive !== 'BOSS') {
        ui.showAbilities(nextActive);
        ui.updateTurnInfo();
        engine.focusCharacter(nextActive, 300);
        updateAPDisplay(nextActive);
    }
}

// ─── Sync floating 3D HP labels ──────────────────────────
function syncHPLabels() {
    for (const [id, char] of Object.entries(state.characters)) {
        const hp = char.base_stats?.current_health || 0;
        const maxHp = char.base_stats?.max_health || 1;
        const engineChar = engine.characters[id];
        if (engineChar) {
            engineChar.hpPercent = hp / maxHp;
            engine.updateHPLabel(id);
        }
    }
    // Boss
    const bHp = state.boss.base_stats?.current_health || 0;
    const bMax = state.boss.base_stats?.max_health || 1;
    if (engine.characters.BOSS) {
        engine.characters.BOSS.hpPercent = bHp / bMax;
        engine.updateHPLabel('BOSS');
    }
}

// ─── Start ───────────────────────────────────────────────
init().catch(err => {
    console.error('SENTIENT ARENA failed to initialize:', err);
    updateLoadBar(100, 'ERROR: ' + err.message);
});
