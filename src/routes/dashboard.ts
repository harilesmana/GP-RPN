import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { users } from "../db";
import { render } from "../middleware/ejs";

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

    return render('dashboard/kepsek', { 
      user: kepsekUser,
      title: 'Dashboard Kepala Sekolah - E-Learning'
    });
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

    return render('dashboard/guru', { 
      user: guruUser,
      title: 'Dashboard Guru - E-Learning'
    });
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

    return render('dashboard/siswa', { 
      user: siswaUser,
      title: 'Dashboard Siswa - E-Learning'
    });
  });