import { Elysia, t } from "elysia";
import { loginSchema, registerSchema, inputValidation } from "../middleware/inputValidation";
import { hashPassword, verifyPassword } from "../utils/hash";
import { signSession } from "../utils/session";
import { users, loginAttempts, Role } from "../db";
import { render } from "../middleware/ejs";

export const authRoutes = new Elysia()
  .use(inputValidation)
  .get("/login", () => {
    return { _view: 'login.ejs', title: 'Login - E-Learning' };
  })
  .get("/register", () => {
    return { _view: 'register.ejs', title: 'register - e-learning' };
  })
  .post("/login", async ({ body, set, cookie, parseFormData }) => {
    try {
      const formData = await parseFormData();
      const { email, password } = loginSchema.parse(formData);

      const attemptKey = `login_attempt_${email}`;
      const now = Date.now();
      const attempt = loginAttempts.get(attemptKey) || { count: 0, unlockTime: 0 };

      if (now < attempt.unlockTime) {
        const remainingTime = Math.ceil((attempt.unlockTime - now) / 1000);
        set.status = 429;
        return `Terlalu banyak percobaan login. Coba lagi dalam ${remainingTime} detik.`;
      }

      const user = users.find(u => u.email === email && u.status === 'active');
      
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        attempt.count++;
        if (attempt.count >= 5) {
          attempt.unlockTime = now + 15 * 60 * 1000;
          attempt.count = 0;
        }
        loginAttempts.set(attemptKey, attempt);
        
        set.status = 401;
        return "Email atau password salah";
      }

      loginAttempts.delete(attemptKey);

      user.last_login = new Date();
      user.login_count = (user.login_count || 0) + 1;

      const secret = process.env.SESSION_SECRET || "dev_secret_change_me";
      const sessionData = {
        userId: user.id,
        role: user.role as Role,
        issuedAt: Date.now()
      };
      
      const token = signSession(sessionData, secret);
      
      cookie.session.set({
        value: token,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60,
        path: "/"
      });

      switch (user.role) {
        case "kepsek":
          set.redirect = "/dashboard/kepsek";
          break;
        case "guru":
          set.redirect = "/dashboard/guru";
          break;
        case "siswa":
          set.redirect = "/dashboard/siswa";
          break;
        default:
          set.redirect = "/dashboard";
      }
    } catch (error) {
      console.error("Login error:", error);
      set.status = 400;
      return "Terjadi kesalahan saat login";
    }
  })
  .post("/register", async ({ body, set }) => {
    try {
      const { nama, email, password, confirmPassword } = registerSchema.parse(body);

      if (password !== confirmPassword) {
        set.status = 400;
        return "Konfirmasi password tidak cocok";
      }

      if (users.some(u => u.email === email)) {
        set.status = 400;
        return "Email sudah terdaftar";
      }

      const passwordHash = await hashPassword(password);

      const newUser = {
        id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
        nama,
        email,
        password_hash: passwordHash,
        role: "siswa" as Role,
        status: "active" as const,
        created_at: new Date(),
        last_login: new Date(),
        login_count: 1
      };

      users.push(newUser);

      set.status = 201;
      return "Registrasi berhasil! Silakan login.";
    } catch (error) {
      console.error("Registration error:", error);
      set.status = 400;
      return "Terjadi kesalahan saat registrasi";
    }
  })
  .post("/logout", ({ cookie, set }) => {
    cookie.session.set({
      value: "",
      maxAge: 0,
      path: "/"
    });
    set.redirect = "/login";
  });