import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { users, kelas, materi, diskusi, tugas, diskusiMateri } from "../db";

export const guruRoutes = new Elysia({ prefix: "/guru" })
  .derive(authMiddleware as any)
  
  .onBeforeHandle(({ user, set }) => {
    if (!user || !user.userId) {
      set.status = 401;
      return { success: false, error: "Silakan login terlebih dahulu" };
    }
    
    if (user.role !== "guru") {
      set.status = 403;
      return { success: false, error: "Akses ditolak. Hanya guru yang dapat mengakses endpoint ini." };
    }
  })

  .get("/dashboard/stats", async ({ user }) => {
    const guruId = user.userId;
    
    const totalMateri = materi.filter(m => m.guru_id === guruId).length;
    const totalTugas = tugas.filter(t => t.guru_id === guruId && !t.siswa_id).length;
    
    const tugasPerluDinilai = tugas.filter(t => 
      t.guru_id === guruId && 
      t.siswa_id && 
      t.nilai === undefined
    ).length;
    
    const semuaNilai = tugas
      .filter(t => t.guru_id === guruId && t.siswa_id && t.nilai !== undefined)
      .map(t => t.nilai as number);
    
    const rataNilai = semuaNilai.length > 0 
      ? Math.round(semuaNilai.reduce((a, b) => a + b, 0) / semuaNilai.length) 
      : 0;
    
    return {
      success: true,
      data: {
        total_materi: totalMateri,
        total_tugas: totalTugas,
        tugas_pending: tugasPerluDinilai,
        rata_nilai: rataNilai,
        total_siswa: users.filter(u => u.role === "siswa" && u.status === "active").length
      }
    };
  })

  .get("/dashboard/recent-activity", async ({ user }) => {
    const guruId = user.userId;
    
    const aktivitasMateri = materi
      .filter(m => m.guru_id === guruId)
      .slice(-5)
      .map(m => ({
        type: "materi",
        title: `Materi "${m.judul}" dibuat`,
        description: m.deskripsi || "Tidak ada deskripsi",
        created_at: m.created_at
      }));
    
    const aktivitasTugas = tugas
      .filter(t => t.guru_id === guruId && !t.siswa_id)
      .slice(-5)
      .map(t => ({
        type: "tugas",
        title: `Tugas "${t.judul}" dibuat`,
        description: t.deskripsi || "Tidak ada deskripsi",
        created_at: t.created_at
      }));
    
    const aktivitasNilai = tugas
      .filter(t => t.guru_id === guruId && t.siswa_id && t.graded_at)
      .slice(-5)
      .map(t => {
        const siswa = users.find(u => u.id === t.siswa_id);
        return {
          type: "nilai",
          title: `Nilai diberikan untuk ${siswa?.nama || "siswa"}`,
          description: `Nilai: ${t.nilai}`,
          created_at: t.graded_at as Date
        };
      });
    
    const semuaAktivitas = [
      ...aktivitasMateri,
      ...aktivitasTugas,
      ...aktivitasNilai
    ].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 10);
    
    return {
      success: true,
      data: semuaAktivitas
    };
  })

  .get("/materi", async ({ user }) => {
    const guruId = user.userId;
    const materiGuru = materi.filter(m => m.guru_id === guruId);
    
    return {
      success: true,
      data: materiGuru.map(m => ({
        id: m.id,
        judul: m.judul || "Judul tidak tersedia",
        deskripsi: m.deskripsi || "Tidak ada deskripsi",
        created_at: m.created_at,
        updated_at: m.updated_at
      }))
    };
  })

  .post("/materi", async ({ user, body }) => {
    const guruId = user.userId;
    const { judul, deskripsi, konten, kelas_id } = body as any;
    
    if (!judul || !konten) {
      return { success: false, error: "Judul dan konten materi harus diisi" };
    }
    
    const newMateri = {
      id: materi.length + 1,
      judul: judul.trim(),
      deskripsi: deskripsi?.trim() || "",
      konten: konten.trim(),
      guru_id: guruId,
      kelas_id: kelas_id || 1,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    materi.push(newMateri);
    
    return {
      success: true,
      message: "Materi berhasil dibuat",
      data: {
        id: newMateri.id,
        judul: newMateri.judul
      }
    };
  })

  .put("/materi/:id", async ({ user, params, body }) => {
    const guruId = user.userId;
    const materiId = parseInt(params.id);
    
    if (isNaN(materiId)) {
      return { success: false, error: "ID materi tidak valid" };
    }
    
    const materiIndex = materi.findIndex(m => m.id === materiId && m.guru_id === guruId);
    if (materiIndex === -1) {
      return { success: false, error: "Materi tidak ditemukan" };
    }
    
    const { judul, konten } = body as any;
    if (!judul || !konten) {
      return { success: false, error: "Judul dan konten materi harus diisi" };
    }
    
    materi[materiIndex].judul = judul.trim();
    materi[materiIndex].konten = konten.trim();
    materi[materiIndex].updated_at = new Date();
    
    if ((body as any).deskripsi) {
      materi[materiIndex].deskripsi = (body as any).deskripsi.trim();
    }
    
    return {
      success: true,
      message: "Materi berhasil diupdate"
    };
  })

  .delete("/materi/:id", async ({ user, params }) => {
    const guruId = user.userId;
    const materiId = parseInt(params.id);
    
    if (isNaN(materiId)) {
      return { success: false, error: "ID materi tidak valid" };
    }
    
    const materiIndex = materi.findIndex(m => m.id === materiId && m.guru_id === guruId);
    if (materiIndex === -1) {
      return { success: false, error: "Materi tidak ditemukan" };
    }
    
    materi.splice(materiIndex, 1);
    
    return {
      success: true,
      message: "Materi berhasil dihapus"
    };
  })

  .get("/tugas", async ({ user }) => {
    const guruId = user.userId;
    
    
    const tugasGuru = tugas.filter(t => t.guru_id === guruId && !t.siswa_id);
    
    const tugasWithCounts = tugasGuru.map(t => {
      const submissionCount = tugas.filter(s => 
        s.materi_id === t.materi_id && 
        s.judul === t.judul && 
        s.siswa_id
      ).length;
      
      const gradedCount = tugas.filter(s => 
        s.materi_id === t.materi_id && 
        s.judul === t.judul && 
        s.siswa_id && 
        s.nilai !== undefined
      ).length;
      
      return {
        ...t,
        submissions_count: submissionCount,
        graded_count: gradedCount
      };
    });
    
    return {
      success: true,
      data: tugasWithCounts
    };
  })

  .post("/tugas", async ({ user, body }) => {
    const guruId = user.userId;
    const { judul, deskripsi, materi_id, deadline } = body as any;
    
    if (!judul || !materi_id || !deadline) {
      return { success: false, error: "Judul, materi, dan deadline harus diisi" };
    }
    
    const materiItem = materi.find(m => m.id === parseInt(materi_id) && m.guru_id === guruId);
    if (!materiItem) {
      return { success: false, error: "Materi tidak ditemukan" };
    }
    
    const newTugas = {
      id: tugas.length + 1,
      judul: judul.trim(),
      deskripsi: deskripsi?.trim() || "",
      materi_id: parseInt(materi_id),
      guru_id: guruId,
      deadline: new Date(deadline),
      created_at: new Date(),
      updated_at: new Date()
    };
    
    tugas.push(newTugas);
    
    return {
      success: true,
      message: "Tugas berhasil dibuat",
      data: {
        id: newTugas.id,
        judul: newTugas.judul
      }
    };
  })

  .get("/tugas/:id/submissions", async ({ user, params }) => {
    const guruId = user.userId;
    const tugasId = parseInt(params.id);
    
    if (isNaN(tugasId)) {
      return { success: false, error: "ID tugas tidak valid" };
    }
    
    
    const tugasItem = tugas.find(t => t.id === tugasId && t.guru_id === guruId && !t.siswa_id);
    if (!tugasItem) {
      return { success: false, error: "Tugas tidak ditemukan" };
    }
    
    
    const tugasSubmissions = tugas
      .filter(t => t.materi_id === tugasItem.materi_id && t.judul === tugasItem.judul && t.siswa_id)
      .map(t => {
        const siswa = users.find(u => u.id === t.siswa_id);
        return {
          id: t.id,
          siswa_id: t.siswa_id,
          siswa_nama: siswa?.nama || "Tidak diketahui",
          jawaban: t.jawaban,
          nilai: t.nilai,
          feedback: t.feedback,
          submitted_at: t.submitted_at,
          graded_at: t.graded_at
        };
      });
    
    return {
      success: true,
      data: {
        tugas: {
          id: tugasItem.id,
          judul: tugasItem.judul,
          deskripsi: tugasItem.deskripsi,
          deadline: tugasItem.deadline
        },
        submissions: tugasSubmissions
      }
    };
  })

  .get("/submissions/pending", async ({ user }) => {
    const guruId = user.userId;
    
    const pendingSubmissions = tugas
      .filter(t => t.guru_id === guruId && t.siswa_id && t.nilai === undefined)
      .map(t => {
        const siswa = users.find(u => u.id === t.siswa_id);
        
        return {
          id: t.id,
          tugas_id: t.id,
          tugas_judul: t.judul || "Tugas tidak ditemukan",
          siswa_id: t.siswa_id,
          siswa_nama: siswa?.nama || "Tidak diketahui",
          jawaban: t.jawaban,
          submitted_at: t.submitted_at
        };
      });
    
    return {
      success: true,
      data: pendingSubmissions
    };
  })

  .post("/submissions/:id/grade", async ({ user, params, body }) => {
    const guruId = user.userId;
    const submissionId = parseInt(params.id);
    
    if (isNaN(submissionId)) {
      return { success: false, error: "ID submission tidak valid" };
    }
    
    const submissionIndex = tugas.findIndex(t => t.id === submissionId);
    if (submissionIndex === -1) {
      return { success: false, error: "Submission tidak ditemukan" };
    }
    
    const submission = tugas[submissionIndex];
    
    
    if (submission.guru_id !== guruId) {
      return { success: false, error: "Anda tidak memiliki akses untuk menilai submission ini" };
    }
    
    const { nilai, feedback } = body as any;
    if (nilai === undefined || nilai < 0 || nilai > 100) {
      return { success: false, error: "Nilai harus antara 0-100" };
    }
    
    tugas[submissionIndex].nilai = parseInt(nilai);
    tugas[submissionIndex].feedback = feedback?.trim() || "";
    tugas[submissionIndex].graded_at = new Date();
    
    return {
      success: true,
      message: "Nilai berhasil diberikan"
    };
  })

  .get("/siswa/progress", async ({ user }) => {
    const guruId = user.userId;
    
    const semuaSiswa = users.filter(u => u.role === "siswa" && u.status === "active");
    
    const siswaProgress = semuaSiswa.map(siswa => {
      
      const tugasDikerjakan = tugas.filter(t => 
        t.siswa_id === siswa.id && 
        t.guru_id === guruId
      ).length;
      
      
      const nilaiSiswa = tugas
        .filter(t => t.siswa_id === siswa.id && t.nilai !== undefined)
        .map(t => t.nilai as number);
      
      const rataNilai = nilaiSiswa.length > 0 
        ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
        : 0;
      
      
      const totalTugas = tugas.filter(t => 
        t.guru_id === guruId && 
        !t.siswa_id
      ).length;
      
      const progress = totalTugas > 0 
        ? Math.round((tugasDikerjakan / totalTugas) * 100)
        : 0;
      
      return {
        id: siswa.id,
        nama: siswa.nama,
        email: siswa.email,
        progress: Math.min(progress, 100),
        rata_nilai: rataNilai,
        tugas_dikerjakan: tugasDikerjakan,
        total_tugas: totalTugas
      };
    });
    
    return {
      success: true,
      data: siswaProgress
    };
  })

  .get("/siswa/:id/progress", async ({ user, params }) => {
    const guruId = user.userId;
    const siswaId = parseInt(params.id);
    
    if (isNaN(siswaId)) {
      return { success: false, error: "ID siswa tidak valid" };
    }
    
    const siswa = users.find(u => u.id === siswaId && u.role === "siswa" && u.status === "active");
    if (!siswa) {
      return { success: false, error: "Siswa tidak ditemukan" };
    }
    
    
    const tugasGuru = tugas.filter(t => t.guru_id === guruId && !t.siswa_id);
    
    
    const submissionsSiswa = tugas.filter(t => 
      t.siswa_id === siswaId && 
      tugasGuru.some(tg => tg.materi_id === t.materi_id && tg.judul === t.judul)
    );
    
    const totalTugas = tugasGuru.length;
    const tugasDikerjakan = submissionsSiswa.length;
    const tugasDinilai = submissionsSiswa.filter(t => t.nilai !== undefined).length;
    
    const nilaiSiswa = submissionsSiswa
      .filter(t => t.nilai !== undefined)
      .map(t => t.nilai as number);
    
    const rataNilai = nilaiSiswa.length > 0 
      ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
      : 0;
    
    const progress = totalTugas > 0 
      ? Math.round((tugasDikerjakan / totalTugas) * 100)
      : 0;
    
    const detailTugas = tugasGuru.map(tugasItem => {
      const submission = submissionsSiswa.find(s => 
        s.materi_id === tugasItem.materi_id && s.judul === tugasItem.judul
      );
      const materiItem = materi.find(m => m.id === tugasItem.materi_id);
      
      return {
        id: tugasItem.id,
        judul: tugasItem.judul,
        deskripsi: tugasItem.deskripsi,
        materi: materiItem?.judul || "Tidak diketahui",
        deadline: tugasItem.deadline,
        status: submission ? "dikerjakan" : "belum_dikerjakan",
        nilai: submission?.nilai || null,
        feedback: submission?.feedback || "",
        submitted_at: submission?.submitted_at || null,
        graded_at: submission?.graded_at || null,
        jawaban: submission?.jawaban || ""
      };
    });
    
    return {
      success: true,
      data: {
        siswa: {
          id: siswa.id,
          nama: siswa.nama,
          email: siswa.email,
          last_login: siswa.last_login,
          last_activity: siswa.last_activity
        },
        statistik: {
          total_tugas: totalTugas,
          tugas_dikerjakan: tugasDikerjakan,
          tugas_dinilai: tugasDinilai,
          progress: progress,
          rata_rata_nilai: rataNilai
        },
        detail_tugas: detailTugas
      }
    };
  })
  
  .get("/diskusi", async ({ user }) => {
    const guruId = user.userId;
    
    const materiGuru = materi.filter(m => m.guru_id === guruId);
    const diskusiGuru = diskusiMateri
      .filter(d => materiGuru.some(m => m.id === d.materi_id))
      .map(d => {
        const userDiskusi = users.find(u => u.id === d.user_id);
        const materiItem = materi.find(m => m.id === d.materi_id);
        
        return {
          id: d.id,
          materi_id: d.materi_id,
          materi_judul: materiItem?.judul || "Materi tidak ditemukan",
          user_id: d.user_id,
          user_name: userDiskusi?.nama || "Tidak diketahui",
          user_role: d.user_role,
          isi: d.isi,
          parent_id: d.parent_id,
          created_at: d.created_at
        };
      });
    
    return {
      success: true,
      data: diskusiGuru
    };
  })

  .post("/diskusi/:id/reply", async ({ user, params, body }) => {
    const guruId = user.userId;
    const diskusiId = parseInt(params.id);
    
    if (isNaN(diskusiId)) {
      return { success: false, error: "ID diskusi tidak valid" };
    }
    
    const diskusiAsli = diskusiMateri.find(d => d.id === diskusiId);
    if (!diskusiAsli) {
      return { success: false, error: "Diskusi tidak ditemukan" };
    }
    
    const materiItem = materi.find(m => m.id === diskusiAsli.materi_id);
    if (!materiItem || materiItem.guru_id !== guruId) {
      return { success: false, error: "Anda tidak memiliki akses untuk membalas diskusi ini" };
    }
    
    const { reply } = body as any;
    if (!reply) {
      return { success: false, error: "Balasan tidak boleh kosong" };
    }
    
    const balasan = {
      id: diskusiMateri.length + 1,
      materi_id: diskusiAsli.materi_id,
      user_id: guruId,
      user_role: "guru",
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