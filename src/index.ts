import "dotenv/config";
import { Elysia } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { cors } from "@elysiajs/cors";
import { securityHeaders } from "./middleware/security";
import { rateLimit } from "./middleware/rateLimit";
import { ejsPlugin } from "./middleware/ejs";
import { authRoutes } from "./routes/auth";
import { dashboardRoutes } from "./routes/dashboard";
import { kepsekRoutes } from "./routes/kepsek";
import { guruRoutes } from "./routes/guru";
import { siswaRoutes } from "./routes/siswa";
import { registrasiRoutes } from "./routes/registrasi";

const app = new Elysia()
  .use(cors())
  .use(cookie({ secret: process.env.SESSION_SECRET || "dev_secret_change_me" }))
  .use(ejsPlugin({ viewsDir: './views' }))
  .use(securityHeaders)
  .onBeforeHandle(rateLimit(60, 60_000))
  .get("/", ({ set }) => {
    set.status = 302;
    set.headers.Location = "/auth/login";
    return "Redirecting to login...";
  })
  .use(authRoutes)
  .use(dashboardRoutes)
  .use(kepsekRoutes)
  .use(guruRoutes)
  .use(siswaRoutes)
  .use(registrasiRoutes)
  .all("*", () => new Response("Not Found", { status: 404 }));

const server = app.listen(process.env.PORT ? Number(process.env.PORT) : 3000, () => {
  console.log(`🚀 Server running at http://localhost:${app.server?.port}`);
});

export type App = typeof app;