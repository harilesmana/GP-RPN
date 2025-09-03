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

const app = new Elysia()

  .use(securityHeaders)
  .use(rateLimit)
  .use(inputValidation)


  .use(authRoutes)
  .use(materiRoutes)
  .use(komentarRoutes)
  .use(quizRoutes)
  .use(adminRoutes)


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
