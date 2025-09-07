import { Elysia, type Context } from "elysia";
import { verifySession } from "../utils/session";

export const authMiddleware = new Elysia().derive(({ cookie, set, request }) => {
  const token = cookie?.session?.value;
  if (!token) {
    return { user: null };
  }

  const secret = process.env.SESSION_SECRET || "dev_secret_change_me";
  const data = verifySession(token, secret);
  if (!data) {
    if (cookie?.session) cookie.session.set({ value: "", maxAge: 0 });
    return { user: null };
  }

  const user = {
    userId: data.userId,
    role: data.role,
  }

  return { user };
})