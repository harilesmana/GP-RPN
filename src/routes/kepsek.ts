import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { 
  users, kelas, materi, diskusi, tugas, 
  User, Kelas, Materi, Diskusi, Tugas,
  getKelasForSiswa, getSiswaForKelas, getKelasForMateri,
  getMateriForKelas, getGuruForKelas, getKelasForGuru
} from "../db";
import { addGuruSchema, updateUserStatusSchema } from "../middleware/inputValidation";
import { hashPassword } from "../utils/hash";

export const kepsekRoutes = new Elysia({ prefix: "/kepsek" })
  .derive(authMiddleware as any)
  
  .onBeforeHandle(({ user, set }) => {
    if (!user || user.role !== "kepsek") {
      set.status = 403;
      return { success: false, error: "Akses ditolak. Hanya kepala sekolah yang dapat mengakses endpoint ini." };
    }
  })

  .get("/info-dasar", () => {
    const jumlahGuru = users.filter(u => u.role === "guru").length;
    const jumlahSiswa = users.filter(u => u.role === "siswa").length;
    const jumlahKelas = kelas.length;
    const jumlahMateri = materi.length;

    return {
      success: true,
      data: {
        jumlah_guru: jumlahGuru,
        jumlah_siswa: jumlahSiswa,
        jumlah_kelas: jumlahKelas,
        jumlah_materi: jumlahMateri
      }
    };
  })

  .get("/guru/daftar", () => {
    const daftarGuru = users
      .filter(u => u.role === "guru")
      .map(guru => {
        const kelasGuru = getKelasForGuru(guru.id).map(k => k.nama).join(", ");
        
        return {
          id: guru.id,
          nama: guru.nama,
          email: guru.email,
          bidang: guru.bidang || "-",
          kelas: kelasGuru || "Belum mengajar",
          status: guru.status,
          last_login: guru.last_login,
          login_count: guru.login_count
        };
      });

    return {
      success: true,
      data: daftarGuru
    };
  })

  .post("/guru/tambah", async ({ body, set }) => {
    const parsed = addGuruSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { success: false, error: "Data tidak valid", details: parsed.error.issues };
    }

    const { nama, email, password } = parsed.data;
    const bidang = (body as any).bidang || "";

    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      set.status = 400;
      return { success: false, error: "Email sudah terdaftar" };
    }

    try {
      const passwordHash = await hashPassword(password);
      const now = new Date();

      const newGuru: User = {
        id: users.length + 1,
        nama: nama.trim(),
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        role: "guru",
        status: "active",
        created_by: 1,
        created_at: now,
        last_login: now,
        login_count: 0,
        last_activity: now,
        bidang: bidang.trim() || undefined
      };

      users.push(newGuru);

      return { 
        success: true, 
        message: "Guru berhasil ditambahkan",
        data: {
          id: newGuru.id,
          nama: newGuru.nama,
          email: newGuru.email,
          bidang: newGuru.bidang
        }
      };
    } catch (error) {
      console.error("Error adding guru:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .patch("/guru/status/:id", async ({ params, body, set }) => {
    const parsed = updateUserStatusSchema.safeParse({ 
      id: params.id, 
      ...body 
    });
    
    if (!parsed.success) {
      set.status = 400;
      return { success: false, error: "Data tidak valid", details: parsed.error.issues };
    }

    const { id, status } = parsed.data;
    const guru = users.find(u => u.id === id && u.role === "guru");

    if (!guru) {
      set.status = 404;
      return { success: false, error: "Guru tidak ditemukan" };
    }

    guru.status = status;
    return { success: true, message: `Status guru berhasil diubah menjadi ${status}` };
  })

  .delete("/guru/hapus/:id", async ({ params, set }) => {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      set.status = 400;
      return { success: false, error: "ID tidak valid" };
    }

    const index = users.findIndex(u => u.id === id && u.role === "guru");
    if (index === -1) {
      set.status = 404;
      return { success: false, error: "Guru tidak ditemukan" };
    }

    users.splice(index, 1);
    return { success: true, message: "Guru berhasil dihapus" };
  })

  .get("/siswa/daftar", () => {
    const daftarSiswa = users
      .filter(u => u.role === "siswa")
      .map(siswa => {
        const kelasSiswa = getKelasForSiswa(siswa.id);
        const namaKelas = kelasSiswa.map(k => k.nama).join(", ") || "Belum ditentukan";
        
        return {
          id: siswa.id,
          nama: siswa.nama,
          email: siswa.email,
          kelas: namaKelas,
          status: siswa.status,
          last_login: siswa.last_login
        };
      });

    return {
      success: true,
      data: daftarSiswa
    };
  })

  .get("/siswa/tugas/:id", async ({ params, set }) => {
    const siswaId = parseInt(params.id);
    if (isNaN(siswaId)) {
      set.status = 400;
      return { success: false, error: "ID siswa tidak valid" };
    }

    const siswa = users.find(u => u.id === siswaId && u.role === "siswa");
    if (!siswa) {
      set.status = 404;
      return { success: false, error: "Siswa tidak ditemukan" };
    }

    const tugasSiswa = getSubmissionForSiswa(siswaId).map(submission => {
      const tugasItem = tugas.find(t => t.id === submission.tugas_id);
      const materiItem = materi.find(m => m.id === tugasItem?.materi_id);
      const kelasMateri = getKelasForMateri(tugasItem?.materi_id || 0);
      
      return {
        id: submission.id,
        tugas: tugasItem?.judul || "Tugas tidak ditemukan",
        materi: materiItem?.judul || "Materi tidak ditemukan",
        kelas: kelasMateri.map(k => k.nama).join(", "),
        status: submission.status,
        nilai: submission.nilai,
        feedback: submission.feedback,
        submitted_at: submission.submitted_at,
        graded_at: submission.graded_at
      };
    });

    return {
      success: true,
      data: tugasSiswa
    };
  })

  .get("/materi/daftar", () => {
    const daftarMateri = materi.map(m => {
      const guruPengampu = users.find(u => u.id === m.guru_id);
      const kelasMateri = getKelasForMateri(m.id);
      
      return {
        id: m.id,
        judul: m.judul,
        deskripsi: m.deskripsi,
        guru: guruPengampu?.nama || "Tidak diketahui",
        kelas: kelasMateri.map(k => k.nama).join(", ") || "Tidak diketahui",
        created_at: m.created_at
      };
    });

    return {
      success: true,
      data: daftarMateri
    };
  })

  .get("/kelas/diskusi-materi/:id", async ({ params, set }) => {
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

    const diskusiMateri = diskusiMateri
      .filter(d => d.materi_id === materiId)
      .map(d => {
        const user = users.find(u => u.id === d.user_id);
        return {
          id: d.id,
          user: user?.nama || "Anonim",
          role: d.user_role,
          isi: d.isi,
          created_at: d.created_at
        };
      });

    return {
      success: true,
      data: diskusiMateri
    };
  })

  .get("/kelas/diskusi", () => {
    const daftarDiskusi = diskusi.map(d => {
      const user = users.find(u => u.id === d.user_id);
      return {
        id: d.id,
        kelas: d.kelas,
        isi: d.isi.length > 100 ? d.isi.substring(0, 100) + "..." : d.isi,
        user: user?.nama || "Anonim",
        role: d.user_role,
        created_at: d.created_at
      };
    });

    return {
      success: true,
      data: daftarDiskusi
    };
  })

  .post("/kelas/diskusi", async ({ body, user, set }) => {
    const { kelas: namaKelas, isi } = body as any;
    
    if (!namaKelas || !isi) {
      set.status = 400;
      return { success: false, error: "Kelas dan isi diskusi harus diisi" };
    }

    if (isi.length < 5) {
      set.status = 400;
      return { success: false, error: "Isi diskusi terlalu pendek" };
    }

    const newDiskusi: Diskusi = {
      id: diskusi.length + 1,
      kelas: namaKelas.trim(),
      isi: isi.trim(),
      user_id: user.userId,
      user_role: user.role,
      created_at: new Date()
    };

    diskusi.push(newDiskusi);
    
    return { 
      success: true, 
      message: "Diskusi berhasil ditambahkan",
      data: {
        id: newDiskusi.id,
        kelas: newDiskusi.kelas,
        isi: newDiskusi.isi
      }
    };
  })

  .get("/kelas/:id/siswa", async ({ params, set }) => {
    const kelasId = parseInt(params.id);
    if (isNaN(kelasId)) {
      set.status = 400;
      return { success: false, error: "ID kelas tidak valid" };
    }

    const kelasItem = kelas.find(k => k.id === kelasId);
    if (!kelasItem) {
      set.status = 404;
      return { success: false, error: "Kelas tidak ditemukan" };
    }

    const siswaKelas = getSiswaForKelas(kelasId);
    const guruKelas = getGuruForKelas(kelasId);

    return {
      success: true,
      data: {
        kelas: kelasItem,
        siswa: siswaKelas,
        guru: guruKelas
      }
    };
  })

  .post("/kelas/:id/siswa/tambah", async ({ params, body, set }) => {
    const kelasId = parseInt(params.id);
    if (isNaN(kelasId)) {
      set.status = 400;
      return { success: false, error: "ID kelas tidak valid" };
    }

    const { siswa_id } = body as any;
    if (!siswa_id) {
      set.status = 400;
      return { success: false, error: "ID siswa harus diisi" };
    }

    const kelasItem = kelas.find(k => k.id === kelasId);
    if (!kelasItem) {
      set.status = 404;
      return { success: false, error: "Kelas tidak ditemukan" };
    }

    const siswa = users.find(u => u.id === parseInt(siswa_id) && u.role === "siswa");
    if (!siswa) {
      set.status = 404;
      return { success: false, error: "Siswa tidak ditemukan" };
    }

    
    const alreadyEnrolled = siswaKelas.some(sk => 
      sk.siswa_id === siswa.id && sk.kelas_id === kelasId
    );

    if (alreadyEnrolled) {
      set.status = 400;
      return { success: false, error: "Siswa sudah terdaftar di kelas ini" };
    }

    
    siswaKelas.push({
      id: siswaKelas.length + 1,
      siswa_id: siswa.id,
      kelas_id: kelasId,
      created_at: new Date()
    });

    return {
      success: true,
      message: "Siswa berhasil ditambahkan ke kelas"
    };
  })

  .delete("/kelas/:id/siswa/:siswaId", async ({ params, set }) => {
    const kelasId = parseInt(params.id);
    const siswaId = parseInt(params.siswaId);

    if (isNaN(kelasId) || isNaN(siswaId)) {
      set.status = 400;
      return { success: false, error: "ID tidak valid" };
    }

    const kelasItem = kelas.find(k => k.id === kelasId);
    if (!kelasItem) {
      set.status = 404;
      return { success: false, error: "Kelas tidak ditemukan" };
    }

    const siswa = users.find(u => u.id === siswaId && u.role === "siswa");
    if (!siswa) {
      set.status = 404;
      return { success: false, error: "Siswa tidak ditemukan" };
    }

    
    const index = siswaKelas.findIndex(sk => 
      sk.siswa_id === siswaId && sk.kelas_id === kelasId
    );

    if (index === -1) {
      set.status = 404;
      return { success: false, error: "Siswa tidak terdaftar di kelas ini" };
    }

    siswaKelas.splice(index, 1);

    return {
      success: true,
      message: "Siswa berhasil dihapus dari kelas"
    };
  });