import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import {
  users, kelas, materi, diskusi, tugas, Role,
  submissions, diskusiMateri, materiRead, MateriRead
} from "../db";

export const siswaRoutes = new Elysia({ prefix: "/siswa" })
  .derive(authMiddleware as any)

  .onBeforeHandle(({ user, set }) => {
    if (!user || !user.userId) {
      set.status = 401;
      return { success: false, error: "Silakan login terlebih dahulu" };
    }

    if (user.role !== "siswa") {
      set.status = 403;
      return { success: false, error: "Akses ditolak. Hanya siswa yang dapat mengakses endpoint ini." };
    }
  })

  // Helper function untuk menentukan status tugas
  .derive(({ user }) => ({
    getTugasStatus: (tugasId: number, siswaId: number) => {
      const submission = submissions.find(s =>
        s.tugas_id === tugasId && s.siswa_id === siswaId
      );

      if (!submission) return "belum_dikerjakan";
      if (submission.nilai !== undefined && submission.nilai !== null) return "selesai";
      return "dikerjakan";
    },

    getSiswaKelasData: (siswaId: number) => {
      const siswa = users.find(u => u.id === siswaId);
      if (!siswa) return null;

      const kelasSiswa = siswa.kelas_id || 1;
      const materiSiswa = materi.filter(m => m.kelas_id === kelasSiswa);
      const tugasSiswa = tugas.filter(t =>
        materiSiswa.some(m => m.id === t.materi_id)
      );

      return { siswa, kelasSiswa, materiSiswa, tugasSiswa };
    }
  }))

  // Dashboard statistics
  .get("/dashboard-stats", async ({ user, getTugasStatus, getSiswaKelasData }) => {
    try {
      const siswaId = user.userId;
      const kelasData = getSiswaKelasData(siswaId);

      if (!kelasData) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const { materiSiswa, tugasSiswa } = kelasData;

      // Hitung status semua tugas
      const tugasWithStatus = tugasSiswa.map(t => ({
        ...t,
        status: getTugasStatus(t.id, siswaId)
      }));

      const tugasSelesai = tugasWithStatus.filter(t => t.status === "selesai").length;
      const tugasPending = tugasWithStatus.filter(t => t.status === "dikerjakan").length;

      const nilaiSiswa = submissions
        .filter(s =>
          s.siswa_id === siswaId &&
          s.nilai !== undefined &&
          s.nilai !== null &&
          tugasSiswa.some(t => t.id === s.tugas_id)
        )
        .map(s => s.nilai as number);

      const rataNilai = nilaiSiswa.length > 0
        ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
        : 0;

      const tugasDikerjakan = tugasWithStatus.filter(t =>
        t.status === "dikerjakan" || t.status === "selesai"
      ).length;

      const progress = tugasSiswa.length > 0
        ? Math.round((tugasDikerjakan / tugasSiswa.length) * 100)
        : 0;

      return {
        success: true,
        data: {
          total_materi: materiSiswa.length,
          total_tugas: tugasSiswa.length,
          tugas_selesai: tugasSelesai,
          tugas_pending: tugasPending,
          rata_nilai: rataNilai,
          overall_progress: progress
        }
      };

    } catch (error) {
      console.error("Error loading dashboard stats:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat statistik dashboard" };
    }
  })

  // Get materi for student's class
  .get("/materi", async ({ user, getSiswaKelasData }) => {
    try {
      const siswaId = user.userId;
      const kelasData = getSiswaKelasData(siswaId);

      if (!kelasData) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const { materiSiswa } = kelasData;

      const materiWithStatus = materiSiswa.map(m => {
        const guru = users.find(u => u.id === m.guru_id);
        const isRead = materiRead.some(mr => mr.siswa_id === siswaId && mr.materi_id === m.id);

        return {
          id: m.id,
          judul: m.judul,
          deskripsi: m.deskripsi,
          konten: m.konten.length > 200 ? m.konten.substring(0, 200) + "..." : m.konten,
          guru_nama: guru?.nama || "Tidak diketahui",
          created_at: m.created_at,
          updated_at: m.updated_at,
          is_read: isRead
        };
      });

      return {
        success: true,
        data: materiWithStatus
      };

    } catch (error) {
      console.error("Error loading materi:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat materi" };
    }
  })

  // Get full materi detail
  .get("/materi/:id", async ({ user, params, getSiswaKelasData }) => {
    try {
      const siswaId = user.userId;
      const materiId = parseInt(params.id);

      if (isNaN(materiId)) {
        return { success: false, error: "ID materi tidak valid" };
      }

      const kelasData = getSiswaKelasData(siswaId);
      if (!kelasData) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const materiItem = materi.find(m => m.id === materiId);
      if (!materiItem) {
        return { success: false, error: "Materi tidak ditemukan" };
      }

      // Verify access
      if (materiItem.kelas_id !== kelasData.kelasSiswa) {
        return { success: false, error: "Anda tidak memiliki akses ke materi ini" };
      }

      const guru = users.find(u => u.id === materiItem.guru_id);

      return {
        success: true,
        data: {
          id: materiItem.id,
          judul: materiItem.judul,
          deskripsi: materiItem.deskripsi,
          konten: materiItem.konten,
          guru_nama: guru?.nama || "Tidak diketahui",
          created_at: materiItem.created_at,
          updated_at: materiItem.updated_at
        }
      };

    } catch (error) {
      console.error("Error loading materi detail:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat detail materi" };
    }
  })

  // Mark materi as read
  .post("/materi/:id/read", async ({ user, params, body, getSiswaKelasData }) => {
    try {
      const siswaId = user.userId;
      const materiId = parseInt(params.id);

      if (isNaN(materiId)) {
        return { success: false, error: "ID materi tidak valid" };
      }

      const kelasData = getSiswaKelasData(siswaId);
      if (!kelasData) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const materiItem = materi.find(m => m.id === materiId);
      if (!materiItem) {
        return { success: false, error: "Materi tidak ditemukan" };
      }

      // Verify access
      if (materiItem.kelas_id !== kelasData.kelasSiswa) {
        return { success: false, error: "Anda tidak memiliki akses ke materi ini" };
      }

      // Check if already marked as read
      const existingReadIndex = materiRead.findIndex(mr =>
        mr.siswa_id === siswaId && mr.materi_id === materiId
      );

      const { duration_seconds = 60, scroll_percentage = 100 } = (body as any) || {};

      if (existingReadIndex !== -1) {
        // Update existing record
        materiRead[existingReadIndex].duration_seconds = duration_seconds;
        materiRead[existingReadIndex].scroll_percentage = scroll_percentage;
        materiRead[existingReadIndex].read_at = new Date();
      } else {
        // Create new read record
        const newRead: MateriRead = {
          id: Math.max(...materiRead.map(mr => mr.id), 0) + 1,
          siswa_id: siswaId,
          materi_id: materiId,
          read_at: new Date(),
          duration_seconds,
          scroll_percentage
        };
        materiRead.push(newRead);
      }

      return {
        success: true,
        message: "Materi berhasil ditandai sebagai sudah dibaca"
      };

    } catch (error) {
      console.error("Error marking materi as read:", error);
      return { success: false, error: "Terjadi kesalahan saat menandai materi" };
    }
  })

  // Get tugas
  .get("/tugas", async ({ user, getTugasStatus, getSiswaKelasData }) => {
    try {
      const siswaId = user.userId;
      const kelasData = getSiswaKelasData(siswaId);

      if (!kelasData) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const { tugasSiswa, materiSiswa } = kelasData;

      const tugasWithDetails = tugasSiswa.map(t => {
        const submission = submissions.find(s =>
          s.tugas_id === t.id && s.siswa_id === siswaId
        );
        const materiItem = materiSiswa.find(m => m.id === t.materi_id);
        const status = getTugasStatus(t.id, siswaId);

        return {
          id: t.id,
          judul: t.judul,
          deskripsi: t.deskripsi,
          materi_judul: materiItem?.judul || "Tidak diketahui",
          deadline: t.deadline,
          status,
          nilai: submission?.nilai,
          feedback: submission?.feedback,
          jawaban: submission?.jawaban,
          submitted_at: submission?.submitted_at
        };
      })
        .sort((a, b) => new Date(b.deadline || 0).getTime() - new Date(a.deadline || 0).getTime());

      return {
        success: true,
        data: tugasWithDetails
      };

    } catch (error) {
      console.error("Error loading tugas:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat tugas" };
    }
  })

  // Get recent tugas for dashboard
  .get("/tugas-recent", async ({ user, getTugasStatus, getSiswaKelasData }) => {
    try {
      const siswaId = user.userId;
      const kelasData = getSiswaKelasData(siswaId);

      if (!kelasData) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const { tugasSiswa, materiSiswa } = kelasData;

      // Get 3 tugas terbaru berdasarkan created_at
      const recentTugas = tugasSiswa
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3)
        .map(t => {
          const materiItem = materiSiswa.find(m => m.id === t.materi_id);
          const status = getTugasStatus(t.id, siswaId);

          return {
            id: t.id,
            judul: t.judul,
            materi_judul: materiItem?.judul || "Tidak diketahui",
            status,
            deadline: t.deadline
          };
        });

      return {
        success: true,
        data: recentTugas
      };

    } catch (error) {
      console.error("Error loading recent tugas:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat tugas terbaru" };
    }
  })

  // Submit tugas
  .post("/tugas/:id/submit", async ({ user, params, body, getSiswaKelasData }) => {
    try {
      const siswaId = user.userId;
      const tugasId = parseInt(params.id);

      if (isNaN(tugasId)) {
        return { success: false, error: "ID tugas tidak valid" };
      }

      const kelasData = getSiswaKelasData(siswaId);
      if (!kelasData) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const tugasItem = tugas.find(t => t.id === tugasId);
      if (!tugasItem) {
        return { success: false, error: "Tugas tidak ditemukan" };
      }

      const { jawaban } = body as any;
      if (!jawaban || jawaban.trim().length === 0) {
        return { success: false, error: "Jawaban tidak boleh kosong" };
      }

      const existingSubmissionIndex = submissions.findIndex(s =>
        s.tugas_id === tugasId && s.siswa_id === siswaId
      );

      if (existingSubmissionIndex !== -1) {
        submissions[existingSubmissionIndex].jawaban = jawaban.trim();
        submissions[existingSubmissionIndex].submitted_at = new Date();
        submissions[existingSubmissionIndex].nilai = undefined;
        submissions[existingSubmissionIndex].feedback = undefined;
        submissions[existingSubmissionIndex].graded_at = undefined;
      } else {
        // Create new submission
        const newSubmission = {
          id: Math.max(...submissions.map(s => s.id), 0) + 1,
          tugas_id: tugasId,
          siswa_id: siswaId,
          jawaban: jawaban.trim(),
          submitted_at: new Date()
        };
        submissions.push(newSubmission);
      }

      return {
        success: true,
        message: "Tugas berhasil dikumpulkan"
      };

    } catch (error) {
      console.error("Error submitting tugas:", error);
      return { success: false, error: "Terjadi kesalahan saat mengumpulkan tugas" };
    }
  })

  // Get nilai/grades
  .get("/nilai", async ({ user, getSiswaKelasData }) => {
    try {
      const siswaId = user.userId;
      const kelasData = getSiswaKelasData(siswaId);

      if (!kelasData) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const { tugasSiswa, materiSiswa } = kelasData;

      const nilaiSiswa = submissions
        .filter(s =>
          s.siswa_id === siswaId &&
          tugasSiswa.some(t => t.id === s.tugas_id)
        )
        .map(s => {
          const tugasItem = tugasSiswa.find(t => t.id === s.tugas_id);
          const materiItem = materiSiswa.find(m => m.id === tugasItem?.materi_id);

          return {
            id: s.id,
            tugas_id: s.tugas_id,
            tugas_judul: tugasItem?.judul || "Tugas tidak ditemukan",
            materi_judul: materiItem?.judul || "Materi tidak ditemukan",
            nilai: s.nilai,
            feedback: s.feedback,
            submitted_at: s.submitted_at,
            graded_at: s.graded_at
          };
        })
        .sort((a, b) => {
          // Sort by graded_at if available, then by submitted_at
          const aDate = a.graded_at || a.submitted_at || new Date(0);
          const bDate = b.graded_at || b.submitted_at || new Date(0);
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        });

      return {
        success: true,
        data: nilaiSiswa
      };

    } catch (error) {
      console.error("Error loading nilai:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat nilai" };
    }
  })

  // Get diskusi kelas
  .get("/diskusi-kelas", async ({ user, getSiswaKelasData }) => {
    try {
      const siswaId = user.userId;
      const kelasData = getSiswaKelasData(siswaId);

      if (!kelasData) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const kelasSiswa = kelas.find(k => k.id === kelasData.kelasSiswa);
      const namaKelas = kelasSiswa?.nama || "Kelas 1A";

      const diskusiKelasSiswa = diskusi
        .filter(d => d.kelas === namaKelas)
        .map(d => {
          const userDiskusi = users.find(u => u.id === d.user_id);
          return {
            id: d.id,
            kelas: d.kelas,
            isi: d.isi,
            user_name: userDiskusi?.nama || "Tidak diketahui",
            user_role: d.user_role,
            created_at: d.created_at
          };
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return {
        success: true,
        data: diskusiKelasSiswa
      };

    } catch (error) {
      console.error("Error loading diskusi kelas:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat diskusi kelas" };
    }
  })

  // Add diskusi kelas
  .post("/diskusi-kelas", async ({ user, body, getSiswaKelasData }) => {
    try {
      const siswaId = user.userId;
      const { isi } = body as any;

      if (!isi || isi.trim().length === 0) {
        return { success: false, error: "Isi diskusi tidak boleh kosong" };
      }

      if (isi.trim().length < 5) {
        return { success: false, error: "Isi diskusi terlalu pendek (minimal 5 karakter)" };
      }

      const kelasData = getSiswaKelasData(siswaId);
      if (!kelasData) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const kelasSiswa = kelas.find(k => k.id === kelasData.kelasSiswa);
      const namaKelas = kelasSiswa?.nama || "Kelas 1A";

      const newDiskusi = {
        id: Math.max(...diskusi.map(d => d.id), 0) + 1,
        kelas: namaKelas,
        isi: isi.trim(),
        user_id: siswaId,
        user_role: "siswa" as Role,
        created_at: new Date()
      };

      diskusi.push(newDiskusi);

      return {
        success: true,
        message: "Diskusi kelas berhasil ditambahkan",
        data: { id: newDiskusi.id }
      };

    } catch (error) {
      console.error("Error adding diskusi kelas:", error);
      return { success: false, error: "Terjadi kesalahan saat menambah diskusi kelas" };
    }
  })

  // Get diskusi materi
  .get("/diskusi-materi", async ({ user, getSiswaKelasData }) => {
    try {
      const siswaId = user.userId;
      const kelasData = getSiswaKelasData(siswaId);

      if (!kelasData) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const { materiSiswa } = kelasData;

      const diskusiSiswa = diskusiMateri
        .filter(d => {
          const materiItem = materi.find(m => m.id === d.materi_id);
          return materiItem && materiSiswa.some(m => m.id === materiItem.id);
        })
        .map(d => {
          const userDiskusi = users.find(u => u.id === d.user_id);
          const materiItem = materi.find(m => m.id === d.materi_id);

          return {
            id: d.id,
            materi_id: d.materi_id,
            materi_judul: materiItem?.judul || "Materi tidak ditemukan",
            isi: d.isi,
            user_name: userDiskusi?.nama || "Tidak diketahui",
            user_role: d.user_role,
            created_at: d.created_at,
            parent_id: d.parent_id
          };
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return {
        success: true,
        data: diskusiSiswa
      };

    } catch (error) {
      console.error("Error loading diskusi materi:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat diskusi materi" };
    }
  })

  // Add diskusi materi
  .post("/diskusi-materi", async ({ user, body, getSiswaKelasData }) => {
    try {
      const siswaId = user.userId;
      const { materi_id, isi } = body as any;

      if (!materi_id) {
        return { success: false, error: "Materi harus dipilih" };
      }

      if (!isi || isi.trim().length === 0) {
        return { success: false, error: "Isi diskusi tidak boleh kosong" };
      }

      if (isi.trim().length < 5) {
        return { success: false, error: "Isi diskusi terlalu pendek (minimal 5 karakter)" };
      }

      const kelasData = getSiswaKelasData(siswaId);
      if (!kelasData) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      // Verify materi exists
      const materiItem = materi.find(m => m.id === parseInt(materi_id));
      if (!materiItem) {
        return { success: false, error: "Materi tidak ditemukan" };
      }

      // Verify access
      if (materiItem.kelas_id !== kelasData.kelasSiswa) {
        return { success: false, error: "Anda tidak memiliki akses ke materi ini" };
      }

      const newDiskusi = {
        id: Math.max(...diskusiMateri.map(d => d.id), 0) + 1,
        materi_id: parseInt(materi_id),
        user_id: siswaId,
        user_role: "siswa" as Role,
        isi: isi.trim(),
        created_at: new Date()
      };

      diskusiMateri.push(newDiskusi);

      return {
        success: true,
        message: "Diskusi berhasil ditambahkan",
        data: { id: newDiskusi.id }
      };

    } catch (error) {
      console.error("Error adding diskusi:", error);
      return { success: false, error: "Terjadi kesalahan saat menambah diskusi" };
    }
  })

  // Progress detail
  .get("/progress-detail", async ({ user, getSiswaKelasData }) => {
    try {
      const siswaId = user.userId;
      const kelasData = getSiswaKelasData(siswaId);

      if (!kelasData) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const { materiSiswa, tugasSiswa } = kelasData;

      const materiDibaca = materiRead.filter(mr =>
        mr.siswa_id === siswaId &&
        materiSiswa.some(m => m.id === mr.materi_id)
      ).length;

      const submissionsSiswa = submissions.filter(s =>
        s.siswa_id === siswaId &&
        tugasSiswa.some(t => t.id === s.tugas_id)
      );

      const nilaiSiswa = submissionsSiswa
        .filter(s => s.nilai !== undefined && s.nilai !== null)
        .map(s => s.nilai as number);

      const rataNilai = nilaiSiswa.length > 0
        ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
        : 0;

      return {
        success: true,
        data: {
          total_materi: materiSiswa.length,
          materi_dipelajari: materiDibaca,
          progress_materi: materiSiswa.length > 0
            ? Math.round((materiDibaca / materiSiswa.length) * 100)
            : 0,

          total_tugas: tugasSiswa.length,
          tugas_selesai: submissionsSiswa.length,
          progress_tugas: tugasSiswa.length > 0
            ? Math.round((submissionsSiswa.length / tugasSiswa.length) * 100)
            : 0,

          rata_nilai: rataNilai,
          jumlah_tugas_dinilai: nilaiSiswa.length
        }
      };

    } catch (error) {
      console.error("Error loading progress detail:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat detail progress" };
    }
  })

  .get("/reading-stats", async ({ user, getSiswaKelasData }) => {
    try {
      const siswaId = user.userId;
      const kelasData = getSiswaKelasData(siswaId);

      if (!kelasData) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const { materiSiswa } = kelasData;

      const readingStats = materiRead
        .filter(mr =>
          mr.siswa_id === siswaId &&
          materiSiswa.some(m => m.id === mr.materi_id)
        )
        .map(mr => {
          const materiItem = materiSiswa.find(m => m.id === mr.materi_id);
          return {
            materi_id: mr.materi_id,
            materi_judul: materiItem?.judul || "Tidak diketahui",
            read_at: mr.read_at,
            duration_seconds: mr.duration_seconds || 0,
            scroll_percentage: mr.scroll_percentage || 0
          };
        })
        .sort((a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime());

      const totalReadTime = readingStats.reduce((sum, stat) => sum + (stat.duration_seconds || 0), 0);
      const avgScrollPercentage = readingStats.length > 0
        ? Math.round(readingStats.reduce((sum, stat) => sum + (stat.scroll_percentage || 0), 0) / readingStats.length)
        : 0;

      return {
        success: true,
        data: {
          total_read: readingStats.length,
          total_available: materiSiswa.length,
          total_read_time_seconds: totalReadTime,
          average_scroll_percentage: avgScrollPercentage,
          recent_reads: readingStats.slice(0, 5),
          reading_completion_rate: materiSiswa.length > 0 ?
            Math.round((readingStats.length / materiSiswa.length) * 100) : 0
        }
      };

    } catch (error) {
      console.error("Error loading reading stats:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat statistik membaca" };
    }
  });