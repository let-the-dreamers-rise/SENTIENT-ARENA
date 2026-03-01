// ═══════════════════════════════════════════════════════════
// SENTIENT ARENA — Three.js 3D Engine v2
// HUMANOID characters, clear battlefield, tamed bloom,
// floating labels, arena pillars, attack animations
// ═══════════════════════════════════════════════════════════

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ─── Custom Shaders ──────────────────────────────────────
const VignetteShader = {
    uniforms: { tDiffuse: { value: null }, intensity: { value: 0.35 }, color: { value: new THREE.Vector3(0, 0, 0) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float intensity; uniform vec3 color; varying vec2 vUv;
        void main(){ vec4 t=texture2D(tDiffuse,vUv); float d=distance(vUv,vec2(0.5)); float v=smoothstep(0.5,0.9,d)*intensity; t.rgb=mix(t.rgb,color,v); gl_FragColor=t; }`
};
const ChromaShader = {
    uniforms: { tDiffuse: { value: null }, amount: { value: 0.0015 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
        void main(){ vec2 d=vUv-vec2(0.5); float l=length(d); vec2 o=d*amount*l;
        float r=texture2D(tDiffuse,vUv+o).r; float g=texture2D(tDiffuse,vUv).g; float b=texture2D(tDiffuse,vUv-o).b;
        gl_FragColor=vec4(r,g,b,1.0); }`
};

// ─── Build a humanoid figure from primitives ─────────────
function buildHumanoid(cfg) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.bodyColor),
        metalness: 0.45,
        roughness: 0.35,
        emissive: new THREE.Color(cfg.glowColor),
        emissiveIntensity: 0.15
    });
    const glow = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.glowColor),
        metalness: 0.6,
        roughness: 0.2,
        emissive: new THREE.Color(cfg.glowColor),
        emissiveIntensity: 0.4
    });

    // HEAD — sphere
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), mat.clone());
    head.position.y = 1.55;
    head.castShadow = true;
    group.add(head);

    // VISOR — glowing strip across face
    const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.05, 0.12),
        glow.clone()
    );
    visor.position.set(0, 1.55, 0.1);
    group.add(visor);

    // NECK
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.1, 8), mat.clone());
    neck.position.y = 1.38;
    group.add(neck);

    // TORSO — capsule-like (box with rounded edges via two stacked)
    const torsoWidth = cfg.bulky ? 0.45 : 0.32;
    const torsoDepth = cfg.bulky ? 0.3 : 0.2;
    const torso = new THREE.Mesh(
        new THREE.BoxGeometry(torsoWidth, 0.5, torsoDepth),
        mat.clone()
    );
    torso.position.y = 1.05;
    torso.castShadow = true;
    group.add(torso);

    // CHEST EMBLEM — glowing diamond
    const emblem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.06, 0),
        glow.clone()
    );
    emblem.position.set(0, 1.15, torsoDepth / 2 + 0.02);
    group.add(emblem);

    // WAIST
    const waist = new THREE.Mesh(
        new THREE.BoxGeometry(torsoWidth * 0.85, 0.15, torsoDepth * 0.85),
        mat.clone()
    );
    waist.position.y = 0.72;
    group.add(waist);

    // LEFT ARM
    const armWidth = cfg.bulky ? 0.12 : 0.08;
    const lArm = new THREE.Mesh(
        new THREE.CylinderGeometry(armWidth, armWidth * 0.8, 0.45, 8),
        mat.clone()
    );
    lArm.position.set(-torsoWidth / 2 - armWidth, 1.1, 0);
    lArm.rotation.z = 0.15;
    lArm.castShadow = true;
    group.add(lArm);

    // RIGHT ARM
    const rArm = new THREE.Mesh(
        new THREE.CylinderGeometry(armWidth, armWidth * 0.8, 0.45, 8),
        mat.clone()
    );
    rArm.position.set(torsoWidth / 2 + armWidth, 1.1, 0);
    rArm.rotation.z = -0.15;
    rArm.castShadow = true;
    group.add(rArm);

    // FOREARMS (hands glow)
    const lHand = new THREE.Mesh(new THREE.SphereGeometry(armWidth * 1.1, 8, 8), glow.clone());
    lHand.position.set(-torsoWidth / 2 - armWidth, 0.82, 0);
    group.add(lHand);
    const rHand = new THREE.Mesh(new THREE.SphereGeometry(armWidth * 1.1, 8, 8), glow.clone());
    rHand.position.set(torsoWidth / 2 + armWidth, 0.82, 0);
    group.add(rHand);

    // LEFT LEG
    const legWidth = cfg.bulky ? 0.1 : 0.07;
    const lLeg = new THREE.Mesh(
        new THREE.CylinderGeometry(legWidth, legWidth * 0.9, 0.5, 8),
        mat.clone()
    );
    lLeg.position.set(-0.1, 0.4, 0);
    lLeg.castShadow = true;
    group.add(lLeg);

    // RIGHT LEG
    const rLeg = lLeg.clone();
    rLeg.position.set(0.1, 0.4, 0);
    group.add(rLeg);

    // FEET — small boxes
    const lFoot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.15), mat.clone());
    lFoot.position.set(-0.1, 0.12, 0.03);
    group.add(lFoot);
    const rFoot = lFoot.clone();
    rFoot.position.set(0.1, 0.12, 0.03);
    group.add(rFoot);

    // WEAPON (class-specific)
    if (cfg.weapon === 'blade') {
        const blade = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.6, 0.02),
            glow.clone()
        );
        blade.position.set(torsoWidth / 2 + armWidth + 0.06, 1.0, 0);
        blade.rotation.z = -0.3;
        group.add(blade);
    } else if (cfg.weapon === 'staff') {
        const staff = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8),
            glow.clone()
        );
        staff.position.set(torsoWidth / 2 + armWidth + 0.08, 1.0, 0);
        group.add(staff);
        // Orb at top
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), glow.clone());
        orb.position.set(torsoWidth / 2 + armWidth + 0.08, 1.55, 0);
        group.add(orb);
    } else if (cfg.weapon === 'shield') {
        const shield = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.4, 0.3),
            glow.clone()
        );
        shield.position.set(-torsoWidth / 2 - armWidth - 0.06, 1.0, 0);
        group.add(shield);
    }

    // SHOULDER PADS (tank gets big ones)
    if (cfg.bulky) {
        const lPad = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.15), mat.clone());
        lPad.position.set(-torsoWidth / 2 - 0.04, 1.3, 0);
        group.add(lPad);
        const rPad = lPad.clone();
        rPad.position.set(torsoWidth / 2 + 0.04, 1.3, 0);
        group.add(rPad);
    }

    // Store body parts for animation
    group.userData.bodyParts = { head, torso, lArm, rArm, lLeg, rLeg, emblem, visor };
    return group;
}

