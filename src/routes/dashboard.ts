import { Elysia } from "elysia";
import ejs from "ejs";
import { authMiddleware } from "../middleware/auth";

const render = async (file: string, data: Record<string, any> = {}) => {
  const tpl = await Bun.file(file).text();
  return ejs.render(tpl, data);
};

export const dashboardRoutes = new Elysia()
  .derive(authMiddleware as any)
  .get("/dashboard", async ({ set, user }) => {
    if (!user) {
      set.status = 302;
      set.headers.Location = "/login?error=Silakan login terlebih dahulu";
      return;
    }
    
    set.headers["Content-Type"] = "text/html; charset=utf-8";
    
    if (user.role === "kepsek") {
      return render("views/dashboard/kepsek.ejs", { 
        user,
      });
    }
    
    
if (user.role === "guru") {
      return render("views/dashboard/guru.ejs", { 
        user,
      });
    }
    
    
    return render("views/dashboard/siswa.ejs", { user });
  });
