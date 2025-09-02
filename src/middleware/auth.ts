import { verifyAccessToken, isTokenBlacklisted } from "../utils/jwt";
import { users } from "../db";

export async function authMiddleware({ request }: any) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { user: null, error: "Token tidak valid" };
    }

    const token = authHeader.substring(7); 
    
    
    if (isTokenBlacklisted(token)) {
      return { user: null, error: "Token telah direvoke" };
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return { user: null, error: "Token invalid atau expired" };
    }

    const user = users.find((u) => u.id === (payload as any).id);
    if (!user) {
      return { user: null, error: "User tidak ditemukan" };
    }

    
    if (user.status !== "active") {
      return { user: null, error: "Akun tidak aktif. Silakan hubungi administrator." };
    }

    return { user, error: null };
  } catch (error) {
    console.error("Auth middleware error:", error);
    return { user: null, error: "Error authentication" };
  }
}