// ─── Build a boss entity from primitives ─────────────────
function buildBossModel(color) {
    const group = new THREE.Group();
    const bossColor = new THREE.Color(color);
    const mat = new THREE.MeshStandardMaterial({
        color: bossColor, metalness: 0.6, roughness: 0.25,
        emissive: bossColor, emissiveIntensity: 0.2
    });
    const glow = new THREE.MeshStandardMaterial({
        color: bossColor, metalness: 0.5, roughness: 0.2,
        emissive: bossColor, emissiveIntensity: 0.5
    });

    // MAIN BODY — tall imposing torso
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 1), mat.clone());
    body.position.y = 2.0;
    body.scale.set(1, 1.3, 0.8);
    body.castShadow = true;
    group.add(body);

    // HEAD — angular, menacing
    const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), mat.clone());
    head.position.y = 3.0;
    head.castShadow = true;
    group.add(head);

    // EYES — two glowing slits
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const lEye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.05), eyeMat);
    lEye.position.set(-0.1, 3.02, 0.2);
    group.add(lEye);
    const rEye = lEye.clone();
    rEye.position.set(0.1, 3.02, 0.2);
    group.add(rEye);

    // ARMS — thick, threatening
    const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.8, 8), mat.clone());
    lArm.position.set(-0.8, 2.0, 0);
    lArm.rotation.z = 0.4;
    group.add(lArm);
    const rArm = lArm.clone();
    rArm.position.set(0.8, 2.0, 0);
    rArm.rotation.z = -0.4;
    group.add(rArm);

    // CLAWS
    for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 3; i++) {
            const claw = new THREE.Mesh(
                new THREE.ConeGeometry(0.03, 0.2, 4),
                glow.clone()
            );
            claw.position.set(side * 0.95, 1.5, (i - 1) * 0.08);
            claw.rotation.z = side * 0.3;
            group.add(claw);
        }
    }

    // FLOATING SHARDS — orbiting threat indicators
    const shardGroup = new THREE.Group();
    for (let i = 0; i < 8; i++) {
        const s = new THREE.Mesh(
            new THREE.TetrahedronGeometry(0.08 + Math.random() * 0.06, 0),
            glow.clone()
        );
        const angle = (i / 8) * Math.PI * 2;
        s.userData.orbitAngle = angle;
        s.userData.orbitRadius = 1.2 + Math.random() * 0.3;
        s.userData.orbitSpeed = 0.3 + Math.random() * 0.3;
        s.userData.floatOffset = Math.random() * Math.PI * 2;
        shardGroup.add(s);
    }
    group.add(shardGroup);

    // SPINE SPIKES (down the back)
    for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.04, 0.25, 4),
            glow.clone()
        );
        spike.position.set(0, 1.5 + i * 0.35, -0.4);
        spike.rotation.x = -0.4;
        group.add(spike);
    }

    // BASE — hovering over a dark ring
    const baseRing = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 1.2, 32),
        new THREE.MeshBasicMaterial({ color: bossColor, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
    );
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.y = 0.02;
    group.add(baseRing);

    group.userData.bodyParts = { body, head, lArm, rArm, shardGroup, lEye, rEye, baseRing };
    return group;
}

// ─── Class-specific aura effects ─────────────────────────
function buildVexAura(color) {
    const g = new THREE.Group();
    // Lightning crackling field — 6 jagged energy lines
    for (let i = 0; i < 6; i++) {
        const pts = [];
        const a = (i / 6) * Math.PI * 2;
        for (let j = 0; j < 5; j++) {
            const r = 0.3 + j * 0.15;
            const jitter = (Math.random() - 0.5) * 0.15;
            pts.push(new THREE.Vector3(Math.cos(a + jitter) * r, 0.8 + j * 0.25 + jitter, Math.sin(a + jitter) * r));
        }
        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 })
        );
        line.userData.boltId = i;
        g.add(line);
    }
    // Energy sparks — small particles orbiting fast
    for (let i = 0; i < 12; i++) {
        const s = new THREE.Mesh(
            new THREE.SphereGeometry(0.015, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 })
        );
        s.userData.sparkAngle = (i / 12) * Math.PI * 2;
        s.userData.sparkSpeed = 2 + Math.random() * 2;
        s.userData.sparkRadius = 0.35 + Math.random() * 0.2;
        s.userData.sparkY = 0.8 + Math.random() * 0.8;
        g.add(s);
    }
    // Base energy pool
    const pool = new THREE.Mesh(
        new THREE.CircleGeometry(0.6, 32),
        new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
    );
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.03;
    g.add(pool);
    return g;
}

function buildLyraAura(color) {
    const g = new THREE.Group();
    // Floating rune circle
    const runeRing = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.6, 6),
        new THREE.MeshBasicMaterial({ color: 0xaa44ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
    );
    runeRing.rotation.x = -Math.PI / 2; runeRing.position.y = 0.15;
    g.add(runeRing);
    // Inner rune ring
    const inner = new THREE.Mesh(
        new THREE.RingGeometry(0.35, 0.38, 6),
        new THREE.MeshBasicMaterial({ color: 0xcc66ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
    );
    inner.rotation.x = -Math.PI / 2; inner.position.y = 0.15;
    g.add(inner);
    // Orbiting mystic orbs — 4 glowing spheres
    for (let i = 0; i < 4; i++) {
        const orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xcc66ff, transparent: true, opacity: 0.7 })
        );
        orb.userData.orbAngle = (i / 4) * Math.PI * 2;
        orb.userData.orbSpeed = 0.8 + Math.random() * 0.3;
        orb.userData.orbRadius = 0.5;
        orb.userData.orbY = 1.2 + Math.random() * 0.4;
        g.add(orb);
    }
    // Mystic particle veil — rising purple motes
    for (let i = 0; i < 8; i++) {
        const mote = new THREE.Mesh(
            new THREE.SphereGeometry(0.01, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xaa44ff, transparent: true, opacity: 0.5 })
        );
        mote.userData.motePhase = Math.random() * Math.PI * 2;
        mote.userData.moteSpeed = 0.3 + Math.random() * 0.3;
        mote.userData.moteRadius = 0.2 + Math.random() * 0.3;
        g.add(mote);
    }
    g.userData.runeRing = runeRing;
    g.userData.innerRing = inner;
    return g;
}

function buildKaelAura(color) {
    const g = new THREE.Group();
    // Hexagonal shield barrier — wireframe hex
    const hex = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 1.6, 6, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.06, side: THREE.DoubleSide, wireframe: true })
    );
    hex.position.y = 1.0;
    g.add(hex);
    // Solid hex shell (barely visible)
    const hexSolid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.53, 0.53, 1.55, 6, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.02, side: THREE.DoubleSide })
    );
    hexSolid.position.y = 1.0;
    g.add(hexSolid);
    // Ground crack lines — 6 radial lines
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const pts = [
            new THREE.Vector3(0, 0.03, 0),
            new THREE.Vector3(Math.cos(a) * 0.8, 0.03, Math.sin(a) * 0.8)
        ];
        const crack = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.2 })
        );
        g.add(crack);
    }
    // Heavy energy pool
    const pool = new THREE.Mesh(
        new THREE.CircleGeometry(0.7, 6),
        new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.06, side: THREE.DoubleSide })
    );
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.03;
    g.add(pool);
    g.userData.hex = hex;
    g.userData.hexSolid = hexSolid;
    return g;
}

