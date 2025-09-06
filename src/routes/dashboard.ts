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
  
  
  .get("/guru/siswa/:id/progress/view", async ({ set, params, user }) => {
    if (!user || user.role !== "guru") {
      set.status = 302;
      set.headers.Location = "/login?error=Silakan login terlebih dahulu";
      return;
    }
    
    set.headers["Content-Type"] = "text/html; charset=utf-8";
    
    try {
      
      const response = await fetch(`http://localhost:${process.env.PORT || 3000}/guru/siswa/${params.id}/progress`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      let progressData = null;
      let error = null;
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          progressData = result.data;
        } else {
          error = result.error || 'Gagal memuat data progress';
        }
      } else {
        error = await response.text();
      }
      
      return render("views/dashboard/siswa-progress.ejs", { 
        user,
        siswaId: params.id,
        progressData: progressData,
        error: error
      });
    } catch (error) {
      console.error('Error loading progress data:', error);
      return render("views/dashboard/siswa-progress.ejs", { 
        user,
        siswaId: params.id,
        progressData: null,
        error: "Terjadi kesalahan saat memuat data progress"
      });
    }
  });
