import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { users, materi, tugas, submissions, diskusi, diskusiMateri, kelas, Role } from "../db";

export const siswaRoutes = new Elysia()
  .use(authMiddleware)
  .derive(({ user }) => {
    if (!user || user.role !== "siswa") {
      throw new Error("Unauthorized");
    }
    return { user };
  })
  
  .get("/siswa/dashboard-stats", ({ user }) => {
    const siswaId = user.userId;
    const siswaTugas = tugas.filter(t => t.siswa_id === siswaId);
    
    const total_materi = materi.length;
    const tugas_selesai = siswaTugas.filter(t => t.status === "selesai").length;
    const tugas_pending = siswaTugas.filter(t => t.status !== "selesai").length;
    
    const nilaiValues = siswaTugas.filter(t => t.nilai !== undefined).map(t => t.nilai!);
    const rata_nilai = nilaiValues.length > 0 
      ? Math.round(nilaiValues.reduce((a, b) => a + b, 0) / nilaiValues.length) 
      : 0;
    
    const overall_progress = Math.min(Math.round((tugas_selesai / Math.max(total_materi, 1)) * 100), 100);

    return {
      total_materi,
      tugas_selesai,
      tugas_pending,
      rata_nilai,
      overall_progress
    };
  })
  .get("/siswa/tugas-recent", ({ user }) => {
    const siswaId = user.userId;
    return tugas
      .filter(t => t.siswa_id === siswaId)
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        judul: "Tugas " + t.id,
        materi_id: t.materi_id,
        materi_judul: materi.find(m => m.id === t.materi_id)?.judul || "Unknown",
        status: t.status,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
      }));
  })
  
  .get("/siswa/materi", () => {
    return materi.map(m => ({
      id: m.id,
      judul: m.judul,
      deskripsi: m.deskripsi,
      konten: m.konten.substring(0, 200) + "...", 
      guru_id: m.guru_id,
      guru_nama: users.find(u => u.id === m.guru_id)?.nama || "Unknown",
      created_at: m.created_at
    }));
  })
  
  .get("/siswa/tugas", ({ user }) => {
    const siswaId = user.userId;
    
    return tugas
      .filter(t => t.siswa_id === siswaId)
      .map(t => {
        const submission = submissions.find(s => s.tugas_id === t.id && s.siswa_id === siswaId);
        
        return {
          id: t.id,
          judul: "Tugas " + t.id,
          materi_id: t.materi_id,
          materi_judul: materi.find(m => m.id === t.materi_id)?.judul || "Unknown",
          deskripsi: "Deskripsi tugas untuk materi " + t.materi_id,
          status: t.status,
          nilai: submission?.nilai,
          feedback: submission?.feedback,
          jawaban: submission?.jawaban,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
          submitted_at: submission?.submitted_at
        };
      });
  })
  .post("/siswa/tugas/:id/submit", async ({ params, body, user }) => {
    const { id } = params;
    const { jawaban } = body as any;
    const siswaId = user.userId;

    
    const tugasIndex = tugas.findIndex(t => t.id === parseInt(id) && t.siswa_id === siswaId);
    if (tugasIndex === -1) {
      throw new Error("Tugas tidak ditemukan");
    }

    
    let submission = submissions.find(s => s.tugas_id === parseInt(id) && s.siswa_id === siswaId);
    
    if (submission) {
      submission.jawaban = jawaban;
      submission.submitted_at = new Date();
    } else {
      submission = {
        id: submissions.length > 0 ? Math.max(...submissions.map(s => s.id)) + 1 : 1,
        tugas_id: parseInt(id),
        siswa_id: siswaId,
        jawaban,
        submitted_at: new Date()
      };
      submissions.push(submission);
    }

    
    tugas[tugasIndex].status = "dikerjakan";
    tugas[tugasIndex].updated_at = new Date();

    return { message: "Jawaban berhasil disimpan" };
  })
  
  .get("/siswa/nilai", ({ user }) => {
    const siswaId = user.userId;
    
    return submissions
      .filter(s => s.siswa_id === siswaId && s.nilai !== null)
      .map(s => {
        const tugasItem = tugas.find(t => t.id === s.tugas_id);
        
        return {
          id: s.id,
          tugas_id: s.tugas_id,
          tugas_judul: "Tugas " + s.tugas_id,
          materi_id: tugasItem?.materi_id,
          materi_judul: materi.find(m => m.id === tugasItem?.materi_id)?.judul || "Unknown",
          nilai: s.nilai,
          feedback: s.feedback,
          submitted_at: s.submitted_at,
          graded_at: s.graded_at
        };
      });
  })
  
  .get("/siswa/diskusi-kelas", () => {
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
  .get("/siswa/diskusi-materi", () => {
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
  .post("/siswa/diskusi-materi", async ({ body, user }) => {
    const { materi_id, isi } = body as any;

    const newDiskusi = {
      id: diskusiMateri.length > 0 ? Math.max(...diskusiMateri.map(d => d.id)) + 1 : 1,
      materi_id: parseInt(materi_id),
      user_id: user.userId,
      user_role: user.role as Role,
      isi,
      created_at: new Date()
    };

    diskusiMateri.push(newDiskusi);
    return { message: "Komentar berhasil ditambahkan", id: newDiskusi.id };
  })
  
  .get("/siswa/progress-detail", ({ user }) => {
    const siswaId = user.userId;
    const siswaTugas = tugas.filter(t => t.siswa_id === siswaId);
    
    const materi_dipelajari = new Set(siswaTugas.map(t => t.materi_id)).size;
    const total_materi = materi.length;
    const progress_materi = Math.round((materi_dipelajari / Math.max(total_materi, 1)) * 100);
    
    const tugas_selesai = siswaTugas.filter(t => t.status === "selesai").length;
    const total_tugas = siswaTugas.length;
    const progress_tugas = Math.round((tugas_selesai / Math.max(total_tugas, 1)) * 100);
    
    const nilaiValues = siswaTugas.filter(t => t.nilai !== undefined).map(t => t.nilai!);
    const rata_nilai = nilaiValues.length > 0 
      ? Math.round(nilaiValues.reduce((a, b) => a + b, 0) / nilaiValues.length) 
      : 0;

    return {
      materi_dipelajari,
      total_materi,
      progress_materi,
      tugas_selesai,
      total_tugas,
      progress_tugas,
      rata_nilai
    };
  });