import { Elysia } from "elysia";
import { users } from "../db";
import { authMiddleware } from "../middleware/auth";
import { addGuruSchema, updateUserStatusSchema, sanitizeInput } from "../middleware/inputValidation";
import { hashPassword, validatePasswordStrength } from "../utils/hash";

let lastId = users.length;

export const adminRoutes = new Elysia()
  // .use(inputValidation)
  .derive(({ body }) => {

    if (body && typeof body === 'object') {
      const sanitizedBody: any = {};
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') {
          sanitizedBody[key] = sanitizeInput(value);
        } else {
          sanitizedBody[key] = value;
        }
      }
      return { sanitizedBody };
    }
    return { sanitizedBody: body };
  })
  .derive(authMiddleware as any)


  .get("/admin/users", ({ user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (user.role !== "kepsek") {
      set.status = 403;
      return { error: "Forbidden: hanya kepsek yang boleh mengakses" };
    }


    const usersWithoutPassword = users.map(u => ({
      id: u.id,
      nama: u.nama,
      email: u.email,
      role: u.role,
      status: u.status,
      created_by: u.created_by,
      created_at: u.created_at,
      last_login: u.last_login
    }));

    return { data: usersWithoutPassword };
  })


  .post("/admin/guru", async ({ sanitizedBody, user, set }: any) => {
    console.log('User details: ', user)
    console.log('Data: ', sanitizedBody)
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (user.role !== "kepsek") {
      set.status = 403;
      return { error: "Forbidden: hanya kepsek yang boleh menambah guru" };
    }

    const { nama, email, password } = sanitizedBody as { nama: string; email: string; password: string };


    try {
      addGuruSchema.parse({ nama, email, password });
    } catch (error: any) {
      set.status = 400;
      return { error: error.errors[0].message };
    }


    if (!validatePasswordStrength(password)) {
      set.status = 400;
      return { error: "Password harus mengandung huruf besar, huruf kecil, dan angka" };
    }


    if (users.find((u) => u.email === email)) {
      set.status = 400;
      return { error: "Email sudah terdaftar" };
    }

    const newGuru = {
      id: ++lastId,
      nama,
      email,
      password_hash: await hashPassword(password),
      role: "guru" as const,
      status: "active" as const,
      created_by: user.id,
      created_at: new Date()
    };

    users.push(newGuru);


    const { password_hash, ...guruWithoutPassword } = newGuru;

    return {
      data: guruWithoutPassword,
      message: "Guru berhasil ditambahkan"
    };
  })


  .patch("/admin/users/status", async ({ sanitizedBody, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (user.role !== "kepsek") {
      set.status = 403;
      return { error: "Forbidden: hanya kepsek yang boleh mengubah status user" };
    }

    const { user_id, status } = sanitizedBody as { user_id: number; status: 'active' | 'inactive' };


    try {
      updateUserStatusSchema.parse({ user_id, status });
    } catch (error: any) {
      set.status = 400;
      return { error: error.errors[0].message };
    }


    const userToUpdate = users.find(u => u.id === user_id);
    if (!userToUpdate) {
      set.status = 404;
      return { error: "User tidak ditemukan" };
    }


    if (userToUpdate.id === user.id) {
      set.status = 400;
      return { error: "Tidak dapat menonaktifkan akun sendiri" };
    }


    userToUpdate.status = status;

    return {
      message: `Status user berhasil diubah menjadi ${status}`,
      data: {
        id: userToUpdate.id,
        nama: userToUpdate.nama,
        email: userToUpdate.email,
        role: userToUpdate.role,
        status: userToUpdate.status
      }
    };
  })


  .get("/admin/dashboard", ({ user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (user.role !== "kepsek") {
      set.status = 403;
      return { error: "Forbidden: hanya kepsek yang boleh mengakses dashboard" };
    }

    const totalUsers = users.length;
    const totalGuru = users.filter(u => u.role === "guru").length;
    const totalSiswa = users.filter(u => u.role === "siswa").length;
    const activeUsers = users.filter(u => u.status === "active").length;
    const inactiveUsers = users.filter(u => u.status === "inactive").length;


    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const newUsers = users.filter(u =>
      new Date(u.created_at) > sevenDaysAgo
    ).length;

    return {
      data: {
        total_users: totalUsers,
        total_guru: totalGuru,
        total_siswa: totalSiswa,
        active_users: activeUsers,
        inactive_users: inactiveUsers,
        new_users_last_7_days: newUsers,
        users_by_role: {
          kepsek: users.filter(u => u.role === "kepsek").length,
          guru: totalGuru,
          siswa: totalSiswa
        }
      }
    };
  });
