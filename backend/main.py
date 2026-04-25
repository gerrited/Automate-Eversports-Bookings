import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import backend.models  # noqa: F401 — ensures all models are registered with Base.metadata
from backend.api import auth, jobs, admin, facilities, account, bookings, webhooks


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not os.environ.get("JWT_SECRET"):
        raise RuntimeError("JWT_SECRET environment variable is not set")
    yield


app = FastAPI(title="Eversports Booking API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(facilities.router, prefix="/api")
app.include_router(account.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(webhooks.router, prefix="/api")
