import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { users } from "../db";

export const dashboardRoutes = new Elysia({ prefix: "/dashboard" })
  .use(authMiddleware)
  .get("/", async ({ user, set }) => {
    if (!user) {
      set.redirect = "/auth/login";
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
        return { error: "Akses ditolak" };
    }
  })
  .get("/kepsek", async ({ user, set }) => {
    if (!user || user.role !== "kepsek") {
      set.redirect = "/auth/login";
      return;
    }

    const kepsekUser = users.find(u => u.id === user.userId);
    if (!kepsekUser) {
      set.redirect = "/auth/login";
      return;
    }

    return { 
      _view: 'dashboard/kepsek.ejs', 
      user: kepsekUser,
      title: 'Dashboard Kepala Sekolah - E-Learning'
    };
  })
  .get("/guru", async ({ user, set }) => {
    if (!user || user.role !== "guru") {
      set.redirect = "/auth/login";
      return;
    }

    const guruUser = users.find(u => u.id === user.userId);
    if (!guruUser) {
      set.redirect = "/auth/login";
      return;
    }

    return { 
      _view: 'dashboard/guru.ejs', 
      user: guruUser,
      title: 'Dashboard Guru - E-Learning'
    };
  })
  .get("/siswa", async ({ user, set }) => {
    if (!user || user.role !== "siswa") {
      set.redirect = "/auth/login";
      return;
    }

    const siswaUser = users.find(u => u.id === user.userId);
    if (!siswaUser) {
      set.redirect = "/auth/login";
      return;
    }

    return { 
      _view: 'dashboard/siswa.ejs', 
      user: siswaUser,
      title: 'Dashboard Siswa - E-Learning'
    };
  });