import { Elysia } from "elysia";
import { komentar, users, materi, KomentarWithUserAndReplies } from "../db";
import { authMiddleware } from "../middleware/auth";
import { komentarSchema, inputValidation } from "../middleware/inputValidation";

let lastKomentarId = komentar.length > 0 ? Math.max(...komentar.map(k => k.id)) : 0;


function buildKomentarTree(komentarList: any[]): KomentarWithUserAndReplies[] {
  const komentarMap = new Map<number, KomentarWithUserAndReplies>();
  const rootKomentar: KomentarWithUserAndReplies[] = [];

  
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
    const komentarTree = buildKomentarTree(komentarMateri);
    
    return { 
      data: komentarTree,
      total: komentarMateri.length
    };
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

    const { isi, parent_id } = sanitizedBody as { isi: string; parent_id?: number };

    
    try {
      komentarSchema.parse({ isi, parent_id });
    } catch (error: any) {
      set.status = 400;
      return { error: error.errors[0].message };
    }
    
    
    const materiExists = materi.find(m => m.id === materiId);
    if (!materiExists) {
      set.status = 404;
      return { error: "Materi tidak ditemukan" };
    }

    
    if (parent_id) {
      const parentKomentar = komentar.find(k => k.id === parent_id && k.materi_id === materiId);
      if (!parentKomentar) {
        set.status = 404;
        return { error: "Komentar parent tidak ditemukan" };
      }
    }

    const newKomentar = {
      id: ++lastKomentarId,
      materi_id: materiId,
      user_id: user.id,
      isi,
      parent_id: parent_id || null,
      created_at: new Date(),
    };

    komentar.push(newKomentar);
    
    
    const userData = users.find(u => u.id === user.id);
    const responseData = {
      ...newKomentar,
      user: userData ? { 
        id: userData.id, 
        nama: userData.nama, 
        role: userData.role 
      } : null,
      replies: []
    };

    return { 
      data: responseData, 
      message: parent_id ? "Balasan berhasil ditambahkan" : "Komentar berhasil ditambahkan" 
    };
  })

  
  .put("/komentar/:id", async ({ params, sanitizedBody, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const komentarId = Number(params.id);
    if (isNaN(komentarId)) {
      set.status = 400;
      return { error: "ID komentar tidak valid" };
    }

    const { isi } = sanitizedBody as { isi: string };

    
    try {
      komentarSchema.parse({ isi });
    } catch (error: any) {
      set.status = 400;
      return { error: error.errors[0].message };
    }

    const komentarIndex = komentar.findIndex(k => k.id === komentarId);
    if (komentarIndex === -1) {
      set.status = 404;
      return { error: "Komentar tidak ditemukan" };
    }

    const komentarToUpdate = komentar[komentarIndex];
    
    
    if (komentarToUpdate.user_id !== user.id) {
      set.status = 403;
      return { error: "Forbidden: hanya pemilik komentar yang dapat mengedit" };
    }

    
    komentarToUpdate.isi = isi;
    komentarToUpdate.updated_at = new Date();

    
    const userData = users.find(u => u.id === user.id);
    const responseData = {
      ...komentarToUpdate,
      user: userData ? { 
        id: userData.id, 
        nama: userData.nama, 
        role: userData.role 
      } : null
    };

    return { 
      data: responseData, 
      message: "Komentar berhasil diupdate" 
    };
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

    
    const replyIndexes: number[] = [];
    komentar.forEach((k, index) => {
      if (k.parent_id === komentarId) {
        replyIndexes.push(index);
      }
    });

    
    replyIndexes.reverse().forEach(index => {
      komentar.splice(index, 1);
    });

    komentar.splice(komentarIndex, 1);
    
    return { 
      message: "Komentar dan semua balasannya berhasil dihapus" 
    };
  })

  
  .get("/komentar/:id", ({ params, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const komentarId = Number(params.id);
    if (isNaN(komentarId)) {
      set.status = 400;
      return { error: "ID komentar tidak valid" };
    }

    const komentarDetail = komentar.find(k => k.id === komentarId);
    if (!komentarDetail) {
      set.status = 404;
      return { error: "Komentar tidak ditemukan" };
    }

    
    const replies = komentar.filter(k => k.parent_id === komentarId);
    
    
    const userKomentar = users.find(u => u.id === komentarDetail.user_id);
    const repliesWithUser = replies.map(k => {
      const userReply = users.find(u => u.id === k.user_id);
      return {
        ...k,
        user: userReply ? { 
          id: userReply.id, 
          nama: userReply.nama, 
          role: userReply.role 
        } : null
      };
    });

    const responseData = {
      ...komentarDetail,
      user: userKomentar ? { 
        id: userKomentar.id, 
        nama: userKomentar.nama, 
        role: userKomentar.role 
      } : null,
      replies: repliesWithUser
    };

    return { data: responseData };
  })

  
  .get("/user/komentar", ({ user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const userKomentar = komentar.filter(k => k.user_id === user.id);
    const komentarWithMateri = userKomentar.map(k => {
      const materiKomentar = materi.find(m => m.id === k.materi_id);
      return {
        ...k,
        materi: materiKomentar ? {
          id: materiKomentar.id,
          judul: materiKomentar.judul
        } : null
      };
    });

    return { 
      data: komentarWithMateri,
      total: userKomentar.length
    };
  })

  
  .get("/komentar/terbaru", ({ user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    
    const komentarTerbaru = [...komentar]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    const komentarWithDetails = komentarTerbaru.map(k => {
      const userKomentar = users.find(u => u.id === k.user_id);
      const materiKomentar = materi.find(m => m.id === k.materi_id);
      
      return {
        ...k,
        user: userKomentar ? {
          id: userKomentar.id,
          nama: userKomentar.nama,
          role: userKomentar.role
        } : null,
        materi: materiKomentar ? {
          id: materiKomentar.id,
          judul: materiKomentar.judul
        } : null
      };
    });

    return { data: komentarWithDetails };
  });
