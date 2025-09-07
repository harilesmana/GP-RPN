import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { 
  users, kelas, materi, diskusi, tugas, 
  tugasDetail, submissions, diskusiMateri,
  User, Kelas, Materi, TugasDetail, Submission, DiskusiMateri
} from "../db";

export const siswaRoutes = new Elysia({ prefix: "/siswa" })
  .derive(authMiddleware as any)
  
  .onBeforeHandle(({ user, set }) => {
    if (!user || !user.userId) {
      set.status = 401;
      return "Silakan login terlebih dahulu";
    }
    
    if (user.role !== "siswa") {
      set.status = 403;
      return "Akses ditolak. Hanya siswa yang dapat mengakses endpoint ini.";
    }
  })

  
  .get("/dashboard-stats", async ({ user }) => {
    const siswaId = user.userId;
    
    const semuaTugas = tugasDetail.length;
    const tugasDikerjakan = submissions.filter(s => s.siswa_id === siswaId).length;
    const tugasSelesai = submissions.filter(s => 
      s.siswa_id === siswaId && s.nilai !== undefined
    ).length;
    
    const nilaiSiswa = submissions
      .filter(s => s.siswa_id === siswaId && s.nilai !== undefined)
      .map(s => s.nilai as number);
    
    const rataNilai = nilaiSiswa.length > 0 
      ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
      : 0;
    
    const progress = semuaTugas > 0 
      ? Math.round((tugasDikerjakan / semuaTugas) * 100)
      : 0;
    
    return {
      success: true,
      data: {
        total_materi: materi.length,
        total_tugas: semuaTugas,
        tugas_selesai: tugasSelesai,
        tugas_pending: tugasDikerjakan - tugasSelesai,
        rata_nilai: rataNilai,
        overall_progress: progress
      }
    };
  })

  
  .get("/materi", async ({ user }) => {
    const siswa = users.find(u => u.id === user.userId);
    const kelasSiswa = siswa?.kelas_id || 1;
    
    const materiSiswa = materi
      .filter(m => m.kelas_id === kelasSiswa)
      .map(m => {
        const guru = users.find(u => u.id === m.guru_id);
        return {
          id: m.id,
          judul: m.judul,
          deskripsi: m.deskripsi,
          konten: m.konten.substring(0, 200) + (m.konten.length > 200 ? "..." : ""),
          guru_nama: guru?.nama || "Tidak diketahui",
          created_at: m.created_at
        };
      });
    
    return {
      success: true,
      data: materiSiswa
    };
  })

  
  .get("/tugas", async ({ user }) => {
    const siswaId = user.userId;
    const siswa = users.find(u => u.id === siswaId);
    const kelasSiswa = siswa?.kelas_id || 1;
    
    const tugasSiswa = tugasDetail
      .filter(t => {
        const materiItem = materi.find(m => m.id === t.materi_id);
        return materiItem && materiItem.kelas_id === kelasSiswa;
      })
      .map(t => {
        const submission = submissions.find(s => 
          s.tugas_id === t.id && s.siswa_id === siswaId
        );
        const materiItem = materi.find(m => m.id === t.materi_id);
        
        return {
          id: t.id,
          judul: t.judul,
          deskripsi: t.deskripsi,
          materi_judul: materiItem?.judul || "Tidak diketahui",
          deadline: t.deadline,
          status: submission ? "dikerjakan" : "belum_dikerjakan",
          nilai: submission?.nilai,
          feedback: submission?.feedback,
          jawaban: submission?.jawaban,
          submitted_at: submission?.submitted_at
        };
      });
    
    return {
      success: true,
      data: tugasSiswa
    };
  })

  
  .get("/tugas-recent", async ({ user }) => {
    const siswaId = user.userId;
    
    const tugasSiswa = await fetch(`/siswa/tugas`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'include'
    }).then(res => res.json());
    
    return {
      success: true,
      data: tugasSiswa.data.slice(0, 5) 
    };
  })

  
  .post("/tugas/:id/submit", async ({ user, params, body, set }) => {
    const siswaId = user.userId;
    const tugasId = parseInt(params.id);
    
    if (isNaN(tugasId)) {
      set.status = 400;
      return { error: "ID tugas tidak valid" };
    }
    
    const tugasItem = tugasDetail.find(t => t.id === tugasId);
    if (!tugasItem) {
      set.status = 404;
      return { error: "Tugas tidak ditemukan" };
    }
    
    cons