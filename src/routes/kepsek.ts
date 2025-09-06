import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { addGuruSchema, updateUserStatusSchema } from "../middleware/inputValidation";
import { hashPassword } from "../utils/hash";
import { users, kelas, materi, diskusi, Role } from "../db";

export const kepsekRoutes = new Elysia()
  .use(authMiddleware)
  .derive(({ user }) => {
    if (!user || user.role !== "kepsek") {
      throw new Error("Unauthorized");
    }
    return { user };
  })
  
  .get("/kepsek/info-dasar", async () => {
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
  
  .get("/kepsek/guru/daftar", async () => {
    const guruList = users
      .filter(u => u.role === "guru")
      .map(guru => ({
        id: guru.id,
        nama: guru.nama,
        email: guru.email,
        bidang: guru.bidang,
        status: guru.status,
        created_at: guru.created_at
      }));

    return guruList;
  })
  .post("/kepsek/guru/tambah", async ({ body }) => {
    const { nama, email, password, bidang } = addGuruSchema.parse(body);

    
    if (users.some(u => u.email === email)) {
      throw new Error("Email sudah terdaftar");
    }

    const passwordHash = await hashPassword(password);
    const newGuru = {
      id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      nama,
      email,
      password_hash: passwordHash,
      role: "guru" as Role,
      status: "active" as const,
      bidang,
      created_at: new Date(),
      created_by: 1 
    };

    users.push(newGuru);
    return { message: "Guru berhasil ditambahkan", guru: newGuru };
  })
  .patch("/kepsek/guru/status/:id", async ({ params, body }) => {
    const { id } = params;
    const { status } = updateUserStatusSchema.parse(body);

    const user = users.find(u => u.id === parseInt(id) && u.role === "guru");
    if (!user) {
      throw new Error("Guru tidak ditemukan");
    }

    user.status = status;
    return { message: "Status guru berhasil diubah", user };
  })
  .delete("/kepsek/guru/hapus/:id", async ({ params }) => {
    const { id } = params;
    const index = users.findIndex(u => u.id === parseInt(id) && u.role === "guru");
    
    if (index === -1) {
      throw new Error("Guru tidak ditemukan");
    }

    users.splice(index, 1);
    return { message: "Guru berhasil dihapus" };
  })
  
  .get("/kepsek/siswa/daftar", async () => {
    const siswaList = users
      .filter(u => u.role === "siswa")
      .map(siswa => ({
        id: siswa.id,
        nama: siswa.nama,
        email: siswa.email,
        status: siswa.status,
        created_at: siswa.created_at
      }));

    return siswaList;
  })
  .get("/kepsek/siswa/tugas/:id", async ({ params }) => {
    const { id } = params;
    const siswaId = parseInt(id);

    
    const tugasSiswa = tugas.filter(t => t.siswa_id === siswaId);
    return tugasSiswa.map(t => ({
      id: t.id,
      materi: materi.find(m => m.id === t.materi_id)?.judul || "Unknown",
      status: t.status,
      nilai: t.nilai,
      created_at: t.created_at
    }));
  })
  
  .get("/kepsek/materi/daftar", async () => {
    const materiList = materi.map(m => ({
      id: m.id,
      judul: m.judul,
      guru: users.find(u => u.id === m.guru_id)?.nama || "Unknown",
      created_at: m.created_at
    }));

    return materiList;
  })
  
  .get("/kepsek/kelas/diskusi", async () => {
    return diskusi;
  })
  .post("/kepsek/kelas/diskusi", async ({ body }) => {
    const { kelas: kelasName, isi } = body;

    const newDiskusi = {
      id: diskusi.length > 0 ? Math.max(...diskusi.map(d => d.id)) + 1 : 1,
      kelas: kelasName,
      isi,
      user_id: 1, 
      user_role: "kepsek" as Role,
      created_at: new Date()
    };

    diskusi.push(newDiskusi);
    return { message: "Diskusi berhasil ditambahkan", diskusi: newDiskusi };
  })
  .get("/kepsek/kelas/diskusi-materi/:id", async ({ params }) => {
    const { id } = params;
    const materiId = parseInt(id);

    const diskusiMateri = diskusiMateri.filter(d => d.materi_id === materiId);
    return diskusiMateri.map(d => ({
      id: d.id,
      user: users.find(u => u.id === d.user_id)?.nama || "Unknown",
      role: d.user_role,
      isi: d.isi,
      created_at: d.created_at
    }));
  });