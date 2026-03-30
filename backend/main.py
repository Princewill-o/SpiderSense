"""FastAPI application entry point for Spider-Sense AI backend."""
from __future__ import annotations

import os

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

import api as api_module
from api import router as api_router
from models import Settings
from session_store import SessionStore
from websocket_handler import FramePipeline, websocket_endpoint

DATA_DIR = os.environ.get("DATA_DIR", "./data")

app = FastAPI(title="Spider-Sense AI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
store = SessionStore(data_dir=DATA_DIR)
settings = Settings()
pipeline = FramePipeline(store=store, settings=settings, data_dir=DATA_DIR)

# Initialize API module
api_module.init(store, settings)
api_module.register_settings_callback(pipeline.update_settings)

app.include_router(api_router)


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket) -> None:
    await websocket_endpoint(websocket, pipeline)


@app.on_event("startup")
async def startup() -> None:
    print("[Spider-Sense AI] Backend started")


@app.on_event("shutdown")
async def shutdown() -> None:
    print("[Spider-Sense AI] Backend shutting down")
