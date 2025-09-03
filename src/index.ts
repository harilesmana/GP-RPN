import "dotenv/config";
import { Elysia } from "elysia";
import { authRoutes } from "./routes/auth";
import { kepsekRoutes } from "./routes/kepsek"; 
import { rateLimit } from "./middleware/rateLimit";
import { securityHeaders } from "./middleware/securityHeaders";
import { inputValidation } from "./middleware/inputValidation";

const app = new Elysia()
  
  .use(securityHeaders)
  .use(rateLimit)
  .use(inputValidation)
  
  
  .use(authRoutes)
  .use(kepsekRoutes)
  
  
  .get("/health", () => ({ status: "OK", timestamp: new Date().toISOString() }))
  
  
  .get("/", () =>
    new Response("Selamat datang! <a href='/login'>Login</a>", {
      headers: { "Content-Type": "text/html" },
    })
  )
  
  
  .onError(({ code }) => {
    if (code === 'NOT_FOUND') return new Response('Halaman tidak ditemukan', { status: 404 })
  })
  
  .listen(3000);

console.log("🛡️  Server aman berjalan di http://localhost:3000");
