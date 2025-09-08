import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import {
  users, kelas, materi, diskusi, tugas,
  submissions, diskusiMateri,
  User, Kelas, Materi, Tugas, Submission, DiskusiMateri
} from "../db";
import { z } from "zod";

export const guruRoutes = new Elysia({ prefix: "/guru" })
  .derive(authMiddleware as any)

  .onBeforeHandle(({ user, set }) => {
    if (!user || !user.userId) {
      set.status = 401;
      return "Silakan login terlebih dahulu";
    }

    if (user.role !== "guru") {
      set.status = 403;
      return "Akses ditolak. Hanya guru yang dapat mengakses endpoint ini.";
    }
  })

  .get("/dashboard/stats", async ({ user }) => {
    const guruId = user.userId;

    const totalMateri = materi.filter(m => m.guru_id === guruId).length;
    const totalTugas = tugas.filter(t => t.guru_id === guruId).length;

    // PERBAIKAN: Hitung tugas yang perlu dinilai dengan benar
    const tugasPerluDinilai = submissions
      .filter(s => {
        const tugasItem = tugas.find(t => t.id === s.tugas_id);
        return tugasItem &&
          tugasItem.guru_id === guruId &&
          (s.nilai === undefined || s.nilai === null);
      }).length;

    // PERBAIKAN: Hitung rata-rata nilai dengan benar
    const semuaNilai = submissions
      .filter(s => {
        const tugasItem = tugas.find(t => t.id === s.tugas_id);
        return tugasItem &&
          tugasItem.guru_id === guruId &&
          s.nilai !== undefined &&
          s.nilai !== null;
      })
      .map(s => s.nilai as number);

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
      .filter(t => t.guru_id === guruId)
      .slice(-5)
      .map(t => ({
        type: "tugas",
        title: `Tugas "${t.judul}" dibuat`,
        description: t.deskripsi || "Tidak ada deskripsi",
        created_at: t.created_at
      }));

    const aktivitasNilai = submissions
      .filter(s => {
        const tugasItem = tugas.find(t => t.id === s.tugas_id);
        return tugasItem && tugasItem.guru_id === guruId && s.graded_at;
      })
      .slice(-5)
      .map(s => {
        const siswa = users.find(u => u.id === s.siswa_id);
        return {
          type: "nilai",
          title: `Nilai diberikan untuk ${siswa?.nama || "siswa"}`,
          description: `Nilai: ${s.nilai}`,
          created_at: s.graded_at as Date
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
    try {
      const guruId = user.userId;

      console.log(`Loading materi untuk guru ${guruId}`);
      console.log(`Total materi di database: ${materi.length}`);

      const materiGuru = materi
        .filter(m => m.guru_id === guruId)
        .map(m => ({
          id: m.id,
          judul: m.judul || "Judul tidak tersedia",
          deskripsi: m.deskripsi || "Tidak ada deskripsi",
          konten: m.konten || "Tidak ada konten yang tersedia",
          created_at: m.created_at || new Date(),
          updated_at: m.updated_at || m.created_at || new Date()
        }));

      console.log(`Materi ditemukan untuk guru ${guruId}: ${materiGuru.length} items`);

      return {
        success: true,
        data: materiGuru
      };

    } catch (error) {
      console.error("Error loading materi guru:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat materi" };
    }
  })

  .post("/materi", async ({ user, body, set }) => {
    const guruId = user.userId;
    const { judul, deskripsi, konten, kelas_id } = body as any;

    if (!judul || !konten) {
      set.status = 400;
      return { error: "Judul dan konten materi harus diisi" };
    }

    const newMateri: Materi = {
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

  .get("/materi/:id/detail", async ({ user, params }) => {
    try {
      const guruId = user.userId;
      const materiId = parseInt(params.id);

      if (isNaN(materiId)) {
        return { success: false, error: "ID materi tidak valid" };
      }

      const materiItem = materi.find(m => m.id === materiId && m.guru_id === guruId);
      if (!materiItem) {
        return { success: false, error: "Materi tidak ditemukan atau Anda tidak memiliki akses" };
      }

      return {
        success: true,
        data: {
          id: materiItem.id,
          judul: materiItem.judul || "Judul tidak tersedia",
          deskripsi: materiItem.deskripsi || "Tidak ada deskripsi",
          konten: materiItem.konten || "Tidak ada konten yang tersedia",
          created_at: materiItem.created_at,
          updated_at: materiItem.updated_at
        }
      };

    } catch (error) {
      console.error("Error loading materi detail:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat detail materi" };
    }
  })

  .put("/materi/:id", async ({ user, params, body, set }) => {
    const guruId = user.userId;
    const materiId = parseInt(params.id);

    if (isNaN(materiId)) {
      set.status = 400;
      return { error: "ID materi tidak valid" };
    }

    const materiIndex = materi.findIndex(m => m.id === materiId && m.guru_id === guruId);
    if (materiIndex === -1) {
      set.status = 404;
      return { error: "Materi tidak ditemukan" };
    }

    const { judul, konten } = body as any;
    if (!judul || !konten) {
      set.status = 400;
      return { error: "Judul dan konten materi harus diisi" };
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

  .delete("/materi/:id", async ({ user, params, set }) => {
    const guruId = user.userId;
    const materiId = parseInt(params.id);

    if (isNaN(materiId)) {
      set.status = 400;
      return { error: "ID materi tidak valid" };
    }

    const materiIndex = materi.findIndex(m => m.id === materiId && m.guru_id === guruId);
    if (materiIndex === -1) {
      set.status = 404;
      return { error: "Materi tidak ditemukan" };
    }

    materi.splice(materiIndex, 1);

    return {
      success: true,
      message: "Materi berhasil dihapus"
    };
  })

  // PERBAIKAN: Gunakan array tugas yang sudah disinkronkan
  .get("/tugas", async ({ user }) => {
    const guruId = user.userId;
    const tugasGuru = tugas.filter(t => t.guru_id === guruId);

    const tugasWithCounts = tugasGuru.map(t => {
      const submissionCount = submissions.filter(s => s.tugas_id === t.id).length;
      const gradedCount = submissions.filter(s => s.tugas_id === t.id && s.nilai !== undefined).length;

      // PERBAIKAN: Ambil nama materi dengan benar
      const materiItem = materi.find(m => m.id === t.materi_id);

      return {
        ...t,
        materi_judul: materiItem?.judul || "Materi tidak ditemukan",
        submissions_count: submissionCount,
        graded_count: gradedCount
      };
    });

    return {
      success: true,
      data: tugasWithCounts
    };
  })

  .post("/tugas", async ({ user, body, set }) => {
    const guruId = user.userId;
    const { judul, deskripsi, materi_id, deadline } = body as any;

    if (!judul || !materi_id || !deadline) {
      set.status = 400;
      return { error: "Judul, materi, dan deadline harus diisi" };
    }

    const materiItem = materi.find(m => m.id === parseInt(materi_id) && m.guru_id === guruId);
    if (!materiItem) {
      set.status = 404;
      return { error: "Materi tidak ditemukan" };
    }

    // PERBAIKAN: Buat tugas dengan struktur yang konsisten
    const newTugas: Tugas = {
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

  .get("/tugas/:id/submissions", async ({ user, params, set }) => {
    const guruId = user.userId;
    const tugasId = parseInt(params.id);

    if (isNaN(tugasId)) {
      set.status = 400;
      return { error: "ID tugas tidak valid" };
    }

    // PERBAIKAN: Cari tugas di array yang benar
    const tugasItem = tugas.find(t => t.id === tugasId && t.guru_id === guruId);
    if (!tugasItem) {
      set.status = 404;
      return { error: "Tugas tidak ditemukan" };
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
    try {
      const guruId = user.userId;

      const pendingSubmissions = submissions
        .filter(s => {
          const tugasItem = tugas.find(t => t.id === s.tugas_id);
          return tugasItem &&
            tugasItem.guru_id === guruId &&
            (s.nilai === undefined || s.nilai === null);
        })
        .map(s => {
          const tugasItem = tugas.find(t => t.id === s.tugas_id);
          const siswa = users.find(u => u.id === s.siswa_id);

          return {
            id: s.id,
            tugas_id: s.tugas_id,
            tugas_judul: tugasItem?.judul || "Tugas tidak ditemukan",
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

    } catch (error) {
      console.error("Error loading pending submissions:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat submission pending" };
    }
  })

  .post("/submissions/:id/grade", async ({ user, params, body, set }) => {
    try {
      const guruId = user.userId;
      const submissionId = parseInt(params.id);

      if (isNaN(submissionId)) {
        set.status = 400;
        return { success: false, error: "ID submission tidak valid" };
      }

      const submissionIndex = submissions.findIndex(s => s.id === submissionId);
      if (submissionIndex === -1) {
        set.status = 404;
        return { success: false, error: "Submission tidak ditemukan" };
      }

      const submission = submissions[submissionIndex];
      const tugasItem = tugas.find(t => t.id === submission.tugas_id);

      if (!tugasItem) {
        set.status = 404;
        return { success: false, error: "Tugas tidak ditemukan" };
      }

      if (tugasItem.guru_id !== guruId) {
        set.status = 403;
        return { success: false, error: "Anda tidak memiliki akses untuk menilai submission ini" };
      }

      const { nilai, feedback } = body as any;

      if (nilai === undefined || nilai === null) {
        set.status = 400;
        return { success: false, error: "Nilai harus diisi" };
      }

      const numericNilai = parseInt(nilai);
      if (isNaN(numericNilai) || numericNilai < 0 || numericNilai > 100) {
        set.status = 400;
        return { success: false, error: "Nilai harus berupa angka antara 0-100" };
      }

      submissions[submissionIndex].nilai = numericNilai;
      submissions[submissionIndex].feedback = feedback?.trim() || "";
      submissions[submissionIndex].graded_at = new Date();

      console.log(`Nilai diberikan: Submission ${submissionId}, Nilai: ${numericNilai}`);

      return {
        success: true,
        message: "Nilai berhasil diberikan",
        data: {
          submission_id: submissionId,
          nilai: numericNilai,
          feedback: feedback?.trim() || ""
        }
      };

    } catch (error) {
      console.error("Error grading submission:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server saat memberikan nilai" };
    }
  })

  // PERBAIKAN: Progress siswa dengan perhitungan yang benar
  .get("/siswa/progress", async ({ user }) => {
    const guruId = user.userId;

    const semuaSiswa = users.filter(u => u.role === "siswa" && u.status === "active");

    const siswaProgress = semuaSiswa.map(siswa => {
      // PERBAIKAN: Ambil semua tugas milik guru yang login
      const tugasGuru = tugas.filter(t => t.guru_id === guruId);

      // PERBAIKAN: Hitung submission siswa untuk tugas guru yang login
      const submissionsSiswa = submissions.filter(s =>
        s.siswa_id === siswa.id &&
        tugasGuru.some(t => t.id === s.tugas_id)
      );

      const tugasDikerjakan = submissionsSiswa.length;

      const nilaiSiswa = submissionsSiswa
        .filter(s => s.nilai !== undefined && s.nilai !== null)
        .map(s => s.nilai as number);

      const rataNilai = nilaiSiswa.length > 0
        ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
        : 0;

      const totalTugas = tugasGuru.length;

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

  .get("/siswa/:id/progress", async ({ user, params, set }) => {
    try {
      const guruId = user.userId;
      const siswaId = parseInt(params.id);

      if (isNaN(siswaId)) {
        return { success: false, error: "ID siswa tidak valid" };
      }

      const siswa = users.find(u => u.id === siswaId && u.role === "siswa" && u.status === "active");
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      // PERBAIKAN: Gunakan array tugas yang sudah disinkronkan
      const tugasGuru = tugas.filter(t => t.guru_id === guruId);

      const submissionsSiswa = submissions.filter(s =>
        s.siswa_id === siswaId &&
        tugasGuru.some(t => t.id === s.tugas_id)
      );

      const totalTugas = tugasGuru.length;
      const tugasDikerjakan = submissionsSiswa.length;
      const tugasDinilai = submissionsSiswa.filter(s => s.nilai !== undefined && s.nilai !== null).length;

      const nilaiSiswa = submissionsSiswa
        .filter(s => s.nilai !== undefined && s.nilai !== null)
        .map(s => s.nilai as number);

      const rataNilai = nilaiSiswa.length > 0
        ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
        : 0;

      const progress = totalTugas > 0
        ? Math.round((tugasDikerjakan / totalTugas) * 100)
        : 0;

      const detailTugas = tugasGuru.map(tugasItem => {
        const submission = submissionsSiswa.find(s => s.tugas_id === tugasItem.id);
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
          graded_at: submission?.graded_at || null
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
    } catch (error) {
      console.error("Error loading siswa progress:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat progress siswa" };
    }
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

  .post("/diskusi/:id/reply", async ({ user, params, body, set }) => {
    const guruId = user.userId;
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

    const materiItem = materi.find(m => m.id === diskusiAsli.materi_id);
    if (!materiItem || materiItem.guru_id !== guruId) {
      set.status = 403;
      return { error: "Anda tidak memiliki akses untuk membalas diskusi ini" };
    }

    const { reply } = body as any;
    if (!reply) {
      set.status = 400;
      return { error: "Balasan tidak boleh kosong" };
    }

    const balasan: DiskusiMateri = {
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