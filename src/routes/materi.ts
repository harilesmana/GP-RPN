import { Elysia } from "elysia";
import { materi, users, komentar } from "../db";
import { authMiddleware } from "../middleware/auth";
import { materiSchema, inputValidation } from "../middleware/inputValidation";

let lastMateriId = materi.length > 0 ? Math.max(...materi.map(m => m.id)) : 0;

export const materiRoutes = new Elysia()
  .use(inputValidation)
  .derive(authMiddleware as any)

  
  .get("/materi", ({ user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    
    const materiDenganUser = materi.map(m => {
      const userMateri = users.find(u => u.id === m.created_by);
      return {
        ...m,
        created_by_user: userMateri ? { id: userMateri.id, nama: userMateri.nama } : null
      };
    });
    
    return { data: materiDenganUser };
  })

  
  .get("/materi/:id", ({ params, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const materiId = Number(params.id);
    if (isNaN(materiId)) {
      set.status = 400;
      return { error: "ID materi tidak valid" };
    }

    const materiDetail = materi.find(m => m.id === materiId);
    
    if (!materiDetail) {
      set.status = 404;
      return { error: "Materi tidak ditemukan" };
    }
    
    
    const userMateri = users.find(u => u.id === materiDetail.created_by);
    
    
    const komentarMateri = komentar.filter(k => k.materi_id === materiId);
    
    
    const komentarDenganUser = komentarMateri.map(k => {
      const userKomentar = users.find(u => u.id === k.user_id);
      return {
        ...k,
        user: userKomentar ? { id: userKomentar.id, nama: userKomentar.nama, role: userKomentar.role } : null
      };
    });
    
    const responseData = {
      ...materiDetail,
      created_by_user: userMateri ? { id: userMateri.id, nama: userMateri.nama } : null,
      komentar: komentarDenganUser
    };

    return { data: responseData };
  })

  
  .post("/materi", async ({ sanitizedBody, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    
    
    if (user.role !== "kepsek" && user.role !== "guru") {
      set.status = 403;
      return { error: "Forbidden: hanya kepsek dan guru yang boleh membuat materi" };
    }

    const { judul, deskripsi } = sanitizedBody as { judul: string; deskripsi: string };

    
    try {
      materiSchema.parse({ judul, deskripsi });
    } catch (error: any) {
      set.status = 400;
      return { error: error.errors[0].message };
    }

    const newMateri = {
      id: ++lastMateriId,
      judul,
      deskripsi,
      created_by: user.id,
      created_at: new Date(),
    };

    materi.push(newMateri);

    return { data: newMateri, message: "Materi berhasil ditambahkan" };
  })

  
  .delete("/materi/:id", ({ params, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    
    if (user.role !== "kepsek" && user.role !== "guru") {
      set.status = 403;
      return { error: "Forbidden: hanya kepsek dan guru yang boleh menghapus materi" };
    }

    const materiId = Number(params.id);
    if (isNaN(materiId)) {
      set.status = 400;
      return { error: "ID materi tidak valid" };
    }

    const idx = materi.findIndex((m) => m.id === materiId);
    if (idx === -1) {
      set.status = 404;
      return { error: "Materi tidak ditemukan" };
    }

    
    const komentarIndexes: number[] = [];
    komentar.forEach((k, index) => {
      if (k.materi_id === materiId) {
        komentarIndexes.push(index);
      }
    });
    
    
    komentarIndexes.reverse().forEach(index => {
      komentar.splice(index, 1);
    });

    materi.splice(idx, 1);
    return { message: "Materi dan komentar terkait berhasil dihapus" };
  });
