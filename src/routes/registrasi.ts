import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { users, kelas, Role } from "../db";

export const registrasiRoutes = new Elysia()
  .use(authMiddleware)
  .derive(({ user }) => {
    if (!user || user.role !== "kepsek") {
      throw new Error("Unauthorized");
    }
    return { user };
  })
  .get("/registrasi/kelas", async () => {
    return kelas.map(k => ({
      ...k,
      wali_kelas_nama: users.find(u => u.id === k.wali_kelas_id)?.nama || "Unknown"
    }));
  })
  .post("/registrasi/kelas", async ({ body }) => {
    const { nama, tingkat, wali_kelas_id } = body;

    const waliKelas = users.find(u => u.id === parseInt(wali_kelas_id) && u.role === "guru");
    if (!waliKelas) {
      throw new Error("Wali kelas harus seorang guru");
    }

    const newKelas = {
      id: kelas.length > 0 ? Math.max(...kelas.map(k => k.id)) + 1 : 1,
      nama,
      tingkat,
      wali_kelas_id: parseInt(wali_kelas_id),
      created_at: new Date()
    };

    kelas.push(newKelas);
    return { message: "Kelas berhasil dibuat", kelas: newKelas };
  })
  .put("/registrasi/kelas/:id", async ({ params, body }) => {
    const { id } = params;
    const { nama, tingkat, wali_kelas_id } = body;

    const kelasIndex = kelas.findIndex(k => k.id === parseInt(id));
    if (kelasIndex === -1) {
      throw new Error("Kelas tidak ditemukan");
    }

    const waliKelas = users.find(u => u.id === parseInt(wali_kelas_id) && u.role === "guru");
    if (!waliKelas) {
      throw new Error("Wali kelas harus seorang guru");
    }

    kelas[kelasIndex] = {
      ...kelas[kelasIndex],
      nama,
      tingkat,
      wali_kelas_id: parseInt(wali_kelas_id)
    };

    return { message: "Kelas berhasil diupdate", kelas: kelas[kelasIndex] };
  })
  .delete("/registrasi/kelas/:id", async ({ params }) => {
    const { id } = params;

    const kelasIndex = kelas.findIndex(k => k.id === parseInt(id));
    if (kelasIndex === -1) {
      throw new Error("Kelas tidak ditemukan");
    }

    kelas.splice(kelasIndex, 1);
    return { message: "Kelas berhasil dihapus" };
  })
  .post("/registrasi/siswa/:id/kelas", async ({ params, body }) => {
    const { id } = params;
    const { kelas_id } = body;

    const siswa = users.find(u => u.id === parseInt(id) && u.role === "siswa");
    if (!siswa) {
      throw new Error("Siswa tidak ditemukan");
    }

    const kelasItem = kelas.find(k => k.id === parseInt(kelas_id));
    if (!kelasItem) {
      throw new Error("Kelas tidak ditemukan");
    }

    siswa.kelas_id = parseInt(kelas_id);

    return { message: "Siswa berhasil didaftarkan ke kelas", siswa, kelas: kelasItem };
  })
  .get("/registrasi/siswa/kelas/:id", async ({ params }) => {
    const { id } = params;
    const kelasId = parseInt(id);

    const siswaInKelas = users.filter(u => 
      u.role === "siswa" && u.kelas_id === kelasId
    );

    return {
      kelas: kelas.find(k => k.id === kelasId),
      siswa: siswaInKelas.map(s => ({
        id: s.id,
        nama: s.nama,
        email: s.email,
        status: s.status
      }))
    };
  });