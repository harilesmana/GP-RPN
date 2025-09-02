import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "fallback-insecure-secret-change-in-production";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "fallback-insecure-refresh-secret-change-in-production";

if (SECRET === "fallback-insecure-secret-change-in-production" || 
    REFRESH_SECRET === "fallback-insecure-refresh-secret-change-in-production") {
  console.warn("⚠️  Peringatan: Menggunakan secret key default. Ubah di environment variables untuk production!");
}


export function generateAccessToken(payload: object): string {
  return jwt.sign(payload, SECRET, { 
    expiresIn: "15m",
    issuer: "e-learning-app",
    audience: "e-learning-users"
  });
}


export function generateRefreshToken(payload: object): string {
  return jwt.sign(payload, REFRESH_SECRET, { 
    expiresIn: "7d",
    issuer: "e-learning-app",
    audience: "e-learning-users"
  });
}

export function verifyAccessToken(token: string): any {
  try {
    return jwt.verify(token, SECRET, {
      issuer: "e-learning-app",
      audience: "e-learning-users"
    });
  } catch (error) {
    console.warn("Token verification failed:", error);
    return null;
  }
}

export function verifyRefreshToken(token: string): any {
  try {
    return jwt.verify(token, REFRESH_SECRET, {
      issuer: "e-learning-app",
      audience: "e-learning-users"
    });
  } catch (error) {
    console.warn("Refresh token verification failed:", error);
    return null;
  }
}


const tokenBlacklist = new Set<string>();

export function addToBlacklist(token: string): void {
  const decoded = jwt.decode(token) as any;
  if (decoded && decoded.exp) {
    const expiryTime = decoded.exp * 1000 - Date.now();
    if (expiryTime > 0) {
      tokenBlacklist.add(token);
      
      setTimeout(() => tokenBlacklist.delete(token), expiryTime);
    }
  }
}

export function isTokenBlacklisted(token: string): boolean {
  return tokenBlacklist.has(token);
}


setInterval(() => {
  const now = Date.now();
  for (const token of tokenBlacklist) {
    const decoded = jwt.decode(token) as any;
    if (decoded && decoded.exp && decoded.exp * 1000 < now) {
      tokenBlacklist.delete(token);
    }
  }
}, 60 * 60 * 1000); 
