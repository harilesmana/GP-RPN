import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { users, kelas, materi, diskusi, tugas, diskusiMateri, siswaTugas, siswaMateri, getTugasForKelas, getSubmissionForSiswa, getMateriProgressForSiswa, getTugasWithStatus } from "../db";

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
      const siswa = users.find(u => u.id === siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      const kelasSiswa = siswa.kelas_id || 1;
      
      
      const totalMateri = materi.filter(m => m.kelas_id === kelasSiswa).length;
      
      
      const tugasUntukKelas = getTugasForKelas(kelasSiswa);
      const semuaTugas = tugasUntukKelas.length;
      
      
      const tugasDikerjakan = siswaTugas.filter(st => 
        st.siswa_id === siswaId && 
        st.status !== 'belum_dikerjakan' &&
        tugasUntukKelas.some(t => t.id === st.tugas_id)
      ).length;
      
      
      const tugasSelesai = siswaTugas.filter(st => 
        st.siswa_id === siswaId && 
        st.nilai !== undefined &&
        tugasUntukKelas.some(t => t.id === st.tugas_id)
      ).length;
      
      
      const nilaiSiswa = siswaTugas
        .filter(st => st.siswa_id === siswaId && st.nilai !== undefined)
        .map(st => st.nilai as number);
      
      const rataNilai = nilaiSiswa.length > 0 
        ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
        : 0;
      
      
      const progress = semuaTugas > 0 
        ? Math.round((tugasDikerjakan / semuaTugas) * 100)
        : 0;
      
      
      const materiDipelajari = siswaMateri.filter(sm => 
        sm.siswa_id === siswaId && 
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
          overall_progress: progress
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
      const siswa = users.find(u => u.id === siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      const kelasSiswa = siswa.kelas_id || 1;
      
      const materiSiswa = materi
        .filter(m => m.kelas_id === kelasSiswa)
        .map(m => {
          const guru = users.find(u => u.id === m.guru_id);
          const progress = getMateriProgressForSiswa(siswaId, m.id);
          
          const konten = m.konten || "Tidak ada konten yang tersedia";
          const preview = konten.length > 200 ? konten.substring(0, 200) + "..." : konten;
          
          return {
            id: m.id,
            judul: m.judul || "Judul tidak tersedia",
            deskripsi: m.deskripsi || "Tidak ada deskripsi",
            konten: konten,
            konten_preview: preview,
            guru_nama: guru?.nama || "Tidak diketahui",
            created_at: m.created_at,
            updated_at: m.updated_at,
            last_accessed: progress?.last_accessed,
            is_completed: progress?.is_completed || false,
            progress: progress ? (progress.is_completed ? 100 : 50) : 0
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

  .get("/tugas", async ({ user }) => {
    try {
      const siswaId = user.userId;
      const siswa = users.find(u => u.id === siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      const kelasSiswa = siswa.kelas_id || 1;
      const tugasSiswa = getTugasWithStatus(siswaId, kelasSiswa);
      
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
      const siswa = users.find(u => u.id === siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      const kelasSiswa = siswa.kelas_id || 1;
      const tugasSiswa = getTugasWithStatus(siswaId, kelasSiswa);
      
      
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
      
      
      const tugasItem = tugas.find(t => t.id === tugasId);
      if (!tugasItem) {
        return { success: false, error: "Tugas tidak ditemukan" };
      }
      
      const { jawaban } = body as any;
      if (!jawaban || jawaban.trim().length === 0) {
        return { success: false, error: "Jawaban tidak boleh kosong" };
      }
      
      
      const submissionIndex = siswaTugas.findIndex(st => 
        st.siswa_id === siswaId && st.tugas_id === tugasId
      );
      
      if (submissionIndex !== -1) {
        
        siswaTugas[submissionIndex].jawaban = jawaban.trim();
        siswaTugas[submissionIndex].status = 'dikerjakan';
        siswaTugas[submissionIndex].submitted_at = new Date();
        siswaTugas[submissionIndex].nilai = undefined;
        siswaTugas[submissionIndex].feedback = undefined;
        siswaTugas[submissionIndex].graded_at = undefined;
      } else {
        
        siswaTugas.push({
          id: siswaTugas.length + 1,
          siswa_id: siswaId,
          tugas_id: tugasId,
          jawaban: jawaban.trim(),
          status: 'dikerjakan',
          submitted_at: new Date()
        });
      }
      
      
      const materiProgressIndex = siswaMateri.findIndex(sm => 
        sm.siswa_id === siswaId && sm.materi_id === tugasItem.materi_id
      );
      
      if (materiProgressIndex !== -1) {
        siswaMateri[materiProgressIndex].last_accessed = new Date();
      } else {
        siswaMateri.push({
          id: siswaMateri.length + 1,
          siswa_id: siswaId,
          materi_id: tugasItem.materi_id,
          last_accessed: new Date(),
          is_completed: false
        });
      }
      
      
      const siswa = users.find(u => u.id === siswaId);
      if (siswa) {
        siswa.last_activity = new Date();
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

  .get("/nilai", async ({ user }) => {
    try {
      const siswaId = user.userId;
      
      const nilaiSiswa = siswaTugas
        .filter(st => st.siswa_id === siswaId && st.nilai !== undefined)
        .map(st => {
          const tugasItem = tugas.find(t => t.id === st.tugas_id);
          const materiItem = materi.find(m => m.id === tugasItem?.materi_id);
          
          return {
            id: st.id,
            tugas_id: st.tugas_id,
            tugas_judul: tugasItem?.judul || "Tugas tidak ditemukan",
            materi_judul: materiItem?.judul || "Materi tidak ditemukan",
            nilai: st.nilai,
            feedback: st.feedback,
            submitted_at: st.submitted_at,
            graded_at: st.graded_at
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
      const siswa = users.find(u => u.id === siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      const kelasSiswa = siswa.kelas_id || 1;
      
      const materiSiswa = materi.filter(m => m.kelas_id === kelasSiswa);
      const diskusiSiswa = diskusiMateri
        .filter(d => materiSiswa.some(m => m.id === d.materi_id))
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
      
      const newDiskusi = {
        id: diskusiMateri.length + 1,
        materi_id: parseInt(materi_id),
        user_id: siswaId,
        user_role: "siswa",
        isi: isi.trim(),
        created_at: new Date()
      };
      
      diskusiMateri.push(newDiskusi);
      
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
      const siswa = users.find(u => u.id === siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      const kelasSiswa = siswa.kelas_id || 1;
      
      
      const materiSiswa = materi.filter(m => m.kelas_id === kelasSiswa);
      
      
      const tugasUntukKelas = getTugasForKelas(kelasSiswa);
      
      
      const submissionsSiswa = getSubmissionForSiswa(siswaId);
      
      
      const materiProgress = getMateriProgressForSiswa(siswaId);
      
      
      const materiDipelajari = materiProgress.filter(mp => mp.is_completed).length;
      const tugasDikerjakan = submissionsSiswa.filter(s => s.status !== 'belum_dikerjakan').length;
      
      const nilaiSiswa = submissionsSiswa
        .filter(s => s.nilai !== undefined)
        .map(s => s.nilai as number);
      
      const rataNilai = nilaiSiswa.length > 0 
        ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
        : 0;
      
      return {
        success: true,
        data: {
          total_materi: materiSiswa.length,
          materi_dipelajari: materiDipelajari,
          total_tugas: tugasUntukKelas.length,
          tugas_dikerjakan: tugasDikerjakan,
          rata_nilai: rataNilai,
          progress_materi: materiSiswa.length > 0 
            ? Math.round((materiDipelajari / materiSiswa.length) * 100)
            : 0,
          progress_tugas: tugasUntukKelas.length > 0 
            ? Math.round((tugasDikerjakan / tugasUntukKelas.length) * 100)
            : 0,
          
          
          detail_materi: materiSiswa.map(m => {
            const progress = materiProgress.find(mp => mp.materi_id === m.id);
            const tugasMateri = tugasUntukKelas.filter(t => t.materi_id === m.id);
            const tugasDikerjakan = submissionsSiswa.filter(s => 
              tugasMateri.some(t => t.id === s.tugas_id) && s.status !== 'belum_dikerjakan'
            ).length;
            
            return {
              id: m.id,
              judul: m.judul,
              progress: progress?.is_completed ? 100 : Math.round((tugasDikerjakan / tugasMateri.length) * 100),
              last_accessed: progress?.last_accessed,
              total_tugas: tugasMateri.length,
              tugas_dikerjakan: tugasDikerjakan
            };
          })
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
      
      const materiItem = materi.find(m => m.id === materiId);
      if (!materiItem) {
        return { success: false, error: "Materi tidak ditemukan" };
      }
      
      
      const siswa = users.find(u => u.id === siswaId);
      if (materiItem.kelas_id !== (siswa?.kelas_id || 1)) {
        return { success: false, error: "Anda tidak memiliki akses ke materi ini" };
      }
      
      const guru = users.find(u => u.id === materiItem.guru_id);
      
      
      const materiProgressIndex = siswaMateri.findIndex(sm => 
        sm.siswa_id === siswaId && sm.materi_id === materiId
      );
      
      if (materiProgressIndex !== -1) {
        siswaMateri[materiProgressIndex].last_accessed = new Date();
      } else {
        siswaMateri.push({
          id: siswaMateri.length + 1,
          siswa_id: siswaId,
          materi_id: materiId,
          last_accessed: new Date(),
          is_completed: false
        });
      }
      
      
      if (siswa) {
        siswa.last_activity = new Date();
      }
      
      return {
        success: true,
        data: {
          id: materiItem.id,
          judul: materiItem.judul || "Judul tidak tersedia",
          deskripsi: materiItem.deskripsi || "Tidak ada deskripsi",
          konten: materiItem.konten || "Tidak ada konten yang tersedia",
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

  
  .post("/materi/:id/complete", async ({ user, params }) => {
    try {
      const siswaId = user.userId;
      const materiId = parseInt(params.id);
      
      if (isNaN(materiId)) {
        return { success: false, error: "ID materi tidak valid" };
      }
      
      const materiProgressIndex = siswaMateri.findIndex(sm => 
        sm.siswa_id === siswaId && sm.materi_id === materiId
      );
      
      if (materiProgressIndex !== -1) {
        siswaMateri[materiProgressIndex].is_completed = true;
        siswaMateri[materiProgressIndex].last_accessed = new Date();
      } else {
        siswaMateri.push({
          id: siswaMateri.length + 1,
          siswa_id: siswaId,
          materi_id: materiId,
          last_accessed: new Date(),
          is_completed: true
        });
      }
      
      
      const siswa = users.find(u => u.id === siswaId);
      if (siswa) {
        siswa.last_activity = new Date();
      }
      
      return {
        success: true,
        message: "Materi berhasil ditandai sebagai selesai"
      };
      
    } catch (error) {
      console.error("Error completing materi:", error);
      return { success: false, error: "Terjadi kesalahan saat menandai materi sebagai selesai" };
    }
  });