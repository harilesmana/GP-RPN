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
  })


  .get("/guru/siswa/:id/progress/view", async ({ set, params, user, cookie }) => {

    if (!user || !user.userId) {
      set.status = 302;
      set.headers.Location = "/login?error=Silakan login terlebih dahulu";
      return;
    }

    if (user.role !== "guru") {
      set.status = 302;
      set.headers.Location = "/dashboard?error=Akses ditolak. Hanya guru yang dapat mengakses halaman ini.";
      return;
    }

    set.headers["Content-Type"] = "text/html; charset=utf-8";
    set.headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    set.headers["Pragma"] = "no-cache";
    set.headers["Expires"] = "0";

    try {
      const baseUrl = `http://localhost:${process.env.PORT || 3000}`;

      // PERBAIKAN: Tambahkan timestamp dan headers yang lebih baik
      const timestamp = Date.now();
      const response = await fetch(`${baseUrl}/guru/siswa/${params.id}/progress?_t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cookie': `session=${cookie.session.value}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        credentials: 'include'
      });

      let progressData = null;
      let error = null;

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          progressData = result.data;

        } else {
          error = result.error || 'Gagal memuat data progress';
          console.error('API Error:', result.error);
        }
      } else {
        const errorText = await response.text();
        error = `Gagal terhubung ke server (${response.status})`;
        console.error('HTTP Error:', response.status, errorText);
      }

      return render("views/dashboard/siswa-progress.ejs", {
        user,
        siswaId: params.id,
        progressData: progressData,
        error: error,
        // PERBAIKAN: Tambahkan timestamp untuk mencegah cache
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error loading progress data:', error);
      return render("views/dashboard/siswa-progress.ejs", {
        user,
        siswaId: params.id,
        progressData: null,
        error: "Terjadi kesalahan saat memuat data progress: " + error.message,
        timestamp: Date.now()
      });
    }
  })