import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { 
  users, kelas, materi, diskusi, tugas, diskusiMateri, 
  getKelasForGuru, getMateriForKelas, getKelasForMateri,
  getSiswaForKelas, getTugasForKelas, isMateriInKelas
} from "../db";

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
    const totalTugas = tugas.filter(t => t.guru_id === guruId).length;
    
    const tugasPerluDinilai = tugas.filter(t => 
      t.guru_id === guruId
    ).flatMap(t => {
      return users.filter(u => u.role === "siswa").map(siswa => {
        const submission = getSubmissionForSiswa(siswa.id, t.id);
        return submission && submission.status === 'dikerjakan' && submission.nilai === undefined;
      }).filter(Boolean);
    }).length;
    
    const semuaNilai = users.filter(u => u.role === "siswa").flatMap(siswa => {
      return tugas.filter(t => t.guru_id === guruId).map(t => {
        const submission = getSubmissionForSiswa(siswa.id, t.id);
        return submission?.nilai;
      }).filter(n => n !== undefined) as number[];
    });
    
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
    
    const aktivitasNilai = users.filter(u => u.role === "siswa").flatMap(siswa => {
      return tugas
        .filter(t => t.guru_id === guruId)
        .map(t => {
          const submission = getSubmissionForSiswa(siswa.id, t.id);
          if (submission && submission.nilai !== undefined && submission.graded_at) {
            return {
              type: "nilai",
              title: `Nilai diberikan untuk ${siswa.nama}`,
              description: `Nilai: ${submission.nilai}`,
              created_at: submission.graded_at
            };
          }
          return null;
        }).filter(Boolean);
    }).slice(-5);
    
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
    
    const materiWithKelas = materiGuru.map(m => {
      const kelasMateri = getKelasForMateri(m.id).map(k => k.nama).join(", ");
      
      return {
        id: m.id,
        judul: m.judul || "Judul tidak tersedia",
        deskripsi: m.deskripsi || "Tidak ada deskripsi",
        kelas: kelasMateri,
        created_at: m.created_at,
        updated_at: m.updated_at
      };
    });
    
    return {
      success: true,
      data: materiWithKelas
    };
  })

  .post("/materi", async ({ user, body }) => {
    const guruId = user.userId;
    const { judul, deskripsi, konten, kelas_ids } = body as any;
    
    if (!judul || !konten || !kelas_ids || !Array.isArray(kelas_ids) || kelas_ids.length === 0) {
      return { success: false, error: "Judul, konten, dan minimal satu kelas harus diisi" };
    }
    
    const newMateri = {
      id: materi.length + 1,
      judul: judul.trim(),
      deskripsi: deskripsi?.trim() || "",
      konten: konten.trim(),
      guru_id: guruId,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    materi.push(newMateri);
    
    
    kelas_ids.forEach((kelasId: number) => {
      materiKelas.push({
        id: materiKelas.length + 1,
        materi_id: newMateri.id,
        kelas_id: kelasId,
        created_at: new Date()
      });
    });
    
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
    
    const { judul, konten, kelas_ids } = body as any;
    if (!judul || !konten) {
      return { success: false, error: "Judul dan konten materi harus diisi" };
    }
    
    materi[materiIndex].judul = judul.trim();
    materi[materiIndex].konten = konten.trim();
    materi[materiIndex].updated_at = new Date();
    
    if ((body as any).deskripsi) {
      materi[materiIndex].deskripsi = (body as any).deskripsi.trim();
    }
    
    
    if (kelas_ids && Array.isArray(kelas_ids)) {
      
      const existingIndexes: number[] = [];
      materiKelas.forEach((mk, index) => {
        if (mk.materi_id === materiId) {
          existingIndexes.push(index);
        }
      });
      
      
      existingIndexes.reverse().forEach(index => {
        materiKelas.splice(index, 1);
      });
      
      
      kelas_ids.forEach((kelasId: number) => {
        materiKelas.push({
          id: materiKelas.length + 1,
          materi_id: materiId,
          kelas_id: kelasId,
          created_at: new Date()
        });
      });
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
    
    
    const mkIndexes: number[] = [];
    materiKelas.forEach((mk, index) => {
      if (mk.materi_id === materiId) {
        mkIndexes.push(index);
      }
    });
    
    
    mkIndexes.reverse().forEach(index => {
      materiKelas.splice(index, 1);
    });
    
    return {
      success: true,
      message: "Materi berhasil dihapus"
    };
  })

  .get("/tugas", async ({ user }) => {
    const guruId = user.userId;
    const tugasGuru = tugas.filter(t => t.guru_id === guruId);
    
    const tugasWithCounts = tugasGuru.map(t => {
      const submissionCount = getSubmissionForSiswa(0).filter(s => s.tugas_id === t.id).length;
      const gradedCount = getSubmissionForSiswa(0).filter(s => s.tugas_id === t.id && s.nilai !== undefined).length;
      
      const kelasMateri = getKelasForMateri(t.materi_id).map(k => k.nama).join(", ");
      
      return {
        ...t,
        submissions_count: submissionCount,
        graded_count: gradedCount,
        kelas: kelasMateri
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
      return { success: false, error: "Materi tidak ditemukan atau tidak memiliki akses" };
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
    
    const tugasItem = tugas.find(t => t.id === tugasId && t.guru_id === guruId);
    if (!tugasItem) {
      return { success: false, error: "Tugas tidak ditemukan" };
    }
    
    
    const kelasMateri = getKelasForMateri(tugasItem.materi_id);
    const semuaSiswa = kelasMateri.flatMap(k => getSiswaForKelas(k.id));
    
    const tugasSubmissions = semuaSiswa.map(siswa => {
      const submission = getSubmissionForSiswa(siswa.id, tugasItem.id);
      
      return {
        siswa_id: siswa.id,
        siswa_nama: siswa.nama,
        siswa_email: siswa.email,
        jawaban: submission?.jawaban,
        nilai: submission?.nilai,
        feedback: submission?.feedback,
        status: submission?.status || 'belum_dikerjakan',
        submitted_at: submission?.submitted_at,
        graded_at: submission?.graded_at
      };
    });
    
    return {
      success: true,
      data: {
        tugas: {
          id: tugasItem.id,
          judul: tugasItem.judul,
          deskripsi: tugasItem.deskripsi,
          deadline: tugasItem.deadline,
          kelas: kelasMateri.map(k => k.nama).join(", ")
        },
        submissions: tugasSubmissions
      }
    };
  })

  .get("/submissions/pending", async ({ user }) => {
    const guruId = user.userId;
    
    const pendingSubmissions = tugas
      .filter(t => t.guru_id === guruId)
      .flatMap(t => {
        const kelasMateri = getKelasForMateri(t.materi_id);
        const semuaSiswa = kelasMateri.flatMap(k => getSiswaForKelas(k.id));
        
        return semuaSiswa.map(siswa => {
          const submission = getSubmissionForSiswa(siswa.id, t.id);
          
          if (submission && submission.status === 'dikerjakan' && submission.nilai === undefined) {
            return {
              id: submission.id,
              tugas_id: t.id,
              tugas_judul: t.judul,
              siswa_id: siswa.id,
              siswa_nama: siswa.nama,
              jawaban: submission.jawaban,
              submitted_at: submission.submitted_at
            };
          }
          return null;
        }).filter(Boolean);
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
    
    const submission = getSubmissionForSiswa(0).find(s => s.id === submissionId);
    if (!submission) {
      return { success: false, error: "Submission tidak ditemukan" };
    }
    
    const tugasItem = tugas.find(t => t.id === submission.tugas_id);
    if (!tugasItem || tugasItem.guru_id !== guruId) {
      return { success: false, error: "Anda tidak memiliki akses untuk menilai submission ini" };
    }
    
    const { nilai, feedback } = body as any;
    if (nilai === undefined || nilai < 0 || nilai > 100) {
      return { success: false, error: "Nilai harus antara 0-100" };
    }
    
    
    const submissionIndex = siswaTugas.findIndex(st => st.id === submissionId);
    if (submissionIndex !== -1) {
      siswaTugas[submissionIndex].nilai = parseInt(nilai);
      siswaTugas[submissionIndex].feedback = feedback?.trim() || "";
      siswaTugas[submissionIndex].graded_at = new Date();
      siswaTugas[submissionIndex].status = 'selesai';
    }
    
    return {
      success: true,
      message: "Nilai berhasil diberikan"
    };
  })

  .get("/siswa/progress", async ({ user }) => {
    const guruId = user.userId;
    
    
    const kelasGuru = getKelasForGuru(guruId);
    
    
    const semuaSiswa = kelasGuru.flatMap(k => getSiswaForKelas(k.id));
    
    
    const uniqueSiswa = [...new Map(semuaSiswa.map(s => [s.id, s])).values()];
    
    const siswaProgress = uniqueSiswa.map(siswa => {
      
      const semuaTugasGuru = tugas.filter(t => t.guru_id === guruId);
      
      const tugasDikerjakan = semuaTugasGuru.filter(t => {
        const submission = getSubmissionForSiswa(siswa.id, t.id);
        return submission && submission.status !== 'belum_dikerjakan';
      }).length;
      
      const nilaiSiswa = semuaTugasGuru.map(t => {
        const submission = getSubmissionForSiswa(siswa.id, t.id);
        return submission?.nilai;
      }).filter(n => n !== undefined) as number[];
      
      const rataNilai = nilaiSiswa.length > 0 
        ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
        : 0;
      
      const progress = semuaTugasGuru.length > 0 
        ? Math.round((tugasDikerjakan / semuaTugasGuru.length) * 100)
        : 0;
      
      return {
        id: siswa.id,
        nama: siswa.nama,
        email: siswa.email,
        progress: Math.min(progress, 100),
        rata_nilai: rataNilai,
        tugas_dikerjakan: tugasDikerjakan,
        total_tugas: semuaTugasGuru.length
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
    
    
    const tugasGuru = tugas.filter(t => t.guru_id === guruId);
    
    const submissionsSiswa = getSubmissionForSiswa(siswaId).filter(s => 
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
    
    const detailTugas = tugasGuru.map(tugasItem => {
      const submission = submissionsSiswa.find(s => s.tugas_id === tugasItem.id);
      const materiItem = materi.find(m => m.id === tugasItem.materi_id);
      const kelasMateri = getKelasForMateri(tugasItem.materi_id);
      
      return {
        id: tugasItem.id,
        judul: tugasItem.judul,
        deskripsi: tugasItem.deskripsi,
        materi: materiItem?.judul || "Tidak diketahui",
        kelas: kelasMateri.map(k => k.nama).join(", "),
        deadline: tugasItem.deadline,
        status: submission ? submission.status : 'belum_dikerjakan',
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
        const kelasMateri = getKelasForMateri(d.materi_id);
        
        return {
          id: d.id,
          materi_id: d.materi_id,
          materi_judul: materiItem?.judul || "Materi tidak ditemukan",
          kelas: kelasMateri.map(k => k.nama).join(", "),
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