function buildBossAura(color) {
    const g = new THREE.Group();
    // Enormous energy rings — 3 concentric rotating rings
    for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(1.0 + i * 0.4, 0.02, 8, 32),
            new THREE.MeshBasicMaterial({ color: 0xff4488, transparent: true, opacity: 0.15 - i * 0.03 })
        );
        ring.position.y = 2.0;
        ring.rotation.x = Math.PI / 2 + i * 0.2;
        ring.userData.ringSpeed = 0.4 + i * 0.2;
        ring.userData.ringAxis = i;
        g.add(ring);
    }
    // Particle storm — many small particles swirling
    for (let i = 0; i < 20; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.02, 4, 4),
            new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xff0000 : 0xff4488, transparent: true, opacity: 0.6 })
        );
        p.userData.stormAngle = (i / 20) * Math.PI * 2;
        p.userData.stormSpeed = 1 + Math.random();
        p.userData.stormRadius = 1.2 + Math.random() * 0.6;
        p.userData.stormY = 1.5 + Math.random() * 2;
        g.add(p);
    }
    // Ground dark energy pool
    const pool = new THREE.Mesh(
        new THREE.CircleGeometry(1.5, 32),
        new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.06, side: THREE.DoubleSide })
    );
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.03;
    g.add(pool);
    return g;
}

