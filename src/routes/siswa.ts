import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import {
  users, kelas, materi, diskusi, tugas,
  submissions, diskusiMateri, materiRead,
  Role
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

  // Dashboard statistics
  .get("/dashboard-stats", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = users.find(u => u.id === siswaId);

      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const kelasSiswa = siswa.kelas_id || 1;

      // Filter tugas berdasarkan kelas siswa
      const tugasKelasSiswa = tugas.filter(t => {
        const materiItem = materi.find(m => m.id === t.materi_id);
        return materiItem && materiItem.kelas_id === kelasSiswa;
      });

      const semuaTugas = tugasKelasSiswa.length;
      const tugasDikerjakan = submissions.filter(s =>
        s.siswa_id === siswaId &&
        tugasKelasSiswa.some(t => t.id === s.tugas_id)
      ).length;

      const tugasSelesai = submissions.filter(s =>
        s.siswa_id === siswaId &&
        s.nilai !== undefined &&
        tugasKelasSiswa.some(t => t.id === s.tugas_id)
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
          total_materi: materi.filter(m => m.kelas_id === kelasSiswa).length,
          total_tugas: semuaTugas,
          tugas_selesai: tugasSelesai,
          tugas_pending: tugasDikerjakan - tugasSelesai,
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
  .get("/materi", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = users.find(u => u.id === siswaId);

      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const kelasSiswa = siswa.kelas_id || 1;

      const materiSiswa = materi
        .filter(m => m.kelas_id === kelasSiswa)
        .map(m => {
          const guru = users.find(u => u.id === m.guru_id);
          return {
            id: m.id,
            judul: m.judul,
            deskripsi: m.deskripsi,
            konten: m.konten.length > 200 ? m.konten.substring(0, 200) + "..." : m.konten,
            guru_nama: guru?.nama || "Tidak diketahui",
            created_at: m.created_at,
            updated_at: m.updated_at
          };
        });

      return {
        success: true,
        data: materiSiswa
      };

    } catch (error) {
      console.error("Error loading materi:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat materi" };
    }
  })

  // Get full materi detail
  .get("/materi/:id", async ({ user, params }) => {
    try {
      const siswaId = user.userId;
      const materiId = parseInt(params.id);

      if (isNaN(materiId)) {
        return { success: false, error: "ID materi tidak valid" };
      }

      const materiItem = materi.find(m => m.id === materiId);
      if (!materiItem) {
        return { success: false, error: "Materi tidak ditemukan" };
      }

      // Verify access
      const siswa = users.find(u => u.id === siswaId);
      if (materiItem.kelas_id !== (siswa?.kelas_id || 1)) {
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

  .post("/materi/:id/read", async ({ user, params }) => {
    try {
      const siswaId = user.userId;
      const materiId = parseInt(params.id);

      if (isNaN(materiId)) {
        return { success: false, error: "ID materi tidak valid" };
      }

      const materiItem = materi.find(m => m.id === materiId);
      if (!materiItem) {
        return { success: false, error: "Materi tidak ditemukan" };
      }

      // Verify access
      const siswa = users.find(u => u.id === siswaId);
      if (materiItem.kelas_id !== (siswa?.kelas_id || 1)) {
        return { success: false, error: "Anda tidak memiliki akses ke materi ini" };
      }

      // Mark as read
      const readKey = `${siswaId}-${materiId}`;
      materiRead.add(readKey);

      return {
        success: true,
        message: "Materi berhasil ditandai sebagai sudah dibaca"
      };

    } catch (error) {
      console.error("Error marking materi as read:", error);
      return { success: false, error: "Terjadi kesalahan saat menandai materi sebagai dibaca" };
    }
  })

  // Get tugas for student's class
  .get("/tugas", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = users.find(u => u.id === siswaId);

      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const kelasSiswa = siswa.kelas_id || 1;

      const tugasSiswa = tugas
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

    } catch (error) {
      console.error("Error loading tugas:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat tugas" };
    }
  })

  // Get recent tugas for dashboard
  .get("/tugas-recent", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = users.find(u => u.id === siswaId);

      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const kelasSiswa = siswa.kelas_id || 1;

      // Get recent tugas (limit to 3)
      const recentTugas = tugas
        .filter(t => {
          const materiItem = materi.find(m => m.id === t.materi_id);
          return materiItem && materiItem.kelas_id === kelasSiswa;
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3)
        .map(t => {
          const submission = submissions.find(s =>
            s.tugas_id === t.id && s.siswa_id === siswaId
          );
          const materiItem = materi.find(m => m.id === t.materi_id);

          return {
            id: t.id,
            judul: t.judul,
            materi_judul: materiItem?.judul || "Tidak diketahui",
            status: submission ? "dikerjakan" : "belum_dikerjakan",
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
  .post("/tugas/:id/submit", async ({ user, params, body }) => {
    try {
      const siswaId = user.userId;
      const tugasId = parseInt(params.id);

      if (isNaN(tugasId)) {
        return { success: false, error: "ID tugas tidak valid" };
      }

      const tugasItem = tugas.find(t => t.id === tugasId);
      if (!tugasItem) {
        return { success: false, error: "Tugas tidak ditemukan" };
      }

      const { jawaban } = body as any;
      if (!jawaban || jawaban.trim().length === 0) {
        return { success: false, error: "Jawaban tidak boleh kosong" };
      }

      // Check existing submission
      const existingSubmissionIndex = submissions.findIndex(s =>
        s.tugas_id === tugasId && s.siswa_id === siswaId
      );

      if (existingSubmissionIndex !== -1) {
        // Update existing submission
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
  .get("/nilai", async ({ user }) => {
    try {
      const siswaId = user.userId;

      const nilaiSiswa = submissions
        .filter(s => s.siswa_id === siswaId)
        .map(s => {
          const tugasItem = tugas.find(t => t.id === s.tugas_id);
          const materiItem = materi.find(m => m.id === tugasItem?.materi_id);

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
  .get("/diskusi-kelas", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = users.find(u => u.id === siswaId);

      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const kelasSiswa = kelas.find(k => k.id === siswa.kelas_id);
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
  .post("/diskusi-kelas", async ({ user, body }) => {
    try {
      const siswaId = user.userId;
      const { isi } = body as any;

      if (!isi || isi.trim().length === 0) {
        return { success: false, error: "Isi diskusi tidak boleh kosong" };
      }

      if (isi.trim().length < 5) {
        return { success: false, error: "Isi diskusi terlalu pendek (minimal 5 karakter)" };
      }

      const siswa = users.find(u => u.id === siswaId);
      const kelasSiswa = kelas.find(k => k.id === siswa?.kelas_id);
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
  .get("/diskusi-materi", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = users.find(u => u.id === siswaId);

      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const kelasSiswa = siswa.kelas_id || 1;
      const materiSiswa = materi.filter(m => m.kelas_id === kelasSiswa);

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
  .post("/diskusi-materi", async ({ user, body }) => {
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

      // Verify materi exists
      const materiItem = materi.find(m => m.id === parseInt(materi_id));
      if (!materiItem) {
        return { success: false, error: "Materi tidak ditemukan" };
      }

      // Verify access
      const siswa = users.find(u => u.id === siswaId);
      if (materiItem.kelas_id !== (siswa?.kelas_id || 1)) {
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

  // Get progress detail
  .get("/progress-detail", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = users.find(u => u.id === siswaId);

      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const kelasSiswa = siswa.kelas_id || 1;

      const materiSiswa = materi.filter(m => m.kelas_id === kelasSiswa);
      const tugasSiswa = tugas.filter(t =>
        materiSiswa.some(m => m.id === t.materi_id)
      );

      const submissionsSiswa = submissions.filter(s =>
        s.siswa_id === siswaId &&
        tugasSiswa.some(t => t.id === s.tugas_id)
      );

      const nilaiSiswa = submissionsSiswa
        .filter(s => s.nilai !== undefined)
        .map(s => s.nilai as number);

      // Hitung materi yang sudah dibaca berdasarkan tracking
      const materiDibaca = materiSiswa.filter(m => {
        const readKey = `${siswaId}-${m.id}`;
        return materiRead.has(readKey);
      }).length;

      return {
        success: true,
        data: {
          total_materi: materiSiswa.length,
          materi_dipelajari: materiDibaca, // Update: berdasarkan yang sudah dibaca
          total_tugas: tugasSiswa.length,
          tugas_selesai: submissionsSiswa.length,
          rata_nilai: nilaiSiswa.length > 0
            ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
            : 0,
          progress_materi: materiSiswa.length > 0
            ? Math.round((materiDibaca / materiSiswa.length) * 100)
            : 0,
          progress_tugas: tugasSiswa.length > 0
            ? Math.round((submissionsSiswa.length / tugasSiswa.length) * 100)
            : 0
        }
      };

    } catch (error) {
      console.error("Error loading progress detail:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat detail progress" };
    }
  });