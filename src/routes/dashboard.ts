import { Elysia } from "elysia";
import ejs from "ejs";
import { authMiddleware } from "../middleware/auth";
import { 
  users, 
  classes, 
  mataPelajaran, 
  guruMengajar, 
  tasks, 
  tugasSiswa, 
  diskusi,
  siswaKelas
} from "../db"; 

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
      const jumlahKelas = classes.length;
      const jumlahGuru = users.filter(u => u.role === "guru" && u.status === "active").length;
      const jumlahSiswa = users.filter(u => u.role === "siswa" && u.status === "active").length;
      const tugasDeadline = tasks.filter(t => {
  const now = new Date();
  return t.deadline.getTime() - now.getTime() <= 2 * 24 * 60 * 60 * 1000; 
});

const tugasBelumDikumpulkan = tugasSiswa.filter(ts => ts.status === 'belum');
      return render("views/dashboard/kepsek.ejs", { 
        user, 
        jumlahKelas, 
        jumlahGuru, 
        jumlahSiswa 
      });
    }
    
    if (user.role === "guru") {
      
      const guru = users.find(u => u.id === user.userId);
      
    
      const kelasDiampu = classes.filter(c => c.wali_kelas_id === user.userId);
      
      
      const mapelDiajar = guruMengajar
        .filter(gm => gm.guru_id === user.userId)
        .map(gm => {
          const mapel = mataPelajaran.find(mp => mp.id === gm.mata_pelajaran_id);
          const kelas = classes.find(c => c.id === gm.kelas_id);
          return { ...gm, nama_mapel: mapel?.nama, nama_kelas: kelas?.nama };
        });

      
      const tugasDibuat = tasks.filter(t => t.created_by === user.userId);
      
    
      const tugasPerluDinilai = tugasDibuat.map(tugas => {
        const submissions = tugasSiswa.filter(ts => ts.tugas_id === tugas.id);
        const sudahDinilai = submissions.filter(ts => ts.status === 'selesai' && ts.nilai !== undefined).length;
        const belumDinilai = submissions.filter(ts => ts.status === 'selesai' && ts.nilai === undefined).length;
        
        return {
          ...tugas,
          total_siswa: submissions.length,
          sudah_dinilai: sudahDinilai,
          perlu_dinilai: belumDinilai
        };
      });

      const totalPerluDinilai = tugasPerluDinilai.reduce((sum, t) => sum + t.perlu_dinilai, 0);

      
      const diskusiTerbaru = diskusi
        .filter(d => {
          const isKelas = d.target_type === 'kelas' && kelasDiampu.some(k => k.id === d.target_id);
          const isTugas = d.target_type === 'tugas' && tugasDibuat.some(t => t.id === d.target_id);
          return isKelas || isTugas;
        })
        .slice(0, 5)
        .map(d => {
          const pengirim = users.find(u => u.id === d.pengirim_id);
          return {
            ...d,
            nama_pengirim: pengirim?.nama || 'Unknown'
          };
        });

      return render("views/dashboard/guru.ejs", { 
        user: { ...user, nama: guru?.nama },
        kelasDiampu,
        mapelDiajar,
        tugasPerluDinilai,
        totalPerluDinilai,
        diskusiTerbaru
      });
    }
    
    
    return render("views/dashboard/siswa.ejs", { user });
  });
