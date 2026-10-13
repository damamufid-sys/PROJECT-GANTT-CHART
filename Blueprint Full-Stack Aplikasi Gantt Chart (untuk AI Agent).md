# Blueprint Full-Stack: Aplikasi Manajemen Proyek Gantt Chart

*Dokumen khusus untuk dibaca AI Agent · Versi 1.0 · Bahasa antarmuka aplikasi: Indonesia*

## 0. Cara membaca dokumen ini

Dokumen ini adalah satu-satunya sumber kebenaran. Kamu (AI Agent) membangun aplikasi lengkap dari nol di folder kerja saat ini. Anggap Node.js, npm, dan Git sudah terpasang, dan repository GitHub kosong sudah disiapkan manusia.

Aturan kerja:

1. Kerjakan Fase 0 sampai Fase 6 (Bagian 10) berurutan. Setiap fase punya gerbang (gate). Jangan lanjut sebelum gate lolos.
2. Buat dan rawat `PROGRESS.md` berisi checklist fase dan acceptance (Bagian 12). Centang setiap selesai satu langkah. Jika sesi terputus dan manusia berkata 'Lanjutkan pekerjaan sebelumnya', baca `PROGRESS.md` lalu lanjutkan dari item pertama yang belum dicentang.
3. Jangan menambah fitur di luar dokumen ini. Jika ada hal ambigu, pilih opsi paling sederhana dan catat di README bagian 'Asumsi'.
4. Jangan menyatakan sesuatu selesai sebelum perintah verifikasinya benar-benar dijalankan dan hasilnya lolos.
5. Jangan menaruh rahasia, token, file `.env`, atau file database di repository.
6. Jalankan perintah secara wajar di dalam folder proyek. Jangan melakukan perintah destruktif di luar folder proyek.
7. Kirim prompt atau pekerjaan secara bertahap per fase, bukan semuanya sekaligus.

## 1. Tujuan dan ruang lingkup

Aplikasi web manajemen proyek berbasis Gantt Chart, multi-pengguna, dengan data tersimpan di database melalui REST API (bukan localStorage).

Lima kemampuan wajib:

1. **Task Management**: tambah, ubah, hapus tugas; durasi hari kerja; tanggal mulai; prioritas Low/Medium/High; warna indikator; sub-tugas (parent-child).
2. **Predecessor dan Timeline**: hubungan Finish-to-Start (FS) dan Start-to-Start (SS) dengan jeda hari (lag); grafik Gantt (bar, panah dependensi, drag dan resize).
3. **Resource Management**: anggota tim (nama, email, peran, gaji) dan alokasi anggota ke tugas.
4. **Kalender Proyek**: pengaturan akhir pekan dan hari libur khusus; durasi hanya menghitung hari kerja.
5. **Analisis Proyek**: Critical Path dan diagram PERT.

Di luar cakupan: kolaborasi real-time, ekspor PDF, notifikasi email, multi-bahasa, deployment cloud.

## 2. Tech stack (tetap, jangan diganti)

| Lapisan | Teknologi |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, react-hook-form, zod |
| Backend | Node.js, Express, TypeScript (tsx untuk dev), zod, jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit |
| Database | SQLite dengan Prisma ORM (file `server/prisma/dev.db`, masuk `.gitignore`) |
| Logika inti | Paket `shared` (TypeScript murni, dipakai server dan client) |
| Gantt dan PERT | Digambar sendiri dengan SVG, tanpa library Gantt eksternal |
| Test | Vitest, Supertest, Testing Library |
| Tooling | npm workspaces, concurrently |

Alasan paket `shared`: mesin penjadwalan harus identik di server (sumber kebenaran, disimpan ke DB) dan di client (pratinjau saat drag).

## 3. Struktur repository

