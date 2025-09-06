import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { users, materi, tugas, submissions, diskusiMateri, kelas, Role } from "../db";

export const guruRoutes = new Elysia()
  .use(authMiddleware)
  .derive(({ user }) => {
    if (!user || user.role !== "guru") {
      throw new Error("Unauthorized");
    }
    return { user };
  })
  
  .get("/guru/dashboard/stats", async ({ user }) => {
    const guruId = user.userId;
    
    const totalMateri = materi.filter(m => m.guru_id === guruId).length;
    const totalSiswa = users.filter(u => u.role === "siswa").length;
    
    
    const tugasPending = submissions.filter(s => {
      const t = tugas.find(t => t.id === s.tugas_id);
      return t && materi.find(m => m.id === t.materi_id && m.guru_id === guruId) && s.nilai === null;
    }).length;

    
    const gradedSubmissions = submissions.filter(s => {
      const t = tugas.find(t => t.id === s.tugas_id);
      return t && materi.find(m => m.id === t.materi_id && m.guru_id === guruId) && s.nilai !== null;
    });
    
    const rataNilai = gradedSubmissions.length > 0 
      ? gradedSubmissions.reduce((sum, s) => sum + (s.nilai || 0), 0) / gradedSubmissions.length 
      : 0;

    return {
      total_materi: totalMateri,
      total_siswa: totalSiswa,
      tugas_pending: tugasPending,
      rata_nilai: Math.round(rataNilai)
    };
  })
  .get("/guru/dashboard/recent-activity", async ({ user }) => {
    const guruId = user.userId;
    
    
    const recentMateri = materi
      .filter(m => m.guru_id === guruId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 5)
      .map(m => ({
        type: "materi",
        title: m.judul,
        description: "Materi dibuat",
        created_at: m.created_at
      }));

    const recentGrading = submissions
      .filter(s => {
        const t = tugas.find(t => t.id === s.tugas_id);
        return t && materi.find(m => m.id === t.materi_id && m.guru_id === guruId) && s.graded_at;
      })
      .sort((a, b) => (b.graded_at?.getTime() || 0) - (a.graded_at?.getTime() || 0))
      .slice(0, 5)
      .map(s => ({
        type: "grading",
        title: `Penilaian tugas ${s.tugas_id}`,
        description: `Tugas dinilai: ${s.nilai}`,
        created_at: s.graded_at || new Date()
      }));

    return [...recentMateri, ...recentGrading].sort((a, b) => 
      b.created_at.getTime() - a.created_at.getTime()
    ).slice(0, 5);
  })
  
  .get("/guru/materi", async ({ user }) => {
    const guruId = user.userId;
    return materi.filter(m => m.guru_id === guruId);
  })
  .post("/guru/materi", async ({ user, body }) => {
    const guruId = user.userId;
    const { judul, deskripsi, konten } = body;

    const newMateri = {
      id: materi.length > 0 ? Math.max(...materi.map(m => m.id)) + 1 : 1,
      judul,
      deskripsi,
      konten,
      guru_id: guruId,
      kelas_id: 1, 
      created_at: new Date(),
      updated_at: new Date()
    };

    materi.push(newMateri);
    return { message: "Materi berhasil dibuat", materi: newMateri };
  })
  .put("/guru/materi/:id", async ({ user, params, body }) => {
    const guruId = user.userId;
    const { id } = params;
    const { judul, konten } = body;

    const materiIndex = materi.findIndex(m => m.id === parseInt(id) && m.guru_id === guruId);
    if (materiIndex === -1) {
      throw new Error("Materi tidak ditemukan");
    }

    materi[materiIndex] = {
      ...materi[materiIndex],
      judul,
      konten,
      updated_at: new Date()
    };

    return { message: "Materi berhasil diupdate", materi: materi[materiIndex] };
  })
  .delete("/guru/materi/:id", async ({ user, params }) => {
    const guruId = user.userId;
    const { id } = params;

    const materiIndex = materi.findIndex(m => m.id === parseInt(id) && m.guru_id === guruId);
    if (materiIndex === -1) {
      throw new Error("Materi tidak ditemukan");
    }

    materi.splice(materiIndex, 1);
    return { message: "Materi berhasil dihapus" };
  })
  
  .get("/guru/tugas", async ({ user }) => {
    const guruId = user.userId;
    
    const guruMateri = materi.filter(m => m.guru_id === guruId);
    const guruTugas = tugasDetail.filter(t => 
      guruMateri.some(m => m.id === t.materi_id)
    );

    return guruTugas.map(t => ({
      ...t,
      materi_judul: materi.find(m => m.id === t.materi_id)?.judul || "Unknown",
      submissions_count: submissions.filter(s => s.tugas_id === t.id).length
    }));
  })
  .post("/guru/tugas", async ({ user, body }) => {
    const guruId = user.userId;
    const { materi_id, judul, deskripsi, deadline } = body;

    
    const materiItem = materi.find(m => m.id === materi_id && m.guru_id === guruId);
    if (!materiItem) {
      throw new Error("Materi tidak ditemukan atau tidak memiliki akses");
    }

    const newTugas = {
      id: tugasDetail.length > 0 ? Math.max(...tugasDetail.map(t => t.id)) + 1 : 1,
      judul,
      deskripsi,
      materi_id,
      guru_id: guruId,
      deadline: new Date(deadline),
      created_at: new Date(),
      updated_at: new Date()
    };

    tugasDetail.push(newTugas);
    return { message: "Tugas berhasil dibuat", tugas: newTugas };
  })
  .put("/guru/tugas/:id", async ({ user, params, body }) => {
    const guruId = user.userId;
    const { id } = params;
    const { judul, deskripsi } = body;

    const tugasIndex = tugasDetail.findIndex(t => 
      t.id === parseInt(id) && t.guru_id === guruId
    );
    
    if (tugasIndex === -1) {
      throw new Error("Tugas tidak ditemukan");
    }

    tugasDetail[tugasIndex] = {
      ...tugasDetail[tugasIndex],
      judul,
      deskripsi,
      updated_at: new Date()
    };

    return { message: "Tugas berhasil diupdate", tugas: tugasDetail[tugasIndex] };
  })
  .delete("/guru/tugas/:id", async ({ user, params }) => {
    const guruId = user.userId;
    const { id } = params;

    const tugasIndex = tugasDetail.findIndex(t => 
      t.id === parseInt(id) && t.guru_id === guruId
    );
    
    if (tugasIndex === -1) {
      throw new Error("Tugas tidak ditemukan");
    }

    tugasDetail.splice(tugasIndex, 1);
    return { message: "Tugas berhasil dihapus" };
  })
  
  .get("/guru/submissions/pending", async ({ user }) => {
    const guruId = user.userId;
    
    const pendingSubmissions = submissions.filter(s => {
      const t = tugasDetail.find(t => t.id === s.tugas_id);
      return t && materi.find(m => m.id === t.materi_id && m.guru_id === guruId) && s.nilai === null;
    });

    return pendingSubmissions.map(s => ({
      ...s,
      tugas_judul: tugasDetail.find(t => t.id === s.tugas_id)?.judul || "Unknown",
      siswa_nama: users.find(u => u.id === s.siswa_id)?.nama || "Unknown"
    }));
  })
  .post("/guru/submissions/:id/grade", async ({ params, body }) => {
    const { id } = params;
    const { nilai, feedback } = body;

    const submissionIndex = submissions.findIndex(s => s.id === parseInt(id));
    if (submissionIndex === -1) {
      throw new Error("Submission tidak ditemukan");
    }

    submissions[submissionIndex] = {
      ...submissions[submissionIndex],
      nilai,
      feedback: feedback || "",
      graded_at: new Date()
    };

    
    const tugasId = submissions[submissionIndex].tugas_id;
    const tugasIndex = tugas.findIndex(t => t.id === tugasId);
    if (tugasIndex !== -1) {
      tugas[tugasIndex].status = "selesai";
      tugas[tugasIndex].nilai = nilai;
      tugas[tugasIndex].updated_at = new Date();
    }

    return { message: "Nilai berhasil diberikan", submission: submissions[submissionIndex] };
  })
  
  .get("/guru/siswa/progress", async ({ user }) => {
    const guruId = user.userId;
    
    const siswaList = users.filter(u => u.role === "siswa");
    
    return siswaList.map(siswa => {
      const siswaTugas = tugas.filter(t => t.siswa_id === siswa.id);
      const completed = siswaTugas.filter(t => t.status === "selesai").length;
      const total = siswaTugas.length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      const averageGrade = siswaTugas.filter(t => t.nilai).reduce((sum, t) => sum + (t.nilai || 0), 0) / 
        (siswaTugas.filter(t => t.nilai).length || 1);

      return {
        id: siswa.id,
        nama: siswa.nama,
        email: siswa.email,
        progress,
        rata_nilai: Math.round(averageGrade),
        total_tugas: total,
        selesai: completed
      };
    });
  })
  
  .get("/guru/diskusi", async ({ user }) => {
    const guruId = user.userId;
    
    const guruMateri = materi.filter(m => m.guru_id === guruId);
    const guruDiskusi = diskusiMateri.filter(d => 
      guruMateri.some(m => m.id === d.materi_id)
    );

    return guruDiskusi.map(d => ({
      ...d,
      user_name: users.find(u => u.id === d.user_id)?.nama || "Unknown",
      materi_judul: materi.find(m => m.id === d.materi_id)?.judul || "Unknown"
    }));
  })
  .post("/guru/diskusi/:id/reply", async ({ user, params, body }) => {
    const guruId = user.userId;
    const { id } = params;
    const { reply } = body;

    const parentDiskusi = diskusiMateri.find(d => d.id === parseInt(id));
    if (!parentDiskusi) {
      throw new Error("Diskusi tidak ditemukan");
    }

    
    const materiItem = materi.find(m => m.id === parentDiskusi.materi_id && m.guru_id === guruId);
    if (!materiItem) {
      throw new Error("Tidak memiliki akses ke materi ini");
    }

    const newReply = {
      id: diskusiMateri.length > 0 ? Math.max(...diskusiMateri.map(d => d.id)) + 1 : 1,
      materi_id: parentDiskusi.materi_id,
      user_id: guruId,
      user_role: "guru" as Role,
      isi: reply,
      parent_id: parseInt(id),
      created_at: new Date()
    };

    diskusiMateri.push(newReply);
    return { message: "Balasan berhasil dikirim", reply: newReply };
  });