import "dotenv/config";
import { Elysia } from "elysia";
import { authRoutes } from "./routes/auth";
import { materiRoutes } from "./routes/materi";
import { komentarRoutes } from "./routes/komentar";
import { quizRoutes } from "./routes/quiz";
import { adminRoutes } from "./routes/admin";
import { rateLimit } from "./middleware/rateLimit";
import { securityHeaders } from "./middleware/securityHeaders";
import { inputValidation } from "./middleware/inputValidation";
import ejs from "ejs";
import { readFileSync } from "fs";
import { join } from "path";

// Helper function untuk render EJS
function render(view: string, data: any = {}) {
  const file = readFileSync(join(import.meta.dir, "../../views", view), "utf8");
  return ejs.render(file, data);
}

const app = new Elysia()
  // Global security middleware
  .use(securityHeaders)
  .use(rateLimit)
  .use(inputValidation)
  
  // Routes
  .use(authRoutes)
  .use(materiRoutes)
  .use(komentarRoutes)
  .use(quizRoutes)
  .use(adminRoutes)
  
  // Health check
  .get("/health", () => ({ status: "OK", timestamp: new Date().toISOString() }))
  
  // Home page
  .get("/", () => {
    return new Response(render("home.ejs"), {
      headers: { "Content-Type": "text/html" },
    });
  })
  
  // Handle 404
  .onError(({ code }) => {
    if (code === 'NOT_FOUND') return new Response(render("404.ejs"), { 
      headers: { "Content-Type": "text/html" },
      status: 404 
    });
  })
  
  .listen(3000);

console.log("🛡️  Server aman berjalan di http://localhost:3000");
console.log("📚 Fitur: Auth, Materi, Diskusi Komentar, Quiz & Nilai, Admin Management");
console.log("💬 Fitur Diskusi: Komentar, Balasan, Edit, Hapus dengan struktur tree");
console.log("🔒 Keamanan: Rate Limiting, Input Validation, JWT Protection, XSS Prevention");
