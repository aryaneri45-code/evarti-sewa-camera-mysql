# Evarti Camera Rental

Aplikasi web internal untuk mengelola penyewaan kamera Evarti di lokasi **Cafe** dan **Event**. Owner dan kasir dapat mencatat penyewa, membuat transaksi, menerima pembayaran tunai atau QRIS DANA, mencetak struk thermal, serta melihat riwayat dan laporan pendapatan. Antarmuka menggunakan bahasa Indonesia dan menyesuaikan layar ponsel, tablet, serta desktop.

Pemesanan dan pembayaran dilakukan melalui staf Evarti; aplikasi ini digunakan untuk pencatatan operasional.

## Fitur

- **Akun staf:** login owner dan dua kasir dengan sesi cookie HttpOnly selama 8 jam, proteksi CSRF, dan pembatasan percobaan login.
- **Dashboard:** ringkasan transaksi dan pendapatan hari ini, status pembayaran, serta aktivitas transaksi sesuai akun yang masuk.
- **Katalog kamera:** owner dapat menambah, mengubah, mengaktifkan, menonaktifkan, dan menghapus kamera; mengatur tarif 1 dan 2 jam; serta mengunggah foto. Kasir hanya melihat kamera aktif.
- **Transaksi beberapa kamera:** satu transaksi dapat memuat 1–20 kamera berbeda dengan durasi masing-masing. Tarif manual berlaku untuk durasi lebih dari 2 jam dan kurang dari 24 jam. Jam selesai mengikuti durasi kamera terlama; harga dan total divalidasi kembali oleh backend.
- **Data penyewa:** nama dan nomor WhatsApp wajib, nomor pager opsional, serta pilihan jaminan tanpa jaminan, foto, atau nomor ID. Nomor ID dan foto jaminan tidak ditampilkan pada struk.
- **Add-on katalog:** properti, fotografer, print foto, dan pemindahan file. Owner dapat mengelola nama, harga, dan statusnya. Perubahan disimpan melalui tombol **Simpan katalog add-on**.
- **Layanan manual:** tambahkan satu add-on dengan nama dan harga khusus per transaksi, termasuk layanan gratis. Layanan ini tersimpan bersama transaksi tanpa masuk ke katalog.
- **Pembayaran:** tunai dengan perhitungan kembalian, atau QRIS DANA yang diverifikasi manual oleh kasir pembuat transaksi atau owner.
- **Struk thermal 58 mm:** pratinjau, pilihan struk pelanggan atau admin, cetak melalui dialog browser, serta cetak ulang transaksi lunas. Antarmuka mencantumkan printer Rongta RPP02N sebagai pilihan.
- **Riwayat:** pencarian nomor struk, nama, atau WhatsApp; filter lokasi, tanggal, dan kasir untuk owner; serta tombol void dengan alasan pada antarmuka owner.
- **Laporan owner:** rekap harian, mingguan, dan bulanan; pendapatan menurut metode pembayaran, lokasi, dan kasir; kamera terlaris; serta unduhan PDF. Pendapatan hanya menghitung transaksi lunas.
- **Snapshot dan audit:** nama dan harga kamera maupun add-on disalin ke transaksi agar struk lama tetap konsisten ketika katalog berubah. Tarif manual, layanan manual, verifikasi QRIS, void, dan pencetakan struk dicatat dalam audit log yang tersedia melalui API owner.

### Akun dan lokasi

| Akun | Username | Lokasi transaksi | Password awal dari environment |
| --- | --- | --- | --- |
| Owner | `owner` | Dapat memilih Cafe atau Event | `OWNER_PASSWORD` |
| Kasir 1 | `kasir1` | Cafe | `CASHIER1_PASSWORD` |
| Kasir 2 | `kasir2` | Event | `CASHIER2_PASSWORD` |

Kasir hanya dapat membaca transaksi miliknya. Owner dapat membaca seluruh transaksi. Backend menetapkan lokasi kasir berdasarkan username.

### Status pembayaran dan nomor struk