```
gantt-project-app/
├─ package.json          (npm workspaces: shared, server, client)
├─ tsconfig.base.json
├─ .gitignore  .env.example  README.md  PROGRESS.md
├─ shared/src/
│   dates.ts calendar.ts scheduler.ts cpm.ts pert.ts cost.ts
│   schemas.ts types.ts index.ts  + *.test.ts
├─ server/
│   ├─ prisma/  schema.prisma  seed.ts  migrations/
│   └─ src/  index.ts app.ts config.ts db.ts
│       middleware/  auth.ts error.ts validate.ts
│       routes/      auth projects tasks dependencies resources
│                    assignments calendar analysis
│       services/    recompute.ts snapshot.ts
│       tests/
└─ client/
    ├─ index.html  vite.config.ts  (proxy /api ke server)
    └─ src/  main.tsx App.tsx
        api/  hooks/  lib/  styles/
        pages/       Login Register Projects Gantt Team Calendar Analysis
        components/  gantt/ pert/ tasks/ team/ calendar/ ui/
```

## 4. Konfigurasi dan skrip

- Port: server `3001`, client `5173`. Vite mem-proxy `/api` ke `http://localhost:3001`.
- `.env.example` (di-commit): `DATABASE_URL=file:./dev.db`, `JWT_SECRET=ganti-dengan-string-acak`, `PORT=3001`.
- Buat `.env` lokal dengan JWT\_SECRET acak untuk menjalankan aplikasi. File `.env` tidak boleh di-commit. Server wajib gagal start dengan pesan jelas jika `JWT_SECRET` kosong.
- Skrip di root `package.json`:
  - `dev`: jalankan server dan client bersamaan
  - `build`: build shared, server, client
  - `typecheck`: `tsc --noEmit` di semua workspace
  - `test`: Vitest di semua workspace
  - `db:migrate`, `db:seed`, `db:reset`
- Perintah `npm install` di root harus cukup untuk memasang semua dependensi.

## 5. Model data

Semua `id` berupa string cuid. Tanggal disimpan sebagai string ISO `YYYY-MM-DD`. Kolom enum memakai String dan divalidasi lewat zod.

- **User**: id, name, email (unik), passwordHash, createdAt
- **Project**: id, ownerId, name, description?, startDate, weekendDays (String, daftar angka dipisah koma, 0=Minggu sampai 6=Sabtu, default `0,6`), createdAt
- **Holiday**: id, projectId, date, name. Unik pada (projectId, date).
- **Task**: id, projectId, parentId?, position (Int, urutan antar saudara), name, description?, durationDays (Int ≥ 1), startDate (tanggal mulai paling awal), scheduledStart, scheduledEnd (hasil hitung mesin), priority (LOW, MEDIUM, HIGH), color (hex), progress (0 sampai 100), optimisticDays?, pessimisticDays?
- **Dependency**: id, predecessorId, successorId, type (FS atau SS), lagDays (Int, boleh negatif, rentang -365 sampai 365). Unik pada (predecessorId, successorId).
- **Resource**: id, projectId, name, email, role, salary (Int, rupiah per bulan)
- **Assignment**: id, taskId, resourceId, allocationPercent (Int 1 sampai 100, default 100). Unik pada (taskId, resourceId).

Relasi: hapus Project menghapus semua turunannya (cascade). Hapus Task menghapus anak, dependensi, dan assignment terkait. Hapus Resource menghapus assignment-nya.

## 6. Aturan bisnis dan algoritma (paket `shared`)

Semua fungsi di bagian ini adalah fungsi murni dan wajib punya unit test.

### 6.1 Tanggal

Tanggal diproses sebagai tanggal UTC murni, tanpa zona waktu lokal, agar tidak ada pergeseran satu hari.

### 6.2 Kalender

- `weekendDays: number[]` (default `[0,6]`) dan `holidays: Set<string>`.
- `isWorkingDay(d)`, `nextWorkingDay(d)` (d sendiri jika hari kerja, jika tidak maju ke hari kerja berikutnya), `shiftWorkingDays(d, n)` (n boleh negatif; d harus hari kerja), `workingDaysBetween(a, b)` (inklusif).
- Validasi: weekendDays tidak boleh berisi ketujuh hari.

### 6.3 Durasi

`durationDays` adalah bilangan bulat hari kerja (≥ 1). `scheduledEnd = shiftWorkingDays(scheduledStart, durationDays - 1)`. Bar tetap digambar menurut tanggal kalender, sehingga bar melintasi akhir pekan dan hari libur.

