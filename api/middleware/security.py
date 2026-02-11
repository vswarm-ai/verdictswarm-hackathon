"""Security middleware — request size limits, blocked paths, IP tracking."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Request size limit (10KB) — skip for streaming/SSE endpoints
        if request.method in ("POST", "PUT", "PATCH"):
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > 10240:
                return JSONResponse(
                    {"error": "Request too large"}, status_code=413
                )

        # Block common attack/recon paths
        path = request.url.path.lower()
        blocked = [
            ".env", ".git", "wp-admin", "wp-login", "phpmyadmin",
            ".php", "xmlrpc", "wp-content", "wp-includes",
            ".htaccess", ".aws", "actuator",
        ]
        if any(b in path for b in blocked):
            return JSONResponse({"error": "Not found"}, status_code=404)

        return await call_next(request)