| Status | Keterangan |
| --- | --- |
| `paid` | Pembayaran tunai tersimpan atau QRIS sudah diverifikasi; struk dapat dicetak |
| `pending_verification` | QRIS menunggu konfirmasi manual; struk belum dapat dicetak |
| `void` | Transaksi dibatalkan dan dikecualikan dari pendapatan |

QRIS belum terhubung ke payment gateway. Aplikasi menampilkan instruksi menggunakan QRIS statis resmi Evarti; aset QR pembayaran tidak disertakan.

Nomor struk menggunakan format `CAF-YYYYMMDD-001` untuk Cafe dan `EVT-YYYYMMDD-001` untuk Event, dengan urutan per lokasi dan tanggal. Tanggal nomor struk dan pengelompokan laporan menggunakan zona waktu `Asia/Jakarta`.

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Frontend | React 18, Vite 6, Lucide React, CSS |
| Backend | Node.js, Express 4, Zod |
| Database utama | MySQL melalui `mysql2/promise`, tabel InnoDB dan charset `utf8mb4` |
| SQLite | `better-sqlite3` untuk dukungan database lama, migrasi, dan pengujian API |
| Autentikasi | `bcryptjs`, sesi tersimpan di database, cookie HttpOnly, CSRF |
| Upload dan PDF | Multer, PDFKit |
| Pengujian | Node.js Test Runner dan Supertest |
| Pengelolaan proyek | npm workspaces dan Concurrently |

## Menjalankan secara lokal

### 1. Persyaratan

- Node.js **20 atau lebih baru**, sesuai `engines` di `package.json`.
- npm yang mendukung workspaces.
- Server MySQL yang berjalan dan akun untuk membuat database serta memberi izin pengguna aplikasi.

Jalankan seluruh perintah npm berikut dari root repositori.

### 2. Siapkan database MySQL

Masuk ke MySQL menggunakan akun administrator:

```sh
mysql -u root -p
```

Buat database dan pengguna aplikasi. Ganti password contoh sebelum menjalankan SQL:

```sql
CREATE DATABASE evarti CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'evarti'@'127.0.0.1' IDENTIFIED BY 'GANTI_DENGAN_PASSWORD_DATABASE';
GRANT ALL PRIVILEGES ON evarti.* TO 'evarti'@'127.0.0.1';
```

Jika memakai MySQL terkelola atau database yang sudah tersedia, gunakan host, nama database, pengguna, dan izin yang sesuai. Backend membuat tabel saat startup, tetapi database/schema harus tersedia terlebih dahulu. Akun aplikasi memerlukan izin membuat dan mengubah tabel selain membaca dan menulis data.

### 3. Atur environment

Salin template backend ke root repositori:

```sh
cp back-end/.env.example .env
```

Edit `.env`:

- Sesuaikan `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, dan `MYSQL_DATABASE` dengan database yang disiapkan.
- Gunakan `DATABASE_CLIENT=mysql`.
- Isi `SESSION_SECRET` dengan nilai acak minimal 32 karakter. Salah satu cara membuatnya:

  ```sh
  openssl rand -base64 32
  ```

- Ganti `OWNER_PASSWORD`, `CASHIER1_PASSWORD`, dan `CASHIER2_PASSWORD` dengan password masing-masing minimal 12 karakter.

Nilai contoh `SESSION_SECRET` dan password akun yang diawali `change-this-` ditolak saat startup. Simpan kredensial di `.env` dan jangan commit file tersebut.

### 4. Instal dan jalankan

```sh
npm install
npm run dev
```

Perintah ini menjalankan backend dan frontend bersamaan:

| Layanan | Alamat default |
| --- | --- |
| Frontend | [http://localhost:5173](http://localhost:5173) |
| Backend API | [http://127.0.0.1:3000](http://127.0.0.1:3000) |
| Health check | [http://127.0.0.1:3000/api/health](http://127.0.0.1:3000/api/health) |

Ikuti alamat yang ditampilkan Vite jika port frontend sedang digunakan. Vite meneruskan request `/api` ke `http://localhost:3000`. Backend mendengarkan pada `127.0.0.1`; jika port API diubah, sesuaikan juga proxy di `Front-end/vite.config.js`.

