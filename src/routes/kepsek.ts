import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { addGuruSchema, updateUserStatusSchema } from "../middleware/inputValidation";
import { hashPassword } from "../utils/hash";
import { users, kelas, materi, diskusi, diskusiMateri, tugas, submissions, Role } from "../db";

export const kepsekRoutes = new Elysia({ prefix: "/kepsek" })
  .use(authMiddleware)
  .derive(({ user }) => {
    if (!user || user.role !== "kepsek") {
      throw new Error("Unauthorized");
    }
    return { user };
  })
  .get("/dashboard/stats", async () => {
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
  .get("/guru", async () => {
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

    return {
      success: true,
      data: guruList
    };
  })
  .post("/guru", async ({ body }) => {
    const { nama, email, password, bidang } = addGuruSchema.parse(body);

    if (users.some(u => u.email === email)) {
      return { success: false, error: "Email sudah terdaftar" };
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
    return { 
      success: true, 
      message: "Guru berhasil ditambahkan", 
      data: newGuru 
    };
  })
  .patch("/guru/:id/status", async ({ params, body }) => {
    const { id } = params;
    const { status } = updateUserStatusSchema.parse(body);

    const user = users.find(u => u.id === parseInt(id) && u.role === "guru");
    if (!user) {
      return { success: false, error: "Guru tidak ditemukan" };
    }

    user.status = status;
    return { 
      success: true, 
      message: "Status guru berhasil diubah", 
      data: user 
    };
  })
  .delete("/guru/:id", async ({ params }) => {
    const { id } = params;
    const index = users.findIndex(u => u.id === parseInt(id) && u.role === "guru");
    
    if (index === -1) {
      return { success: false, error: "Guru tidak ditemukan" };
    }

    users.splice(index, 1);
    return { success: true, message: "Guru berhasil dihapus" };
  })
  .get("/siswa", async () => {
    const siswaList = users
      .filter(u => u.role === "siswa")
      .map(siswa => ({
        id: siswa.id,
        nama: siswa.nama,
        email: siswa.email,
        status: siswa.status,
        kelas_id: siswa.kelas_id,
        kelas_nama: kelas.find(k => k.id === siswa.kelas_id)?.nama || "Belum terdaftar",
        created_at: siswa.created_at
      }));

    return {
      success: true,
      data: siswaList
    };
  })
  .get("/siswa/:id/tugas", async ({ params }) => {
    const { id } = params;
    const siswaId = parseInt(id);

    const tugasSiswa = tugas.filter(t => t.siswa_id === siswaId);
    return {
      success: true,
      data: tugasSiswa.map(t => ({
        id: t.id,
        materi: materi.find(m => m.id === t.materi_id)?.judul || "Unknown",
        status: t.status,
        nilai: t.nilai,
        created_at: t.created_at
      }))
    };
  })
  .get("/materi", async () => {
    const materiList = materi.map(m => ({
      id: m.id,
      judul: m.judul,
      guru: users.find(u => u.id === m.guru_id)?.nama || "Unknown",
      created_at: m.created_at
    }));

    return {
      success: true,
      data: materiList
    };
  })
  .get("/diskusi", async () => {
    const diskusiList = diskusi.map(d => ({
      id: d.id,
      kelas: d.kelas,
      isi: d.isi,
      user: users.find(u => u.id === d.user_id)?.nama || "Unknown",
      role: d.user_role,
      created_at: d.created_at
    }));

    return {
      success: true,
      data: diskusiList
    };
  })
  .post("/diskusi", async ({ body }) => {
    const { kelas: kelasName, isi } = body as any;

    const newDiskusi = {
      id: diskusi.length > 0 ? Math.max(...diskusi.map(d => d.id)) + 1 : 1,
      kelas: kelasName,
      isi,
      user_id: 1,
      user_role: "kepsek" as Role,
      created_at: new Date()
    };

    diskusi.push(newDiskusi);
    return { 
      success: true, 
      message: "Diskusi berhasil ditambahkan", 
      data: newDiskusi 
    };
  })
  .get("/diskusi-materi/:id", async ({ params }) => {
    const { id } = params;
    const materiId = parseInt(id);

    const diskusiMateriList = diskusiMateri.filter(d => d.materi_id === materiId);
    return {
      success: true,
      data: diskusiMateriList.map(d => ({
        id: d.id,
        user: users.find(u => u.id === d.user_id)?.nama || "Unknown",
        role: d.user_role,
        isi: d.isi,
        created_at: d.created_at
      }))
    };
  });