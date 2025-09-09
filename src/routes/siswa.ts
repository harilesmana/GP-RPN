import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { users, kelas, materi, diskusi, tugas, diskusiMateri } from "../db";

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
      
      
      const tugasKelasSiswa = tugas.filter(t => {
        const materiItem = materi.find(m => m.id === t.materi_id);
        return materiItem && materiItem.kelas_id === kelasSiswa && !t.siswa_id;
      });
      
      const semuaTugas = tugasKelasSiswa.length;
      
      
      const tugasDikerjakan = tugas.filter(t => 
        t.siswa_id === siswaId && 
        tugasKelasSiswa.some(tk => tk.materi_id === t.materi_id && tk.judul === t.judul)
      ).length;
      
      
      const tugasSelesai = tugas.filter(t => 
        t.siswa_id === siswaId && 
        t.nilai !== undefined &&
        tugasKelasSiswa.some(tk => tk.materi_id === t.materi_id && tk.judul === t.judul)
      ).length;
      
      
      const nilaiSiswa = tugas
        .filter(t => t.siswa_id === siswaId && t.nilai !== undefined)
        .map(t => t.nilai as number);
      
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

  .get("/tugas", async ({ user }) => {
  try {
    const siswaId = user.userId;
    
    
    const semuaTugas = tugas.filter(t => {
      
      const materiItem = materi.find(m => m.id === t.materi_id);
      return materiItem && materiItem.kelas_id === (user.kelas_id || 1);
    });
    
    
    const tugasDenganStatus = semuaTugas.map(tugasItem => {
      const submission = siswaTugas.find(st => 
        st.siswa_id === siswaId && st.tugas_id === tugasItem.id
      );
      
      const materiItem = materi.find(m => m.id === tugasItem.materi_id);
      
      return {
        id: tugasItem.id,
        judul: tugasItem.judul,
        deskripsi: tugasItem.deskripsi,
        materi_judul: materiItem?.judul || "Tidak diketahui",
        deadline: tugasItem.deadline,
        status: submission?.status || 'belum_dikerjakan',
        nilai: submission?.nilai,
        feedback: submission?.feedback,
        jawaban: submission?.jawaban,
        submitted_at: submission?.submitted_at
      };
    });
    
    return {
      success: true,
      data: tugasDenganStatus
    };
    
  } catch (error) {
    console.error("Error loading tugas:", error);
    return { success: false, error: "Terjadi kesalahan saat memuat tugas" };
  }
})



  .get("/tugas-recent", async ({ user }) => {
    try {
      const siswaId = user.userId;
      
      
      const response = await fetch('/siswa/tugas', {
        method: 'GET',
        credentials: 'include'
      });
      
      let recentTugas = [];
      if (response.ok) {
        const result = await response.json();
        recentTugas = result.data || [];
      }
      
      return {
        success: true,
        data: recentTugas.slice(0, 3)
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
    
    
    const submissionIndex = siswaTugas.findIndex(st => 
      st.siswa_id === siswaId && st.tugas_id === tugasId
    );
    
    const { jawaban } = body as any;
    
    if (submissionIndex !== -1) {
      
      siswaTugas[submissionIndex].jawaban = jawaban;
      siswaTugas[submissionIndex].status = 'dikerjakan';
      siswaTugas[submissionIndex].submitted_at = new Date();
    } else {
      
      siswaTugas.push({
        id: siswaTugas.length + 1,
        siswa_id: siswaId,
        tugas_id: tugasId,
        jawaban: jawaban,
        status: 'dikerjakan',
        submitted_at: new Date()
      });
    }
    
    
    const tugasItem = tugas.find(t => t.id === tugasId);
    if (tugasItem) {
      const materiProgress = siswaMateri.find(sm => 
        sm.siswa_id === siswaId && sm.materi_id === tugasItem.materi_id
      );
      
      if (materiProgress) {
        materiProgress.last_accessed = new Date();
      } else {
        siswaMateri.push({
          id: siswaMateri.length + 1,
          siswa_id: siswaId,
          materi_id: tugasItem.materi_id,
          last_accessed: new Date(),
          is_completed: false
        });
      }
    }
    
    return {
      success: true,
      message: "Tugas berhasil dikumpulkan"
    };
    
  } catch (error) {
    console.error("Error submitting tugas:", error);
    return { success: false, error: "Terjadi kesalahan saat mengumpulkan tugas" };
  }
}) user, params, body }) => {
    try {
      const siswaId = user.userId;
      const tugasId = parseInt(params.id);
      
      if (isNaN(tugasId)) {
        return { success: false, error: "ID tugas tidak valid" };
      }
      
      
      const tugasItem = tugas.find(t => t.id === tugasId && !t.siswa_id);
      if (!tugasItem) {
        return { success: false, error: "Tugas tidak ditemukan" };
      }
      
      const { jawaban } = body as any;
      if (!jawaban || jawaban.trim().length === 0) {
        return { success: false, error: "Jawaban tidak boleh kosong" };
      }
      
      
      const existingSubmission = tugas.find(t => 
        t.siswa_id === siswaId && 
        t.materi_id === tugasItem.materi_id && 
        t.judul === tugasItem.judul
      );
      
      if (existingSubmission) {
        
        existingSubmission.jawaban = jawaban.trim();
        existingSubmission.submitted_at = new Date();
        existingSubmission.status = 'dikerjakan';
        existingSubmission.nilai = undefined;
        existingSubmission.feedback = undefined;
        existingSubmission.graded_at = undefined;
      } else {
        
        const newSubmission = {
          ...tugasItem,
          id: tugas.length + 1,
          siswa_id: siswaId,
          jawaban: jawaban.trim(),
          submitted_at: new Date(),
          status: 'dikerjakan'
        };
        tugas.push(newSubmission);
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
      
      const nilaiSiswa = tugas
        .filter(t => t.siswa_id === siswaId)
        .map(t => {
          const materiItem = materi.find(m => m.id === t.materi_id);
          
          return {
            id: t.id,
            tugas_id: t.id,
            tugas_judul: t.judul || "Tugas tidak ditemukan",
            materi_judul: materiItem?.judul || "Materi tidak ditemukan",
            nilai: t.nilai,
            feedback: t.feedback,
            submitted_at: t.submitted_at,
            graded_at: t.graded_at
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
      
      
      const tugasKelas = tugas.filter(t => {
        const materiItem = materi.find(m => m.id === t.materi_id);
        return materiItem && materiItem.kelas_id === kelasSiswa && !t.siswa_id;
      });
      
      
      const submissionsSiswa = tugas.filter(t => 
        t.siswa_id === siswaId && 
        tugasKelas.some(tk => tk.materi_id === t.materi_id && tk.judul === t.judul)
      );
      
      
      const materiDipelajari = new Set(
        submissionsSiswa.map(s => {
          return s.materi_id;
        })
      ).size;
      
      
      const nilaiSiswa = submissionsSiswa
        .filter(s => s.nilai !== undefined)
        .map(s => s.nilai as number);
      
      return {
        success: true,
        data: {
          total_materi: materiSiswa.length,
          materi_dipelajari: materiDipelajari,
          total_tugas: tugasKelas.length,
          tugas_selesai: submissionsSiswa.length,
          rata_nilai: nilaiSiswa.length > 0 
            ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
            : 0,
          progress_materi: materiSiswa.length > 0 
            ? Math.round((materiDipelajari / materiSiswa.length) * 100)
            : 0,
          progress_tugas: tugasKelas.length > 0 
            ? Math.round((submissionsSiswa.length / tugasKelas.length) * 100)
            : 0
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
  });