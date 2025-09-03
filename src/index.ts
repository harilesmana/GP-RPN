import "dotenv/config";
import { Elysia } from "elysia";
import { authRoutes } from "./routes/auth";
import { staticPlugin } from "@elysiajs/static";
import { materiRoutes } from "./routes/materi";
import { komentarRoutes } from "./routes/komentar";
import { quizRoutes } from "./routes/quiz";
import { adminRoutes } from "./routes/admin";
import { rateLimit } from "./middleware/rateLimit";
import { securityHeaders } from "./middleware/securityHeaders";
import { inputValidation } from "./middleware/inputValidation";
import { render } from "./utils/render";

const app = new Elysia()
  .use(staticPlugin({ assets: "public"}))
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
    new Response(
      render("home", { title: "Beranda" }),
      { headers: { "Content-Type": "text/html" } }
    )
  )

  .onError(({ code }) => {
    if (code === 'NOT_FOUND') {
      return new Response(render("error", { title: "404", message: "Halaman tidak ditemukan" }), { status: 404 })
    }
  })
  
  .listen(3000);

console.log("🛡️  Server aman berjalan di http://localhost:3000");
