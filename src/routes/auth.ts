import { Elysia, t } from "elysia";
import { loginSchema, registerSchema, inputValidation } from "../middleware/inputValidation";
import { rateLimit } from "../middleware/rateLimit";
import { securityHeaders } from "../middleware/securityHeaders";
import { hashPassword, verifyPassword } from "../utils/hash";
import { generateAccessToken, generateRefreshToken, addToBlacklist, verifyRefreshToken } from "../utils/jwt";
import { users, loginAttempts, type Role, type User } from "../db";
import { render } from "../utils/ejsRenderer"; // Anda perlu membuat utility ini

// Constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 menit dalam milidetik

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(securityHeaders)
  .use(rateLimit)
  .use(inputValidation)
  
  // Halaman Login (GET) - Render login.ejs
  .get("/login", async ({ set, query }) => {
    try {
      set.headers['Content-Type'] = 'text/html';
      
      // Data yang akan dikirim ke template EJS
      const templateData = {
        error: query.error || null,
        message: query.message || null,
        email: query.email || ''
      };
      
      // Render template EJS
      return await render('login', templateData);
    } catch (error) {
      console.error("Error rendering login page:", error);
      set.status = 500;
      return "Terjadi kesalahan server";
    }
  })
  
  // Endpoint Login (POST) - Memproses form login
  .post("/login", 
    async ({ body, set, cookie, redirect }) => {
      try {
        const { email, password } = body;
        
        // Validasi input
        try {
          loginSchema.parse({ email, password });
        } catch (validationError: any) {
          return redirect(`/auth/login?error=Validasi gagal&email=${encodeURIComponent(email)}`);
        }
        
        // Cek apakah email sudah terkunci
        const attemptData = loginAttempts.get(email);
        const now = Date.now();
        
        if (attemptData && attemptData.unlockTime > now) {
          const remainingTime = Math.ceil((attemptData.unlockTime - now) / 1000 / 60);
          return redirect(`/auth/login?error=Akun terkunci. Coba lagi dalam ${remainingTime} menit.&email=${encodeURIComponent(email)}`);
        }
        
        // Cari user berdasarkan email
        const user = users.find(u => u.email === email && u.status === 'active');
        
        if (!user) {
          // Update attempt counter
          const currentAttempts = (attemptData?.count || 0) + 1;
          loginAttempts.set(email, {
            count: currentAttempts,
            unlockTime: now
          });
          
          return redirect(`/auth/login?error=Email atau password salah&email=${encodeURIComponent(email)}`);
        }
        
        // Verifikasi password
        const isPasswordValid = await verifyPassword(password, user.password_hash);
        
        if (!isPasswordValid) {
          // Tambah attempt counter
          const currentAttempts = (attemptData?.count || 0) + 1;
          
          if (currentAttempts >= MAX_LOGIN_ATTEMPTS) {
            // Kunci akun
            loginAttempts.set(email, {
              count: currentAttempts,
              unlockTime: now + LOCKOUT_DURATION
            });
            
            return redirect(`/auth/login?error=Terlalu banyak percobaan login. Akun terkunci selama 15 menit.&email=${encodeURIComponent(email)}`);
          } else {
            // Update attempt counter
            loginAttempts.set(email, {
              count: currentAttempts,
              unlockTime: now
            });
            
            return redirect(`/auth/login?error=Email atau password salah. Percobaan ${currentAttempts} dari ${MAX_LOGIN_ATTEMPTS}.&email=${encodeURIComponent(email)}`);
          }
        }
        
        // Reset login attempts jika berhasil
        loginAttempts.delete(email);
        
        // Update last login
        user.last_login = new Date();
        
        // Generate tokens
        const tokenPayload = {
          id: user.id,
          email: user.email,
          role: user.role
        };
        
        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);
        
        // Set cookies
        cookie.accessToken.set({
          value: accessToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 15 * 60, // 15 menit
          path: '/'
        });
        
        cookie.refreshToken.set({
          value: refreshToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 7 * 24 * 60 * 60, // 7 hari
          path: '/'
        });
        
        // Redirect ke dashboard berdasarkan role
        switch(user.role) {
          case "siswa":
            return redirect("/dashboard/siswa");
          case "guru":
            return redirect("/dashboard/guru");
          case "kepsek":
            return redirect("/dashboard/kepsek");
          default:
            return redirect("/dashboard");
        }
        
      } catch (error) {
        console.error("Login error:", error);
        return redirect("/auth/login?error=Terjadi kesalahan server");
      }
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String()
      })
    }
  )
  
  // Logout
  .post("/logout", 
    async ({ cookie, redirect }) => {
      try {
        const token = cookie.accessToken.value;
        if (token) {
          addToBlacklist(token);
        }
        
        // Hapus cookies
        cookie.accessToken.remove();
        cookie.refreshToken.remove();
        
        return redirect("/auth/login?message=Logout berhasil");
      } catch (error) {
        console.error("Logout error:", error);
        return redirect("/auth/login?error=Terjadi kesalahan saat logout");
      }
    }
  )
  
  // Halaman Register (GET) - Render register.ejs
  .get("/register", async ({ set, query }) => {
    try {
      set.headers['Content-Type'] = 'text/html';
      
      const templateData = {
        error: query.error || null,
        message: query.message || null,
        formData: {
          nama: query.nama || '',
          email: query.email || ''
        }
      };
      
      return await render('register', templateData);
    } catch (error) {
      console.error("Error rendering register page:", error);
      set.status = 500;
      return "Terjadi kesalahan server";
    }
  })
  
  // Endpoint Register (POST) - Memproses form register
  .post("/register", 
    async ({ body, set, redirect }) => {
      try {
        const { nama, email, password } = body;
        
        // Validasi input
        try {
          registerSchema.parse({ nama, email, password });
        } catch (validationError: any) {
          return redirect(`/auth/register?error=Validasi gagal&nama=${encodeURIComponent(nama)}&email=${encodeURIComponent(email)}`);
        }
        
        // Cek apakah email sudah terdaftar
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
          return redirect(`/auth/register?error=Email sudah terdaftar&nama=${encodeURIComponent(nama)}&email=${encodeURIComponent(email)}`);
        }
        
        // Hash password
        const passwordHash = await hashPassword(password);
        
        // Buat user baru (role siswa)
        const newUser: User = {
          id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
          nama,
          email,
          password_hash: passwordHash,
          role: "siswa",
          status: "active",
          created_at: new Date()
        };
        
        users.push(newUser);
        
        return redirect("/auth/login?message=Registrasi berhasil. Silakan login.");
        
      } catch (error) {
        console.error("Register error:", error);
        return redirect("/auth/register?error=Terjadi kesalahan server");
      }
    },
    {
      body: t.Object({
        nama: t.String(),
        email: t.String(),
        password: t.String()
      })
    }
  );
