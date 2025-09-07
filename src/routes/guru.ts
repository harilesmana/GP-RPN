import { Elysia, t } from "elysia";
import { verifySession } from "../utils/session";
import { users, materi, tugas, tugasDetail, submissions, diskusiMateri, kelas, Role } from "../db";

export const guruRoutes = new Elysia({ prefix: "/guru" })
  // .use(authMiddleware)
  .derive(({ cookie, set, request }) => {
    const token = cookie?.session?.value;
    if (!token) {
      return { user: null };
    }

    const secret = process.env.SESSION_SECRET || "dev_secret_change_me";
    const data = verifySession(token, secret);
    if (!data) {
      if (cookie?.session) cookie.session.set({ value: "", maxAge: 0 });
      return { user: null };
    }

    const user = {
      userId: data.userId,
      role: data.role,
    }

    return { user };
  })
  .derive(({ user }) => {
    if (!user || user.role !== "guru") {
      throw new Error("Unauthorized");
    }
    return { user };
  })
  .get("/dashboard/stats", async ({ user }) => {
    const guruId = user.userId;

    const totalMateri = materi.filter(m => m.guru_id === guruId).length;
    const totalSiswa = users.filter(u => u.role === "siswa").length;

    const tugasPending = submissions.filter(s => {
      const t = tugasDetail.find(t => t.id === s.tugas_id);
      return t && materi.find(m => m.id === t.materi_id && m.guru_id === guruId) && s.nilai === null;
    }).length;

    const gradedSubmissions = submissions.filter(s => {
      const t = tugasDetail.find(t => t.id === s.tugas_id);
      return t && materi.find(m => m.id === t.materi_id && m.guru_id === guruId) && s.nilai !== null;
    });

    const rataNilai = gradedSubmissions.length > 0
      ? gradedSubmissions.reduce((sum, s) => sum + (s.nilai || 0), 0) / gradedSubmissions.length
      : 0;

    return {
      success: true,
      data: {
        total_materi: totalMateri,
        total_siswa: totalSiswa,
        tugas_pending: tugasPending,
        rata_nilai: Math.round(rataNilai)
      }
    };
  })
  .get("/dashboard/activity", async ({ user }) => {
    const guruId = user.userId;

    const recentMateri = materi
      .filter(m => m.guru_id === guruId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 5)
      .map(m => ({
        type: "materi",
        title: `Materi "${m.judul}" dibuat`,
        description: m.deskripsi || "Tidak ada deskripsi",
        created_at: m.created_at
      }));

    const recentGrading = submissions
      .filter(s => {
        const t = tugasDetail.find(t => t.id === s.tugas_id);
        return t && materi.find(m => m.id === t.materi_id && m.guru_id === guruId) && s.graded_at;
      })
      .sort((a, b) => (b.graded_at?.getTime() || 0) - (a.graded_at?.getTime() || 0))
      .slice(0, 5)
      .map(s => {
        const siswa = users.find(u => u.id === s.siswa_id);
        return {
          type: "grading",
          title: `Penilaian tugas ${s.tugas_id}`,
          description: `Nilai: ${s.nilai}`,
          created_at: s.graded_at as Date
        };
      });

    const semuaAktivitas = [
      ...recentMateri,
      ...recentGrading
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
        judul: m.judul,
        deskripsi: m.deskripsi,
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

    const guruMateri = materi.filter(m => m.guru_id === guruId);
    const guruTugas = tugasDetail.filter(t =>
      guruMateri.some(m => m.id === t.materi_id)
    );

    const tugasWithCounts = guruTugas.map(t => {
      const materiList = materi.filter(s => s.id === t.materi_id)
      const submissionCount = submissions.filter(s => s.tugas_id === t.id).length;
      const gradedCount = submissions.filter(s => s.tugas_id === t.id && s.nilai !== undefined).length;

      return {
        ...t,
        materi_judul: materiList[0].judul,
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
      id: tugasDetail.length + 1,
      judul: judul.trim(),
      deskripsi: deskripsi?.trim() || "",
      materi_id: parseInt(materi_id),
      guru_id: guruId,
      deadline: new Date(deadline),
      created_at: new Date(),
      updated_at: new Date()
    };

    tugasDetail.push(newTugas);

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

    const tugasItem = tugasDetail.find(t => t.id === tugasId && t.guru_id === guruId);
    if (!tugasItem) {
      return { success: false, error: "Tugas tidak ditemukan" };
    }

    const tugasSubmissions = submissions
      .filter(s => s.tugas_id === tugasId)
      .map(s => {
        const siswa = users.find(u => u.id === s.siswa_id);
        return {
          id: s.id,
          siswa_id: s.siswa_id,
          siswa_nama: siswa?.nama || "Tidak diketahui",
          jawaban: s.jawaban,
          nilai: s.nilai,
          feedback: s.feedback,
          submitted_at: s.submitted_at,
          graded_at: s.graded_at
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

    const pendingSubmissions = submissions
      .filter(s => {
        const t = tugasDetail.find(t => t.id === s.tugas_id);
        return t && materi.find(m => m.id === t.materi_id && m.guru_id === guruId) && s.nilai === undefined;
      })
      .map(s => {
        const t = tugasDetail.find(t => t.id === s.tugas_id);
        const siswa = users.find(u => u.id === s.siswa_id);

        return {
          id: s.id,
          tugas_id: s.tugas_id,
          tugas_judul: t?.judul || "Tugas tidak ditemukan",
          siswa_id: s.siswa_id,
          siswa_nama: siswa?.nama || "Tidak diketahui",
          jawaban: s.jawaban,
          submitted_at: s.submitted_at
        };
      });

    return {
      success: true,
      data: pendingSubmissions
    };
  })
  .post("/submissions/:id/grade", async ({ params, body }) => {
    const submissionId = parseInt(params.id);

    if (isNaN(submissionId)) {
      return { success: false, error: "ID submission tidak valid" };
    }

    const submissionIndex = submissions.findIndex(s => s.id === submissionId);
    if (submissionIndex === -1) {
      return { success: false, error: "Submission tidak ditemukan" };
    }

    const { nilai, feedback } = body as any;
    if (nilai === undefined || nilai < 0 || nilai > 100) {
      return { success: false, error: "Nilai harus antara 0-100" };
    }

    submissions[submissionIndex].nilai = parseInt(nilai);
    submissions[submissionIndex].feedback = feedback?.trim() || "";
    submissions[submissionIndex].graded_at = new Date();

    return {
      success: true,
      message: "Nilai berhasil diberikan"
    };
  })
  .get("/siswa/progress", async ({ user }) => {
    const guruId = user.userId;

    const semuaSiswa = users.filter(u => u.role === "siswa" && u.status === "active");

    const siswaProgress = semuaSiswa.map(siswa => {
      const tugasGuru = tugasDetail.filter(t => {
        const m = materi.find(m => m.id === t.materi_id);
        return m && m.guru_id === guruId;
      });

      // Get submissions for this student on guru's tasks only
      const submissionsSiswa = submissions.filter(s =>
        s.siswa_id === siswa.id &&
        tugasGuru.some(t => t.id === s.tugas_id)
      );

      const totalTugas = tugasGuru.length;
      const tugasDikerjakan = submissionsSiswa.length;

      // Calculate average grade from graded submissions only
      const nilaiSiswa = submissionsSiswa
        .filter(s => s.nilai !== undefined && s.nilai !== null)
        .map(s => s.nilai as number);

      const rataNilai = nilaiSiswa.length > 0
        ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
        : 0;

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

    const tugasGuru = tugasDetail.filter(t => {
      const m = materi.find(m => m.id === t.materi_id);
      return m && m.guru_id === guruId;
    });

    const submissionsSiswa = submissions.filter(s =>
      s.siswa_id === siswaId &&
      tugasGuru.some(t => t.id === s.tugas_id)
    );

    const totalTugas = tugasGuru.length;
    const tugasDikerjakan = submissionsSiswa.length;
    const tugasDinilai = submissionsSiswa.filter(s => s.nilai !== undefined).length;

    const nilaiSiswa = submissionsSiswa
      .filter(s => s.nilai !== undefined)
      .map(s => s.nilai as number);

    const rataNilai = nilaiSiswa.length > 0
      ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
      : 0;

    const progress = totalTugas > 0
      ? Math.round((tugasDikerjakan / totalTugas) * 100)
      : 0;

    const detailTugas = tugasGuru.map(t => {
      const submission = submissionsSiswa.find(s => s.tugas_id === t.id);
      const m = materi.find(m => m.id === t.materi_id);

      return {
        id: t.id,
        judul: t.judul,
        deskripsi: t.deskripsi,
        materi: m?.judul || "Tidak diketahui",
        deadline: t.deadline,
        status: submission ? "dikerjakan" : "belum_dikerjakan",
        nilai: submission?.nilai || null,
        feedback: submission?.feedback || "",
        submitted_at: submission?.submitted_at || null,
        graded_at: submission?.graded_at || null
      };
    });

    const siswaData = {
      id: siswa.id,
      nama: siswa.nama,
      email: siswa.email,
      last_login: siswa.last_login,
      last_activity: siswa.last_activity
    };

    const statistik = {
      total_tugas: totalTugas,
      tugas_dikerjakan: tugasDikerjakan,
      tugas_dinilai: tugasDinilai,
      progress: progress,
      rata_rata_nilai: rataNilai
    };

    return {
      _view: 'dashboard/siswa-progress.ejs',
      user: users.find(u => u.id === guruId), // Current guru user
      siswa: siswaData,
      statistik: statistik,
      detailTugas: detailTugas,
      title: `Progress ${siswa.nama} - Dashboard Guru`
    };
  })
  .get("/diskusi", async ({ user }) => {
    const guruId = user.userId;

    const materiGuru = materi.filter(m => m.guru_id === guruId);
    const diskusiGuru = diskusiMateri
      .filter(d => materiGuru.some(m => m.id === d.materi_id))
      .map(d => {
        const userDiskusi = users.find(u => u.id === d.user_id);
        const m = materi.find(m => m.id === d.materi_id);

        return {
          id: d.id,
          materi_id: d.materi_id,
          materi_judul: m?.judul || "Materi tidak ditemukan",
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

    const m = materi.find(m => m.id === diskusiAsli.materi_id);
    if (!m || m.guru_id !== guruId) {
      return { success: false, error: "Tidak memiliki akses untuk membalas diskusi ini" };
    }

    const { reply } = body as any;
    if (!reply) {
      return { success: false, error: "Balasan tidak boleh kosong" };
    }

    const balasan = {
      id: diskusiMateri.length + 1,
      materi_id: diskusiAsli.materi_id,
      user_id: guruId,
      user_role: "guru" as Role,
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