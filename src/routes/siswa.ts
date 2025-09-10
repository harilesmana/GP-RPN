import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { 
  users, kelas, materi, diskusi, tugas, diskusiMateri, 
  siswaTugas, siswaMateri, getKelasForSiswa, getMateriForKelas, 
  getSubmissionForSiswa, getMateriProgressForSiswa, getTugasWithStatus,
  getTugasForSiswa, isSiswaInKelas, isMateriInKelas
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
      const siswa = users.find(u => u.id === siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      
      const kelasSiswa = getKelasForSiswa(siswaId);
      if (kelasSiswa.length === 0) {
        return { success: false, error: "Siswa belum terdaftar di kelas manapun" };
      }
      
      
      const totalMateri = kelasSiswa.reduce((total, k) => {
        return total + getMateriForKelas(k.id).length;
      }, 0);
      
      
      const semuaTugas = getTugasForSiswa(siswaId).length;
      
      
      const tugasDikerjakan = siswaTugas.filter(st => 
        st.siswa_id === siswaId && 
        st.status !== 'belum_dikerjakan'
      ).length;
      
      
      const tugasSelesai = siswaTugas.filter(st => 
        st.siswa_id === siswaId && 
        st.nilai !== undefined
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
      const siswa = users.find(u => u.id === siswaId);
      
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      
      
      const kelasSiswa = getKelasForSiswa(siswaId);
      if (kelasSiswa.length === 0) {
        return { success: false, error: "Siswa belum terdaftar di kelas manapun" };
      }
      
      
      const semuaMateri = kelasSiswa.flatMap(k => getMateriForKelas(k.id));
      
      const materiSiswa = semuaMateri.map(m => {
        const guru = users.find(u => u.id === m.guru_id);
        const progress = getMateriProgressForSiswa(siswaId, m.id);
        
        const konten = m.konten || "Tidak ada konten yang tersedia";
        const preview = konten.length > 200 ? konten.substring(0, 200) + "..." : konten;
        
        
        const kelasMateri = getKelasForMateri(m.id).map(k => k.nama).join(", ");
        
        return {
          id: m.id,
          judul: m.judul || "Judul tidak tersedia",
          deskripsi: m.deskripsi || "Tidak ada deskripsi",
          konten: konten,
          konten_preview: preview,
          guru_nama: guru?.nama || "Tidak diketahui",
          kelas: kelasMateri,
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
      
      const tugasSiswa = getTugasWithStatus(siswaId);
      
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
      
      const tugasSiswa = getTugasWithStatus(siswaId);
      
      
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
      
      
      const kelasSiswa = getKelasForSiswa(siswaId);
      const materiKelas = getKelasForMateri(tugasItem.materi_id);
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
          const kelasMateri = getKelasForMateri(tugasItem?.materi_id || 0);
          
          return {
            id: st.id,
            tugas_id: st.tugas_id,
            tugas_judul: tugasItem?.judul || "Tugas tidak ditemukan",
            materi_judul: materiItem?.judul || "Materi tidak ditemukan",
            kelas: kelasMateri.map(k => k.nama).join(", "),
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
      
      const kelasSiswa = getKelasForSiswa(siswaId);
      const namaKelas = kelasSiswa.map(k => k.nama);
      
      const diskusiKelasSiswa = diskusi
        .filter(d => namaKelas.includes(d.kelas))
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
      
      const kelasSiswa = getKelasForSiswa(siswaId);
      const materiSiswa = kelasSiswa.flatMap(k => getMateriForKelas(k.id));
      
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
      
      
      const kelasSiswa = getKelasForSiswa(siswaId);
      const materiKelas = getKelasForMateri(parseInt(materi_id));
      const hasAccess = kelasSiswa.some(ks => 
        materiKelas.some(mk => mk.id === ks.id)
      );
      
      if (!hasAccess) {
        return { success: false, error: "Anda tidak memiliki akses ke materi ini" };
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
      
      const kelasSiswa = getKelasForSiswa(siswaId);
      
      
      const materiSiswa = kelasSiswa.flatMap(k => getMateriForKelas(k.id));
      
      
      const semuaTugas = getTugasForSiswa(siswaId);
      
      
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
          total_tugas: semuaTugas.length,
          tugas_dikerjakan: tugasDikerjakan,
          rata_nilai: rataNilai,
          progress_materi: materiSiswa.length > 0 
            ? Math.round((materiDipelajari / materiSiswa.length) * 100)
            : 0,
          progress_tugas: semuaTugas.length > 0 
            ? Math.round((tugasDikerjakan / semuaTugas.length) * 100)
            : 0,
          
          
          detail_kelas: kelasSiswa.map(k => {
            const materiKelas = getMateriForKelas(k.id);
            const tugasKelas = getTugasForKelas(k.id);
            const tugasDikerjakanKelas = submissionsSiswa.filter(s => 
              tugasKelas.some(t => t.id === s.tugas_id) && s.status !== 'belum_dikerjakan'
            ).length;
            
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
      
      
      const kelasSiswa = getKelasForSiswa(siswaId);
      const materiKelas = getKelasForMateri(materiId);
      const hasAccess = kelasSiswa.some(ks => 
        materiKelas.some(mk => mk.id === ks.id)
      );
      
      if (!hasAccess) {
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
      
      
      const siswa = users.find(u => u.id === siswaId);
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
      
      
      const kelasSiswa = getKelasForSiswa(siswaId);
      const materiKelas = getKelasForMateri(materiId);
      const hasAccess = kelasSiswa.some(ks => 
        materiKelas.some(mk => mk.id === ks.id)
      );
      
      if (!hasAccess) {
        return { success: false, error: "Anda tidak memiliki akses ke materi ini" };
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