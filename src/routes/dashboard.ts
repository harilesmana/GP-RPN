import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { generateAccessToken } from "../utils/jwt";
import ejs from "ejs";
import { readFileSync } from "fs";
import { join } from "path";

function render(view: string, data: any = {}) {
  const file = readFileSync(join(import.meta.dir, "../../views", view), "utf8");
  return ejs.render(file, data);
}

export const dashboardRoutes = new Elysia()
  .derive(authMiddleware as any)
  
  
  .get("/dashboard", ({ user, set }: any) => {
    if (!user) {
      set.redirect = "/login";
      return;
    }
    
    let dashboardView = `dashboard/${user.role}.ejs`;
    
    return new Response(render(dashboardView, { 
      user,
      token: generateAccessToken({ id: user.id, role: user.role })
    }), {
      headers: { "Content-Type": "text/html" }
    });
  });
