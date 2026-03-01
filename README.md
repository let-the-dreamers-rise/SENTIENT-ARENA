<div align="center">
  <h1>⚡ SENTIENT ARENA</h1>
  <p><h3>An AI-Native Tactical Combat RPG Powered by Mistral AI</h3></p>
  <p>
    <b>Real-Time Adaptive Bosses ⨯ Emotional Character States ⨯ LLM-Generated Abilities</b>
  </p>
</div>

---

## 🌟 The Concept

**Sentient Arena** isn't just a combat game with an AI chatbot tacked on. It is an **AI-native experience** where LLMs dictate the core mechanics of the game. 

Every character in your squad has an emotional profile (Morale, Stress, Confidence, Trust) that shifts dynamically based on battle events. The boss analyzes your tactical habits to invent counter-strategies. And with our flagship feature, **Synapse Link**, you can use natural language to invent completely new abilities mid-battle.

Everything is powered by **Mistral AI** via a custom Python backend (FastAPI) hooked into a rich 3D frontend (Three.js).

---

## 🧠 Core Mistral AI Features

### 1. Synapse Link (Dynamic Ability Generation)
The killer feature. Instead of being locked into a pre-set ability tree, players can click **Synapse Link** mid-battle and type a natural language prompt (e.g., *"I need a massive devastating lightning strike."*). 

The backend sends the prompt, the character's emotional profile, and the current battle context to **Mistral AI**, which returns a structured JSON defining a brand new ability (Name, Damage, Cooldown, Type, AP Cost). The game instantly injects this new ability into your UI, fundamentally changing the game based on your creativity.

### 2. Emotional State Machine & Betrayal
Squad members aren't just hit points. They are driven by an emotional state machine powered by Mistral. 
* Taking sustained damage increases **Stress**.
* Healing allies boosts **Morale**.
* If a character's Morale drops too low, the AI evaluates their personality and decides if they **refuse your command** or **go rogue** (attacking targets of their own choosing). Your own squad becomes a chaotic variable.

### 3. Adaptive Boss Intelligence
The boss (Nexus Prime) doesn't use a scripted rotation. The `API` tracks your playstyle—how often you use support, how aggressive you are, and which characters you rely on. Between waves, Mistral analyzes these tendencies and generates a unique **Threat Strategy**, mutating the boss's behavior to specifically counter your playstyle.

### 4. Context-Aware Banter
During combat, characters organically react to the battle state. Mistral generates dialogue based on what just happened (e.g., getting critically hit by the boss, or landing a 2x combo). This dialogue is then piped through a **Character Voice System** (using browser TTS/ElevenLabs) with distinct pitch and tone for every character.

---

## 🏗️ Technical Architecture

* **Frontend:** Vanilla JS + **Three.js** (WebGL 3D Combat Arena), Custom CSS Glassmorphism UI
* **Backend:** Python + **FastAPI**, Pydantic (Data validation)
* **AI Engine:** `mistralai` SDK (Mistral-Small/Turbo variants) utilizing strictly enforced JSON mode for programmatic integration.
* **Voice:** Web Speech API with ElevenLabs backend infrastructure pre-built.

### Project Structure
```text
sentient-arena/
├── main.py                  # FastAPI Application Entry
├── routers/                 # AI Endpoints (Voice, Ability, Emotion, Boss)
├── models/                  # Pydantic Schemas (Mistral JSON formats)
├── services/                # Mistral & State Managers
└── static/
    └── game/
        ├── index.html       # Game Client UI
        ├── css/main.css     # Premium UI Styling
        └── js/
            ├── engine.js    # Three.js 3D Rendering & Animations
            ├── game.js      # Core Battle Logic, State, AI Orchestration
            └── main.js      # App Initialization & Event Wiring
```

---

## 🚀 How to Run (Local Setup)

Sentient Arena is designed to run locally with smart fallbacks. It is fully playable out of the box, but plugging in a Mistral API key unlocks the full generative experience.

### Prerequisites
* Python 3.10+
* A modern browser (Chrome, Edge, Firefox)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/let-the-dreamers-rise/SENTIENT-ARENA.git
   cd SENTIENT-ARENA
   ```

2. **Install dependencies:**
   ```bash
   pip install fastapi uvicorn httpx pydantic mistralai python-dotenv
   ```

3. **Configure API Keys (Optional but Recommended):**
   Create a `.env` file in the root directory:
   ```env
   MISTRAL_API_KEY=your_mistral_api_key_here
   HOST=0.0.0.0
   PORT=8000
   ```
   *Note: If no API key is provided, the game gracefully degrades to use intelligent offline fallback abilities and systems for demo purposes.*

4. **Start the Game Server:**
   ```bash
   python -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```

5. **Play:**
   Open your browser and navigate to `http://localhost:8000`

---

## 🎮 Gameplay Mechanics Walkthrough

1. **AP (Action Points):** Characters share an energy pool. Every turn, characters have 3 AP. Use it to chain abilities.
2. **Combo Multiplier:** Hitting the boss sequentially builds your combo meter (1.0x → 1.2x → 1.5x → 2.0x). If the boss attacks, the combo breaks.
3. **Pass Turn:** Low on AP? Click the glowing `0 AP` pass button to skip your turn and recover energy.
4. **Threat Targeting:** The boss evaluates threat dynamically—targetting characters dealing the most damage or having the lowest HP. Protect your strikers!
5. **Synapse Link:** Look for the glowing cyan button above the ability tray. Click it, type a tactical command, and watch Mistral build your new arsenal.

---
*Built for the AI Hackathon 2026.*
