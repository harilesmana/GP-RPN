import { Elysia } from "elysia";
import { komentar, users, materi } from "../db";
import { authMiddleware } from "../middleware/auth";
import { komentarSchema, inputValidation } from "../middleware/inputValidation";

let lastKomentarId = komentar.length > 0 ? Math.max(...komentar.map(k => k.id)) : 0;

export const komentarRoutes = new Elysia()
  .use(inputValidation)
  .derive(authMiddleware as any)

  
  .get("/materi/:id/komentar", ({ params, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    
    const materiId = Number(params.id);
    if (isNaN(materiId)) {
      set.status = 400;
      return { error: "ID materi tidak valid" };
    }

    const komentarMateri = komentar.filter(k => k.materi_id === materiId);
    
    
    const komentarDenganUser = komentarMateri.map(k => {
      const userKomentar = users.find(u => u.id === k.user_id);
      return {
        ...k,
        user: userKomentar ? { id: userKomentar.id, nama: userKomentar.nama, role: userKomentar.role } : null
      };
    });
    
    return { data: komentarDenganUser };
  })

  
  .post("/materi/:id/komentar", async ({ params, sanitizedBody, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const materiId = Number(params.id);
    if (isNaN(materiId)) {
      set.status = 400;
      return { error: "ID materi tidak valid" };
    }

    const { isi } = sanitizedBody as { isi: string };
    
    
    try {
      komentarSchema.parse({ isi });
    } catch (error: any) {
      set.status = 400;
      return { error: error.errors[0].message };
    }
    
    
    const materiExists = materi.find(m => m.id === materiId);
    if (!materiExists) {
      set.status = 404;
      return { error: "Materi tidak ditemukan" };
    }

    const newKomentar = {
      id: ++lastKomentarId,
      materi_id: materiId,
      user_id: user.id,
      isi,
      created_at: new Date(),
    };

    komentar.push(newKomentar);
    
    
    const userData = users.find(u => u.id === user.id);
    const responseData = {
      ...newKomentar,
      user: userData ? { id: userData.id, nama: userData.nama, role: userData.role } : null
    };

    return { data: responseData, message: "Komentar berhasil ditambahkan" };
  })

  
  .delete("/komentar/:id", ({ params, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const komentarId = Number(params.id);
    if (isNaN(komentarId)) {
      set.status = 400;
      return { error: "ID komentar tidak valid" };
    }

    const komentarIndex = komentar.findIndex(k => k.id === komentarId);
    
    if (komentarIndex === -1) {
      set.status = 404;
      return { error: "Komentar tidak ditemukan" };
    }

    const komentarToDelete = komentar[komentarIndex];
    
    
    if (user.role === "siswa" && komentarToDelete.user_id !== user.id) {
      set.status = 403;
      return { error: "Forbidden: hanya pemilik komentar atau admin yang dapat menghapus" };
    }

    komentar.splice(komentarIndex, 1);
    return { message: "Komentar berhasil dihapus" };
  });
