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
    if (!user || user.role !== "siswa") {
      set.status = 403;
      return "Akses ditolak. Hanya siswa yang dapat mengakses endpoint ini.";
    }
  })

  
  .get("/dashboard-stats", async ({ user }) => {
    const siswaId = user.userId;
    
    
    const totalMateri = materi.length;
    
    
    const tugasDikerjakan = submissions.filter(s => s.siswa_id === siswaId).length;
    
    
    const tugasDinilai = submissions.filter(s => 
      s.siswa_id === siswaId && s.nilai !== undefined
    ).length;
    
    
    const nilaiSiswa = submissions
      .filter(s => s.siswa_id === siswaId && s.nilai !== undefined)
      .map(s => s.nilai as number);
    
    const rataNilai = nilaiSiswa.length > 0 
      ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
      : 0;
    
    
    const totalTugas = tugasDetail.length;
    const progress = totalTugas > 0 
      ? Math.round((tugasDikerjakan / totalTugas) * 100)
      : 0;
    
    return {
      success: true,
      data: {
        total_materi: totalMateri,
        tugas_selesai: tugasDinilai,
        tugas_pending: tugasDikerjakan - tugasDinilai,
        rata_nilai: rataNilai,
        overall_progress: progress
      }
    };
  })

  
  .get("/tugas-recent", async ({ user }) => {
    const siswaId = user.userId;
    
    const recentTugas = tugasDetail
      .slice(-5)
      .map(tugas => {
        const submission = submissions.find(s => 
          s.tugas_id === tugas.id && s.siswa_id === siswaId
        );
        
        return {
          id: tugas.id,
          judul: tugas.judul,
          materi_judul: materi.find(m => m.id === tugas.materi_id)?.judul || "Tidak diketahui",
          deadline: tugas.deadline,
          status: submission ? "dikerjakan" : "belum_dikerjakan"
        };
      });
    
    return {
      success: true,
      data: recentTugas
    };
  })

  
  .get("/materi", async () => {
    const materiList = materi.map(m => {
      const guru = users.find(u => u.id === m.guru_id);
      
      return {
        id: m.id,
        judul: m.judul,
        deskripsi: m.deskripsi,
        konten: m.konten,
        guru_nama: guru?.nama || "Tidak diketahui",
        created_at: m.created_at
      };
    });
    
    return {
      success: true,
      data: materiList
    };
  })

  
  .get("/tugas", async ({ user }) => {
    const siswaId = user.userId;
    
    const tugasList = tugasDetail.map(tugas => {
      const submission = submissions.find(s => 
        s.tugas_id === tugas.id && s.siswa_id === siswaId
      );
      const materiItem = materi.find(m => m.id === tugas.materi_id);
      const guru = users.find(u => u.id === tugas.guru_id);
      
      return {
        id: tugas.id,
        judul: tugas.judul,
        deskripsi: tugas.deskripsi,
        materi_id: tugas.materi_id,
        materi_judul: materiItem?.judul || "Tidak diketahui",
        guru_nama: guru?.nama || "Tidak diketahui",
        deadline: tugas.deadline,
        status: submission ? (submission.nilai !== undefined ? "selesai" : "dikerjakan") : "belum_dikerjakan",
        jawaban: submission?.jawaban || "",
        nilai: submission?.nilai || null,
        feedback: submission?.feedback || "",
        submitted_at: submission?.submitted_at || null
      };
    });
    
    return {
      success: true,
      data: tugasList
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
    
    
    if (new Date() > new Date(tugasItem.deadline)) {
      set.status = 400;
      return { error: "Tugas sudah melewati deadline" };
    }
    
    const { jawaban } = body as any;
    if (!jawaban || jawaban.trim().length === 0) {
      set.status = 400;
      return { error: "Jawaban tidak boleh kosong" };
    }
    
    
    const existingSubmissionIndex = submissions.findIndex(s => 
      s.tugas_id === tugasId && s.siswa_id === siswaId
    );
    
    if (existingSubmissionIndex !== -1) {
      
      submissions[existingSubmissionIndex].jawaban = jawaban.trim();
      submissions[existingSubmissionIndex].submitted_at = new Date();
      submissions[existingSubmissionIndex].nilai = undefined;
      submissions[existingSubmissionIndex].feedback = "";
      submissions[existingSubmissionIndex].graded_at = undefined;
      
      return {
        success: true,
        message: "Jawaban berhasil diperbarui"
      };
    } else {
      
      const newSubmission: Submission = {
        id: submissions.length + 1,
        tugas_id: tugasId,
        siswa_id: siswaId,
        jawaban: jawaban.trim(),
        submitted_at: new Date()
      };
      
      submissions.push(newSubmission);
      
      return {
        success: true,
        message: "Jawaban berhasil dikumpulkan"
      };
    }
  })

  
  .get("/nilai", async ({ user }) => {
    const siswaId = user.userId;
    
    const nilaiList = submissions
      .filter(s => s.siswa_id === siswaId)
      .map(submission => {
        const tugasItem = tugasDetail.find(t => t.id === submission.tugas_id);
        const materiItem = materi.find(m => m.id === tugasItem?.materi_id);
        
        return {
          id: submission.id,
          tugas_id: submission.tugas_id,
          tugas_judul: tugasItem?.judul || "Tugas tidak ditemukan",
          materi_judul: materiItem?.judul || "Materi tidak ditemukan",
          jawaban: submission.jawaban,
          nilai: submission.nilai,
          feedback: submission.feedback,
          submitted_at: submission.submitted_at,
          graded_at: submission.graded_at
        };
      });
    
    return {
      success: true,
      data: nilaiList
    };
  })

  
  .get("/diskusi-kelas", async () => {
    const diskusiList = diskusiMateri
      .filter(d => d.parent_id === undefined) 
      .map(d => {
        const user = users.find(u => u.id === d.user_id);
        const materiItem = materi.find(m => m.id === d.materi_id);
        
        return {
          id: d.id,
          materi_id: d.materi_id,
          materi_judul: materiItem?.judul || "Materi tidak ditemukan",
          user_id: d.user_id,
          user_name: user?.nama || "Tidak diketahui",
          user_role: d.user_role,
          isi: d.isi,
          created_at: d.created_at
        };
      });
    
    return {
      success: true,
      data: diskusiList
    };
  })

  
  .get("/diskusi-materi", async () => {
    const diskusiList = diskusiMateri.map(d => {
      const user = users.find(u => u.id === d.user_id);
      const materiItem = materi.find(m => m.id === d.materi_id);
      
      return {
        id: d.id,
        materi_id: d.materi_id,
        materi_judul: materiItem?.judul || "Materi tidak ditemukan",
        user_id: d.user_id,
        user_name: user?.nama || "Tidak diketahui",
        user_role: d.user_role,
        isi: d.isi,
        parent_id: d.parent_id,
        created_at: d.created_at
      };
    });
    
    return {
      success: true,
      data: diskusiList
    };
  })

  
  .post("/diskusi-materi", async ({ user, body, set }) => {
    const siswaId = user.userId;
    const { materi_id, isi } = body as any;
    
    if (!materi_id || !isi) {
      set.status = 400;
      return { error: "Materi ID dan isi diskusi harus diisi" };
    }
    
    if (isi.length < 5) {
      set.status = 400;
      return { error: "Isi diskusi terlalu pendek" };
    }
    
    const materiItem = materi.find(m => m.id === parseInt(materi_id));
    if (!materiItem) {
      set.status = 404;
      return { error: "Materi tidak ditemukan" };
    }
    
    const newDiskusi: DiskusiMateri = {
      id: diskusiMateri.length + 1,
      materi_id: parseInt(materi_id),
      user_id: siswaId,
      user_role: "siswa",
      isi: isi.trim(),
      created_at: new Date()
    };
    
    diskusiMateri.push(newDiskusi);
    
    return {
      success: true,
      message: "Diskusi berhasil ditambahkan",
      data: {
        id: newDiskusi.id,
        materi_id: newDiskusi.materi_id
      }
    };
  })

  
  .get("/progress-detail", async ({ user }) => {
    const siswaId = user.userId;
    
    
    const materiDipelajari = new Set(
      submissions
        .filter(s => s.siswa_id === siswaId)
        .map(s => {
          const tugasItem = tugasDetail.find(t => t.id === s.tugas_id);
          return tugasItem?.materi_id;
        })
        .filter(id => id !== undefined)
    ).size;
    
    
    const tugasDikerjakan = submissions.filter(s => s.siswa_id === siswaId).length;
    
    
    const tugasDinilai = submissions.filter(s => 
      s.siswa_id === siswaId && s.nilai !== undefined
    ).length;
    
    
    const nilaiSiswa = submissions
      .filter(s => s.siswa_id === siswaId && s.nilai !== undefined)
      .map(s => s.nilai as number);
    
    const rataNilai = nilaiSiswa.length > 0 
      ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
      : 0;
    
    
    const totalMateri = materi.length;
    const totalTugas = tugasDetail.length;
    
    const progressMateri = totalMateri > 0 
      ? Math.round((materiDipelajari / totalMateri) * 100)
      : 0;
    
    const progressTugas = totalTugas > 0 
      ? Math.round((tugasDikerjakan / totalTugas) * 100)
      : 0;
    
    return {
      success: true,
      data: {
        materi_dipelajari: materiDipelajari,
        total_materi: totalMateri,
        progress_materi: progressMateri,
        tugas_selesai: tugasDinilai,
        total_tugas: totalTugas,
        progress_tugas: progressTugas,
        rata_nilai: rataNilai
      }
    };
  })

  
  .post("/diskusi/:id/reply", async ({ user, params, body, set }) => {
    const siswaId = user.userId;
    const diskusiId = parseInt(params.id);
    
    if (isNaN(diskusiId)) {
      set.status = 400;
      return { error: "ID diskusi tidak valid" };
    }
    
    const diskusiAsli = diskusiMateri.find(d => d.id === diskusiId);
    if (!diskusiAsli) {
      set.status = 404;
      return { error: "Diskusi tidak ditemukan" };
    }
    
    const { reply } = body as any;
    if (!reply) {
      set.status = 400;
      return { error: "Balasan tidak boleh kosong" };
    }
    
    const balasan: DiskusiMateri = {
      id: diskusiMateri.length + 1,
      materi_id: diskusiAsli.materi_id,
      user_id: siswaId,
      user_role: "siswa",
      isi: reply.trim(),
      parent_id: diskusiId,
      created_at: new Date()
    };
    
    diskusiMateri.push(balasan);
    
    return {
      success: true,
      message: "Balasan berhasil dikirim",
      data: {
        id: balasan.id,
        materi_id: balasan.materi_id
      }
    };
  });