### 6.4 Dependensi

Lag dihitung dalam hari kerja. Batas mulai tugas penerus (successor):

- **FS**: `shiftWorkingDays(pred.scheduledEnd, 1 + lag)`
- **SS**: `shiftWorkingDays(pred.scheduledStart, lag)`

`scheduledStart = nextWorkingDay(max(task.startDate, semua batas dari predecessor))`. Jadi `startDate` berfungsi sebagai batas 'mulai paling awal'.

Larangan (balas 422): dependensi ke diri sendiri, pasangan duplikat, siklus (kode `CYCLE_DETECTED`), dan dependensi pada tugas yang punya anak. Hanya tugas daun (leaf) boleh punya dependensi dan assignment.

### 6.5 Tugas induk (summary)

- `scheduledStart` = minimum anak, `scheduledEnd` = maksimum anak, `durationDays` = `workingDaysBetween` keduanya, `progress` = rata-rata anak berbobot durasi.
- Tugas induk hanya boleh diedit nama, deskripsi, warna, dan prioritasnya.
- Kedalaman maksimal 3 level.
- Tugas yang sudah punya dependensi atau assignment tidak boleh diberi anak (409 dengan pesan jelas).

### 6.6 Penjadwalan ulang (recompute)

Urutan: urutkan topologis tugas daun (algoritma Kahn), hitung `scheduledStart` dan `scheduledEnd`, lalu roll-up tugas induk dari bawah ke atas. Server menjalankan ini setiap ada perubahan tugas, dependensi, durasi, atau kalender, menyimpan hasilnya, dan mengembalikan seluruh daftar tugas proyek.

### 6.7 Drag di Gantt

- Geser bar tugas daun: ubah `startDate` ke tanggal baru (snap ke hari kerja). Jika hasilnya lebih awal dari batas predecessor, bar kembali ke batas tersebut dan tampil toast info.
- Tarik tepi kanan bar: ubah `durationDays` (minimum 1) dengan `workingDaysBetween`.
- Bar tugas induk tidak bisa di-drag.
- Selama drag, client memakai mesin `shared` untuk pratinjau. Saat dilepas, kirim PATCH ke server dan pakai respons server sebagai hasil akhir.

### 6.8 Critical Path (CPM), hanya tugas daun

Ordinal hari kerja: `ord(d)` = jumlah hari kerja dari awal proyek (ordinal 0) sampai d.

- Forward pass: `ES = ord(scheduledStart)`, `EF = ord(scheduledEnd)`. Akhir proyek `PE = max(EF)`.
- Backward pass: tugas tanpa penerus punya `LF = PE`. Untuk tugas dengan penerus, `LF` = minimum dari:
  - FS: `LS_succ - 1 - lag`
  - SS: `LS_succ - lag + dur_pred - 1`
- `LS = LF - dur + 1`, `totalFloat = LS - ES` (minimal 0).
- Kritis jika `totalFloat = 0`. Jalur kritis adalah rangkaian tugas kritis yang terhubung, diurutkan menurut ES.

### 6.9 Diagram PERT

- Jaringan activity-on-node dari tugas daun. Setiap node menampilkan nama, durasi, ES, EF, LS, LF, dan slack.
- Tata letak: kolom = kedalaman jalur terpanjang dari node awal. Panah mengikuti dependensi. Node dan panah kritis berwarna merah.
- Jika `optimisticDays` dan `pessimisticDays` terisi, tampilkan estimasi `te = (o + 4m + p) / 6` dan variansi `((p - o) / 6)^2` (m = `durationDays`). Ini informasi tambahan dan tidak mengubah jadwal. Tampilkan juga total variansi dan simpangan baku di sepanjang jalur kritis.

### 6.10 Biaya dan beban kerja

- Tarif harian = `salary / 22`.
- Biaya tugas = jumlah dari (tarif harian × durasi × allocationPercent / 100) untuk tiap assignment. Total proyek = jumlah semua tugas daun. Format rupiah (IDR).
- Peringatan over-alokasi: jika total allocationPercent seorang resource pada tugas daun yang saling tumpang tindih melebihi 100 pada suatu hari kerja, tampilkan peringatan di halaman Tim.

