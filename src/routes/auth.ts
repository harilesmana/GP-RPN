import { Elysia } from "elysia";
import { users, loginAttempts } from "../db";
import { verifyPassword, hashPassword, validatePasswordStrength } from "../utils/hash";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, addToBlacklist } from "../utils/jwt";
import { loginSchema, registerSchema, inputValidation } from "../middleware/inputValidation";
import ejs from "ejs";
import { readFileSync } from "fs";
import { join } from "path";

let lastId = users.length;


function render(view: string, data: any = {}) {
  try {
    const file = readFileSync(join(import.meta.dir, "../../views", view), "utf8");
    
    
    const sanitizedData: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        sanitizedData[key] = value
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');
      } else {
        sanitizedData[key] = value;
      }
    }
    
    return ejs.render(file, sanitizedData);
  } catch (error) {
    console.error("Error rendering view:", error);
    return "<h1>Error loading page</h1>";
  }
}

const LOGIN_ATTEMPTS_LIMIT = parseInt(process.env.LOGIN_ATTEMPTS_LIMIT || "5");
const LOGIN_LOCKOUT_TIME = parseInt(process.env.LOGIN_LOCKOUT_TIME || "900000"); 

export const authRoutes = new Elysia()
  .use(inputValidation)
  
  
  .get("/login", () => new Response(render("login.ejs"), { headers: { "Content-Type": "text/html" } }))

  .post("/login", async ({ sanitizedBody, set, request }: any) => {
    const { email, password } = sanitizedBody as { email: string; password: string };
    
    
    try {
      loginSchema.parse({ email, password });
    } catch (error: any) {
      set.status = 400;
      return { error: error.errors[0].message };
    }
    
    
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('cf-connecting-ip') || 
               'unknown';
    const now = Date.now();
    const attemptData = loginAttempts.get(ip) || { count: 0, unlockTime: 0 };
    
    if (now < attemptData.unlockTime) {
      set.status = 429;
      const waitTime = Math.ceil((attemptData.unlockTime - now) / 1000);
      return new Response(`Terlalu banyak percobaan login. Coba lagi dalam ${waitTime} detik.`, { status: 429 });
    }
    
    const user = users.find((u) => u.email === email);  
    if (!user) {
      
      attemptData.count++;
      if (attemptData.count >= LOGIN_ATTEMPTS_LIMIT) {
        attemptData.unlockTime = now + LOGIN_LOCKOUT_TIME;
        attemptData.count = 0;
      }
      loginAttempts.set(ip, attemptData);
      
      return new Response("Email atau password salah", { status: 401 });
    }  

    
    if (user.status !== "active") {
      set.status = 403;
      return new Response("Akun tidak aktif. Silakan hubungi administrator.", { status: 403 });
    }

    const valid = await verifyPassword(password, user.password_hash);  
    if (!valid) {
      
      attemptData.count++;
      if (attemptData.count >= LOGIN_ATTEMPTS_LIMIT) {
        attemptData.unlockTime = now + LOGIN_LOCKOUT_TIME;
        attemptData.count = 0;
      }
      loginAttempts.set(ip, attemptData);
      
      return new Response("Email atau password salah", { status: 401 });
    }  

    
    loginAttempts.delete(ip);
    
    
    user.last_login = new Date();
    
    const accessToken = generateAccessToken({ id: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id });

    switch (user.role) {  
      case "kepsek":  
        return new Response(render("dashboard/kepsek.ejs", { user, accessToken, refreshToken }), { 
          headers: { "Content-Type": "text/html" } 
        });  
      case "guru":  
        return new Response(render("dashboard/guru.ejs", { user, accessToken, refreshToken }), { 
          headers: { "Content-Type": "text/html" } 
        });  
      case "siswa":  
        return new Response(render("dashboard/siswa.ejs", { user, accessToken, refreshToken }), { 
          headers: { "Content-Type": "text/html" } 
        });  
      default:
        return new Response("Role tidak valid", { status: 401 });
    }
  })
  
  
  .post("/refresh", async ({ body, set }: any) => {
    const { refreshToken } = body;
    
    if (!refreshToken) {
      set.status = 401;
      return { error: "Refresh token required" };
    }
    
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      set.status = 401;
      return { error: "Invalid refresh token" };
    }
    
    const user = users.find(u => u.id === (payload as any).id);
    if (!user) {
      set.status = 401;
      return { error: "User not found" };
    }
    
    const newAccessToken = generateAccessToken({ id: user.id, role: user.role });
    return { accessToken: newAccessToken };
  })
  
  
  .post("/logout", async ({ body, set }: any) => {
    const { accessToken } = body;
    
    if (accessToken) {
      addToBlacklist(accessToken);
    }
    
    return { message: "Logged out successfully" };
  })
  
  
  .get("/register", () => new Response(render("register.ejs"), { headers: { "Content-Type": "text/html" } }))

  .post("/register", async ({ sanitizedBody, set }: any) => {
    const { nama, email, password } = sanitizedBody as any;

    
    try {
      registerSchema.parse({ nama, email, password });
    } catch (error: any) {
      set.status = 400;
      return { error: error.errors[0].message };
    }

    
    if (!validatePasswordStrength(password)) {
      set.status = 400;
      return { error: "Password harus mengandung huruf besar, huruf kecil, dan angka" };
    }

    if (users.find((u) => u.email === email)) {  
      return new Response("Email sudah terdaftar", { status: 400 });  
    }  

    const newUser = {  
      id: ++lastId,  
      nama,  
      email,  
      password_hash: await hashPassword(password),  
      role: "siswa" as const,  
      status: "active" as const,
      created_at: new Date()
    };  

    users.push(newUser);  

    return new Response("Registrasi berhasil. Silakan login.", { status: 200 });
  });
