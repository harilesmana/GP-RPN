import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { 
  users, kelas, materi, diskusi, tugas, 
  tugasDetail, submissions, diskusiMateri,
  User, Kelas, Materi, TugasDetail, Submission, DiskusiMateri
} from "../db";

export const siswaRoutes = new Elysia({ prefix: "/siswa" })
  .derive(authMiddleware as any)
  
  .onBeforeHandle(({ user, set }) => {
    if (!user || !user.userId) {
      set.status = 401;
      return "Silakan login terlebih dahulu";
    }
    
    if (user.role !== "siswa") {
      set.status = 403;
      return "Akses ditolak. Hanya siswa yang dapat mengakses endpoint ini.";
    }
  })

  
  .get("/dashboard-stats", async ({ user }) => {
    const siswaId = user.userId;
    
    const semuaTugas = tugasDetail.length;
    const tugasDikerjakan = submissions.filter(s => s.siswa_id === siswaId).length;
    const tugasSelesai = submissions.filter(s => 
      s.siswa_id === siswaId && s.nilai !== undefined
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
        total_materi: materi.length,
        total_tugas: semuaTugas,
        tugas_selesai: tugasSelesai,
        tugas_pending: tugasDikerjakan - tugasSelesai,
        rata_nilai: rataNilai,
        overall_progress: progress
      }
    };
  })

  

    .get("/materi", async ({ user, set }) => {
      try {
        const siswaId = user.userId;
        const siswa = users.find(u => u.id === siswaId);
        
        if (!siswa) {
          set.status = 404;
          return { success: false, error: "Siswa tidak ditemukan" };
        }
        
        const kelasSiswa = siswa.kelas_id || 1;
        
        console.log(`Loading materi untuk siswa ${siswaId}, kelas ${kelasSiswa}`);
        console.log(`Total materi: ${materi.length}`);
        
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
        
        console.log(`Materi ditemukan: ${materiSiswa.length} items`);
        
        return {
          success: true,
          data: materiSiswa
        };
        
      } catch (error) {
        console.error("Error loading materi:", error);
        set.status = 500;
        return { success: false, error: "Terjadi kesalahan saat memuat materi" };
      }
    })
 // Detail materi
.get("/materi/:id", async ({ user, params, set }) => {
  try {
    const siswaId = user.userId;
    const materiId = parseInt(params.id);
    
    if (isNaN(materiId)) {
      set.status = 400;
      return { success: false, error: "ID materi tidak valid" };
    }
    
    const materiItem = materi.find(m => m.id === materiId);
    if (!materiItem) {
      set.status = 404;
      return { success: false, error: "Materi tidak ditemukan" };
    }
    
    // Cek apakah siswa boleh mengakses materi ini
    const siswa = users.find(u => u.id === siswaId);
    if (materiItem.kelas_id !== (siswa?.kelas_id || 1)) {
      set.status = 403;
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
    set.status = 500;
    return { success: false, error: "Terjadi kesalahan saat memuat detail materi" };
  }
})
  
  .get("/tugas", async ({ user }) => {
    const siswaId = user.userId;
    const siswa = users.find(u => u.id === siswaId);
    const kelasSiswa = siswa?.kelas_id || 1;
    
    const tugasSiswa = tugasDetail
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
  })

  
  .get("/tugas-recent", async ({ user }) => {
    const siswaId = user.userId;
    
    const tugasSiswa = await fetch(`/siswa/tugas`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'include'
    }).then(res => res.json());
    
    return {
      success: true,
      data: tugasSiswa.data.slice(0, 5) 
    };
  })

  
  .post("/tugas/:id/submit", async ({ user, params, body, set }) => {
    const siswaId = user.userId;
    const tugasId = parseInt(params.id);
    
    if (isNaN(tugasId)) {
      set.status = 400;
      return { error: "ID tugas tidak valid" };
    }
    
    const tugasItem = tugasDetail.find(t => t.id === tugasId);
    if (!tugasItem) {
      set.status = 404;
      return { error: "Tugas tidak ditemukan" };
    }
    
    const { jawaban } = body as any;
    if (!jawaban || jawaban.trim().length === 0) {
      set.status = 400;
      return { error: "Jawaban tidak boleh kosong" };
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
      
      const newSubmission: Submission = {
        id: submissions.length + 1,
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
  })

  
  .get("/nilai", async ({ user }) => {
    const siswaId = user.userId;
    
    const nilaiSiswa = submissions
      .filter(s => s.siswa_id === siswaId)
      .map(s => {
        const tugasItem = tugasDetail.find(t => t.id === s.tugas_id);
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
  })

  
  .get("/diskusi-kelas", async ({ user }) => {
    const siswa = users.find(u => u.id === user.userId);
    const kelasSiswa = kelas.find(k => k.id === siswa?.kelas_id);
    
    const diskusiKelasSiswa = diskusi
      .filter(d => d.kelas === (kelasSiswa?.nama || "Umum"))
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
  })

  
  .get("/diskusi-materi", async ({ user }) => {
    const siswa = users.find(u => u.id === user.userId);
    const kelasSiswa = siswa?.kelas_id || 1;
    
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
  })

  
  .post("/diskusi-materi", async ({ user, body, set }) => {
    const siswaId = user.userId;
    const { materi_id, isi } = body as any;
    
    if (!materi_id || !isi) {
      set.status = 400;
      return { error: "Materi dan isi diskusi harus diisi" };
    }
    
    if (isi.length < 5) {
      set.status = 400;
      return { error: "Isi diskusi terlalu pendek" };
    }
    
    const newDiskusi: DiskusiMateri = {
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
  })

  
  .get("/progress-detail", async ({ user }) => {
    const siswaId = user.userId;
    const siswa = users.find(u => u.id === siswaId);
    const kelasSiswa = siswa?.kelas_id || 1;
    
    const materiSiswa = materi.filter(m => m.kelas_id === kelasSiswa);
    const tugasSiswa = tugasDetail.filter(t => 
      materiSiswa.some(m => m.id === t.materi_id)
    );
    
    const submissionsSiswa = submissions.filter(s => 
      s.siswa_id === siswaId && 
      tugasSiswa.some(t => t.id === s.tugas_id)
    );
    
    const nilaiSiswa = submissionsSiswa
      .filter(s => s.nilai !== undefined)
      .map(s => s.nilai as number);
    
    return {
      success: true,
      data: {
        total_materi: materiSiswa.length,
        materi_dipelajari: new Set(submissionsSiswa.map(s => {
          const tugasItem = tugasDetail.find(t => t.id === s.tugas_id);
          return tugasItem?.materi_id;
        })).size,
        total_tugas: tugasSiswa.length,
        tugas_selesai: submissionsSiswa.length,
        rata_nilai: nilaiSiswa.length > 0 
          ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
          : 0,
        progress_materi: materiSiswa.length > 0 
          ? Math.round((new Set(submissionsSiswa.map(s => {
            const tugasItem = tugasDetail.find(t => t.id === s.tugas_id);
            return tugasItem?.materi_id;
          })).size / materiSiswa.length) * 100)
          : 0,
        progress_tugas: tugasSiswa.length > 0 
          ? Math.round((submissionsSiswa.length / tugasSiswa.length) * 100)
          : 0
      }
    };
  });