### 6.11 Vektor uji wajib

Kalender akhir pekan Sabtu dan Minggu, tanpa libur kecuali dinyatakan lain:

- Mulai Jumat 2026-10-23, durasi 3 → berakhir Selasa 2026-10-27.
- FS lag 0 dari tugas di atas → penerus mulai Rabu 2026-10-28.
- SS lag 2 dari tugas di atas → penerus mulai Selasa 2026-10-27.
- Dengan libur Senin 2026-10-26: mulai Jumat 2026-10-23, durasi 3 → berakhir Rabu 2026-10-28.
- CPM: A(3 hari) → B(2 hari), A → C(5 hari), B dan C → D(1 hari), semua FS, lag 0, proyek mulai Senin 2026-10-19. Hasil: A, C, D kritis; B punya float 3; PE = 8.

## 7. REST API

Prefiks `/api`. Format JSON. Semua rute selain `/auth/register`, `/auth/login`, dan `/health` memakai header `Authorization: Bearer <token>`. Setiap data dicek kepemilikannya (hanya pemilik proyek yang boleh mengakses; selain itu 404).

Format error: `{ "error": { "code": "STRING", "message": "pesan bahasa Indonesia", "details": {} } }`. Status: 400/422 validasi, 401 belum login, 404 tidak ditemukan, 409 konflik.

| Method dan path | Fungsi |
| --- | --- |
| GET `/health` | Cek server hidup |
| POST `/auth/register` | Daftar (name, email, password min 8 karakter), kembalikan token dan user |
| POST `/auth/login` | Masuk, kembalikan token dan user |
| GET `/auth/me` | Data user saat ini |
| GET, POST `/projects` | Daftar dan buat proyek |
| GET, PATCH, DELETE `/projects/:id` | Detail (snapshot lengkap: proyek, tugas, dependensi, resource, assignment, holiday), ubah, hapus |
| POST `/projects/:id/tasks` | Buat tugas (bisa dengan parentId) |
| PATCH `/tasks/:id` | Ubah tugas, jadwal dihitung ulang |
| DELETE `/tasks/:id` | Hapus tugas beserta anaknya |
| POST `/tasks/:id/move` | Ubah parent dan posisi |
| POST `/tasks/:id/dependencies` | Tambah predecessor (predecessorId, type, lagDays) |
| PATCH, DELETE `/dependencies/:id` | Ubah atau hapus dependensi |
| GET, POST `/projects/:id/resources` | Daftar dan tambah anggota tim |
| PATCH, DELETE `/resources/:id` | Ubah atau hapus anggota |
| POST `/tasks/:id/assignments` | Alokasikan resource (resourceId, allocationPercent) |
| PATCH, DELETE `/assignments/:id` | Ubah atau hapus alokasi |
| PUT `/projects/:id/calendar` | Atur weekendDays, jadwal dihitung ulang |
| POST `/projects/:id/holidays` | Tambah hari libur (date, name) |
| DELETE `/holidays/:id` | Hapus hari libur |
| GET `/projects/:id/analysis` | Hasil CPM, jalur kritis, data PERT, biaya, beban resource |

Aturan respons: setiap mutasi yang mengubah jadwal (tugas, dependensi, durasi, kalender) mengembalikan `{ tasks: [...] }` berisi seluruh tugas terbaru, supaya client cukup memperbarui cache.

## 8. Frontend

Rute: `/login`, `/register`, `/projects`, `/projects/:id/gantt`, `/projects/:id/team`, `/projects/:id/calendar`, `/projects/:id/analysis`. Rute selain login dan register dilindungi. Token JWT disimpan di localStorage; selain token dan preferensi tampilan (misalnya zoom), semua data berasal dari API.

**Umum**: tampilan rapi dan responsif (layar ponsel sampai desktop), label bahasa Indonesia, state loading, kosong, dan error di setiap halaman, toast untuk hasil aksi, konfirmasi sebelum menghapus, validasi form dengan skema zod dari `shared`.

### 8.1 Halaman Gantt

