import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { users } from "../db";

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
    
    
    const userDetail = users.find(u => u.id === user.userId);
    
    try {
      const template = await Bun.file("views/dashboard/kepsek.ejs").text();
      return template.replace("<%= user.nama %>", userDetail?.nama || "Kepala Sekolah");
    } catch (error) {
      console.error("Error loading kepsek template:", error);
      set.status = 500;
      return "Error loading dashboard";
    }
  })
  .get("/dashboard/guru", async ({ user, set }) => {
    if (!user || user.role !== "guru") {
      set.redirect = "/login";
      return;
    }

    set.headers["Content-Type"] = "text/html";
    
    
    const userDetail = users.find(u => u.id === user.userId);
    
    try {
      const template = await Bun.file("views/dashboard/guru.ejs").text();
      return template.replace("<%= user.nama %>", userDetail?.nama || "Guru");
    } catch (error) {
      console.error("Error loading guru template:", error);
      set.status = 500;
      return "Error loading dashboard";
    }
  })
  .get("/dashboard/siswa", async ({ user, set }) => {
    if (!user || user.role !== "siswa") {
      set.redirect = "/login";
      return;
    }

    set.headers["Content-Type"] = "text/html";
    
    
    const userDetail = users.find(u => u.id === user.userId);
    
    try {
      const template = await Bun.file("views/dashboard/siswa.ejs").text();
      return template.replace("<%= user.nama %>", userDetail?.nama || "Siswa");
    } catch (error) {
      console.error("Error loading siswa template:", error);
      set.status = 500;
      return "Error loading dashboard";
    }
  });