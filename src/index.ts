import "dotenv/config";
import { Elysia } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { cors } from "@elysiajs/cors";
import { securityHeaders } from "./middleware/security";
import { rateLimit } from "./middleware/rateLimit";
import { authRoutes } from "./routes/auth";
import { dashboardRoutes } from "./routes/dashboard";


const app = new Elysia()
  .use(cors()) 
  .use(cookie())
  .use(securityHeaders(new Elysia()))
  
  .onBeforeHandle(rateLimit(60, 60_000))
  
  .get("/", ({ set }) => {
    set.status = 302;
    set.headers.Location = "/login";
  })
  
  .use(authRoutes)
  .use(dashboardRoutes)
  
  .all("*", () => new Response("Not Found", { status: 404 }));

app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
console.log(`Server jalan di http://localhost:${app.server?.port}`);