// ─── Engine Class ────────────────────────────────────────
export class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
        this.characters = {};
        this.particles = [];
        this.shakeOffset = new THREE.Vector3();
        this.shakeIntensity = 0;
        this.shakeDecay = 0.92;
        this.isArenaMode = true;
        this.cameraTarget = new THREE.Vector3(0, 1.5, 0);
        this.cameraAngle = 0;
        this.cameraRadius = 18;
        this.cameraHeight = 9;
        this.targetCameraAngle = 0;
        this.targetCameraRadius = 18;
        this.targetCameraHeight = 9;
        this.bossPhase = 1;
        this.arenaEmissiveIntensity = 0.25;
        this.targetArenaColor = new THREE.Color(0x00cccc);
        this.currentArenaColor = new THREE.Color(0x00cccc);
        this._pulseActive = false;

        this._initRenderer();
        this._initCamera();
        this._initLabelRenderer();
        this._initLights();
        this._initPostProcessing();
        this._initArena();
        this._initAmbientParticles();
    }

    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.9;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x060612);
        window.addEventListener('resize', () => this._onResize());
    }

    _initCamera() {
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, this.cameraHeight, this.cameraRadius);
        this.camera.lookAt(0, 1, 0);
    }

    _initLabelRenderer() {
        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        this.labelRenderer.domElement.id = 'labelLayer';
        document.body.appendChild(this.labelRenderer.domElement);
    }

    _initLights() {
        this.scene.add(new THREE.AmbientLight(0x1a1a30, 1.0));

        this.sunLight = new THREE.DirectionalLight(0x5577aa, 2.5);
        this.sunLight.position.set(5, 12, 5);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(2048, 2048);
        const sc = this.sunLight.shadow.camera;
        sc.near = 0.5; sc.far = 30; sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -10;
        this.scene.add(this.sunLight);

        // Dramatic colored edge lights
        this.edgeLights = [];
        const edgeColors = [0x00aacc, 0x8833cc, 0x3366cc, 0xcc3366];
        const edgePos = [[9, 4, 0], [-9, 4, 0], [0, 4, 9], [0, 4, -9]];
        for (let i = 0; i < 4; i++) {
            const l = new THREE.PointLight(edgeColors[i], 500, 22);
            l.position.set(...edgePos[i]);
            this.scene.add(l);
            this.edgeLights.push(l);
        }

        // Floor-level rim lights for atmosphere
        const rimColors = [0x00ffcc, 0xff4488];
        const rimPos = [[7, 0.5, 7], [-7, 0.5, -7]];
        for (let i = 0; i < 2; i++) {
            const rim = new THREE.PointLight(rimColors[i], 200, 16);
            rim.position.set(...rimPos[i]);
            this.scene.add(rim);
        }

        // Brighter overhead fill
        const fill = new THREE.SpotLight(0x334466, 300);
        fill.position.set(0, 12, 0);
        fill.angle = Math.PI / 3;
        fill.penumbra = 0.8;
        this.scene.add(fill);

        this.scene.add(new THREE.HemisphereLight(0x181830, 0x080815, 0.6));
    }

    _initPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        // Cinematic bloom — atmospheric glow
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.4, 0.85);
        this.bloomPass.threshold = 0.35;
        this.bloomPass.strength = 0.9;
        this.bloomPass.radius = 0.4;
        this.composer.addPass(this.bloomPass);

        this.chromaPass = new ShaderPass(ChromaShader);
        this.chromaPass.uniforms.amount.value = 0.001;
        this.composer.addPass(this.chromaPass);

        this.vignettePass = new ShaderPass(VignetteShader);
        this.vignettePass.uniforms.intensity.value = 0.45;
        this.composer.addPass(this.vignettePass);
    }

    _initArena() {
        // Floor with grid shader
        const floorGeo = new THREE.CircleGeometry(12, 64);
        this.arenaFloorMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 }, uColor: { value: new THREE.Color(0x00cccc) },
                uIntensity: { value: 0.25 }, uPulseOrigin: { value: new THREE.Vector2(0, 0) },
                uPulseRadius: { value: 0 }, uPulseColor: { value: new THREE.Color(0x00cccc) }
            },
            vertexShader: `varying vec2 vUv; varying vec3 vPos;
                void main(){ vUv=uv; vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
            fragmentShader: `
                uniform float uTime; uniform vec3 uColor; uniform float uIntensity;
                uniform vec2 uPulseOrigin; uniform float uPulseRadius; uniform vec3 uPulseColor;
                varying vec2 vUv; varying vec3 vPos;
                float grid(vec2 p, float s){ vec2 g=abs(fract(p/s-0.5)-0.5)/fwidth(p/s); return 1.0-min(min(g.x,g.y),1.0); }
                void main(){
                    vec3 base=vec3(0.015,0.015,0.03);
                    float g1=grid(vPos.xz,1.0)*0.2; float g2=grid(vPos.xz,0.25)*0.05;
                    float d=length(vPos.xz)/12.0;
                    float radial=1.0-smoothstep(0.0,1.0,d);
                    vec3 gc=uColor*(g1+g2)*uIntensity*radial*1.2;
                    float pd=length(vPos.xz-uPulseOrigin);
                    float pulse=smoothstep(uPulseRadius-0.4,uPulseRadius,pd)*(1.0-smoothstep(uPulseRadius,uPulseRadius+0.4,pd));
                    vec3 pg=uPulseColor*pulse*1.5;
                    float edge=smoothstep(0.75,1.0,d)*0.08*(sin(uTime*1.5)*0.5+0.5);
                    gl_FragColor=vec4(base+gc+pg+uColor*edge,1.0);
                }`
        });
        const floor = new THREE.Mesh(floorGeo, this.arenaFloorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Outer ring
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(11.5, 12.2, 64),
            new THREE.MeshBasicMaterial({ color: 0x00cccc, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.01;
        this.scene.add(ring);
        this.arenaRing = ring;

        // ARENA PILLARS — 8 pillars around the edge
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = Math.cos(angle) * 10;
            const z = Math.sin(angle) * 10;

            // Pillar body
            const pillar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15, 0.2, 3.5, 8),
                new THREE.MeshStandardMaterial({ color: 0x1a1a30, metalness: 0.7, roughness: 0.3 })
            );
            pillar.position.set(x, 1.75, z);
            pillar.castShadow = true;
            this.scene.add(pillar);

            // Pillar glow top
            const glow = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 8, 8),
                new THREE.MeshBasicMaterial({
                    color: i % 2 === 0 ? 0x00cccc : 0x8833cc,
                    transparent: true, opacity: 0.6
                })
            );
            glow.position.set(x, 3.6, z);
            this.scene.add(glow);

            // Pillar base ring
            const base = new THREE.Mesh(
                new THREE.RingGeometry(0.3, 0.5, 16),
                new THREE.MeshBasicMaterial({
                    color: i % 2 === 0 ? 0x00cccc : 0x8833cc,
                    transparent: true, opacity: 0.1, side: THREE.DoubleSide
                })
            );
            base.rotation.x = -Math.PI / 2;
            base.position.set(x, 0.02, z);
            this.scene.add(base);
        }

        // Arena center marker
        const center = new THREE.Mesh(
            new THREE.RingGeometry(0.3, 0.5, 32),
            new THREE.MeshBasicMaterial({ color: 0x00cccc, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
        );
        center.rotation.x = -Math.PI / 2;
        center.position.y = 0.015;
        this.scene.add(center);

        // Fog — lighter
        this.scene.fog = new THREE.FogExp2(0x060612, 0.025);
    }

    _initAmbientParticles() {
        const count = 120;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = 3 + Math.random() * 8;
            positions[i * 3] = Math.cos(a) * r;
            positions[i * 3 + 1] = 0.5 + Math.random() * 4;
            positions[i * 3 + 2] = Math.sin(a) * r;
            const c = new THREE.Color().setHSL(0.5 + Math.random() * 0.15, 0.5, 0.5);
            colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.ambientParts = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.025, vertexColors: true, transparent: true, opacity: 0.4,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.scene.add(this.ambientParts);
    }

    // ─── Create HD-2D Character (portrait billboard) ───
    createCharacter(id, config) {
        const group = new THREE.Group();
        group.position.copy(config.position);

        // Load portrait texture as billboard sprite
        const texLoader = new THREE.TextureLoader();
        const tex = texLoader.load(`/static/game/img/${id.toLowerCase()}.png`);
        tex.colorSpace = THREE.SRGBColorSpace;

        const spriteMat = new THREE.SpriteMaterial({
            map: tex, transparent: true, alphaTest: 0.1, depthWrite: false
        });
        const sprite = new THREE.Sprite(spriteMat);
        const scales = { VEX: 1.5, LYRA: 1.35, KAEL: 1.8 };
        const sz = scales[id] || 1.5;
        sprite.scale.set(sz, sz, 1);
        sprite.position.y = sz * 0.5 + 0.1;
        group.add(sprite);

        // Glow ring under sprite
        const glowRing = new THREE.Mesh(
            new THREE.RingGeometry(0.5, 0.7, 32),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(config.color), transparent: true, opacity: 0.25, side: THREE.DoubleSide })
        );
        glowRing.rotation.x = -Math.PI / 2; glowRing.position.y = 0.03;
        group.add(glowRing);

        // Ground shadow
        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(0.6, 24),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
        );
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01;
        group.add(shadow);

        // Orbiting sparks
        const sparkGroup = new THREE.Group();
        for (let i = 0; i < 8; i++) {
            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.025, 6, 6),
                new THREE.MeshBasicMaterial({ color: new THREE.Color(config.color), transparent: true, opacity: 0.6 })
            );
            spark.userData.angle = (i / 8) * Math.PI * 2;
            spark.userData.speed = 1.0 + Math.random() * 0.5;
            spark.userData.radius = 0.6 + Math.random() * 0.15;
            spark.userData.yBase = 0.4 + Math.random() * 1.2;
            sparkGroup.add(spark);
        }
        group.add(sparkGroup);

        // Class glow light
        const cLight = new THREE.PointLight(new THREE.Color(config.color), 80, 5);
        cLight.position.y = 1.2;
        group.add(cLight);

        // Floating label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'char-label-3d';
        labelDiv.innerHTML = `<span class="cl-name" style="color:${config.color}">${id}</span>
            <div class="cl-hpbar"><div class="cl-hpfill" id="cl-hp-${id}" style="background:${config.color}"></div></div>`;
        const label = new CSS2DObject(labelDiv);
        label.position.set(0, sz + 0.5, 0);
        group.add(label);

        // Class-specific aura
        const auraBuilders = { VEX: buildVexAura, LYRA: buildLyraAura, KAEL: buildKaelAura };
        let aura = null;
        if (auraBuilders[id]) { aura = auraBuilders[id](config.color); group.add(aura); }

        this.scene.add(group);

        this.characters[id] = {
            group, charLight: cLight, label, sprite, sparkGroup, glowRing,
            color: new THREE.Color(config.color),
            basePosition: config.position.clone(),
            targetPosition: config.position.clone(),
            isAlive: true, hpPercent: 1.0,
            emotions: { confidence: 0.7, stress: 0.3, trust: 0.6, morale: 0.65 },
            bodyParts: {}, aura, charId: id,
            animPhase: Math.random() * Math.PI * 2
        };
        return this.characters[id];
    }

    createBoss(config) {
        const group = new THREE.Group();
        group.position.copy(config.position);

        // Boss portrait — MASSIVE billboard
        const texLoader = new THREE.TextureLoader();
        const tex = texLoader.load('/static/game/img/boss.png');
        tex.colorSpace = THREE.SRGBColorSpace;

        const spriteMat = new THREE.SpriteMaterial({
            map: tex, transparent: true, alphaTest: 0.1, depthWrite: false, color: 0xffcccc
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(3.5, 3.5, 1);
        sprite.position.y = 2.2;
        group.add(sprite);

        // Dark energy pool
        const darkPool = new THREE.Mesh(
            new THREE.CircleGeometry(2.0, 32),
            new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
        );
        darkPool.rotation.x = -Math.PI / 2; darkPool.position.y = 0.02;
        group.add(darkPool);

        // Concentric boss rings
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(1.0 + i * 0.5, 1.1 + i * 0.5, 32),
                new THREE.MeshBasicMaterial({ color: 0xff4488, transparent: true, opacity: 0.12 - i * 0.03, side: THREE.DoubleSide })
            );
            ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03 + i * 0.01;
            group.add(ring);
        }

        // Shadow
        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(1.5, 32),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
        );
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01;
        group.add(shadow);

        // Storm particles
        const stormGroup = new THREE.Group();
        for (let i = 0; i < 24; i++) {
            const part = new THREE.Mesh(
                new THREE.SphereGeometry(0.03, 4, 4),
                new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xff0000 : 0xff4488, transparent: true, opacity: 0.7 })
            );
            part.userData.angle = (i / 24) * Math.PI * 2;
            part.userData.speed = 0.8 + Math.random() * 0.6;
            part.userData.radius = 1.5 + Math.random() * 0.8;
            part.userData.yBase = 1.0 + Math.random() * 2.5;
            stormGroup.add(part);
        }
        group.add(stormGroup);

        // Boss glow
        const bLight = new THREE.PointLight(new THREE.Color(config.color), 200, 8);
        bLight.position.y = 2.0;
        group.add(bLight);

        // Label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'char-label-3d boss-label';
        labelDiv.innerHTML = `<span class="cl-name" style="color:${config.color}">NEXUS PRIME</span>
            <div class="cl-hpbar boss-hpbar"><div class="cl-hpfill" id="cl-hp-BOSS" style="background:linear-gradient(90deg,#ff4444,#ff4488)"></div></div>`;
        const label = new CSS2DObject(labelDiv);
        label.position.set(0, 4.5, 0);
        group.add(label);

        // Boss aura
        const bossAura = buildBossAura(config.color);
        group.add(bossAura);

        this.scene.add(group);

        this.characters['BOSS'] = {
            group, charLight: bLight, label, sprite, stormGroup,
            color: new THREE.Color(config.color),
            basePosition: config.position.clone(),
            targetPosition: config.position.clone(),
            isAlive: true, hpPercent: 1.0, isBoss: true,
            bodyParts: {}, aura: bossAura, animPhase: 0
        };
    }

    // ─── VFX ─────────────────────────────────────────
    spawnParticleBurst(position, color, count = 20, speed = 2.5) {
        const colorObj = new THREE.Color(color);
        for (let i = 0; i < count; i++) {
            const geo = new THREE.SphereGeometry(0.025 + Math.random() * 0.03, 4, 4);
            const mat = new THREE.MeshBasicMaterial({ color: colorObj, transparent: true, opacity: 0.9 });
            const m = new THREE.Mesh(geo, mat);
            m.position.copy(position); m.position.y += 1;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const s = speed * (0.4 + Math.random());
            m.userData.velocity = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * s, Math.cos(phi) * s * 0.5 + 1.5, Math.sin(phi) * Math.sin(theta) * s
            );
            m.userData.life = 0.6 + Math.random() * 0.4;
            m.userData.age = 0;
            m.userData.mat = mat;
            this.scene.add(m);
            this.particles.push({ mesh: m });
        }
    }

    spawnEnergyBeam(from, to, color, duration = 0.4) {
        const fp = this.characters[from]?.group.position || new THREE.Vector3();
        const tp = this.characters[to]?.group.position || new THREE.Vector3();
        const dir = new THREE.Vector3().subVectors(tp, fp);
        const dist = dir.length();

        const beamGeo = new THREE.CylinderGeometry(0.04, 0.04, dist, 6);
        beamGeo.rotateX(Math.PI / 2);
        const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.7 });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.copy(fp).lerp(tp, 0.5);
        beam.position.y += 1.2;
        beam.lookAt(tp.x, tp.y + 1.2, tp.z);
        this.scene.add(beam);

        const glowGeo = new THREE.CylinderGeometry(0.1, 0.1, dist, 6);
        glowGeo.rotateX(Math.PI / 2);
        const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.15 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(beam.position);
        glow.quaternion.copy(beam.quaternion);
        this.scene.add(glow);

        const start = this.clock.elapsedTime;
        const fade = () => {
            const a = 1 - (this.clock.elapsedTime - start) / duration;
            if (a <= 0) {
                this.scene.remove(beam); this.scene.remove(glow);
                beam.geometry.dispose(); beamMat.dispose();
                glow.geometry.dispose(); glowMat.dispose();
                return;
            }
            beamMat.opacity = a * 0.7; glowMat.opacity = a * 0.15;
            requestAnimationFrame(fade);
        };
        requestAnimationFrame(fade);
    }

    spawnShieldEffect(charId, color = 0x4488ff) {
        const c = this.characters[charId];
        if (!c) return;
        const s = new THREE.Mesh(
            new THREE.SphereGeometry(c.isBoss ? 1.4 : 0.7, 24, 24),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.12, side: THREE.DoubleSide, wireframe: true })
        );
        s.position.y = c.isBoss ? 2 : 1.2;
        c.group.add(s);
        let t = 0;
        const animate = () => {
            t += 0.016;
            s.scale.setScalar(1 + Math.sin(t * 5) * 0.04);
            s.material.opacity = 0.12 * (1 - t / 1.2);
            if (t < 1.2) requestAnimationFrame(animate);
            else { c.group.remove(s); s.geometry.dispose(); s.material.dispose(); }
        };
        requestAnimationFrame(animate);
    }

    spawnHealEffect(charId) {
        const c = this.characters[charId];
        if (!c) return;
        for (let i = 0; i < 12; i++) {
            const g = new THREE.SphereGeometry(0.025, 4, 4);
            const m = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.7 });
            const p = new THREE.Mesh(g, m);
            const a = Math.random() * Math.PI * 2;
            p.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
            p.userData.speed = 1.5 + Math.random() * 1.5;
            c.group.add(p);
            let t = 0;
            const anim = () => {
                t += 0.016; p.position.y += p.userData.speed * 0.016;
                m.opacity = (1 - t / 1.2) * 0.7;
                if (t < 1.2) requestAnimationFrame(anim);
                else { c.group.remove(p); g.dispose(); m.dispose(); }
            };
            setTimeout(() => requestAnimationFrame(anim), i * 40);
        }
    }

    // ─── Attack animation — enhanced sprite lunge + flash + VFX ───
    animateAttack(attackerId, targetId, callback) {
        const attacker = this.characters[attackerId];
        const target = this.characters[targetId];
        if (!attacker || !target) { callback?.(); return; }

        const startPos = attacker.group.position.clone();
        const targetPos = target.group.position.clone();
        const lungePos = startPos.clone().lerp(targetPos, 0.65);
        lungePos.y = 0;

        // Pre-attack sprite glow (anticipation)
        if (attacker.sprite) {
            attacker.sprite.material.color.set(0xffffff);
        }

        let t = 0;
        const lunge = () => {
            t += 0.035; // Faster lunge
            if (t >= 1) {
                attacker.group.position.copy(lungePos);

                // ─── IMPACT EFFECTS ───
                // Sprite flash white on hit
                if (target.sprite) {
                    target.sprite.material.color.set(0xffffff);
                    setTimeout(() => target.sprite.material.color.set(target.isBoss ? 0xffcccc : 0xffffff), 120);
                }

                // Attacker sprite scale-up on hit
                if (attacker.sprite) {
                    const origScale = attacker.sprite.scale.clone();
                    attacker.sprite.scale.multiplyScalar(1.3);
                    setTimeout(() => attacker.sprite.scale.copy(origScale), 150);
                    attacker.sprite.material.color.set(0xffffff);
                }

                // Class-specific hit VFX
                this._spawnClassAttackVFX(attackerId, target.group.position);

                // Screen effects
                this.triggerShake(0.15, 200);
                this.spikeBloom(1.2, 200);
                this.spikeChroma(0.008, 150);
                this.triggerFloorPulse(target.group.position, attacker.color.getHex());

                // Particle burst at impact
                this.spawnParticleBurst(target.group.position, attacker.color.getHex(), 15, 2.0);

                callback?.();

                // Retreat
                let rt = 0;
                const retreat = () => {
                    rt += 0.03;
                    if (rt >= 1) { attacker.group.position.copy(startPos); return; }
                    attacker.group.position.lerpVectors(lungePos, startPos, rt * rt);
                    requestAnimationFrame(retreat);
                };
                setTimeout(() => requestAnimationFrame(retreat), 180);
                return;
            }
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // Ease-in-out
            attacker.group.position.lerpVectors(startPos, lungePos, ease);
            requestAnimationFrame(lunge);
        };
        requestAnimationFrame(lunge);
    }

    // ─── Sprite takes damage — shake + flash red ───
    spriteTakeDamage(charId) {
        const c = this.characters[charId];
        if (!c?.sprite) return;

        // Flash red
        c.sprite.material.color.set(0xff4444);
        setTimeout(() => c.sprite.material.color.set(c.isBoss ? 0xffcccc : 0xffffff), 200);

        // Sprite shake
        const origPos = c.sprite.position.clone();
        let shakeT = 0;
        const shakeAnim = () => {
            shakeT += 0.05;
            if (shakeT >= 1) { c.sprite.position.copy(origPos); return; }
            const intensity = (1 - shakeT) * 0.15;
            c.sprite.position.x = origPos.x + (Math.random() - 0.5) * intensity;
            c.sprite.position.y = origPos.y + (Math.random() - 0.5) * intensity;
            requestAnimationFrame(shakeAnim);
        };
        requestAnimationFrame(shakeAnim);
    }

    // ─── Floating damage number ───
    spawnDamageNumber(position, amount, color = '#ff4444') {
        const div = document.createElement('div');
        div.className = 'damage-number';
        div.textContent = amount > 0 ? `-${amount}` : `+${Math.abs(amount)}`;
        div.style.color = amount > 0 ? color : '#00ff88';
        div.style.fontSize = amount > 25 ? '28px' : '22px';
        const label = new CSS2DObject(div);
        label.position.copy(position);
        label.position.y += 2.5;
        this.scene.add(label);

        let t = 0;
        const float = () => {
            t += 0.02;
            label.position.y += 0.03;
            div.style.opacity = Math.max(0, 1 - t);
            if (t >= 1) { this.scene.remove(label); div.remove(); return; }
            requestAnimationFrame(float);
        };
        requestAnimationFrame(float);
    }

    // ─── Class-specific attack VFX ───
    _spawnClassAttackVFX(attackerId, impactPos) {
        if (attackerId === 'VEX') {
            // Lightning chain — multiple bolts
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    const offset = new THREE.Vector3(
                        (Math.random() - 0.5) * 1.5,
                        0,
                        (Math.random() - 0.5) * 1.5
                    );
                    const endPos = impactPos.clone().add(offset);
                    this.spawnEnergyBeam(
                        { group: { position: impactPos.clone().add(new THREE.Vector3(0, 3, 0)) } },
                        { group: { position: endPos } },
                        '#00ffff', 0.3
                    );
                }, i * 80);
            }
        } else if (attackerId === 'LYRA') {
            // Arcane rune burst — glowing circle appears at target
            const runeGeo = new THREE.RingGeometry(0.3, 1.2, 6);
            const runeMat = new THREE.MeshBasicMaterial({
                color: 0xaa44ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide
            });
            const rune = new THREE.Mesh(runeGeo, runeMat);
            rune.position.copy(impactPos);
            rune.position.y = 0.1;
            rune.rotation.x = -Math.PI / 2;
            this.scene.add(rune);

            let rt = 0;
            const runeAnim = () => {
                rt += 0.025;
                rune.scale.setScalar(1 + rt * 0.5);
                rune.rotation.z += 0.08;
                runeMat.opacity = 0.8 * (1 - rt);
                if (rt >= 1) { this.scene.remove(rune); runeGeo.dispose(); runeMat.dispose(); return; }
                requestAnimationFrame(runeAnim);
            };
            requestAnimationFrame(runeAnim);

            // Vertical magic pillars
            for (let i = 0; i < 5; i++) {
                const pillarGeo = new THREE.CylinderGeometry(0.03, 0.03, 3, 4);
                const pillarMat = new THREE.MeshBasicMaterial({
                    color: 0xcc66ff, transparent: true, opacity: 0.6
                });
                const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                const angle = (i / 5) * Math.PI * 2;
                pillar.position.set(
                    impactPos.x + Math.cos(angle) * 0.8,
                    1.5,
                    impactPos.z + Math.sin(angle) * 0.8
                );
                this.scene.add(pillar);
                setTimeout(() => {
                    this.scene.remove(pillar);
                    pillarGeo.dispose(); pillarMat.dispose();
                }, 600);
            }
        } else if (attackerId === 'KAEL') {
            // Ground slam — expanding shockwave ring
            const ringGeo = new THREE.RingGeometry(0.1, 0.3, 32);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0x4488ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.copy(impactPos);
            ring.position.y = 0.05;
            ring.rotation.x = -Math.PI / 2;
            this.scene.add(ring);

            let st = 0;
            const slamAnim = () => {
                st += 0.03;
                ring.scale.setScalar(1 + st * 8);
                ringMat.opacity = 0.9 * (1 - st);
                if (st >= 1) { this.scene.remove(ring); ringGeo.dispose(); ringMat.dispose(); return; }
                requestAnimationFrame(slamAnim);
            };
            requestAnimationFrame(slamAnim);

            // Extra rock debris particles
            this.spawnParticleBurst(impactPos, 0x4488ff, 25, 3.5);
        } else if (attackerId === 'BOSS') {
            // Boss attack — crimson nova explosion
            const novaGeo = new THREE.SphereGeometry(0.5, 16, 16);
            const novaMat = new THREE.MeshBasicMaterial({
                color: 0xff2244, transparent: true, opacity: 0.7
            });
            const nova = new THREE.Mesh(novaGeo, novaMat);
            nova.position.copy(impactPos);
            nova.position.y = 1.5;
            this.scene.add(nova);

            let nt = 0;
            const novaAnim = () => {
                nt += 0.02;
                nova.scale.setScalar(1 + nt * 6);
                novaMat.opacity = 0.7 * (1 - nt);
                if (nt >= 1) { this.scene.remove(nova); novaGeo.dispose(); novaMat.dispose(); return; }
                requestAnimationFrame(novaAnim);
            };
            requestAnimationFrame(novaAnim);

            this.spawnParticleBurst(impactPos, 0xff2244, 30, 4);
            this.triggerShake(0.25, 350);
        }
    }

    // ─── Critical Hit — slow-mo + screen effects ───
    triggerCriticalHit(position, color = '#ffaa00') {
        // Screen flash
        this.triggerFlash(color);
        // Heavy shake
        this.triggerShake(0.3, 400);
        // Bloom spike
        this.spikeBloom(2.0, 500);
        this.spikeChroma(0.02, 400);
        // Extra particle burst
        this.spawnParticleBurst(position, new THREE.Color(color).getHex(), 40, 5);
        // Double floor pulse
        this.triggerFloorPulse(position, new THREE.Color(color).getHex());
    }

    triggerShake(intensity = 0.2, duration = 250) {
        this.shakeIntensity = intensity;
        setTimeout(() => { this.shakeIntensity *= 0.2; }, duration);
    }

    triggerFlash(color = '#00cccc') {
        const f = document.createElement('div');
        f.className = 'screen-flash';
        f.style.background = color;
        document.body.appendChild(f);
        setTimeout(() => f.remove(), 180);
    }

    spikeChroma(amount = 0.01, duration = 250) {
        this.chromaPass.uniforms.amount.value = amount;
        setTimeout(() => { this.chromaPass.uniforms.amount.value = 0.001; }, duration);
    }

    spikeBloom(strength = 1.5, duration = 350) {
        this.bloomPass.strength = strength;
        setTimeout(() => { this.bloomPass.strength = 0.6; }, duration);
    }

    setDangerVignette(active) {
        const ex = document.querySelector('.vignette-danger');
        if (active && !ex) { const v = document.createElement('div'); v.className = 'vignette-danger'; document.body.appendChild(v); }
        else if (!active && ex) ex.remove();
    }

    triggerFloorPulse(position, color = 0x00cccc) {
        this.arenaFloorMat.uniforms.uPulseOrigin.value.set(position.x, position.z);
        this.arenaFloorMat.uniforms.uPulseRadius.value = 0;
        this.arenaFloorMat.uniforms.uPulseColor.value.set(new THREE.Color(color));
        this._pulseActive = true;
    }

    setBossPhase(phase) {
        this.bossPhase = phase;
        const colors = [0x00cccc, 0xff6600, 0xcc0000];
        const intensities = [0.25, 0.4, 0.7];
        this.targetArenaColor.set(colors[phase - 1] || 0x00cccc);
        this.arenaEmissiveIntensity = intensities[phase - 1] || 0.25;
        this.edgeLights.forEach(l => { l.intensity = 600; });
        setTimeout(() => this.edgeLights.forEach(l => l.intensity = 300), 500);

        // Boss sprite tint shift for phase changes
        const boss = this.characters.BOSS;
        if (boss?.sprite) {
            const tints = [0xffcccc, 0xff8844, 0xff2222];
            boss.sprite.material.color.set(tints[phase - 1] || 0xffcccc);
        }
        if (boss?.charLight) {
            boss.charLight.intensity = 200 + phase * 100;
            boss.charLight.color.set(colors[phase - 1] || 0xff4488);
        }
    }
    updateHPLabel(charId) {
        const c = this.characters[charId];
        if (!c) return;
        const el = document.getElementById(`cl-hp-${charId}`);
        if (el) el.style.width = `${c.hpPercent * 100}%`;
    }

    focusCharacter(charId, duration = 400) {
        const c = this.characters[charId];
        if (!c) return;
        this.cameraTarget.copy(c.group.position);
        this.cameraTarget.y = c.isBoss ? 2 : 1.2;
        this.targetCameraRadius = c.isBoss ? 10 : 8;
        setTimeout(() => { this.targetCameraRadius = 18; }, duration);
    }

    rotateCamera(angle) { this.targetCameraAngle = angle; }

    killCharacter(charId) {
        const c = this.characters[charId];
        if (!c) return;
        c.isAlive = false;
        let t = 0;
        const dissolve = () => {
            t += 0.016;
            c.group.scale.setScalar(1 - t * 0.5);
            c.group.position.y -= 0.01;
            if (t < 1.5) requestAnimationFrame(dissolve);
            else c.group.visible = false;
        };
        requestAnimationFrame(dissolve);
        this.spawnParticleBurst(c.group.position, c.color.getHex(), 30, 3);
    }

    setHouseMode() {
        this.isArenaMode = false;
        this.scene.fog = new THREE.FogExp2(0x0a0812, 0.018);
        this.sunLight.color.set(0xffaa66); this.sunLight.intensity = 1.5;
        this.edgeLights.forEach(l => { l.color.set(0xff8844); l.intensity = 150; });
        this.targetCameraRadius = 10; this.targetCameraHeight = 5;
        this.targetArenaColor.set(0xff8844);
        this.arenaEmissiveIntensity = 0.08;
    }

    setArenaMode() {
        this.isArenaMode = true;
        this.scene.fog = new THREE.FogExp2(0x060612, 0.025);
        this.sunLight.color.set(0x5577aa); this.sunLight.intensity = 2.0;
        this.setBossPhase(this.bossPhase);
        this.targetCameraRadius = 18; this.targetCameraHeight = 9;
    }

    update() {
        const dt = this.clock.getDelta();
        const time = this.clock.elapsedTime;

        // Camera smooth
        this.cameraAngle += (this.targetCameraAngle - this.cameraAngle) * 0.03;
        this.cameraRadius += (this.targetCameraRadius - this.cameraRadius) * 0.04;
        this.cameraHeight += (this.targetCameraHeight - this.cameraHeight) * 0.04;

        const cx = Math.sin(this.cameraAngle) * this.cameraRadius;
        const cz = Math.cos(this.cameraAngle) * this.cameraRadius;
        this.camera.position.set(
            this.cameraTarget.x + cx + this.shakeOffset.x,
            this.cameraTarget.y + this.cameraHeight + this.shakeOffset.y,
            this.cameraTarget.z + cz + this.shakeOffset.z
        );
        this.camera.lookAt(this.cameraTarget);

        // Shake
        if (this.shakeIntensity > 0.001) {
            this.shakeOffset.set(
                (Math.random() - 0.5) * this.shakeIntensity,
                (Math.random() - 0.5) * this.shakeIntensity * 0.4,
                (Math.random() - 0.5) * this.shakeIntensity
            );
            this.shakeIntensity *= this.shakeDecay;
        } else this.shakeOffset.set(0, 0, 0);

        // Animate characters (HD-2D sprites)
        for (const [id, c] of Object.entries(this.characters)) {
            if (!c.isAlive) continue;
            c.animPhase += dt;

            if (c.isBoss) {
                // Boss sprite: menacing vertical bob
                if (c.sprite) {
                    c.sprite.position.y = 2.2 + Math.sin(time * 0.8) * 0.08;
                    // Subtle scale pulse
                    const pulse = 3.5 + Math.sin(time * 1.5) * 0.05;
                    c.sprite.scale.set(pulse, pulse, 1);
                }
                // Storm particles orbit
                if (c.stormGroup) {
                    c.stormGroup.children.forEach(p => {
                        const ud = p.userData;
                        ud.angle += dt * ud.speed;
                        p.position.x = Math.cos(ud.angle) * ud.radius;
                        p.position.z = Math.sin(ud.angle) * ud.radius;
                        p.position.y = ud.yBase + Math.sin(time * 2 + ud.angle) * 0.4;
                    });
                }
            } else {
                // Character sprite: gentle float bob
                if (c.sprite) {
                    const baseY = c.sprite.scale.y * 0.5 + 0.1;
                    c.sprite.position.y = baseY + Math.sin(time * 1.2 + c.animPhase) * 0.04;
                }
                // Glow ring pulse
                if (c.glowRing) {
                    c.glowRing.material.opacity = 0.2 + Math.sin(time * 2 + c.animPhase) * 0.08;
                }
                // Orbiting sparks
                if (c.sparkGroup) {
                    c.sparkGroup.children.forEach(s => {
                        const ud = s.userData;
                        ud.angle += dt * ud.speed;
                        s.position.x = Math.cos(ud.angle) * ud.radius;
                        s.position.z = Math.sin(ud.angle) * ud.radius;
                        s.position.y = ud.yBase + Math.sin(time * 3 + ud.angle) * 0.1;
                        s.material.opacity = 0.4 + Math.sin(time * 4 + ud.angle) * 0.3;
                    });
                }
            }

            // ─── AURA ANIMATION ─────────────────────
            if (c.aura) {
                c.aura.children.forEach(child => {
                    const ud = child.userData;

                    // VEX sparks
                    if (ud.sparkAngle !== undefined) {
                        ud.sparkAngle += dt * ud.sparkSpeed;
                        child.position.x = Math.cos(ud.sparkAngle) * ud.sparkRadius;
                        child.position.z = Math.sin(ud.sparkAngle) * ud.sparkRadius;
                        child.position.y = ud.sparkY + Math.sin(time * 3 + ud.sparkAngle) * 0.1;
                        child.material.opacity = 0.5 + Math.sin(time * 5 + ud.sparkAngle) * 0.3;
                    }
                    // VEX bolts — re-jitter
                    if (ud.boltId !== undefined && Math.random() < 0.02) {
                        const pts = [];
                        const a = (ud.boltId / 6) * Math.PI * 2;
                        for (let j = 0; j < 5; j++) {
                            const r = 0.3 + j * 0.15;
                            const jit = (Math.random() - 0.5) * 0.2;
                            pts.push(new THREE.Vector3(Math.cos(a + jit) * r, 0.8 + j * 0.25 + jit, Math.sin(a + jit) * r));
                        }
                        child.geometry.setFromPoints(pts);
                    }
                    // LYRA orbs
                    if (ud.orbAngle !== undefined) {
                        ud.orbAngle += dt * ud.orbSpeed;
                        child.position.x = Math.cos(ud.orbAngle) * ud.orbRadius;
                        child.position.z = Math.sin(ud.orbAngle) * ud.orbRadius;
                        child.position.y = ud.orbY + Math.sin(time * 1.5 + ud.orbAngle) * 0.15;
                    }
                    // LYRA motes
                    if (ud.motePhase !== undefined) {
                        ud.motePhase += dt * ud.moteSpeed;
                        child.position.x = Math.cos(ud.motePhase * 2) * ud.moteRadius;
                        child.position.z = Math.sin(ud.motePhase * 3) * ud.moteRadius;
                        child.position.y = 0.5 + (ud.motePhase % 2.5);
                        child.material.opacity = 0.3 + Math.sin(ud.motePhase * 4) * 0.2;
                        if (child.position.y > 3) ud.motePhase = Math.random() * Math.PI;
                    }
                    // KAEL hex pulse
                    if (c.aura.userData.hex === child) {
                        child.rotation.y += dt * 0.2;
                        child.material.opacity = 0.04 + Math.sin(time * 1.5) * 0.02;
                    }
                    // LYRA rune rings
                    if (c.aura.userData.runeRing === child) child.rotation.z += dt * 0.3;
                    if (c.aura.userData.innerRing === child) child.rotation.z -= dt * 0.5;
                    // BOSS rings
                    if (ud.ringSpeed !== undefined) {
                        const axis = ud.ringAxis;
                        if (axis === 0) child.rotation.z += dt * ud.ringSpeed;
                        else if (axis === 1) child.rotation.x += dt * ud.ringSpeed;
                        else child.rotation.y += dt * ud.ringSpeed;
                    }
                    // BOSS storm (in aura)
                    if (ud.stormAngle !== undefined) {
                        ud.stormAngle += dt * ud.stormSpeed;
                        child.position.x = Math.cos(ud.stormAngle) * ud.stormRadius;
                        child.position.z = Math.sin(ud.stormAngle) * ud.stormRadius;
                        child.position.y = ud.stormY + Math.sin(time * 2 + ud.stormAngle) * 0.3;
                    }
                });
            }

            // Smooth position
            c.group.position.lerp(c.targetPosition, 0.04);
        }

        // Floor shader
        this.arenaFloorMat.uniforms.uTime.value = time;
        this.currentArenaColor.lerp(this.targetArenaColor, 0.015);
        this.arenaFloorMat.uniforms.uColor.value.copy(this.currentArenaColor);
        this.arenaFloorMat.uniforms.uIntensity.value +=
            (this.arenaEmissiveIntensity - this.arenaFloorMat.uniforms.uIntensity.value) * 0.02;

        if (this._pulseActive) {
            this.arenaFloorMat.uniforms.uPulseRadius.value += dt * 7;
            if (this.arenaFloorMat.uniforms.uPulseRadius.value > 14) {
                this._pulseActive = false;
                this.arenaFloorMat.uniforms.uPulseRadius.value = 0;
            }
        }

        if (this.arenaRing) {
            this.arenaRing.material.opacity = 0.06 + Math.sin(time * 0.8) * 0.02;
            this.arenaRing.material.color.copy(this.currentArenaColor);
        }

        // Ambient float
        if (this.ambientParts) {
            const pos = this.ambientParts.geometry.attributes.position.array;
            for (let i = 0; i < pos.length / 3; i++) {
                pos[i * 3 + 1] += Math.sin(time * 0.4 + i * 0.5) * 0.001;
                if (pos[i * 3 + 1] > 5) pos[i * 3 + 1] = 0.5;
            }
            this.ambientParts.geometry.attributes.position.needsUpdate = true;
        }

        // Clean particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i].mesh;
            p.userData.age += dt;
            if (p.userData.age >= p.userData.life) {
                this.scene.remove(p); p.geometry.dispose(); p.userData.mat.dispose();
                this.particles.splice(i, 1);
                continue;
            }
            p.position.add(p.userData.velocity.clone().multiplyScalar(dt));
            p.userData.velocity.y -= 3.5 * dt;
            p.userData.mat.opacity = 1 - p.userData.age / p.userData.life;
        }

        // Render
        this.composer.render();
        this.labelRenderer.render(this.scene, this.camera);
    }
    _onResize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer.setSize(w, h);
        this.labelRenderer.setSize(w, h);
    }
    start() {
        const loop = () => { requestAnimationFrame(loop); this.update(); };
        loop();
    }
}


