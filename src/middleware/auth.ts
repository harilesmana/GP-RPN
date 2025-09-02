import { verifyToken } from "../utils/jwt";
import { users } from "../db";

export async function authMiddleware({ request }: any) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return { user: null };

  const token = authHeader.split(" ")[1]; 
  if (!token) return { user: null };

  const payload = verifyToken(token);
  if (!payload) return { user: null };

  const user = users.find((u) => u.id === (payload as any).id);
  return { user };
}