- Dua panel: tabel tugas di kiri (WBS, nama, durasi, mulai, selesai, prioritas, penanggung jawab, progres; induk bisa dilipat) dan timeline SVG di kanan. Scroll vertikal keduanya disinkronkan.
- Timeline: zoom Hari/Minggu/Bulan, tombol 'Hari ini', garis hari ini, arsiran akhir pekan dan hari libur, bar berwarna sesuai `color` dengan lapisan progres, bar induk bergaya bracket.
- Panah dependensi: FS dari ujung kanan bar predecessor ke ujung kiri bar penerus, SS dari ujung kiri ke ujung kiri. Jalur siku-siku, posisi x berasal dari `scheduledStart` dan `scheduledEnd` (bukan hitungan hari kalender).
- Drag dan resize sesuai 6.7. Toggle 'Sorot jalur kritis'.
- Dialog tugas: nama, deskripsi, parent, durasi, mulai paling awal, prioritas, warna, progres, estimasi optimistis dan pesimistis (opsional), editor predecessor (baris: tugas, tipe FS/SS, lag), penanggung jawab (resource dan persen). Untuk tugas induk, kolom yang dihitung otomatis dibuat read-only.

### 8.2 Halaman Tim

Tabel anggota (nama, email, peran, gaji), tambah, ubah, hapus, daftar tugas yang dialokasikan, total biaya per anggota, dan peringatan over-alokasi.

### 8.3 Halaman Kalender

Checkbox tujuh hari untuk akhir pekan, daftar hari libur (tanggal dan nama) dengan tambah dan hapus, serta kalender bulanan mini yang menandai hari non-kerja. Setelah perubahan, jadwal bergeser otomatis dan toast 'Jadwal diperbarui' muncul.

### 8.4 Halaman Analisis

Ringkasan (tanggal mulai, tanggal selesai, total hari kerja, total biaya, jumlah tugas kritis), tabel CPM (ES, EF, LS, LF, float, kritis), daftar jalur kritis, dan diagram PERT sesuai 6.9 yang bisa di-scroll dan di-zoom.

## 9. Seed data

`npm run db:seed` bersifat idempoten (aman dijalankan ulang). Isi:

- User demo: `demo@example.com` dengan password `Demo12345` (cantumkan di README sebagai akun contoh).
- Proyek 'Pengembangan Aplikasi Mobile Toko Online', mulai 2026-10-19, akhir pekan Sabtu dan Minggu. Hari libur: 2026-11-11 'Libur internal (contoh)' dan 2026-12-25 'Hari Raya Natal'.
- Resource: Andi Pratama (Project Manager, 15000000), Budi Santoso (Backend Developer, 12000000), Citra Lestari (UI/UX Designer, 10000000), Dewi Anggraini (QA Engineer, 9000000).
- Tugas (induk, lalu anak, dengan dependensi):
  - **1 Perencanaan**: 1.1 Kickoff dan kebutuhan (3 hari, High, Andi, progres 100); 1.2 Penyusunan spesifikasi (4 hari, High, Andi, FS dari 1.1, progres 60)
  - **2 Desain**: 2.1 Riset dan wireframe (5 hari, Medium, Citra, SS dari 1.2 lag 2); 2.2 Desain UI high-fidelity (6 hari, Medium, Citra, FS dari 2.1)
  - **3 Pengembangan**: 3.1 Rancang database dan API (5 hari, High, Budi, FS dari 1.2); 3.2 Implementasi backend (10 hari, High, Budi, FS dari 3.1, optimistis 8, pesimistis 15); 3.3 Implementasi frontend mobile (12 hari, High, Budi 50% dan Citra 50%, FS dari 2.2 dan SS dari 3.2 lag 3)
  - **4 Pengujian**: 4.1 Skenario uji (3 hari, Medium, Dewi, SS dari 3.2 lag 4); 4.2 Integrasi dan uji sistem (6 hari, High, Dewi, FS dari 3.2 dan FS dari 3.3); 4.3 Perbaikan bug (4 hari, Medium, Budi, FS dari 4.2)
  - **5 Peluncuran**: 5.1 Persiapan rilis (2 hari, Medium, Andi, FS dari 4.3 lag 1); 5.2 Rilis dan serah terima (1 hari, High, Andi, FS dari 5.1)
