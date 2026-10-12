/**
 * bedValidation.ts
 * Utilitas validasi untuk mencegah data Bed, Mesin, Alokasi Tempat Tidur,
 * serta baris Rekapitulasi / Perbandingan Harian (P : S) masuk atau didaftarkan
 * sebagai data perawat di sistem jadwal hemodialisa.
 */

/**
 * Mendeteksi apakah suatu string / identifier merupakan baris Rekapitulasi,
 * Statistik, atau Perbandingan Harian Shift (misalnya "Perbandingan Harian (P : S)").
 * Baris-baris ini adalah metadata tabel rekapitulasi, BUKAN personil perawat.
 */
export function isRecapOrSummaryIdentifier(raw: any): boolean {
  if (raw === undefined || raw === null) return false;
  const str = String(raw).trim();
  if (!str) return false;
  const lower = str.toLowerCase();

  // 1. Deteksi "Perbandingan Harian (P : S)" dan variasinya
  if (
    lower.includes('perbandingan') ||
    lower.includes('p : s') ||
    lower.includes('p:s') ||
    lower.includes('p / s') ||
    lower.includes('p/s') ||
    lower.includes('(p : s)') ||
    lower.includes('(p:s)') ||
    lower.includes('rasio') ||
    lower.includes('ratio')
  ) {
    return true;
  }

  // 2. Baris Rekapitulasi & Total
  if (
    lower.startsWith('rekap') ||
    lower === 'rekap' ||
    lower.startsWith('rekapitulasi') ||
    lower.includes('total shift') ||
    lower.includes('total dinas') ||
    lower.includes('total jam') ||
    lower.includes('grand total') ||
    lower.includes('jumlah shift') ||
    lower.includes('rata-rata') ||
    lower.includes('rata rata') ||
    lower.includes('average') ||
    lower.includes('ringkasan')
  ) {
    return true;
  }

  // 3. Kata tanda tangan / pimpinan di footer yang terbawa dari lembar cetak
  if (
    lower.startsWith('mengetahui') ||
    lower.startsWith('tanda tangan') ||
    lower === 'kepala ruangan' ||
    lower === 'kepala ruang' ||
    lower === 'direktur' ||
    lower === 'ttd'
  ) {
    return true;
  }

  // 4. ID buatan yang berasal dari perbandingan
  if (
    lower.includes('perbandingan') ||
    lower.includes('emp-rekap') ||
    lower.includes('emp-perbandingan')
  ) {
    return true;
  }

  return false;
}

/**
 * Mendeteksi apakah suatu string / identifier merupakan Bed, Mesin, atau Ruangan Hemodialisa,
 * bukan nama personil perawat atau dokter.
 * Contoh: "A01", "BED A01", "Bed A02", "Mesin A01", "ISO 01", "B05", "Bed 1", "Tempat Tidur 2", dll.
 */
export function isBedOrMachineIdentifier(raw: any): boolean {
  if (raw === undefined || raw === null) return false;
  const str = String(raw).trim();
  if (!str) return false;
  const lower = str.toLowerCase();

  // 1. Kata kunci eksplisit Bed, Mesin, Unit, Tempat Tidur
  if (
    lower.startsWith('bed') ||
    lower.startsWith('mesin') ||
    lower.startsWith('machine') ||
    lower.startsWith('mach-') ||
    lower.startsWith('tempat tidur') ||
    lower.startsWith('tt ') ||
    lower === 'tt' ||
    lower.startsWith('ruang bed') ||
    lower.startsWith('dialyzer')
  ) {
    return true;
  }

  // 2. Kode mesin fisik unit HD:
  // Area A (A01..A12), Area B (B01..B09), Area C (C01..C08), Area D (D01..D03), Area E (E01..E02), Area F (F01..F02)
  // Format: A01, A1, A-01, B05, C02, D-01, E02, F01, dsb.
  if (/^[a-f]\s*[-_]?\s*\d{1,3}$/i.test(lower)) {
    return true;
  }

  // 3. Kode Isolasi: ISO 01..ISO 04, ISO-01, ISOLASI, ISOLASI 1..4, dsb.
  if (/^(iso|isolasi)\s*[-_]?\s*\d{0,3}$/i.test(lower)) {
    return true;
  }

  // 4. Frasa gabungan: "Bed A01", "Bed-A01", "Mesin 01", "Bed A", "Bed 12", "TT 01"
  if (/^(bed|mesin|tt)\s*[-_]?\s*[a-z0-9_-]+/i.test(lower)) {
    return true;
  }

  // 5. Merk / Model alat mesin hemodialisa yang keliru dimasukkan sebagai nama perawat
  if (
    lower.includes('fresenius') ||
    lower.includes('surdial') ||
    lower.includes('nipro') ||
    lower.includes('toray') ||
    lower.includes('b.braun') ||
    lower.includes('bbraun') ||
    lower.includes('gambro') ||
    lower.includes('4008s') ||
    lower.includes('5008s')
  ) {
    return true;
  }

  return false;
}

