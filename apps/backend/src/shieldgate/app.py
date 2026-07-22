import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .classify.ollama import probe_and_warm
from .config import Settings, get_settings
from .db import create_pool
from .scheduler import start_scheduler, stop_scheduler

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.pool = await create_pool(settings.supabase_db_url)
        app.state.settings = settings
        app.state.classifier_reachable = False
        if settings.classifier_provider == "ollama":
            app.state.classifier_reachable = await probe_and_warm(settings)
            if not app.state.classifier_reachable:
                logger.warning(
                    "ShieldGate: local classifier (ollama @ %s) unreachable at startup — "
                    "running in regex-only mode; context-based classification is DISABLED.",
                    settings.ollama_base_url,
                )
        start_scheduler(app)
        yield
        await stop_scheduler(app)
        await app.state.pool.close()

    app = FastAPI(title="ShieldGate Backend", lifespan=lifespan)
    origins = ["http://localhost:3000", "http://127.0.0.1:3000",
               "http://localhost:5175", "http://127.0.0.1:5175"]
    if settings.cors_extra_origins:
        origins += [o.strip() for o in settings.cors_extra_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware, allow_origins=origins,
        allow_origin_regex=r"^chrome-extension://.*$",
        allow_methods=["*"], allow_headers=["*"],
    )

    api = APIRouter(prefix="/api/v1")

    @api.get("/health")
    async def health(request: Request) -> dict[str, str | bool | None]:
        s = request.app.state.settings
        return {
            "status": "ok",
            "classifier_provider": s.classifier_provider,
            "inference_endpoint": s.ollama_base_url if s.classifier_provider == "ollama" else None,
            "classifier_reachable": request.app.state.classifier_reachable,
        }

    from .routes.approvals import router as approvals_router
    from .routes.audit import router as audit_router
    from .routes.classify import router as classify_router
    from .routes.decisions import router as decisions_router
    from .routes.events import router as events_router
    from .routes.horizon import router as horizon_router
    from .routes.policy import router as policy_router
    from .routes.provenance import router as provenance_router
    from .routes.redact import router as redact_router
    from .routes.registry import router as registry_router
    from .routes.reports import router as reports_router
    from .routes.shadow import router as shadow_router
    api.include_router(classify_router)
    api.include_router(audit_router)
    api.include_router(policy_router)
    api.include_router(events_router)
    api.include_router(approvals_router)
    api.include_router(provenance_router)
    api.include_router(redact_router)
    api.include_router(registry_router)
    api.include_router(reports_router)
    api.include_router(decisions_router)
    api.include_router(shadow_router)
    api.include_router(horizon_router)

    app.include_router(api)
    return app
