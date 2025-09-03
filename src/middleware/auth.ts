import type { Context } from "elysia";
import { verifySession } from "../utils/session";

export async function authMiddleware({ cookie, set }: Context) {
  const token = cookie?.session?.value;
  if (!token) return { user: null };

  const secret = process.env.SESSION_SECRET || "dev_secret_change_me";
  const data = verifySession(token, secret);
  if (!data) {
  
    if (cookie?.session) cookie.session.set({ value: "", maxAge: 0 });
    return { user: null };
  }
  return { user: data };
}
