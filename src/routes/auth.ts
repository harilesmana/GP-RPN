import { Elysia } from "elysia";
import ejs from "ejs";
import { getUsers, loginAttempts } from "../db";
import { verifyPassword, hashPassword } from "../utils/hash";
import { signSession } from "../utils/session";
import { loginSchema, registerSchema, inputValidation } from "../middleware/inputValidation";
import type { Role } from "../db";

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

  .get("/register", async ({ set, query }) => {
    const fs = await Bun.file("views/register.ejs").text();
    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return view(fs, {
      error: query.error ?? "",
      message: query.message ?? "",
      formData: query.formData ? JSON.parse(query.formData) : {}
    });
  })

  .post("/register", async ({ request, set }) => {
    const formData = await request.formData();
    const body: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      body[key] = String(value);
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      const errorMessage = parsed.error.issues.map((i) => i.message).join(", ");
      
      set.status = 302;
      set.headers.Location = `/register?error=${encodeURIComponent(errorMessage)}&formData=${encodeURIComponent(JSON.stringify(body))}`;
      return;
    }

    const { email, password, nama, confirmPassword, kelas_id } = parsed.data;

    if (password !== confirmPassword) {
      set.status = 302;
      set.headers.Location = `/register?error=${encodeURIComponent("Password dan konfirmasi password tidak cocok")}&formData=${encodeURIComponent(JSON.stringify(body))}`;
      return;
    }

    const users = await getUsers();
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      set.status = 302;
      set.headers.Location = `/register?error=${encodeURIComponent("Email sudah terdaftar")}&formData=${encodeURIComponent(JSON.stringify(body))}`;
      return;
    }

    try {
      const passwordHash = await hashPassword(password);
      const now = new Date();

      
      const { query } = await import("../db");
      await query(
        `INSERT INTO users (nama, email, password_hash, role, status, created_at, last_login, login_count, last_activity) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nama.trim(),
          email.toLowerCase().trim(),
          passwordHash,
          "siswa",
          "active",
          now,
          now,
          0,
          now
        ]
      );

      set.status = 302;
      set.headers.Location = "/login?message=Registrasi berhasil. Silakan login.";
      return;

    } catch (error) {
      console.error("Registration error:", error);
      set.status = 500;
      set.headers.Location = `/register?error=${encodeURIComponent("Terjadi kesalahan server")}&formData=${encodeURIComponent(JSON.stringify(body))}`;
      return;
    }
  })

  .post("/login", async ({ request, set, cookie }) => {
    const formData = await request.formData();
    const body: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      body[key] = String(value);
    }

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

    const users = await getUsers();
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

    
    const { query } = await import("../db");
    await query(
      "UPDATE users SET last_login = ?, login_count = login_count + 1 WHERE id = ?",
      [new Date(), user.id]
    );

    user.last_login = new Date();

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