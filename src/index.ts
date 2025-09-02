import "dotenv/config";
import { Elysia } from "elysia";
import { authRoutes } from "./routes/auth";

const app = new Elysia()
  .use(authRoutes)
  .get("/", () =>
    new Response("Selamat datang! <a href='/login'>Login</a>", {
      headers: { "Content-Type": "text/html" },
    })
  )
  .listen(3000);

console.log(`server running at http://localhost: 3000`);
