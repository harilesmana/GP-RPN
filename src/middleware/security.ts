import type { Elysia } from "elysia";

export function securityHeaders(app: Elysia) {
  return app.onAfterHandle(({ set }) => {
    set.headers["X-Content-Type-Options"] = "nosniff";
    set.headers["X-Frame-Options"] = "DENY";
    set.headers["X-XSS-Protection"] = "0"; 
    set.headers["Referrer-Policy"] = "no-referrer";
    set.headers["Permissions-Policy"] = "geolocation=(), microphone=()";
    set.headers["Cross-Origin-Opener-Policy"] = "same-origin";
    set.headers["Cross-Origin-Resource-Policy"] = "same-site";
    set.headers["Cross-Origin-Embedder-Policy"] = "require-corp";
    
    set.headers["Content-Security-Policy"] =
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';";
  });
}
