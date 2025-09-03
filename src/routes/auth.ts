import { Elysia } from "elysia";
import ejs from "ejs";
import { users, loginAttempts } from "../db";
import { verifyPassword } from "../utils/hash";
import { signSession } from "../utils/session";
import { loginSchema, inputValidation } from "../middleware/inputValidation";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 10;

const view = (tpl: string, data: Record<string, any> = {}) =>
  ejs.render(tpl, data, { rmWhitespace: true });

export const authRoutes = new Elysia()
  .use(inputValidation)
  .get("/login", async ({ set, query }) => {
    const fs = await Bun.file("views/login.ejs").text();
    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return view(fs, {
      error: query.error ?? "",
      message: query.message ?? ""
    });
  })
  .post("/login", async ({ request, set, cookie, parseFormData }) => {
    const body = await parseFormData();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      set.status = 400;
      return parsed.error.issues.map((i) => i.message).join(", ");
    }

    const email = String(parsed.data.email).toLowerCase().trim();
    const password = String(parsed.data.password);

    
    const key = `login:${email}`;
    const now = Date.now();
    const bucket = loginAttempts.get(key);
    if (bucket && now < bucket.unlockTime) {
      set.status = 429;
      const sisa = Math.ceil((bucket.unlockTime - now) / 1000);
      return `Akun dikunci sementara. Coba lagi dalam ${sisa} detik.`;
    }

    const user = users.find(
      (u) => u.email.toLowerCase() === email && u.status === "active"
    );
    if (!user) {
      hit();
      set.status = 401;
      return "Email atau password salah.";
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      hit();
      set.status = 401;
      return "Email atau password salah.";
    }

    
    loginAttempts.delete(key);

  
    const secret = process.env.SESSION_SECRET || "dev_secret_change_me";
    const token = signSession(
      { userId: user.id, role: user.role, issuedAt: Math.floor(now / 1000) },
      secret
    );

    cookie.session.set({
      value: token,
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      maxAge: 60 * 60 * 8 
    });

    
    set.status = 302;
    set.headers.Location = "/dashboard";
    return;

    function hit() {
      if (!bucket || now > bucket.unlockTime) {
        loginAttempts.set(key, { count: 1, unlockTime: 0 });
      } else {
        bucket.count++;
        if (bucket.count >= MAX_ATTEMPTS) {
          bucket.unlockTime = now + LOCK_MINUTES * 60_000;
          bucket.count = 0;
        }
        loginAttempts.set(key, bucket);
      }
    }
  })
  .post("/logout", ({ set, cookie }) => {
    if (cookie.session) cookie.session.set({ value: "", maxAge: 0 });
    set.status = 302;
    set.headers.Location = "/login?message=Berhasil logout";
  });
