import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { 
  getUsers, getKelasForSiswa, getMateriForKelas, getKelasForMateri,
  getSubmissionForSiswa, getMateriProgressForSiswa, getTugasWithStatus,
  getTugasForSiswa, isSiswaInKelas, isMateriInKelas, getMateriById,
  query, getUserById
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

  .get("/dashboard-stats", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = await getUserById(siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      const kelasSiswa = await getKelasForSiswa(siswaId);
      if (kelasSiswa.length === 0) {
        return { success: false, error: "Siswa belum terdaftar di kelas manapun" };
      }
      
      const totalMateri = (await Promise.all(
        kelasSiswa.map(k => getMateriForKelas(k.id))
      )).reduce((total, materi) => total + materi.length, 0);
      
      const semuaTugas = (await getTugasForSiswa(siswaId)).length;
      
      const siswaTugas = await getSubmissionForSiswa(siswaId) as any[];
      const tugasDikerjakan = siswaTugas.filter(st => 
        st.status !== 'belum_dikerjakan'
      ).length;
      
      const tugasSelesai = siswaTugas.filter(st => 
        st.nilai !== undefined && st.nilai !== null
      ).length;
      
      const nilaiSiswa = siswaTugas
        .filter(st => st.nilai !== undefined && st.nilai !== null)
        .map(st => st.nilai as number);
      
      const rataNilai = nilaiSiswa.length > 0 
        ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
        : 0;
      
      const progress = semuaTugas > 0 
        ? Math.round((tugasDikerjakan / semuaTugas) * 100)
        : 0;
      
      const siswaMateri = await getMateriProgressForSiswa(siswaId) as any[];
      const materiDipelajari = siswaMateri.filter(sm => 
        sm.is_completed
      ).length;
      
      const progressMateri = totalMateri > 0 
        ? Math.round((materiDipelajari / totalMateri) * 100)
        : 0;
      
      return {
        success: true,
        data: {
          total_materi: totalMateri,
          materi_dipelajari: materiDipelajari,
          progress_materi: progressMateri,
          total_tugas: semuaTugas,
          tugas_dikerjakan: tugasDikerjakan,
          tugas_selesai: tugasSelesai,
          tugas_pending: tugasDikerjakan - tugasSelesai,
          rata_nilai: rataNilai,
          overall_progress: progress,
          kelas: kelasSiswa.map(k => k.nama)
        }
      };
      
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat statistik dashboard" };
    }
  })

  .get("/materi", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = await getUserById(siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      const kelasSiswa = await getKelasForSiswa(siswaId);
      if (kelasSiswa.length === 0) {
        return { success: false, error: "Siswa belum terdaftar di kelas manapun" };
      }
      
      const semuaMateriPromises = kelasSiswa.map(k => getMateriForKelas(k.id));
      const semuaMateriArrays = await Promise.all(semuaMateriPromises);
      const semuaMateri = semuaMateriArrays.flat();
      
      const materiSiswa = await Promise.all(semuaMateri.map(async (m) => {
        const users = await getUsers();
        const guru = users.find(u => u.id === m.guru_id);
        const progress = await getMateriProgressForSiswa(siswaId, m.id) as any;
        
        const konten = m.konten || "Tidak ada konten yang tersedia";
        const preview = konten.length > 200 ? konten.substring(0, 200) + "..." : konten;
        
        const kelasMateri = await getKelasForMateri(m.id);
        
        return {
          id: m.id,
          judul: m.judul || "Judul tidak tersedia",
          deskripsi: m.deskripsi || "Tidak ada deskripsi",
          konten: konten,
          konten_preview: preview,
          guru_nama: guru?.nama || "Tidak diketahui",
          kelas: kelasMateri.map(k => k.nama).join(", "),
          created_at: m.created_at,
          updated_at: m.updated_at,
          last_accessed: progress?.last_accessed,
          is_completed: progress?.is_completed || false,
          progress: progress ? (progress.is_completed ? 100 : 50) : 0
        };
      }));
      
      return {
        success: true,
        data: materiSiswa
      };
      
    } catch (error) {
      console.error("Error loading materi:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat materi" };
    }
  })

  .get("/tugas", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = await getUserById(siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      const tugasSiswa = await getTugasWithStatus(siswaId);
      
      return {
        success: true,
        data: tugasSiswa
      };
      
    } catch (error) {
      console.error("Error loading tugas:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat tugas" };
    }
  })

  .get("/tugas-recent", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = await getUserById(siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      const tugasSiswa = await getTugasWithStatus(siswaId);
      
      const recentTugas = tugasSiswa
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3);
      
      return {
        success: true,
        data: recentTugas
      };
      
    } catch (error) {
      console.error("Error loading recent tugas:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat tugas terbaru" };
    }
  })

  .post("/tugas/:id/submit", async ({ user, params, body }) => {
    try {
      const siswaId = user.userId;
      const tugasId = parseInt(params.id);
      
      if (isNaN(tugasId)) {
        return { success: false, error: "ID tugas tidak valid" };
      }
      
      const semuaTugas = await query("SELECT * FROM tugas WHERE id = ?", [tugasId]);
      const tugasItem = (semuaTugas as any[])[0];
      if (!tugasItem) {
        return { success: false, error: "Tugas tidak ditemukan" };
      }
      
      const kelasSiswa = await getKelasForSiswa(siswaId);
      const materiKelas = await getKelasForMateri(tugasItem.materi_id);
      const hasAccess = kelasSiswa.some(ks => 
        materiKelas.some(mk => mk.id === ks.id)
      );
      
      if (!hasAccess) {
        return { success: false, error: "Anda tidak memiliki akses ke tugas ini" };
      }
      
      const { jawaban } = body as any;
      if (!jawaban || jawaban.trim().length === 0) {
        return { success: false, error: "Jawaban tidak boleh kosong" };
      }
      
      const existingSubmission = await query(
        "SELECT * FROM siswa_tugas WHERE siswa_id = ? AND tugas_id = ?",
        [siswaId, tugasId]
      ) as any[];
      
      if (existingSubmission.length > 0) {
        await query(
          "UPDATE siswa_tugas SET jawaban = ?, status = 'dikerjakan', submitted_at = NOW(), nilai = NULL, feedback = NULL, graded_at = NULL WHERE siswa_id = ? AND tugas_id = ?",
          [jawaban.trim(), siswaId, tugasId]
        );
      } else {
        await query(
          "INSERT INTO siswa_tugas (siswa_id, tugas_id, jawaban, status, submitted_at) VALUES (?, ?, ?, 'dikerjakan', NOW())",
          [siswaId, tugasId, jawaban.trim()]
        );
      }
      
      const existingProgress = await query(
        "SELECT * FROM siswa_materi WHERE siswa_id = ? AND materi_id = ?",
        [siswaId, tugasItem.materi_id]
      ) as any[];
      
      if (existingProgress.length > 0) {
        await query(
          "UPDATE siswa_materi SET last_accessed = NOW() WHERE siswa_id = ? AND materi_id = ?",
          [siswaId, tugasItem.materi_id]
        );
      } else {
        await query(
          "INSERT INTO siswa_materi (siswa_id, materi_id, last_accessed, is_completed) VALUES (?, ?, NOW(), false)",
          [siswaId, tugasItem.materi_id]
        );
      }
      
      await query(
        "UPDATE users SET last_activity = NOW() WHERE id = ?",
        [siswaId]
      );
      
      return {
        success: true,
        message: "Tugas berhasil dikumpulkan"
      };
      
    } catch (error) {
      console.error("Error submitting tugas:", error);
      return { success: false, error: "Terjadi kesalahan saat mengumpulkan tugas" };
    }
  })

  .get("/nilai", async ({ user }) => {
    try {
      const siswaId = user.userId;
      
      const siswaTugas = await getSubmissionForSiswa(siswaId) as any[];
      const nilaiSiswa = siswaTugas
        .filter(st => st.nilai !== undefined && st.nilai !== null)
        .map(st => {
          return {
            id: st.id,
            tugas_id: st.tugas_id,
            nilai: st.nilai,
            feedback: st.feedback,
            submitted_at: st.submitted_at,
            graded_at: st.graded_at
          };
        });
      
      
      const nilaiWithDetails = await Promise.all(nilaiSiswa.map(async (nilai) => {
        const tugasResult = await query("SELECT * FROM tugas WHERE id = ?", [nilai.tugas_id]) as any[];
        const tugasItem = tugasResult[0];
        
        if (!tugasItem) {
          return {
            ...nilai,
            tugas_judul: "Tugas tidak ditemukan",
            materi_judul: "Materi tidak ditemukan",
            kelas: "Tidak diketahui"
          };
        }
        
        const materiResult = await query("SELECT * FROM materi WHERE id = ?", [tugasItem.materi_id]) as any[];
        const materiItem = materiResult[0];
        const kelasMateri = await getKelasForMateri(tugasItem.materi_id);
        
        return {
          ...nilai,
          tugas_judul: tugasItem.judul || "Tugas tidak ditemukan",
          materi_judul: materiItem?.judul || "Materi tidak ditemukan",
          kelas: kelasMateri.map(k => k.nama).join(", ")
        };
      }));
      
      return {
        success: true,
        data: nilaiWithDetails
      };
      
    } catch (error) {
      console.error("Error loading nilai:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat nilai" };
    }
  })

  .get("/diskusi-kelas", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = await getUserById(siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      const kelasSiswa = await getKelasForSiswa(siswaId);
      const namaKelas = kelasSiswa.map(k => k.nama);
      
      const placeholders = namaKelas.map(() => '?').join(',');
      const diskusiResult = await query(
        `SELECT * FROM diskusi WHERE kelas IN (${placeholders}) ORDER BY created_at DESC`,
        namaKelas
      ) as any[];
      
      const users = await getUsers();
      const diskusiKelasSiswa = diskusiResult.map(d => {
        const userDiskusi = users.find(u => u.id === d.user_id);
        return {
          id: d.id,
          kelas: d.kelas,
          isi: d.isi,
          user_name: userDiskusi?.nama || "Tidak diketahui",
          user_role: d.user_role,
          created_at: d.created_at
        };
      });
      
      return {
        success: true,
        data: diskusiKelasSiswa
      };
      
    } catch (error) {
      console.error("Error loading diskusi kelas:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat diskusi kelas" };
    }
  })

  .get("/diskusi-materi", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = await getUserById(siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      const kelasSiswa = await getKelasForSiswa(siswaId);
      const materiSiswaPromises = kelasSiswa.map(k => getMateriForKelas(k.id));
      const materiSiswaArrays = await Promise.all(materiSiswaPromises);
      const materiSiswa = materiSiswaArrays.flat();
      
      const materiIds = materiSiswa.map(m => m.id);
      if (materiIds.length === 0) {
        return { success: true, data: [] };
      }
      
      const placeholders = materiIds.map(() => '?').join(',');
      const diskusiResult = await query(
        `SELECT * FROM diskusi_materi WHERE materi_id IN (${placeholders}) ORDER BY created_at DESC`,
        materiIds
      ) as any[];
      
      const users = await getUsers();
      const semuaMateri = await query("SELECT * FROM materi") as any[];
      
      const diskusiSiswa = diskusiResult.map(d => {
        const userDiskusi = users.find(u => u.id === d.user_id);
        const materiItem = semuaMateri.find(m => m.id === d.materi_id);
        
        return {
          id: d.id,
          materi_id: d.materi_id,
          materi_judul: materiItem?.judul || "Materi tidak ditemukan",
          isi: d.isi,
          user_name: userDiskusi?.nama || "Tidak diketahui",
          user_role: d.user_role,
          created_at: d.created_at
        };
      });
      
      return {
        success: true,
        data: diskusiSiswa
      };
      
    } catch (error) {
      console.error("Error loading diskusi materi:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat diskusi materi" };
    }
  })

  .post("/diskusi-materi", async ({ user, body }) => {
    try {
      const siswaId = user.userId;
      const { materi_id, isi } = body as any;
      
      if (!materi_id || !isi) {
        return { success: false, error: "Materi dan isi diskusi harus diisi" };
      }
      
      if (isi.length < 5) {
        return { success: false, error: "Isi diskusi terlalu pendek" };
      }
      
      const kelasSiswa = await getKelasForSiswa(siswaId);
      const materiKelas = await getKelasForMateri(parseInt(materi_id));
      const hasAccess = kelasSiswa.some(ks => 
        materiKelas.some(mk => mk.id === ks.id)
      );
      
      if (!hasAccess) {
        return { success: false, error: "Anda tidak memiliki akses ke materi ini" };
      }
      
      await query(
        "INSERT INTO diskusi_materi (materi_id, user_id, user_role, isi, created_at) VALUES (?, ?, 'siswa', ?, NOW())",
        [parseInt(materi_id), siswaId, isi.trim()]
      );
      
      return {
        success: true,
        message: "Diskusi berhasil ditambahkan"
      };
      
    } catch (error) {
      console.error("Error adding diskusi:", error);
      return { success: false, error: "Terjadi kesalahan saat menambah diskusi" };
    }
  })

  .get("/progress-detail", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = await getUserById(siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      const kelasSiswa = await getKelasForSiswa(siswaId);
      
      const materiSiswaPromises = kelasSiswa.map(k => getMateriForKelas(k.id));
      const materiSiswaArrays = await Promise.all(materiSiswaPromises);
      const materiSiswa = materiSiswaArrays.flat();
      
      const semuaTugas = await getTugasForSiswa(siswaId);
      
      const submissionsSiswa = await getSubmissionForSiswa(siswaId) as any[];
      
      const materiProgress = await getMateriProgressForSiswa(siswaId) as any[];
      
      const materiDipelajari = materiProgress.filter(mp => mp.is_completed).length;
      const tugasDikerjakan = submissionsSiswa.filter(s => s.status !== 'belum_dikerjakan').length;
      
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
          materi_dipelajari: materiDipelajari,
          total_tugas: semuaTugas.length,
          tugas_dikerjakan: tugasDikerjakan,
          rata_nilai: rataNilai,
          progress_materi: materiSiswa.length > 0 
            ? Math.round((materiDipelajari / materiSiswa.length) * 100)
            : 0,
          progress_tugas: semuaTugas.length > 0 
            ? Math.round((tugasDikerjakan / semuaTugas.length) * 100)
            : 0,
          
          detail_kelas: await Promise.all(kelasSiswa.map(async (k) => {
            const materiKelas = await getMateriForKelas(k.id);
            const tugasKelas = await getTugasForKelas(k.id);
            const submissionsSiswa = await getSubmissionForSiswa(siswaId) as any[];
            
            const tugasDikerjakanKelas = submissionsSiswa.filter(s => 
              tugasKelas.some(t => t.id === s.tugas_id) && s.status !== 'belum_dikerjakan'
            ).length;
            
            const materiProgress = await getMateriProgressForSiswa(siswaId) as any[];
            const materiDipelajariKelas = materiProgress.filter(mp => 
              materiKelas.some(m => m.id === mp.materi_id) && mp.is_completed
            ).length;
            
            return {
              id: k.id,
              nama: k.nama,
              total_materi: materiKelas.length,
              materi_dipelajari: materiDipelajariKelas,
              total_tugas: tugasKelas.length,
              tugas_dikerjakan: tugasDikerjakanKelas,
              progress_materi: materiKelas.length > 0 
                ? Math.round((materiDipelajariKelas / materiKelas.length) * 100)
                : 0,
              progress_tugas: tugasKelas.length > 0 
                ? Math.round((tugasDikerjakanKelas / tugasKelas.length) * 100)
                : 0
            };
          }))
        }
      };
      
    } catch (error) {
      console.error("Error loading progress detail:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat detail progress" };
    }
  })

  .get("/materi/:id", async ({ user, params }) => {
    try {
      const siswaId = user.userId;
      const materiId = parseInt(params.id);
      
      if (isNaN(materiId)) {
        return { success: false, error: "ID materi tidak valid" };
      }
      
      const materiItem = await getMateriById(materiId);
      if (!materiItem) {
        return { success: false, error: "Materi tidak ditemukan" };
      }
      
      const kelasSiswa = await getKelasForSiswa(siswaId);
      const materiKelas = await getKelasForMateri(materiId);
      const hasAccess = kelasSiswa.some(ks => 
        materiKelas.some(mk => mk.id === ks.id)
      );
      
      if (!hasAccess) {
        return { success: false, error: "Anda tidak memiliki akses ke materi ini" };
      }
      
      const users = await getUsers();
      const guru = users.find(u => u.id === materiItem.guru_id);
      
      const existingProgress = await query(
        "SELECT * FROM siswa_materi WHERE siswa_id = ? AND materi_id = ?",
        [siswaId, materiId]
      ) as any[];
      
      if (existingProgress.length > 0) {
        await query(
          "UPDATE siswa_materi SET last_accessed = NOW() WHERE siswa_id = ? AND materi_id = ?",
          [siswaId, materiId]
        );
      } else {
        await query(
          "INSERT INTO siswa_materi (siswa_id, materi_id, last_accessed, is_completed) VALUES (?, ?, NOW(), false)",
          [siswaId, materiId]
        );
      }
      
      await query(
        "UPDATE users SET last_activity = NOW() WHERE id = ?",
        [siswaId]
      );
      
      return {
        success: true,
        data: {
          id: materiItem.id,
          judul: materiItem.judul || "Judul tidak tersedia",
          deskripsi: materiItem.deskripsi || "Tidak ada deskripsi",
          konten: materiItem.konten || "Tidak ada konten yang tersedia",
          guru_nama: guru?.nama || "Tidak diketahui",
          kelas: materiKelas.map(k => k.nama).join(", "),
          created_at: materiItem.created_at,
          updated_at: materiItem.updated_at
        }
      };
      
    } catch (error) {
      console.error("Error loading materi detail:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat detail materi" };
    }
  })

  .post("/materi/:id/complete", async ({ user, params }) => {
    try {
      const siswaId = user.userId;
      const materiId = parseInt(params.id);
      
      if (isNaN(materiId)) {
        return { success: false, error: "ID materi tidak valid" };
      }
      
      const kelasSiswa = await getKelasForSiswa(siswaId);
      const materiKelas = await getKelasForMateri(materiId);
      const hasAccess = kelasSiswa.some(ks => 
        materiKelas.some(mk => mk.id === ks.id)
      );
      
      if (!hasAccess) {
        return { success: false, error: "Anda tidak memiliki akses ke materi ini" };
      }
      
      const existingProgress = await query(
        "SELECT * FROM siswa_materi WHERE siswa_id = ? AND materi_id = ?",
        [siswaId, materiId]
      ) as any[];
      
      if (existingProgress.length > 0) {
        await query(
          "UPDATE siswa_materi SET is_completed = true, last_accessed = NOW() WHERE siswa_id = ? AND materi_id = ?",
          [siswaId, materiId]
        );
      } else {
        await query(
          "INSERT INTO siswa_materi (siswa_id, materi_id, last_accessed, is_completed) VALUES (?, ?, NOW(), true)",
          [siswaId, materiId]
        );
      }
      
      await query(
        "UPDATE users SET last_activity = NOW() WHERE id = ?",
        [siswaId]
      );
      
      return {
        success: true,
        message: "Materi berhasil ditandai sebagai selesai"
      };
      
    } catch (error) {
      console.error("Error completing materi:", error);
      return { success: false, error: "Terjadi kesalahan saat menandai materi sebagai selesai" };
    }
  });