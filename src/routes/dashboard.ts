import { Elysia } from "elysia";
import { verifySession } from "../utils/session";
import { users } from "../db";

export const dashboardRoutes = new Elysia({ prefix: "/dashboard" })
  // .use(authMiddleware)
  .derive(({ cookie, set, request }) => {
    const token = cookie?.session?.value;
    if (!token) {
      return { user: null };
    }

    const secret = process.env.SESSION_SECRET || "dev_secret_change_me";
    const data = verifySession(token, secret);
    if (!data) {
      if (cookie?.session) cookie.session.set({ value: "", maxAge: 0 });
      return { user: null };
    }

    const user = {
      userId: data.userId,
      role: data.role,
    }

    return { user };
  })
  .get("/", async ({ user, set }) => {
    if (!user) {
      set.headers.location = "/auth/login";
      return;
    }

    switch (user.role) {
      case "kepsek":
        set.status = 302;
        set.headers.location = "/dashboard/kepsek";
        return;
      case "guru":
        set.status = 302;
        set.headers.location = "/dashboard/guru";
        return;
      case "siswa":
        set.status = 302;
        set.headers.location = "/dashboard/siswa";
        return;
      default:
        set.status = 403;
        return { error: "Akses ditolak" };
    }
  })
  .get("/kepsek", async ({ user, set }) => {
    if (!user || user.role !== "kepsek") {
      set.status = 302;
      set.headers.location = "/auth/login";
      return;
    }

    const kepsekUser = users.find(u => u.id === user.userId);
    if (!kepsekUser) {
      set.status = 302;
      set.headers.location = "/auth/login";
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
      set.status = 302;
      set.headers.location = "/auth/login";
      return;
    }

    const guruUser = users.find(u => u.id === user.userId);
    if (!guruUser) {
      set.status = 302;
      set.headers.location = "/auth/login";
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
      set.status = 302;
      set.headers.location = "/auth/login";
      return;
    }

    const siswaUser = users.find(u => u.id === user.userId);
    if (!siswaUser) {
      set.status = 302;
      set.headers.location = "/auth/login";
      return;
    }

    return {
      _view: 'dashboard/siswa.ejs',
      user: siswaUser,
      title: 'Dashboard Siswa - E-Learning'
    };
  });