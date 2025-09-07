import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";

export const dashboardRoutes = new Elysia()
  .use(authMiddleware)
  .get("/dashboard", async ({ user, set }) => {
    if (!user) {
      set.redirect = "/login";
      return;
    }

    
    switch (user.role) {
      case "kepsek":
        set.redirect = "/dashboard/kepsek";
        break;
      case "guru":
        set.redirect = "/dashboard/guru";
        break;
      case "siswa":
        set.redirect = "/dashboard/siswa";
        break;
      default:
        set.redirect = "/login";
    }
  })
  .get("/dashboard/kepsek", async ({ user, set }) => {
    if (!user || user.role !== "kepsek") {
      set.redirect = "/login";
      return;
    }

    set.headers["Content-Type"] = "text/html";
    
    
    const { users } = await import("../db");
    const userDetail = users.find(u => u.id === user.userId);
    
    return Bun.file("views/dashboard/kepsek.ejs").text()
      .then(content => content.replace("<%= user.nama %>", userDetail?.nama || "Kepala Sekolah"));
  })
  .get("/dashboard/guru", async ({ user, set }) => {
    if (!user || user.role !== "guru") {
      set.redirect = "/login";
      return;
    }

    set.headers["Content-Type"] = "text/html";
    
    
    const { users } = await import("../db");
    const userDetail = users.find(u => u.id === user.userId);
    
    return Bun.file("views/dashboard/guru.ejs").text()
      .then(content => content.replace("<%= user.nama %>", userDetail?.nama || "Guru"));
  })
  .get("/dashboard/siswa", async ({ user, set }) => {
    if (!user || user.role !== "siswa") {
      set.redirect = "/login";
      return;
    }

    set.headers["Content-Type"] = "text/html";
    
    
    const { users } = await import("../db");
    const userDetail = users.find(u => u.id === user.userId);
    
    return Bun.file("views/dashboard/siswa.ejs").text()
      .then(content => content.replace("<%= user.nama %>", userDetail?.nama || "Siswa"));
  });