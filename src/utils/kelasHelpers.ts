import { users, kelas, siswaKelas, materiKelas, getKelasForSiswa, getMateriForKelas } from "../db";

export function getSiswaWithKelas() {
  return users
    .filter(u => u.role === "siswa")
    .map(siswa => {
      const kelasSiswa = getKelasForSiswa(siswa.id);
      return {
        ...siswa,
        kelas: kelasSiswa
      };
    });
}

export function getMateriWithKelas() {
  return materi.map(m => {
    const kelasMateri = getKelasForMateri(m.id);
    return {
      ...m,
      kelas: kelasMateri
    };
  });
}

export function isSiswaInKelas(siswaId: number, kelasId: number): boolean {
  return siswaKelas.some(sk => sk.siswa_id === siswaId && sk.kelas_id === kelasId);
}

export function isMateriInKelas(materiId: number, kelasId: number): boolean {
  return materiKelas.some(mk => mk.materi_id === materiId && mk.kelas_id === kelasId);
}

export function getSiswaProgress(siswaId: number) {
  const kelasSiswa = getKelasForSiswa(siswaId);
  const semuaMateri = kelasSiswa.flatMap(k => getMateriForKelas(k.id));
  const semuaTugas = kelasSiswa.flatMap(k => getTugasForKelas(k.id));
  
  const materiProgress = getMateriProgressForSiswa(siswaId);
  const tugasProgress = getSubmissionForSiswa(siswaId);
  
  const materiDipelajari = materiProgress.filter(mp => mp.is_completed).length;
  const tugasDikerjakan = tugasProgress.filter(tp => tp.status !== 'belum_dikerjakan').length;
  const tugasSelesai = tugasProgress.filter(tp => tp.nilai !== undefined).length;
  
  const nilaiSiswa = tugasProgress
    .filter(tp => tp.nilai !== undefined)
    .map(tp => tp.nilai as number);
  
  const rataNilai = nilaiSiswa.length > 0 
    ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
    : 0;
  
  return {
    total_materi: semuaMateri.length,
    materi_dipelajari: materiDipelajari,
    total_tugas: semuaTugas.length,
    tugas_dikerjakan: tugasDikerjakan,
    tugas_selesai: tugasSelesai,
    rata_nilai: rataNilai,
    progress_materi: semuaMateri.length > 0 ? Math.round((materiDipelajari / semuaMateri.length) * 100) : 0,
    progress_tugas: semuaTugas.length > 0 ? Math.round((tugasDikerjakan / semuaTugas.length) * 100) : 0
  };
}