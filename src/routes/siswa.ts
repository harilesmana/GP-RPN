import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { users, materi, tugas, tugasDetail, submissions, diskusi, diskusiMateri, kelas, Role } from "../db";

export const siswaRoutes = new Elysia()
  .use(authMiddleware)
  .derive(({ user }) => {
    if (!user || user.role !== "siswa") {
      throw new Error("Unauthorized");
    }
    return { user };
  })
  .get("/siswa/dashboard-stats", async ({ user }) => {
    const siswaId = user.userId;
    
    const totalMateri = materi.length;
    const tugasSiswa = tugas.filter(t => t.siswa_id === siswaId);
    const tugasSelesai = tugasSiswa.filter(t => t.status === "selesai").length;
    const tugasPending = tugasSiswa.filter(t => t.status !== "selesai").length;
    
    const nilaiTugas = tugasSiswa.filter(t => t.nilai).map(t => t.nilai || 0);
    const rataNilai = nilaiTugas.length > 0 
      ? nilaiTugas.reduce((sum, nilai) => sum + nilai, 0) / nilaiTugas.length 
      : 0;

    const overallProgress = totalMateri > 0 
      ? Math.round((tugasSelesai / totalMateri) * 100) 
      : 0;

    return {
      total_materi: totalMateri,
      tugas_selesai: tugasSelesai,
      tugas_pending: tugasPending,
      rata_nilai: Math.round(rataNilai),
      overall_progress: overallProgress
    };
  })
  .get("/siswa/tugas-recent", async ({ user }) => {
    const siswaId = user.userId;
    
    const recentTugas = tugas
      .filter(t => t.siswa_id === siswaId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        judul: tugasDetail.find(td => td.id === t.materi_id)?.judul || "Unknown",
        materi_judul: materi.find(m => m.id === t.materi_id)?.judul || "Unknown",
        status: t.status,
        deadline: tugasDetail.find(td => td.id === t.materi_id)?.deadline || new Date(),
        nilai: t.nilai
      }));

    return recentTugas;
  })
  .get("/siswa/materi", async () => {
    return materi.map(m => ({
      id: m.id,
      judul: m.judul,
      deskripsi: m.deskripsi,
      konten: m.konten.substring(0, 200) + (m.konten.length > 200 ? "..." : ""),
      guru_nama: users.find(u => u.id === m.guru_id)?.nama || "Unknown",
      created_at: m.created_at
    }));
  })
  .get("/siswa/tugas", async ({ user }) => {
    const siswaId = user.userId;
    
    return tugas
      .filter(t => t.siswa_id === siswaId)
      .map(t => {
        const detail = tugasDetail.find(td => td.id === t.materi_id);
        const submission = submissions.find(s => s.tugas_id === t.id && s.siswa_id === siswaId);
        
        return {
          id: t.id,
          judul: detail?.judul || "Unknown",
          deskripsi: detail?.deskripsi || "",
          materi_id: t.materi_id,
          materi_judul: materi.find(m => m.id === t.materi_id)?.judul || "Unknown",
          status: t.status,
          deadline: detail?.deadline || new Date(),
          nilai: t.nilai,
          feedback: submission?.feedback,
          jawaban: submission?.jawaban,
          created_at: t.created_at
        };
      });
  })
  .post("/siswa/tugas/:id/submit", async ({ user, params, body }) => {
    const siswaId = user.userId;
    const { id } = params;
    const { jawaban } = body;

    const tugasId = parseInt(id);
    const tugasItem = tugasDetail.find(t => t.id === tugasId);
    if (!tugasItem) {
      throw new Error("Tugas tidak ditemukan");
    }

    let submission = submissions.find(s => 
      s.tugas_id === tugasId && s.siswa_id === siswaId
    );

    if (submission) {
      submission.jawaban = jawaban;
      submission.submitted_at = new Date();
    } else {
      submission = {
        id: submissions.length > 0 ? Math.max(...submissions.map(s => s.id)) + 1 : 1,
        tugas_id: tugasId,
        siswa_id: siswaId,
        jawaban,
        submitted_at: new Date()
      };
      submissions.push(submission);
    }

    let tugasSiswa = tugas.find(t => 
      t.materi_id === tugasId && t.siswa_id === siswaId
    );

    if (tugasSiswa) {
      tugasSiswa.status = "dikerjakan";
      tugasSiswa.updated_at = new Date();
    } else {
      tugasSiswa = {
        id: tugas.length > 0 ? Math.max(...tugas.map(t => t.id)) + 1 : 1,
        materi_id: tugasId,
        siswa_id: siswaId,
        status: "dikerjakan",
        created_at: new Date(),
        updated_at: new Date()
      };
      tugas.push(tugasSiswa);
    }

    return { 
      message: "Jawaban berhasil disimpan", 
      submission,
      tugas: tugasSiswa
    };
  })
  .get("/siswa/nilai", async ({ user }) => {
    const siswaId = user.userId;
    
    return submissions
      .filter(s => s.siswa_id === siswaId && s.nilai !== null)
      .map(s => {
        const tugasItem = tugasDetail.find(t => t.id === s.tugas_id);
        const materiItem = materi.find(m => m.id === (tugasItem?.materi_id || 0));
        
        return {
          id: s.id,
          tugas_id: s.tugas_id,
          tugas_judul: tugasItem?.judul || "Unknown",
          materi_id: tugasItem?.materi_id || 0,
          materi_judul: materiItem?.judul || "Unknown",
          nilai: s.nilai,
          feedback: s.feedback,
          submitted_at: s.submitted_at,
          graded_at: s.graded_at
        };
      });
  })
  .get("/siswa/diskusi-kelas", async () => {
    return diskusi.map(d => ({
      id: d.id,
      kelas: d.kelas,
      isi: d.isi,
      user_id: d.user_id,
      user_name: users.find(u => u.id === d.user_id)?.nama || "Unknown",
      user_role: d.user_role,
      created_at: d.created_at
    }));
  })
  .get("/siswa/diskusi-materi", async () => {
    return diskusiMateri.map(d => ({
      id: d.id,
      materi_id: d.materi_id,
      materi_judul: materi.find(m => m.id === d.materi_id)?.judul || "Unknown",
      user_id: d.user_id,
      user_name: users.find(u => u.id === d.user_id)?.nama || "Unknown",
      user_role: d.user_role,
      isi: d.isi,
      parent_id: d.parent_id,
      created_at: d.created_at
    }));
  })
  .post("/siswa/diskusi-materi", async ({ user, body }) => {
    const siswaId = user.userId;
    const { materi_id, isi } = body;

    const materiItem = materi.find(m => m.id === parseInt(materi_id));
    if (!materiItem) {
      throw new Error("Materi tidak ditemukan");
    }

    const newDiskusi = {
      id: diskusiMateri.length > 0 ? Math.max(...diskusiMateri.map(d => d.id)) + 1 : 1,
      materi_id: parseInt(materi_id),
      user_id: siswaId,
      user_role: "siswa" as Role,
      isi,
      created_at: new Date()
    };

    diskusiMateri.push(newDiskusi);
    return { message: "Diskusi berhasil ditambahkan", diskusi: newDiskusi };
  })
  .get("/siswa/progress-detail", async ({ user }) => {
    const siswaId = user.userId;
    
    const totalMateri = materi.length;
    const materiDipelajari = new Set(
      tugas.filter(t => t.siswa_id === siswaId).map(t => t.materi_id)
    ).size;

    const totalTugas = tugasDetail.length;
    const tugasSelesai = tugas.filter(t => 
      t.siswa_id === siswaId && t.status === "selesai"
    ).length;

    const nilaiTugas = tugas.filter(t => 
      t.siswa_id === siswaId && t.nilai
    ).map(t => t.nilai || 0);

    const rataNilai = nilaiTugas.length > 0 
      ? nilaiTugas.reduce((sum, nilai) => sum + nilai, 0) / nilaiTugas.length 
      : 0;

    return {
      total_materi: totalMateri,
      materi_dipelajari: materiDipelajari,
      progress_materi: totalMateri > 0 ? Math.round((materiDipelajari / totalMateri) * 100) : 0,
      total_tugas: totalTugas,
      tugas_selesai: tugasSelesai,
      progress_tugas: totalTugas > 0 ? Math.round((tugasSelesai / totalTugas) * 100) : 0,
      rata_nilai: Math.round(rataNilai)
    };
  });