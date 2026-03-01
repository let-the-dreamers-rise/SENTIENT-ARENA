"""
Sentient Arena — Backend Entry Point
FastAPI application with all routers mounted.

Run: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import os, logging
from dotenv import load_dotenv

load_dotenv()  # Load .env before anything else

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse

from routers import dialogue, emotion, boss, ability, rule, voice
from services.state_manager import state

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("sentient.main")

# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="Sentient Arena API",
    description="Backend for AI-driven character dialogue, emotion, boss adaptation, abilities, and voice.",
    version="1.0.0",
)

# CORS — allow UE5 and local dev to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for audio
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static", "audio")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static/audio", StaticFiles(directory=STATIC_DIR), name="audio")

# Static files for game
GAME_DIR = os.path.join(os.path.dirname(__file__), "static", "game")
os.makedirs(GAME_DIR, exist_ok=True)
app.mount("/static/game", StaticFiles(directory=GAME_DIR), name="game")

# ── Mount Routers ─────────────────────────────────────────────
app.include_router(dialogue.router)
app.include_router(emotion.router)
app.include_router(boss.router)
app.include_router(ability.router)
app.include_router(rule.router)
app.include_router(voice.router)


# ── Root → Game ───────────────────────────────────────────────

@app.get("/")
async def root():
    """Serve the Three.js game."""
    game_html = os.path.join(os.path.dirname(__file__), "static", "game", "index.html")
    if os.path.exists(game_html):
        return FileResponse(game_html, media_type="text/html")
    return RedirectResponse("/docs")


# ── Health & State Endpoints ──────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "game": "sentient_arena"}


@app.get("/api/state")
async def get_full_state():
    """Return ALL game state — for Three.js frontend startup."""
    chars = state.get_all_characters()
    b = state.get_boss()
    return {
        "characters": [c.model_dump(by_alias=True) for c in chars],
        "boss": b.model_dump() if b else {},
    }


@app.get("/api/state/characters")
async def get_characters():
    """Return all character states — for UE5 to load on startup or after transitions."""
    chars = state.get_all_characters()
    return {"characters": [c.model_dump(by_alias=True) for c in chars]}


@app.get("/api/state/characters/{character_id}")
async def get_character(character_id: str):
    """Return a single character state."""
    char = state.get_character(character_id)
    if not char:
        return {"error": f"Character '{character_id}' not found."}
    return char.model_dump(by_alias=True)


@app.get("/api/state/boss")
async def get_boss():
    """Return boss state."""
    b = state.get_boss()
    if not b:
        return {"error": "No boss initialized."}
    return b.model_dump()


@app.get("/api/state/tendencies")
async def get_tendencies():
    """Return computed player tendencies."""
    return state.compute_tendencies().model_dump()


@app.post("/api/state/action")
async def record_action(action: dict):
    """Record a player action for tendency tracking.
    Body: {"type": "offensive"|"defensive"|"support", "target": "VEX", "ability_type": "offensive"}
    """
    state.record_action(action)
    return {"status": "recorded", "total_actions": len(state._player_actions)}


@app.post("/api/state/reset")
async def reset_state():
    """Reset all game state to defaults."""
    state.reset()
    return {"status": "reset", "characters": len(state.characters)}


# ── Startup Event ─────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    logger.info("🎮 Sentient Arena backend starting...")
    logger.info(f"   Characters loaded: {list(state.characters.keys())}")
    logger.info(f"   Boss: {state.boss.display_name if state.boss else 'None'}")

    if not os.getenv("MISTRAL_API_KEY"):
        logger.warning("⚠️  MISTRAL_API_KEY not set — AI features will use fallbacks.")
    if not os.getenv("ELEVENLABS_API_KEY"):
        logger.warning("⚠️  ELEVENLABS_API_KEY not set — voice will be disabled.")

    logger.info("✅ Ready at http://0.0.0.0:8000")
    logger.info("   Docs: http://0.0.0.0:8000/docs")
