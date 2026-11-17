from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (registers tables)
from app.config import settings
from app.db import Base, engine
from app.routers import cases, legislation


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Fine for a demo; switch to Alembic migrations once the schema settles.
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title=f"{settings.product_name} API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(cases.router)
app.include_router(legislation.router)


@app.get("/health")
def health():
    return {"status": "ok", "product": settings.product_name}
