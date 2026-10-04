from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.services.room_service import room_service
from app.api.routes import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await room_service.start_monitor()
    yield
    # Shutdown


app = FastAPI(
    title="Nepali Bingo 1v1 API",
    version="1.0.0",
    description="Real-Time Authoritative 1v1 Nepali Bingo Web Game API",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "nepali-bingo-1v1"}
