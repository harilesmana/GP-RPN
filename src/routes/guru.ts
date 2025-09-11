import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { 
  getUsers, getKelasForGuru, getMateriForKelas, getKelasForMateri,
  getSiswaForKelas, getTugasForKelas, isMateriInKelas, getMateriById,
  query, getUserById, getTugas, getSubmissionForSiswa, getDiskusiMateri
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
    
    const semuaMateri = await query("SELECT * FROM materi WHERE guru_id = ?", [guruId]) as any[];
    const totalMateri = semuaMateri.length;
    
    const semuaTugas = await query("SELECT * FROM tugas WHERE guru_id = ?", [guruId]) as any[];
    const totalTugas = semuaTugas.length;
    
    const semuaSiswaTugas = await query("SELECT * FROM siswa_tugas") as any[];
    const semuaUsers = await getUsers();
    
    const tugasPerluDinilai = semuaTugas.filter(t => {
      return semuaUsers.filter(u => u.role === "siswa").map(siswa => {
        const submission = semuaSiswaTugas.find(st => 
          st.siswa_id === siswa.id && st.tugas_id === t.id
        );
        return submission && submission.status === 'dikerjakan' && (submission.nilai === undefined || submission.nilai === null);
      }).filter(Boolean);
    }).length;
    
    const semuaNilai = semuaUsers.filter(u => u.role === "siswa").flatMap(siswa => {
      return semuaTugas.map(t => {
        const submission = semuaSiswaTugas.find(st => 
          st.siswa_id === siswa.id && st.tugas_id === t.id
        );
        return submission?.nilai;
      }).filter(n => n !== undefined && n !== null) as number[];
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
        total_siswa: semuaUsers.filter(u => u.role === "siswa" && u.status === "active").length
      }
    };
  })

  .get("/dashboard/recent-activity", async ({ user }) => {
    const guruId = user.userId;
    
    const aktivitasMateri = (await query(
      "SELECT * FROM materi WHERE guru_id = ? ORDER BY created_at DESC LIMIT 5", 
      [guruId]
    ) as any[]).map(m => ({
      type: "materi",
      title: `Materi "${m.judul}" dibuat`,
      description: m.deskripsi || "Tidak ada deskripsi",
      created_at: m.created_at
    }));
    
    const aktivitasTugas = (await query(
      "SELECT * FROM tugas WHERE guru_id = ? ORDER BY created_at DESC LIMIT 5", 
      [guruId]
    ) as any[]).map(t => ({
      type: "tugas",
      title: `Tugas "${t.judul}" dibuat`,
      description: t.deskripsi || "Tidak ada deskripsi",
      created_at: t.created_at
    }));
    
    const semuaUsers = await getUsers();
    const semuaSiswaTugas = await query("SELECT * FROM siswa_tugas") as any[];
    
    const aktivitasNilai = semuaUsers.filter(u => u.role === "siswa").flatMap(siswa => {
      return (async () => {
        const semuaTugasGuru = await query("SELECT * FROM tugas WHERE guru_id = ?", [guruId]) as any[];
        
        return semuaTugasGuru.map(t => {
          const submission = semuaSiswaTugas.find(s => 
            s.siswa_id === siswa.id && s.tugas_id === t.id
          );
          if (submission && submission.nilai !== undefined && submission.nilai !== null && submission.graded_at) {
            return {
              type: "nilai",
              title: `Nilai diberikan untuk ${siswa.nama}`,
              description: `Nilai: ${submission.nilai}`,
              created_at: submission.graded_at
            };
          }
          return null;
        }).filter(Boolean);
      })();
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
    const materiGuru = await query("SELECT * FROM materi WHERE guru_id = ?", [guruId]) as any[];
    
    const materiWithKelas = await Promise.all(materiGuru.map(async (m) => {
      const kelasMateri = await getKelasForMateri(m.id);
      const kelasNames = kelasMateri.map(k => k.nama).join(", ");
      
      return {
        id: m.id,
        judul: m.judul || "Judul tidak tersedia",
        deskripsi: m.deskripsi || "Tidak ada deskripsi",
        kelas: kelasNames,
        created_at: m.created_at,
        updated_at: m.updated_at
      };
    }));
    
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
    
    try {
      const result = await query(
        "INSERT INTO materi (judul, deskripsi, konten, guru_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
        [judul.trim(), deskripsi?.trim() || "", konten.trim(), guruId]
      ) as any;
      
      const newMateriId = result.insertId;
      
      for (const kelasId of kelas_ids) {
        await query(
          "INSERT INTO materi_kelas (materi_id, kelas_id, created_at) VALUES (?, ?, NOW())",
          [newMateriId, kelasId]
        );
      }
      
      return {
        success: true,
        message: "Materi berhasil dibuat",
        data: {
          id: newMateriId,
          judul: judul.trim()
        }
      };
    } catch (error) {
      console.error("Error creating materi:", error);
      return { success: false, error: "Terjadi kesalahan saat membuat materi" };
    }
  })

  .put("/materi/:id", async ({ user, params, body }) => {
    const guruId = user.userId;
    const materiId = parseInt(params.id);
    
    if (isNaN(materiId)) {
      return { success: false, error: "ID materi tidak valid" };
    }
    
    const materiResult = await query("SELECT * FROM materi WHERE id = ? AND guru_id = ?", [materiId, guruId]) as any[];
    if (materiResult.length === 0) {
      return { success: false, error: "Materi tidak ditemukan" };
    }
    
    const { judul, konten, kelas_ids } = body as any;
    if (!judul || !konten) {
      return { success: false, error: "Judul dan konten materi harus diisi" };
    }
    
    try {
      await query(
        "UPDATE materi SET judul = ?, konten = ?, updated_at = NOW() WHERE id = ? AND guru_id = ?",
        [judul.trim(), konten.trim(), materiId, guruId]
      );
      
      if ((body as any).deskripsi) {
        await query(
          "UPDATE materi SET deskripsi = ? WHERE id = ? AND guru_id = ?",
          [(body as any).deskripsi.trim(), materiId, guruId]
        );
      }
      
      if (kelas_ids && Array.isArray(kelas_ids)) {
        await query("DELETE FROM materi_kelas WHERE materi_id = ?", [materiId]);
        
        for (const kelasId of kelas_ids) {
          await query(
            "INSERT INTO materi_kelas (materi_id, kelas_id, created_at) VALUES (?, ?, NOW())",
            [materiId, kelasId]
          );
        }
      }
      
      return {
        success: true,
        message: "Materi berhasil diupdate"
      };
    } catch (error) {
      console.error("Error updating materi:", error);
      return { success: false, error: "Terjadi kesalahan saat mengupdate materi" };
    }
  })

  .delete("/materi/:id", async ({ user, params }) => {
    const guruId = user.userId;
    const materiId = parseInt(params.id);
    
    if (isNaN(materiId)) {
      return { success: false, error: "ID materi tidak valid" };
    }
    
    const materiResult = await query("SELECT * FROM materi WHERE id = ? AND guru_id = ?", [materiId, guruId]) as any[];
    if (materiResult.length === 0) {
      return { success: false, error: "Materi tidak ditemukan" };
    }
    
    try {
      await query("DELETE FROM materi WHERE id = ? AND guru_id = ?", [materiId, guruId]);
      await query("DELETE FROM materi_kelas WHERE materi_id = ?", [materiId]);
      
      return {
        success: true,
        message: "Materi berhasil dihapus"
      };
    } catch (error) {
      console.error("Error deleting materi:", error);
      return { success: false, error: "Terjadi kesalahan saat menghapus materi" };
    }
  })

  .get("/tugas", async ({ user }) => {
    const guruId = user.userId;
    const tugasGuru = await query("SELECT * FROM tugas WHERE guru_id = ?", [guruId]) as any[];
    
    const tugasWithCounts = await Promise.all(tugasGuru.map(async (t) => {
      const submissionCountResult = await query(
        "SELECT COUNT(*) as count FROM siswa_tugas WHERE tugas_id = ?",
        [t.id]
      ) as any[];
      const submissionCount = submissionCountResult[0].count;
      
      const gradedCountResult = await query(
        "SELECT COUNT(*) as count FROM siswa_tugas WHERE tugas_id = ? AND nilai IS NOT NULL",
        [t.id]
      ) as any[];
      const gradedCount = gradedCountResult[0].count;
      
      const kelasMateri = await getKelasForMateri(t.materi_id);
      const kelasNames = kelasMateri.map(k => k.nama).join(", ");
      
      return {
        ...t,
        submissions_count: submissionCount,
        graded_count: gradedCount,
        kelas: kelasNames
      };
    }));
    
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
    
    const materiResult = await query("SELECT * FROM materi WHERE id = ? AND guru_id = ?", [parseInt(materi_id), guruId]) as any[];
    if (materiResult.length === 0) {
      return { success: false, error: "Materi tidak ditemukan atau tidak memiliki akses" };
    }
    
    try {
      const result = await query(
        "INSERT INTO tugas (judul, deskripsi, materi_id, guru_id, deadline, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
        [judul.trim(), deskripsi?.trim() || "", parseInt(materi_id), guruId, new Date(deadline)]
      ) as any;
      
      return {
        success: true,
        message: "Tugas berhasil dibuat",
        data: {
          id: result.insertId,
          judul: judul.trim()
        }
      };
    } catch (error) {
      console.error("Error creating tugas:", error);
      return { success: false, error: "Terjadi kesalahan saat membuat tugas" };
    }
  })

  .get("/tugas/:id/submissions", async ({ user, params }) => {
    const guruId = user.userId;
    const tugasId = parseInt(params.id);
    
    if (isNaN(tugasId)) {
      return { success: false, error: "ID tugas tidak valid" };
    }
    
    const tugasResult = await query("SELECT * FROM tugas WHERE id = ? AND guru_id = ?", [tugasId, guruId]) as any[];
    if (tugasResult.length === 0) {
      return { success: false, error: "Tugas tidak ditemukan" };
    }
    
    const tugasItem = tugasResult[0];
    const kelasMateri = await getKelasForMateri(tugasItem.materi_id);
    const semuaSiswaPromises = kelasMateri.map(k => getSiswaForKelas(k.id));
    const semuaSiswaArrays = await Promise.all(semuaSiswaPromises);
    const semuaSiswa = semuaSiswaArrays.flat();
    
    const tugasSubmissions = await Promise.all(semuaSiswa.map(async (siswa) => {
      const submissionResult = await query(
        "SELECT * FROM siswa_tugas WHERE siswa_id = ? AND tugas_id = ?",
        [siswa.id, tugasItem.id]
      ) as any[];
      
      const submission = submissionResult[0] || null;
      
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
    }));
    
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
    
    const tugasGuru = await query("SELECT * FROM tugas WHERE guru_id = ?", [guruId]) as any[];
    
    const pendingSubmissions = [];
    
    for (const t of tugasGuru) {
      const kelasMateri = await getKelasForMateri(t.materi_id);
      const semuaSiswaPromises = kelasMateri.map(k => getSiswaForKelas(k.id));
      const semuaSiswaArrays = await Promise.all(semuaSiswaPromises);
      const semuaSiswa = semuaSiswaArrays.flat();
      
      for (const siswa of semuaSiswa) {
        const submissionResult = await query(
          "SELECT * FROM siswa_tugas WHERE siswa_id = ? AND tugas_id = ?",
          [siswa.id, t.id]
        ) as any[];
        
        const submission = submissionResult[0];
        
        if (submission && submission.status === 'dikerjakan' && (submission.nilai === undefined || submission.nilai === null)) {
          pendingSubmissions.push({
            id: submission.id,
            tugas_id: t.id,
            tugas_judul: t.judul,
            siswa_id: siswa.id,
            siswa_nama: siswa.nama,
            jawaban: submission.jawaban,
            submitted_at: submission.submitted_at
          });
        }
      }
    }
    
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
    
    const submissionResult = await query("SELECT * FROM siswa_tugas WHERE id = ?", [submissionId]) as any[];
    if (submissionResult.length === 0) {
      return { success: false, error: "Submission tidak ditemukan" };
    }
    
    const submission = submissionResult[0];
    const tugasResult = await query("SELECT * FROM tugas WHERE id = ? AND guru_id = ?", [submission.tugas_id, guruId]) as any[];
    if (tugasResult.length === 0) {
      return { success: false, error: "Anda tidak memiliki akses untuk menilai submission ini" };
    }
    
    const { nilai, feedback } = body as any;
    if (nilai === undefined || nilai < 0 || nilai > 100) {
      return { success: false, error: "Nilai harus antara 0-100" };
    }
    
    try {
      await query(
        "UPDATE siswa_tugas SET nilai = ?, feedback = ?, graded_at = NOW(), status = 'selesai' WHERE id = ?",
        [parseInt(nilai), feedback?.trim() || "", submissionId]
      );
      
      return {
        success: true,
        message: "Nilai berhasil diberikan"
      };
    } catch (error) {
      console.error("Error grading submission:", error);
      return { success: false, error: "Terjadi kesalahan saat memberikan nilai" };
    }
  })

  .get("/siswa/progress", async ({ user }) => {
    const guruId = user.userId;
    
    const kelasGuru = await getKelasForGuru(guruId);
    const semuaSiswaPromises = kelasGuru.map(k => getSiswaForKelas(k.id));
    const semuaSiswaArrays = await Promise.all(semuaSiswaPromises);
    const semuaSiswa = semuaSiswaArrays.flat();
    
    const uniqueSiswa = [...new Map(semuaSiswa.map(s => [s.id, s])).values()];
    
    const siswaProgress = await Promise.all(uniqueSiswa.map(async (siswa) => {
      const semuaTugasGuru = await query("SELECT * FROM tugas WHERE guru_id = ?", [guruId]) as any[];
      
      const tugasDikerjakan = (await Promise.all(semuaTugasGuru.map(async (t) => {
        const submissionResult = await query(
          "SELECT * FROM siswa_tugas WHERE siswa_id = ? AND tugas_id = ?",
          [siswa.id, t.id]
        ) as any[];
        
        const submission = submissionResult[0];
        return submission && submission.status !== 'belum_dikerjakan';
      }))).filter(Boolean).length;
      
      const nilaiSiswa = (await Promise.all(semuaTugasGuru.map(async (t) => {
        const submissionResult = await query(
          "SELECT * FROM siswa_tugas WHERE siswa_id = ? AND tugas_id = ?",
          [siswa.id, t.id]
        ) as any[];
        
        const submission = submissionResult[0];
        return submission?.nilai;
      }))).filter(n => n !== undefined && n !== null) as number[];
      
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
    }));
    
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
    
    const users = await getUsers();
    const siswa = users.find(u => u.id === siswaId && u.role === "siswa" && u.status === "active");
    if (!siswa) {
      return { success: false, error: "Siswa tidak ditemukan" };
    }
    
    const tugasGuru = await query("SELECT * FROM tugas WHERE guru_id = ?", [guruId]) as any[];
    const submissionsSiswa = await query("SELECT * FROM siswa_tugas WHERE siswa_id = ?", [siswaId]) as any[];
    
    const totalTugas = tugasGuru.length;
    const tugasDikerjakan = submissionsSiswa.filter(s => 
      tugasGuru.some(t => t.id === s.tugas_id) && s.status !== 'belum_dikerjakan'
    ).length;
    const tugasDinilai = submissionsSiswa.filter(s => 
      tugasGuru.some(t => t.id === s.tugas_id) && s.nilai !== undefined && s.nilai !== null
    ).length;
    
    const nilaiSiswa = submissionsSiswa
      .filter(s => tugasGuru.some(t => t.id === s.tugas_id) && s.nilai !== undefined && s.nilai !== null)
      .map(s => s.nilai as number);
    
    const rataNilai = nilaiSiswa.length > 0 
      ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
      : 0;
    
    const progress = totalTugas > 0 
      ? Math.round((tugasDikerjakan / totalTugas) * 100)
      : 0;
    
    const detailTugas = await Promise.all(tugasGuru.map(async (tugasItem) => {
      const submissionResult = await query(
        "SELECT * FROM siswa_tugas WHERE siswa_id = ? AND tugas_id = ?",
        [siswaId, tugasItem.id]
      ) as any[];
      
      const submission = submissionResult[0];
      const materiItem = await getMateriById(tugasItem.materi_id);
      const kelasMateri = await getKelasForMateri(tugasItem.materi_id);
      
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
    }));
    
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
    
    const materiGuru = await query("SELECT * FROM materi WHERE guru_id = ?", [guruId]) as any[];
    const materiIds = materiGuru.map(m => m.id);
    
    if (materiIds.length === 0) {
      return { success: true, data: [] };
    }
    
    const placeholders = materiIds.map(() => '?').join(',');
    const diskusiGuru = await query(
      `SELECT * FROM diskusi_materi WHERE materi_id IN (${placeholders}) ORDER BY created_at DESC`,
      materiIds
    ) as any[];
    
    const users = await getUsers();
    const semuaMateri = await query("SELECT * FROM materi") as any[];
    
    const diskusiWithDetails = diskusiGuru.map(d => {
      const userDiskusi = users.find(u => u.id === d.user_id);
      const materiItem = semuaMateri.find(m => m.id === d.materi_id);
      const kelasMateri = materiItem ? getKelasForMateri(d.materi_id) : [];
      
      return {
        id: d.id,
        materi_id: d.materi_id,
        materi_judul: materiItem?.judul || "Materi tidak ditemukan",
        kelas: kelasMateri.then(km => km.map(k => k.nama).join(", ")),
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
      data: diskusiWithDetails
    };
  })

  .post("/diskusi/:id/reply", async ({ user, params, body }) => {
    const guruId = user.userId;
    const diskusiId = parseInt(params.id);
    
    if (isNaN(diskusiId)) {
      return { success: false, error: "ID diskusi tidak valid" };
    }
    
    const diskusiResult = await query("SELECT * FROM diskusi_materi WHERE id = ?", [diskusiId]) as any[];
    if (diskusiResult.length === 0) {
      return { success: false, error: "Diskusi tidak ditemukan" };
    }
    
    const diskusiAsli = diskusiResult[0];
    const materiResult = await query("SELECT * FROM materi WHERE id = ? AND guru_id = ?", [diskusiAsli.materi_id, guruId]) as any[];
    if (materiResult.length === 0) {
      return { success: false, error: "Anda tidak memiliki akses untuk membalas diskusi ini" };
    }
    
    const { reply } = body as any;
    if (!reply) {
      return { success: false, error: "Balasan tidak boleh kosong" };
    }
    
    try {
      const result = await query(
        "INSERT INTO diskusi_materi (materi_id, user_id, user_role, isi, parent_id, created_at) VALUES (?, ?, 'guru', ?, ?, NOW())",
        [diskusiAsli.materi_id, guruId, reply.trim(), diskusiId]
      ) as any;
      
      return {
        success: true,
        message: "Balasan berhasil dikirim",
        data: {
          id: result.insertId,
          materi_id: diskusiAsli.materi_id
        }
      };
    } catch (error) {
      console.error("Error replying to discussion:", error);
      return { success: false, error: "Terjadi kesalahan saat mengirim balasan" };
    }
  });