Saat inisialisasi database baru, backend membuat tabel, tiga akun staf, katalog kamera awal, dan katalog add-on awal. Seed saat ini mencakup **14 kamera** dan **13 add-on**; opsi pemindahan file memiliki tarif awal berbayar.

Password environment hanya digunakan untuk pembuatan akun awal. Mengubahnya setelah akun tersimpan tidak mengubah password akun yang sudah ada. Katalog add-on awal hanya dimasukkan ketika akun pertama dibuat, sehingga perubahan dan penghapusan add-on tetap tersimpan setelah restart.

Untuk menjalankan layanan secara terpisah, gunakan dua terminal:

```sh
# Terminal 1
npm run dev:backend
```

```sh
# Terminal 2
npm run dev:frontend
```

## Konfigurasi

Backend membaca `.env` di root repositori terlebih dahulu. Jika tidak tersedia, backend membaca `back-end/.env`. Environment proses yang sudah diatur mengambil prioritas atas nilai dari file.

| Variabel | Kegunaan | Default / ketentuan |
| --- | --- | --- |
| `NODE_ENV` | Mode aplikasi | `development` |
| `PORT` | Port backend | `3000` |
| `DATABASE_CLIENT` | Pilihan database | `mysql`; juga mendukung `sqlite` |
| `MYSQL_HOST` | Host MySQL | Wajib untuk MySQL |
| `MYSQL_PORT` | Port MySQL | `3306` |
| `MYSQL_USER` | Pengguna MySQL | Wajib untuk MySQL |
| `MYSQL_PASSWORD` | Password pengguna MySQL | Wajib untuk MySQL |
| `MYSQL_DATABASE` | Nama database/schema yang sudah tersedia | Wajib untuk MySQL |
| `MYSQL_SSL` | Mengaktifkan TLS koneksi MySQL | `false` |
| `DATABASE_PATH` | Lokasi file ketika menggunakan SQLite | `./.data/evarti.sqlite`, relatif terhadap direktori kerja backend |
| `SESSION_SECRET` | Secret untuk hash token sesi | Wajib, acak, minimal 32 karakter |
| `FRONTEND_ORIGIN` | Origin frontend yang diizinkan CORS; dapat dipisahkan koma | `http://localhost:5173` |
| `COOKIE_SECURE` | Cookie sesi hanya dikirim melalui HTTPS | `false`; wajib `true` pada production |
| `OWNER_PASSWORD` | Password awal owner | Wajib, minimal 12 karakter |
| `CASHIER1_PASSWORD` | Password awal Kasir 1 | Wajib, minimal 12 karakter |
| `CASHIER2_PASSWORD` | Password awal Kasir 2 | Wajib, minimal 12 karakter |

Frontend menyediakan template `Front-end/.env.example` dengan variabel `VITE_API_URL`. Untuk development dengan proxy Vite, biarkan nilainya kosong. Jika perlu menunjuk origin API secara eksplisit, salin template ke `Front-end/.env` dan isi dengan origin API, tanpa akhiran `/api`. Nilai ini diterapkan saat Vite berjalan atau saat build.

## Perintah pengembangan dan build

| Perintah dari root | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan backend dan frontend bersamaan |
| `npm run dev:backend` | Menjalankan backend |
| `npm run dev:frontend` | Menjalankan Vite development server |
| `npm test` | Menjalankan pengujian API backend |
| `npm run test:coverage --workspace evarti-rental-backend` | Menjalankan pengujian dengan laporan coverage |
| `npm run build` | Membuat frontend production di `Front-end/dist/` |
| `npm run preview --workspace evarti-rental-frontend` | Melihat hasil build frontend secara lokal |
| `npm run start --workspace evarti-rental-backend` | Menjalankan backend untuk konfigurasi deployment |

Pengujian API menggunakan SQLite sementara dan direktori upload sementara. Cakupannya mencakup login, pemisahan akses kasir, beberapa kamera dalam satu transaksi, validasi harga dan WhatsApp, add-on katalog/manual, persistensi katalog, QRIS, privasi jaminan, void, dan laporan PDF. Pengujian ini tidak memverifikasi koneksi MySQL production.