/**
 * Validasi apakah akun perawat tidak valid, bodong, atau merupakan entitas Bed/Mesin/Rekap
 * yang keliru tersinkronisasi sebagai staf.
 */
export function isInvalidNurseAccount(emp: any): boolean {
  if (!emp) return true;
  const name = String(emp.name || '').trim();

  // Nama kosong atau simbol strip
  if (!name || name === '-' || name === '--' || name === '---' || name.replace(/[^a-zA-Z0-9]/g, '').length < 2) {
    return true;
  }

  const idStr = String(emp.id || '');
  let usernameStr = String(emp.username || '').trim();
  if (usernameStr.startsWith('@')) {
    usernameStr = usernameStr.substring(1);
  }
  const nipStr = String(emp.nip || '');

  // Tolak mutlak jika nama, username, id, atau NIP adalah Bed / Mesin
  if (
    isBedOrMachineIdentifier(name) ||
    isBedOrMachineIdentifier(usernameStr) ||
    isBedOrMachineIdentifier(idStr) ||
    isBedOrMachineIdentifier(nipStr)
  ) {
    return true;
  }

  // Tolak mutlak jika nama, username, id, atau NIP adalah Baris Rekapitulasi / Perbandingan Harian
  if (
    isRecapOrSummaryIdentifier(name) ||
    isRecapOrSummaryIdentifier(usernameStr) ||
    isRecapOrSummaryIdentifier(idStr) ||
    isRecapOrSummaryIdentifier(nipStr)
  ) {
    return true;
  }

  // ID legacy dummy blacklist
  if (idStr === 'emp-karu') return true;

  // Timestamp sampah yang pernah masuk saat sinkronisasi error
  if (idStr.includes('1790191588620') || idStr.includes('1790218743659')) return true;
  if (usernameStr.includes('1790191588620') || usernameStr.includes('1790218743659')) return true;
  if (nipStr.includes('1790191588620') || nipStr.includes('1790218743659')) return true;

  // Akun generik otomatis: nurse1790218743659
  if (/^nurse\d{10,}$/i.test(usernameStr) || /^nurse\d{10,}$/i.test(idStr)) {
    if (name === '-' || name === '--' || name.toLowerCase().startsWith('nurse') || name.replace(/[^a-zA-Z0-9]/g, '').length < 3) {
      return true;
    }
  }

  return false;
}

/**
 * Mengumpulkan seluruh ID akun karyawan perawat yang harus dihapus / dibersihkan
 * karena merupakan entitas Bed, Mesin, Rekapitulasi, atau akun dummy.
 */
export function getPurgedBedEmployeeIds(rawEmployees?: any[]): Set<string> {
  const purgedIds = new Set<string>();

  // 1. Tambahkan ID statis yang terdeteksi sebagai bed/mesin/dummy
  purgedIds.add('1790191588620');
  purgedIds.add('1790218743659');
  purgedIds.add('emp-karu');

  let empsToCheck: any[] = [];
  if (Array.isArray(rawEmployees) && rawEmployees.length > 0) {
    empsToCheck = rawEmployees;
  } else if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const data = localStorage.getItem('hd_shift_employees');
      if (data) {
        empsToCheck = JSON.parse(data);
      }
    } catch {
      // ignore
    }
  }

  if (Array.isArray(empsToCheck)) {
    for (const emp of empsToCheck) {
      if (emp && emp.id) {
        if (isInvalidNurseAccount(emp) || isRecapOrSummaryIdentifier(emp.name) || isRecapOrSummaryIdentifier(emp.id)) {
          purgedIds.add(String(emp.id));
        }
      }
    }
  }

  return purgedIds;
}
