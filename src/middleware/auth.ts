import { verifyAccessToken, isTokenBlacklisted } from "../utils/jwt";
import { users } from "../db";

export async function authMiddleware(ctx: any, next: any) {
  try {
    const authHeader = ctx.request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response("Token tidak valid", { status: 401 });
    }

    const token = authHeader.substring(7);

    if (isTokenBlacklisted(token)) {
      return new Response("Token telah direvoke", { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return new Response("Token invalid atau expired", { status: 401 });
    }

    const user = users.find(u => u.id === (payload as any).id);
    if (!user) {
      return new Response("User tidak ditemukan", { status: 401 });
    }

    if (user.status !== "active") {
      return new Response("Akun tidak aktif. Silakan hubungi administrator.", { status: 403 });
    }

    ctx.user = user; // simpan user ke context Elysia
    await next();     // lanjut ke route handler
  } catch (error) {
    console.error("Auth middleware error:", error);
    return new Response("Error authentication", { status: 500 });
  }
}
