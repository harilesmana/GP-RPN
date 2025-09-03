import "dotenv/config";
import { Elysia } from "elysia";
import { authRoutes } from "./routes/auth";
import { dashboardRoutes } from "./routes/dashboard";
import { materiRoutes } from "./routes/materi";
import { komentarRoutes } from "./routes/komentar";
import { quizRoutes } from "./routes/quiz";
import { adminRoutes } from "./routes/admin";
import { kepsekRoutes } from "./routes/kepsek"; 
import { rateLimit } from "./middleware/rateLimit";
import { securityHeaders } from "./middleware/securityHeaders";
import { inputValidation } from "./middleware/inputValidation";
import ejs from "ejs";
import { readFileSync } from "fs";
import { join } from "path";


function render(view: string, data: any = {}) {
  
  const file = readFileSync(join(import.meta.dir, "../../views", view), "utf8");
  return ejs.render(file, data);
}

const app = new Elysia()
  
  .use(securityHeaders)
  .use(rateLimit)
  .use(inputValidation)
  

  
  .use(authRoutes)
  .use(dashboardRoutes)
  .use(materiRoutes)
  .use(komentarRoutes)
  .use(quizRoutes)
  .use(adminRoutes)
  .use(kepsekRoutes) 

  
  .get("/health", () => ({ status: "OK", timestamp: new Date().toISOString() }))

  
  .get("/", () => {
    return new Response(render("login.ejs"), {
      headers: { "Content-Type": "text/html" },
    });
  })

  
  .onError(({ code }) => {
    if (code === "NOT_FOUND") {
      return new Response(render("404.ejs"), {
        headers: { "Content-Type": "text/html" },
        status: 404
      });
    }
  })
  
  
  .listen(process.env.PORT || 3000);

console.log(`🛡️  Server aman berjalan di http://localhost:${process.env.PORT || 3000}`);
