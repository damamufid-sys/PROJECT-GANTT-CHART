# PROGRESS — Aplikasi Manajemen Proyek Gantt Chart

Dokumen ini dirawat sesuai Bagian 0 dan Bagian 13 blueprint.
Jika sesi terputus, lanjutkan dari item pertama yang belum dicentang.

## Status fase

- [x] **Fase 0 — Fondasi**: monorepo npm workspaces (`shared`, `server`, `client`), tsconfig,
      Vite + React + Tailwind, Express dengan `/api/health`, skrip root, `.gitignore`,
      `.env.example`, `PROGRESS.md`.
  - Gerbang: `npm install` dan `npm run typecheck` sukses. ✅
- [x] **Fase 1 — Mesin inti (`shared`)**: 6.1–6.10 + skema zod + unit test seluruh vektor 6.11.
  - Gerbang: `npm test -w shared` lolos (32 test). ✅
- [x] **Fase 2 — Backend**: skema Prisma + migrasi `init`, auth, rute Bagian 7, `recompute`,
      `snapshot`, middleware error/validasi, cek kepemilikan, seed, test integrasi Supertest.
  - Gerbang: typecheck + test server lolos (51 test), `npm run db:seed` berhasil. ✅
- [x] **Fase 3 — Frontend**: Bagian 8 lengkap + test komponen dan halaman (20 test).
  - Gerbang: typecheck, test, dan build client lolos. ✅
- [x] **Fase 4 — Integrasi dan verifikasi**: keempat perintah verifikasi lolos, `npm run dev`
      berjalan, `http://localhost:3001/api/health` dan `http://localhost:5173` merespons,
      verifikasi lewat API untuk seluruh item checklist. ✅
- [x] **Fase 5 — Rapikan sebelum push**: `.gitignore` mengecualikan `node_modules`, `dist`, `.env`,
      `*.db`, `coverage`; README lengkap; pemindaian rahasia bersih. ✅
- [ ] **Fase 6 — Push ke GitHub**: menunggu URL repository dari manusia.

## Acceptance checklist (Bagian 12)

### Tugas

- [x] Tambah, ubah, dan hapus tugas berhasil
- [x] Durasi, tanggal mulai, prioritas, dan warna tersimpan
- [x] Sub-tugas (parent-child) bisa dibuat, dan induk menghitung rentang serta progres otomatis

### Dependensi dan Gantt

- [x] Predecessor FS dan SS dengan lag mengubah posisi bar sesuai 6.4 dan vektor uji 6.11
- [x] Bar Gantt tampil, ada panah dependensi (FS dan SS), dan bar bisa di-drag serta di-resize
- [x] Dependensi yang membentuk siklus ditolak dengan pesan jelas (kode `CYCLE_DETECTED`, 422)

### Resource

- [x] Tambah anggota tim (nama, email, peran, gaji) dan alokasikan ke tugas
- [x] Biaya dan peringatan over-alokasi muncul benar

### Kalender

- [x] Ubah akhir pekan dan tambah hari libur, lalu jadwal bergeser otomatis
- [x] Durasi tidak menghitung akhir pekan dan hari libur

### Analisis

- [x] Halaman Analisis menampilkan Critical Path dan diagram PERT, node kritis berwarna merah

### Persistensi dan akun

- [x] Data tidak hilang saat halaman di-refresh (data berasal dari database SQLite)
- [x] Register, login, dan logout berfungsi, dan pengguna A tidak bisa melihat data pengguna B

### Repository

- [x] Ada folder `src` di tiap workspace, `package.json`, dan `README.md`
- [x] `node_modules`, `.env`, dan file database tidak ikut ter-commit (diverifikasi `git check-ignore`)
- [x] `npm run typecheck`, `npm test`, dan `npm run build` lolos tanpa error

## Log verifikasi

| Tanggal | Perintah | Hasil |
| --- | --- | --- |
| 2026-10-14 | `npm install` | sukses (426 paket) |
| 2026-10-14 | `npm run typecheck` | sukses — shared, server, client |
| 2026-10-14 | `npm test` | 103 test lolos (shared 32, server 51, client 20) |
| 2026-10-14 | `npm run build` | sukses — shared (`dist`), server (`dist`), client (`client/dist`) |
| 2026-10-14 | `npm run db:seed` | sukses dan idempoten (17 tugas, 13 dependensi, 13 alokasi) |
| 2026-10-14 | `npm run dev` | server 3001 + client 5173 merespons; `/api/health` OK |
| 2026-10-14 | Verifikasi lewat REST API (akun demo) | CPM: 9 tugas kritis, `Skenario uji` float 23, total 42 hari kerja, biaya Rp 31.863.636, 6 peringatan over-alokasi |

## Catatan verifikasi lewat API (data seed)

- `Kickoff dan kebutuhan` 2026-10-19 → 2026-10-21 (3 hari kerja).
- `Skenario uji` 2026-11-10 → 2026-11-13: hari libur 2026-11-11 dilewati, membuktikan kalender
  memengaruhi durasi.
- `Implementasi backend` memiliki estimasi PERT te = 10,5 dan variansi 1,3611.
- Tugas `Skenario uji` non-kritis (float 23) sehingga efek jalur kritis terlihat.
