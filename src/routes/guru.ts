import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { users, materi, tugas, submissions, kelas, diskusiMateri, Role } from "../db";

export const guruRoutes = new Elysia()
  .use(authMiddleware)
  .derive(({ user }) => {
    if (!user || user.role !== "guru") {
      throw new Error("Unauthorized");
    }
    return { user };
  })
  
  .get("/guru/dashboard/stats", ({ user }) => {
    const guruMateri = materi.filter(m => m.guru_id === user.userId);
    const guruTugas = tugas.filter(t => {
      const tugasMateri = materi.find(m => m.id === t.materi_id);
      return tugasMateri && tugasMateri.guru_id === user.userId;
    });
    
    const total_materi = guruMateri.length;
    const total_siswa = users.filter(u => u.role === "siswa" && u.status === "active").length;
    const tugas_pending = submissions.filter(s => s.nilai === null).length;
    
    const nilaiValues = submissions.filter(s => s.nilai !== null).map(s => s.nilai!);
    const rata_nilai = nilaiValues.length > 0 
      ? Math.round(nilaiValues.reduce((a, b) => a + b, 0) / nilaiValues.length) 
      : 0;

    return {
      data: {
        total_materi,
        total_siswa,
        tugas_pending,
        rata_nilai
      }
    };
  })
  .get("/guru/dashboard/recent-activity", () => {
    
    return {
      data: [
        {
          title: "Materi Baru",
          description: "Menambahkan materi pembelajaran baru",
          created_at: new Date().toISOString()
        }
      ]
    };
  })
  
  .get("/guru/materi", ({ user }) => {
    return {
      data: materi
        .filter(m => m.guru_id === user.userId)
        .map(m => ({
          id: m.id,
          judul: m.judul,
          deskripsi: m.deskripsi,
          konten: m.konten,
          created_at: m.created_at,
          updated_at: m.updated_at
        }))
    };
  })
  .post("/guru/materi", async ({ body, user }) => {
    const { judul, deskripsi, konten } = body as any;

    const newMateri = {
      id: materi.length > 0 ? Math.max(...materi.map(m => m.id)) + 1 : 1,
      judul,
      deskripsi,
      konten,
      guru_id: user.userId,
      kelas_id: 1, 
      created_at: new Date(),
      updated_at: new Date()
    };

    materi.push(newMateri);
    return { message: "Materi berhasil ditambahkan", id: newMateri.id };
  })
  .put("/guru/materi/:id", async ({ params, body, user }) => {
    const { id } = params;
    const { judul, konten } = body as any;

    const materiIndex = materi.findIndex(m => m.id === parseInt(id) && m.guru_id === user.userId);
    if (materiIndex === -1) {
      throw new Error("Materi tidak ditemukan");
    }

    materi[materiIndex].judul = judul;
    materi[materiIndex].konten = konten;
    materi[materiIndex].updated_at = new Date();

    return { message: "Materi berhasil diupdate" };
  })
  .delete("/guru/materi/:id", async ({ params, user }) => {
    const { id } = params;
    const materiIndex = materi.findIndex(m => m.id === parseInt(id) && m.guru_id === user.userId);
    
    if (materiIndex === -1) {
      throw new Error("Materi tidak ditemukan");
    }

    materi.splice(materiIndex, 1);
    return { message: "Materi berhasil dihapus" };
  })
  
  .get("/guru/tugas", ({ user }) => {
    const guruMateri = materi.filter(m => m.guru_id === user.userId);
    const guruTugas = tugas.filter(t => guruMateri.some(m => m.id === t.materi_id));
    
    return {
      data: guruTugas.map(t => ({
        id: t.id,
        judul: "Tugas " + t.id, 
        materi_id: t.materi_id,
        materi_judul: materi.find(m => m.id === t.materi_id)?.judul || "Unknown",
        deskripsi: "Deskripsi tugas",
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
        submissions_count: submissions.filter(s => s.tugas_id === t.id).length
      }))
    };
  })
  .post("/guru/tugas", async ({ body, user }) => {
    const { materi_id, judul, deskripsi, deadline } = body as any;

    
    const materiItem = materi.find(m => m.id === parseInt(materi_id) && m.guru_id === user.userId);
    if (!materiItem) {
      throw new Error("Materi tidak ditemukan");
    }

    const newTugas = {
      id: tugas.length > 0 ? Math.max(...tugas.map(t => t.id)) + 1 : 1,
      materi_id: parseInt(materi_id),
      siswa_id: 0, 
      status: "belum_dikerjakan" as const,
      created_at: new Date(),
      updated_at: new Date()
    };

    tugas.push(newTugas);
    return { message: "Tugas berhasil dibuat", id: newTugas.id };
  })
  
  .get("/guru/submissions/pending", ({ user }) => {
    const guruMateri = materi.filter(m => m.guru_id === user.userId);
    const pendingSubmissions = submissions.filter(s => {
      const tugasItem = tugas.find(t => t.id === s.tugas_id);
      return tugasItem && guruMateri.some(m => m.id === tugasItem.materi_id) && s.nilai === null;
    });

    return {
      data: pendingSubmissions.map(s => ({
        id: s.id,
        tugas_id: s.tugas_id,
        tugas_judul: "Tugas " + s.tugas_id,
        siswa_id: s.siswa_id,
        siswa_nama: users.find(u => u.id === s.siswa_id)?.nama || "Unknown",
        jawaban: s.jawaban,
        submitted_at: s.submitted_at
      }))
    };
  })
  .post("/guru/submissions/:id/grade", async ({ params, body }) => {
    const { id } = params;
    const { nilai } = body as any;

    const submission = submissions.find(s => s.id === parseInt(id));
    if (!submission) {
      throw new Error("Submission tidak ditemukan");
    }

    submission.nilai = parseInt(nilai);
    submission.graded_at = new Date();
    submission.feedback = "Kerja bagus!"; 

    return { message: "Nilai berhasil diberikan" };
  })
  
  .get("/guru/siswa/progress", () => {
    const siswaList = users.filter(u => u.role === "siswa" && u.status === "active");
    
    return {
      data: siswaList.map(siswa => ({
        id: siswa.id,
        nama: siswa.nama,
        email: siswa.email,
        progress: Math.floor(Math.random() * 100), 
        rata_nilai: Math.floor(Math.random() * 100) 
      }))
    };
  })
  
  .get("/guru/diskusi", ({ user }) => {
    const guruMateri = materi.filter(m => m.guru_id === user.userId);
    const guruDiskusi = diskusiMateri.filter(d => 
      guruMateri.some(m => m.id === d.materi_id)
    );

    return {
      data: guruDiskusi.map(d => ({
        id: d.id,
        materi_id: d.materi_id,
        materi_judul: materi.find(m => m.id === d.materi_id)?.judul || "Unknown",
        user_id: d.user_id,
        user_name: users.find(u => u.id === d.user_id)?.nama || "Unknown",
        user_role: d.user_role,
        isi: d.isi,
        created_at: d.created_at
      }))
    };
  })
  .post("/guru/diskusi/:id/reply", async ({ params, body, user }) => {
    const { id } = params;
    const { reply } = body as any;

    const parentDiskusi = diskusiMateri.find(d => d.id === parseInt(id));
    if (!parentDiskusi) {
      throw new Error("Diskusi tidak ditemukan");
    }

    const newReply = {
      id: diskusiMateri.length > 0 ? Math.max(...diskusiMateri.map(d => d.id)) + 1 : 1,
      materi_id: parentDiskusi.materi_id,
      user_id: user.userId,
      user_role: user.role as Role,
      isi: reply,
      parent_id: parseInt(id),
      created_at: new Date()
    };

    diskusiMateri.push(newReply);
    return { message: "Balasan berhasil dikirim", id: newReply.id };
  });