- Beri warna berbeda per kelompok. Pastikan seed menghasilkan setidaknya satu tugas non-kritis (misalnya 4.1) dan satu hari libur yang jatuh di dalam rentang proyek sehingga efek kalender terlihat.

## 10. Fase pengerjaan

### Fase 0: Fondasi

Inisialisasi monorepo npm workspaces (`shared`, `server`, `client`), tsconfig, Vite + React + Tailwind, Express kosong dengan `/api/health`, skrip root, `.gitignore`, `.env.example`, `PROGRESS.md`.

**Gate**: `npm install` dan `npm run typecheck` sukses pada kerangka.

### Fase 1: Mesin inti (`shared`)

Implementasikan 6.1 sampai 6.10 beserta skema zod dan tipe. Tulis unit test termasuk semua vektor uji di 6.11.

**Gate**: `npm test -w shared` lolos.

### Fase 2: Backend

Skema Prisma dan migrasi, auth, seluruh rute di Bagian 7, `recompute` dan `snapshot`, middleware error dan validasi, cek kepemilikan, seed (Bagian 9). Tulis test integrasi Supertest dengan database SQLite terpisah untuk: auth, CRUD tugas, parent-child, FS dan SS dengan lag, penolakan siklus, kalender (weekend dan libur menggeser jadwal), assignment, analisis, dan akses lintas pengguna ditolak.

**Gate**: typecheck dan test server lolos, `npm run db:seed` berhasil.

### Fase 3: Frontend

Implementasikan Bagian 8 lengkap. Tulis beberapa test komponen: bar Gantt dan panah dependensi ter-render dari data seed, form tugas memvalidasi input, diagram PERT menandai node kritis.

**Gate**: typecheck, test, dan build client lolos.

### Fase 4: Integrasi dan verifikasi

1. Jalankan `npm install`, `npm run typecheck`, `npm test`, dan `npm run build`. Perbaiki semua error sampai semuanya lolos tanpa error.
2. Jalankan `npm run dev`, pastikan `http://localhost:3001/api/health` dan `http://localhost:5173` merespons, lalu beri tahu manusia alamat URL aplikasi.
3. Telusuri Acceptance Checklist (Bagian 12) dan tandai di `PROGRESS.md`. Item yang gagal diperbaiki dengan protokol Bagian 13.

**Gate**: keempat perintah verifikasi lolos dan seluruh checklist tercentang.

### Fase 5: Rapikan sebelum push

- `.gitignore` mengecualikan minimal: `node_modules`, `dist`, `.env`, `*.db`, `*.db-journal`, `coverage`.
- `README.md` berisi: deskripsi dan daftar fitur, tech stack, prasyarat, cara install (`npm install`, salin `.env.example` ke `.env`, `npm run db:migrate`, `npm run db:seed`), cara menjalankan (`npm run dev`, alamat URL), cara test dan build, akun demo, ringkasan API, dan bagian 'Asumsi'.
- Pindai repo untuk rahasia: tidak ada token, password nyata, atau file `.env` dan database yang ikut ter-track.

**Gate**: `git status` bersih dari file yang seharusnya diabaikan dan README sesuai kenyataan.

### Fase 6: Push ke GitHub

Perlu URL repository dari manusia, berbentuk `https://github.com/USERNAME/gantt-project-app.git`. Jika belum diberikan, tanyakan sekali. Jangan menebak USERNAME.

```
git init
git add .
git commit -m "Initial commit: Gantt Chart project management app"
git branch -M main
git remote add origin <URL repository>
git push -u origin main
```

Saat push pertama, jendela browser untuk login GitHub mungkin muncul (Git Credential Manager). Beri tahu manusia agar login dan menekan Authorize. Jika identitas Git (`user.name` dan `user.email`) belum diatur, minta manusia mengaturnya. Jika push tidak bisa dijalankan agen, berikan perintah di atas kepada manusia untuk dijalankan manual.

**Gate**: `git log` menunjukkan commit dan `git push` sukses.

## 11. Standar kualitas

