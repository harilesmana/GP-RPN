import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { 
  users, kelas, materi, diskusi, tugas, 
  User, Kelas, Materi, Diskusi, Tugas 
} from "../db";
import { addGuruSchema, updateUserStatusSchema } from "../middleware/inputValidation";
import { hashPassword } from "../utils/hash";

export const kepsekRoutes = new Elysia({ prefix: "/kepsek" })
  .derive(authMiddleware as any)
  
  
  .onBeforeHandle(({ user, set }) => {
    if (!user || user.role !== "kepsek") {
      set.status = 403;
      return "Akses ditolak. Hanya kepala sekolah yang dapat mengakses endpoint ini.";
    }
  })


   .get("/info-dasar", () => {
    const jumlahGuru = users.filter(u => u.role === "guru").length;
    const jumlahSiswa = users.filter(u => u.role === "siswa").length;
    const jumlahKelas = kelas.length;
    const jumlahMateri = materi.length;

    return {
      jumlah_guru: jumlahGuru,
      jumlah_siswa: jumlahSiswa,
      jumlah_kelas: jumlahKelas,
      jumlah_materi: jumlahMateri
    };
  })

.get("/chat/online-users", () => {
  
  return {
    total_online: 0,
    users: []
  };
})
  .get("/guru/daftar", () => {
    const daftarGuru = users
      .filter(u => u.role === "guru")
      .map(guru => ({
        id: guru.id,
        nama: guru.nama,
        email: guru.email,
        bidang: guru.bidang || "-",
        status: guru.status,
        last_login: guru.last_login,
        login_count: guru.login_count
      }));

    return daftarGuru;
  })

  
  .post("/guru/tambah", async ({ body, set }) => {
    const parsed = addGuruSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Data tidak valid", details: parsed.error.issues };
    }

    const { nama, email, password } = parsed.data;
    const bidang = (body as any).bidang || "";

    
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      set.status = 400;
      return { error: "Email sudah terdaftar" };
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
      return { error: "Terjadi kesalahan server" };
    }
  })

  
  .patch("/guru/status/:id", async ({ params, body, set }) => {
    const parsed = updateUserStatusSchema.safeParse({ 
      id: params.id, 
      ...body 
    });
    
    if (!parsed.success) {
      set.status = 400;
      return { error: "Data tidak valid", details: parsed.error.issues };
    }

    const { id, status } = parsed.data;
    const guru = users.find(u => u.id === id && u.role === "guru");

    if (!guru) {
      set.status = 404;
      return { error: "Guru tidak ditemukan" };
    }

    guru.status = status;
    return { success: true, message: `Status guru berhasil diubah menjadi ${status}` };
  })

  
  .delete("/guru/hapus/:id", async ({ params, set }) => {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      set.status = 400;
      return { error: "ID tidak valid" };
    }

    const index = users.findIndex(u => u.id === id && u.role === "guru");
    if (index === -1) {
      set.status = 404;
      return { error: "Guru tidak ditemukan" };
    }

    
    users.splice(index, 1);
    return { success: true, message: "Guru berhasil dihapus" };
  })

  
  .get("/siswa/daftar", () => {
    const daftarSiswa = users
      .filter(u => u.role === "siswa")
      .map(siswa => {
        
        const kelasSiswa = kelas[siswa.id % kelas.length] || kelas[0];
        
        return {
          id: siswa.id,
          nama: siswa.nama,
          email: siswa.email,
          kelas: kelasSiswa?.nama || "Belum ditentukan",
          status: siswa.status,
          last_login: siswa.last_login
        };
      });

    return daftarSiswa;
  })

  
  .get("/siswa/tugas/:id", async ({ params, set }) => {
    const siswaId = parseInt(params.id);
    if (isNaN(siswaId)) {
      set.status = 400;
      return { error: "ID siswa tidak valid" };
    }

    const siswa = users.find(u => u.id === siswaId && u.role === "siswa");
    if (!siswa) {
      set.status = 404;
      return { error: "Siswa tidak ditemukan" };
    }

    const tugasSiswa = tugas
      .filter(t => t.siswa_id === siswaId)
      .map(t => {
        const materiItem = materi.find(m => m.id === t.materi_id);
        return {
          id: t.id,
          materi: materiItem?.judul || "Materi tidak ditemukan",
          status: t.status,
          nilai: t.nilai,
          hasil: t.hasil,
          updated_at: t.updated_at
        };
      });

    return tugasSiswa;
  })

  
  .get("/materi/daftar", () => {
    const daftarMateri = materi.map(m => {
      const guruPengampu = users.find(u => u.id === m.guru_id);
      const kelasMateri = kelas.find(k => k.id === m.kelas_id);
      
      return {
        id: m.id,
        judul: m.judul,
        deskripsi: m.deskripsi,
        guru: guruPengampu?.nama || "Tidak diketahui",
        kelas: kelasMateri?.nama || "Tidak diketahui",
        created_at: m.created_at
      };
    });

    return daftarMateri;
  })

  
  .get("/kelas/diskusi-materi/:id", async ({ params, set }) => {
    const materiId = parseInt(params.id);
    if (isNaN(materiId)) {
      set.status = 400;
      return { error: "ID materi tidak valid" };
    }

    const materiItem = materi.find(m => m.id === materiId);
    if (!materiItem) {
      set.status = 404;
      return { error: "Materi tidak ditemukan" };
    }

    
    
    const diskusiMateri = diskusi.slice(0, 5).map(d => {
      const user = users.find(u => u.id === d.user_id);
      return {
        id: d.id,
        user: user?.nama || "Anonim",
        role: d.user_role,
        isi: d.isi,
        created_at: d.created_at
      };
    });

    return diskusiMateri;
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

    return daftarDiskusi;
  })

  
  .post("/kelas/diskusi", async ({ body, user, set }) => {
    const { kelas, isi } = body as any;
    
    if (!kelas || !isi) {
      set.status = 400;
      return { error: "Kelas dan isi diskusi harus diisi" };
    }

    if (isi.length < 5) {
      set.status = 400;
      return { error: "Isi diskusi terlalu pendek" };
    }

    const newDiskusi: Diskusi = {
      id: diskusi.length + 1,
      kelas: kelas.trim(),
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
  });
