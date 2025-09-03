import { Elysia } from "elysia";
import { materi, users, komentar } from "../db";
import { authMiddleware } from "../middleware/auth";
import { materiSchema, inputValidation } from "../middleware/inputValidation";

let lastMateriId = materi.length > 0 ? Math.max(...materi.map(m => m.id)) : 0;


function buildKomentarTree(komentarList: any[]): any[] {
  const komentarMap = new Map<number, any>();
  const rootKomentar: any[] = [];

  
  komentarList.forEach(k => {
    const userKomentar = users.find(u => u.id === k.user_id);
    komentarMap.set(k.id, {
      ...k,
      user: userKomentar ? { 
        id: userKomentar.id, 
        nama: userKomentar.nama, 
        role: userKomentar.role 
      } : null,
      replies: []
    });
  });

  
  komentarList.forEach(k => {
    const komentarNode = komentarMap.get(k.id);
    if (komentarNode && k.parent_id) {
      const parent = komentarMap.get(k.parent_id);
      if (parent) {
        parent.replies.push(komentarNode);
      }
    } else if (komentarNode) {
      rootKomentar.push(komentarNode);
    }
  });

  
  rootKomentar.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  
  rootKomentar.forEach(k => {
    k.replies.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  return rootKomentar;
}

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
      const komentarMateri = komentar.filter(k => k.materi_id === m.id);
      
      return {
        ...m,
        created_by_user: userMateri ? { id: userMateri.id, nama: userMateri.nama } : null,
        total_komentar: komentarMateri.length
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
    const komentarTree = buildKomentarTree(komentarMateri);
    
    const responseData = {
      ...materiDetail,
      created_by_user: userMateri ? { id: userMateri.id, nama: userMateri.nama } : null,
      komentar: komentarTree,
      total_komentar: komentarMateri.length
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
  })

  
  .get("/materi/populer", ({ user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const materiDenganKomentar = materi.map(m => {
      const userMateri = users.find(u => u.id === m.created_by);
      const komentarMateri = komentar.filter(k => k.materi_id === m.id);
      
      return {
        ...m,
        created_by_user: userMateri ? { id: userMateri.id, nama: userMateri.nama } : null,
        total_komentar: komentarMateri.length
      };
    });

    
    materiDenganKomentar.sort((a, b) => b.total_komentar - a.total_komentar);

    return { 
      data: materiDenganKomentar.slice(0, 5), 
      total: materiDenganKomentar.length
    };
  });