- TypeScript strict mode, tanpa `any` kecuali terpaksa dan diberi komentar.
- Validasi semua input di server dengan zod. Jangan percaya data dari client.
- Password di-hash dengan bcryptjs. `passwordHash` tidak pernah dikirim ke client.
- Server memakai `helmet` dan `cors`. Rute login dan register dibatasi dengan rate limit.
- Jangan menyalin logika penjadwalan ke tempat lain. Selalu impor dari `shared`.
- Kode terbaca: nama jelas, fungsi kecil, tanpa kode mati.

## 12. Acceptance checklist

Verifikasi lewat API (Supertest atau curl) dan antarmuka. Tandai di `PROGRESS.md`.

**Tugas**

- [ ] Tambah, ubah, dan hapus tugas berhasil
- [ ] Durasi, tanggal mulai, prioritas, dan warna tersimpan
- [ ] Sub-tugas (parent-child) bisa dibuat, dan induk menghitung rentang serta progres otomatis

**Dependensi dan Gantt**

- [ ] Predecessor FS dan SS dengan lag mengubah posisi bar sesuai 6.4 dan vektor uji 6.11
- [ ] Bar Gantt tampil, ada panah dependensi (FS dan SS), dan bar bisa di-drag serta di-resize
- [ ] Dependensi yang membentuk siklus ditolak dengan pesan jelas

**Resource**

- [ ] Tambah anggota tim (nama, email, peran, gaji) dan alokasikan ke tugas
- [ ] Biaya dan peringatan over-alokasi muncul benar

**Kalender**

- [ ] Ubah akhir pekan dan tambah hari libur, lalu jadwal bergeser otomatis
- [ ] Durasi tidak menghitung akhir pekan dan hari libur

**Analisis**

- [ ] Halaman Analisis menampilkan Critical Path dan diagram PERT, node kritis berwarna merah

**Persistensi dan akun**

- [ ] Data tidak hilang saat halaman di-refresh (data berasal dari database)
- [ ] Register, login, dan logout berfungsi, dan pengguna A tidak bisa melihat data pengguna B

**Repository**

- [ ] Ada folder `src` di tiap workspace, `package.json`, dan `README.md`
- [ ] `node_modules`, `.env`, dan file database tidak ikut ter-commit
- [ ] `npm run typecheck`, `npm test`, dan `npm run build` lolos tanpa error

## 13. Protokol perbaikan bug

Gunakan saat manusia melaporkan fitur rusak, misalnya 'saat saya klik tambah tugas, tidak ada yang muncul'.

1. Ulangi masalahnya (test, curl, atau langkah di UI) dan pastikan terlihat.
2. Tentukan lapisannya: mesin `shared`, API server, atau UI client.
3. Tulis test yang gagal terlebih dahulu bila memungkinkan.
4. Perbaiki penyebab utamanya dengan perubahan sekecil mungkin.
5. Jalankan `typecheck`, `test`, dan `build` penuh untuk memastikan fitur lain tidak rusak, lalu cek ulang item terkait di Bagian 12.
6. Laporkan penyebab dan perbaikan dalam maksimal tiga kalimat.

**Contoh**: 'Panah dependensi tidak muncul dan durasi tidak melewati akhir pekan.' Periksa: (a) posisi x panah harus dihitung dari `scheduledStart` dan `scheduledEnd`, dan panah harus dirender untuk FS dan SS; (b) durasi harus memakai `shiftWorkingDays` dan `workingDaysBetween`, bukan selisih hari kalender; (c) jalankan vektor uji 6.11 untuk membuktikan perbaikan.

Jika kamu berhenti di tengah pekerjaan, baca `PROGRESS.md` dan lanjutkan dari item pertama yang belum selesai.

## 14. Laporan akhir ke manusia

Setelah Fase 6, kirim laporan singkat berisi:

- Hasil keempat perintah verifikasi (install, typecheck, test, build)
- URL aplikasi lokal dan akun demo
- URL repository dan status push
- Daftar asumsi atau batasan yang kamu ambil
- Pengingat untuk manusia: uji manual dengan checklist Bagian 12, pastikan repository berstatus Public, lalu simpan chat history dan kumpulkan bersama URL repository sesuai instruksi dosen
