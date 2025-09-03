import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { authMiddleware } from '../middleware/auth';
import { securityHeaders } from '../middleware/security';
import * as ejs from 'ejs';
import { readFile } from 'fs/promises';
import path from 'path';

export const dashboardRoutes = new Elysia()
  .use(staticPlugin({
    assets: 'public',
    prefix: '/public'
  }))
  .use(authMiddleware)
  .use(securityHeaders)
  

  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.redirect = '/login';
      return;
    }
  })
  
  
  .get('/dashboard/:role', async ({ params, user, set }) => {
    if (user.role !== params.role) {
      set.status = 403;
      return "Akses ditolak";
    }

    try {
      const templatePath = path.join(process.cwd(), 'views', 'dashboard', `${params.role}.ejs`);
      const template = await readFile(templatePath, 'utf-8');
      
      let dashboardData = {};
      
      switch (params.role) {
        case 'kepsek':
          dashboardData = {
            title: 'Dashboard Kepala Sekolah',
            welcomeMessage: `Selamat datang, ${user.role}!`,
            menu: [
              { name: 'Manajemen Guru', url: '/manajemen/guru' },
              { name: 'Laporan Akademik', url: '/laporan/akademik' },
              { name: 'Pengaturan Sekolah', url: '/pengaturan/sekolah' }
            ]
          };
          break;
        case 'guru':
          dashboardData = {
            title: 'Dashboard Guru',
            welcomeMessage: `Selamat datang, ${user.role}!`,
            menu: [
              { name: 'Kelola Nilai', url: '/kelola/nilai' },
              { name: 'Jadwal Mengajar', url: '/jadwal/mengajar' },
              { name: 'Absensi Siswa', url: '/absensi/siswa' }
            ]
          };
          break;
        case 'siswa':
          dashboardData = {
            title: 'Dashboard Siswa',
            welcomeMessage: `Selamat datang, ${user.role}!`,
            menu: [
              { name: 'Lihat Nilai', url: '/lihat/nilai' },
              { name: 'Jadwal Pelajaran', url: '/jadwal/pelajaran' },
              { name: 'Tugas Sekolah', url: '/tugas/sekolah' }
            ]
          };
          break;
        default:
          set.status = 404;
          return "Halaman tidak ditemukan";
      }

      const html = ejs.render(template, { 
        ...dashboardData,
        user
      });
      
      set.headers['Content-Type'] = 'text/html';
      return html;
    } catch (error) {
      set.status = 500;
      return 'Error loading dashboard page';
    }
  });