Build frontend hanya menghasilkan berkas statis; backend tetap dijalankan sebagai proses terpisah. Untuk production, gunakan HTTPS, `NODE_ENV=production`, `COOKIE_SECURE=true`, dan `FRONTEND_ORIGIN` sesuai domain frontend. Gunakan reverse proxy untuk melayani frontend dan `/api` dalam satu origin. Cookie sesi menggunakan `SameSite=Strict`, sehingga penempatan frontend dan API pada situs berbeda perlu memperhitungkan pembatasan cookie browser.

Panduan pemindahan VPS, backup, restore MySQL, Nginx, PM2, serta migrasi data tersedia di [README-hosting.md](README-hosting.md).

## Penyimpanan dan migrasi data

### Data yang perlu dicadangkan

- Database MySQL: `users`, `sessions`, `cameras`, `addons`, `receipt_sequences`, `transactions`, `transaction_items`, `transaction_addons`, dan `audit_logs`.
- Foto kamera: `back-end/uploads/cameras/`.
- Foto jaminan: `back-end/uploads/private/`.
- Konfigurasi backend dan frontend yang digunakan untuk menjalankan aplikasi.

Nama file upload disimpan sebagai referensi di database. Backup database perlu disertai folder `back-end/uploads/` agar foto tetap tersedia. Add-on manual tersimpan di `transaction_addons`, sedangkan urutan nomor struk tersimpan di `receipt_sequences`.

Upload menerima JPG, PNG, atau WebP dengan pemeriksaan signature file. Batas foto kamera **3 MB** dan foto jaminan **2 MB**. Foto jaminan diakses melalui endpoint terautentikasi oleh owner atau kasir pembuat transaksi.

### Migrasi SQLite lama ke MySQL

Hentikan aplikasi, buat backup database SQLite beserta upload, lalu siapkan database MySQL kosong dan konfigurasikan koneksinya di `.env`. Jalankan migrasi **sebelum startup backend** agar database tujuan belum terisi seed:

```sh
npm run migrate:sqlite --workspace evarti-rental-backend -- /absolute/path/to/evarti.sqlite
```

Script membaca SQLite tanpa mengubahnya, memeriksa kelengkapan sembilan tabel dan relasi foreign key, membuat tabel MySQL tanpa seed, serta menolak impor jika tabel tujuan sudah berisi data. Seluruh data diimpor dalam satu transaksi database. Salin folder upload secara terpisah jika berpindah server, lalu jalankan aplikasi dengan `DATABASE_CLIENT=mysql`.

SQLite lama masih dapat dijalankan dengan `DATABASE_CLIENT=sqlite` dan `DATABASE_PATH` yang sesuai; penggunaan normal proyek ini menggunakan MySQL.

## Struktur proyek

```text
.
├── Front-end/
│   ├── public/evarti-logo.png
│   ├── src/
│   │   ├── services/api.js       # Request API, cookie sesi, dan token CSRF
│   │   ├── App.jsx               # Halaman dan alur aplikasi
│   │   ├── main.jsx
│   │   └── styles.css            # Tampilan responsif dan cetak struk
│   ├── .env.example
│   └── vite.config.js
├── back-end/
│   ├── scripts/migrate-sqlite-to-mysql.js
│   ├── src/
│   │   ├── config/env.js
│   │   ├── middleware/           # Autentikasi, CSRF, peran, dan upload
│   │   ├── routes/               # Auth, kamera, add-on, transaksi, laporan, audit
│   │   ├── utils/                # Validasi transaksi, WhatsApp, dan error
│   │   ├── app.js
│   │   ├── db.js                 # SQLite dan definisi katalog awal
│   │   ├── mysql.js              # Koneksi, skema, dan seed MySQL
│   │   └── server.js
│   ├── tests/api.test.js
│   ├── uploads/                  # Dibuat saat runtime, diabaikan Git
│   └── .env.example
├── design-system/evarti-rental/   # Pedoman desain dan pratinjau UI
├── PRD-evarti.md
├── README-hosting.md
├── package.json                  # npm workspaces dan perintah utama
└── README.md
```
