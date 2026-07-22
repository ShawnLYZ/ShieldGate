from dataclasses import dataclass

import asyncpg
import jwt
from fastapi import Depends, HTTPException, Request

from .db import get_pool


@dataclass(frozen=True)
class AuthUser:
    id: str
    role: str
    department: str


# Real Supabase Auth (GoTrue, as started by `supabase start`) signs session access
# tokens asymmetrically (ES256, per-project generated key) by default and only
# publishes the legacy shared secret for HS256-signed tokens. A PyJWKClient per
# JWKS URL, cached across requests, avoids refetching the key set on every call.
_jwks_clients: dict[str, jwt.PyJWKClient] = {}


def _jwks_client_for(jwks_url: str) -> jwt.PyJWKClient:
    client = _jwks_clients.get(jwks_url)
    if client is None:
        client = jwt.PyJWKClient(jwks_url)
        _jwks_clients[jwks_url] = client
    return client


async def require_user(request: Request, pool: asyncpg.Pool = Depends(get_pool)) -> AuthUser:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(401, {"code": "no_token", "message": "Missing bearer token."})
    token = header[7:]
    settings = request.app.state.settings
    try:
        alg = jwt.get_unverified_header(token).get("alg")
        if alg == "HS256":
            # Legacy/offline path: also what test_approvals_api.py's bearer()
            # helper hand-signs, so unit tests keep working without a live GoTrue.
            claims = jwt.decode(token, settings.supabase_jwt_secret,
                                algorithms=["HS256"], audience="authenticated")
        else:
            jwks_url = f"{settings.supabase_auth_url}/auth/v1/.well-known/jwks.json"
            signing_key = _jwks_client_for(jwks_url).get_signing_key_from_jwt(token)
            claims = jwt.decode(token, signing_key.key,
                                algorithms=["ES256", "RS256"], audience="authenticated")
    except jwt.PyJWTError:
        raise HTTPException(401, {"code": "bad_token", "message": "Invalid token."})
    row = await pool.fetchrow("select role, department from public.profiles where id = $1", claims["sub"])
    if row is None:
        raise HTTPException(403, {"code": "no_profile", "message": "No profile for user."})
    return AuthUser(id=claims["sub"], role=row["role"], department=row["department"])


def require_role(user: AuthUser, *roles: str) -> None:
    if user.role not in roles:
        raise HTTPException(403, {"code": "forbidden", "message": f"Requires role: {', '.join(roles)}"})
