import { Elysia } from "elysia";
import { html } from "@elysiajs/html";
import { authMiddleware } from "../middleware/auth";

export const dashboardRoutes = new Elysia()
  .use(html())
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
        set.status = 403;
        return "Akses ditolak";
    }
  })
  .get("/dashboard/kepsek", async ({ user, set }) => {
    if (!user || user.role !== "kepsek") {
      set.redirect = "/login";
      return;
    }

    const kepsekUser = users.find(u => u.id === user.userId);
    if (!kepsekUser) {
      set.redirect = "/login";
      return;
    }

    set.headers["Content-Type"] = "text/html";
    const template = await Bun.file("views/dashboard/kepsek.ejs").text();
    return template.replace("<%= user.nama %>", kepsekUser.nama);
  })
  .get("/dashboard/guru", async ({ user, set }) => {
    if (!user || user.role !== "guru") {
      set.redirect = "/login";
      return;
    }

    const guruUser = users.find(u => u.id === user.userId);
    if (!guruUser) {
      set.redirect = "/login";
      return;
    }

    set.headers["Content-Type"] = "text/html";
    const template = await Bun.file("views/dashboard/guru.ejs").text();
    return template.replace("<%= user.nama %>", guruUser.nama);
  })
  .get("/dashboard/siswa", async ({ user, set }) => {
    if (!user || user.role !== "siswa") {
      set.redirect = "/login";
      return;
    }

    const siswaUser = users.find(u => u.id === user.userId);
    if (!siswaUser) {
      set.redirect = "/login";
      return;
    }

    set.headers["Content-Type"] = "text/html";
    const template = await Bun.file("views/dashboard/siswa.ejs").text();
    return template.replace("<%= user.nama %>", siswaUser.nama);
  });