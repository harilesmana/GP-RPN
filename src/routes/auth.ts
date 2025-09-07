import { Elysia } from "elysia";
import { loginSchema, registerSchema, inputValidation } from "../middleware/inputValidadation";
import { hashPassword, verifyPassword } from "../utils/hash";
import { signSession } from "../utils/session";
import { users, loginAttempts, Role } from "../db";

export const authRoutes = new Elysia()
  .use(inputValidation)
  .get("/login", async ({ set }) => {
    set.headers["Content-Type"] = "text/html";
    return Bun.file("views/login.ejs").text();
  })
  .get("/register", async ({ set }) => {
    set.headers["Content-Type"] = "text/html";
    return Bun.file("views/register.ejs").text();
  })
  .post("/login", async ({ body, set, cookie, parseFormData }) => {
    try {
      const formData = await parseFormData();
      const validatedData = loginSchema.parse(formData);

      // Check login attempts
      const attemptKey = `${validatedData.email}_${new Date().toISOString().split('T')[0]}`;
      const attempt = loginAttempts.get(attemptKey) || { count: 0, unlockTime: 0 };

      if (attempt.count >= 5 && Date.now() < attempt.unlockTime) {
        const minutesLeft = Math.ceil((attempt.unlockTime - Date.now()) / 60000);
        set.status = 429;
        return `Terlalu banyak percobaan login. Coba lagi dalam ${minutesLeft} menit.`;
      }

      // Find user
      const user = users.find(u => u.email === validatedData.email && u.status === 'active');
      if (!user) {
        incrementLoginAttempt(attemptKey);
        set.status = 401;
        return "Email atau password salah";
      }

      // Verify password
      const isValid = await verifyPassword(validatedData.password, user.password_hash);
      if (!isValid) {
        incrementLoginAttempt(attemptKey);
        set.status = 401;
        return "Email atau password salah";
      }

      // Reset login attempts on success
      loginAttempts.delete(attemptKey);

      // Update user login info
      user.last_login = new Date();
      user.login_count = (user.login_count || 0) + 1;
      user.last_activity = new Date();

      // Create session
      const secret = process.env.SESSION_SECRET || "dev_secret_change_me";
      const sessionData = {
        userId: user.id,
        role: user.role as Role,
        issuedAt: Date.now()
      };
      const token = signSession(sessionData, secret);

      // Set cookie
      cookie.session.set({
        value: token,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60, // 1 week
        path: "/"
      });

      // Redirect based on role
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

      return "Login berhasil";
    } catch (error) {
      console.error("Login error:", error);
      set.status = 400;
      return "Terjadi kesalahan saat login";
    }
  })
  .post("/register", async ({ body, set }) => {
    try {
      const validatedData = registerSchema.parse(body);

      // Check if passwords match
      if (validatedData.password !== validatedData.confirmPassword) {
        set.status = 400;
        return "Password dan konfirmasi password tidak cocok";
      }

      // Check if email already exists
      const existingUser = users.find(u => u.email === validatedData.email);
      if (existingUser) {
        set.status = 400;
        return "Email sudah terdaftar";
      }

      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);

      // Create new user (default role: siswa)
      const newUser = {
        id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
        nama: validatedData.nama,
        email: validatedData.email,
        password_hash: hashedPassword,
        role: "siswa" as Role,
        status: "active" as const,
        created_at: new Date(),
        last_login: undefined,
        login_count: 0,
        last_activity: new Date()
      };

      users.push(newUser);

      set.status = 201;
      return "Registrasi berhasil. Silakan login.";
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
    return "Logout berhasil";
  });

function incrementLoginAttempt(key: string) {
  const now = Date.now();
  const attempt = loginAttempts.get(key) || { count: 0, unlockTime: 0 };
  
  attempt.count++;
  
  if (attempt.count >= 5) {
    attempt.unlockTime = now + 15 * 60 * 1000; // Lock for 15 minutes
  }
  
  loginAttempts.set(key, attempt);
}