# PRD — Evarti Rental Receipt System

**Produk:** Website Admin/Kasir Penyewaan Kamera & Pembuatan Struk
**Brand:** evarti — *Weaving stories into your life*
**Versi:** 1.0 (Draft)
**Tanggal:** 17 Oktober 2026

---

## 1. Latar Belakang

Evarti menyewakan kamera digital (kamera pocket) di dua lokasi operasional: **Cafe** dan **Event**. Saat ini pencatatan penyewaan dan pembuatan struk perlu dibuat lebih rapi, cepat, dan terdokumentasi. Kasir membutuhkan alat yang mudah dipakai di perangkat apa pun (HP, tablet, laptop) untuk memilih kamera, mengisi data sewa, mencetak struk thermal, dan menyimpan riwayat transaksi. Pemilik membutuhkan visibilitas atas transaksi dan laporan dari setiap kasir.

## 2. Tujuan

1. Mempercepat input transaksi sewa oleh kasir (target < 1 menit per transaksi).
2. Menghasilkan struk yang konsisten sesuai format Evarti, siap cetak di thermal 58 mm.
3. Menyimpan riwayat transaksi yang terpisah per kasir dan per lokasi (Cafe/Event).
4. Memberi Pemilik akses laporan dan kontrol atas tarif di luar katalog.
5. Menyediakan pembayaran QRIS statis DANA dengan verifikasi manual pada tahap awal.

### Di Luar Cakupan (Non-Goals)
- Website atau akses untuk pelanggan/penyewa.
- Booking online atau pembayaran online oleh pelanggan.
- Integrasi otomatis webhook pembayaran (QRIS dinamis) — ditunda ke fase berikutnya.
- Perhitungan atau pencatatan denda keterlambatan di sistem — denda hanya tertulis di footer struk.
- Verifikasi nomor WhatsApp (mis. pesan konfirmasi) — belum diterapkan pada tahap awal.
- Manajemen stok/ketersediaan unit kamera (dapat dipertimbangkan di fase berikutnya).

## 3. Pengguna & Peran

Sistem memiliki **3 akun tetap**:

| Akun | Peran | Hak Akses |
|---|---|---|
| Owner | Pemilik | Melihat semua transaksi, filter per Kasir 1 / Kasir 2, laporan, menyetujui tarif manual (durasi > 2 jam) |
| Kasir 1 | Kasir | Membuat struk, melihat riwayat miliknya sendiri |
| Kasir 2 | Kasir | Membuat struk, melihat riwayat miliknya sendiri |

**Aturan akses:**
- Seluruh halaman dilindungi login. Tidak ada halaman publik.
- Kasir hanya melihat transaksi miliknya, tidak dapat melihat transaksi kasir lain.
- Owner dapat memilih tampilan: **Semua / Kasir 1 / Kasir 2**.

## 4. Fitur Utama

### 4.1 Autentikasi
- Login dengan username dan password.
- Sesi aman (token/cookie httpOnly), logout, dan auto-expire sesi.
- Pembatasan akses berbasis peran (role-based access control).

### 4.2 Katalog Kamera
- Tampilan **kartu katalog** dengan **foto kamera fisik**, nama, dan harga 1 jam / 2 jam, agar kasir mudah mengenali dan memilih.
- Klik kartu untuk memilih kamera pada formulir sewa.
- Desain responsif: grid menyesuaikan lebar layar (1 kolom HP, 2–3 kolom tablet, 3–4 kolom desktop).

**Manajemen katalog (khusus Owner, tersedia sejak MVP):**
- Owner dapat menambah kamera baru, mengubah nama, foto, dan harga 1 jam / 2 jam, serta menonaktifkan/mengaktifkan kamera.
- Kamera nonaktif tidak muncul di formulir kasir, tetapi tetap tampil pada riwayat lama.
- Perubahan harga hanya berlaku untuk transaksi baru; transaksi lama tidak berubah (data harga disimpan sebagai snapshot).
- Upload foto kamera dengan batas ukuran dan format (JPG/PNG/WebP).
- Kasir hanya dapat melihat katalog, tidak dapat mengubahnya.

**Data katalog awal:**

```json
[
  {"id": "canon-ixus-160", "name": "Canon Ixus 160", "prices": {"1": 15000, "2": 23000}},
  {"id": "canon-ixus-185", "name": "Canon Ixus 185", "prices": {"1": 18000, "2": 27000}},
  {"id": "canon-ixus-285", "name": "Canon Ixus 285", "prices": {"1": 30000, "2": 45000}},
  {"id": "canon-SX610-HS", "name": "Canon SX610 HS", "prices": {"1": 40000, "2": 60000}},
  {"id": "sony-dsc-w810", "name": "Sony DSC W810", "prices": {"1": 20000, "2": 30000}},
  {"id": "sony-dsc-wx7", "name": "Sony DSC WX7", "prices": {"1": 25000, "2": 38000}},
  {"id": "sony-dsc-s950", "name": "Sony DSC S950", "prices": {"1": 18000, "2": 27000}},
  {"id": "nikon-coolpix-s3500", "name": "Nikon Coolpix S3500", "prices": {"1": 18000, "2": 27000}},
  {"id": "nikon-coolpix-a100", "name": "Nikon Coolpix A100", "prices": {"1": 15000, "2": 23000}},
  {"id": "fujifilm-finepix-jv", "name": "Fujifilm FinePix JV", "prices": {"1": 10000, "2": 15000}},
  {"id": "casio-qv-r200", "name": "Casio QV-R200", "prices": {"1": 10000, "2": 15000}},
  {"id": "lumix-dmc-fx520", "name": "Lumix DMC-FX520", "prices": {"1": 15000, "2": 23000}},
  {"id": "lumix-dmc-lx7", "name": "Lumix DMC-LX7", "prices": {"1": 30000, "2": 45000}},
  {"id": "olympus-mtough-8010", "name": "Olympus MTough - 8010", "prices": {"1": 15000, "2": 20000}}
]
```

Setiap item katalog ditambah field `image` (URL/path foto kamera).

**Data add-on awal:**

```json
[
  {"id": "print-1", "category": "print", "label": "1 foto", "price": 10000},
  {"id": "print-2", "category": "print", "label": "2 foto", "price": 15000},
  {"id": "print-3", "category": "print", "label": "3 foto", "price": 20000},
  {"id": "print-4", "category": "print", "label": "4 foto", "price": 20000},
  {"id": "print-5", "category": "print", "label": "5 foto", "price": 25000},
  {"id": "Analog A", "category": "property", "label": "Analog A", "price": 10000},
  {"id": "Analog B", "category": "property", "label": "Analog B", "price": 5000},
  {"id": "Analog C", "category": "property", "label": "Analog C", "price": 7000},
  {"id": "Airdrop/Local Send", "category": "transfer", "label": "100 Foto", "price": 5000},
  {"id": "Google Drive - 1 week", "category": "transfer", "label": "100 Foto", "price": 10000},
  {"id": "fotografer-5", "category": "photographer", "label": "5 foto", "price": 10000},
  {"id": "fotografer-10", "category": "photographer", "label": "10 foto", "price": 18000},
  {"id": "fotografer-15", "category": "photographer", "label": "15 foto", "price": 25000}
]
```

### 4.3 Formulir Pembuatan Struk
Field input:

| Field | Tipe | Keterangan |
|---|---|---|
| Lokasi | Pilihan | Cafe / Event |
| Nama Penyewa | Teks | Wajib |
| No. WhatsApp | Teks angka | Wajib; ditampilkan di pratinjau dan struk |
| Nomor Pager | Teks | Opsional; nomor perangkat pengingat waktu sewa, ditampilkan di pratinjau dan struk jika diisi |
| Jaminan | Pilihan | Opsional, ditentukan kasir yang bertugas: Tidak ada / Foto / Nomor ID |
| Foto Jaminan | Upload gambar | Muncul jika jaminan = Foto; bisa ambil langsung dari kamera HP |
| Nomor ID | Teks | Muncul jika jaminan = Nomor ID |
| Kamera | Pilihan dari katalog (dengan foto) | Wajib |
| Durasi | Pilihan | 1 jam / 2 jam / Lebih dari 2 jam (manual) |
| Jam Mulai | Waktu | Default: waktu saat ini, dapat diubah |
| Jam Selesai | Waktu | Dihitung otomatis dari Jam Mulai + Durasi |
| Harga | Angka | Otomatis dari katalog; manual jika > 2 jam |
| Metode Bayar | Pilihan | Tunai / QRIS DANA |
| Uang Diterima | Angka | Hanya untuk Tunai |
| Kembali | Angka | Otomatis: Diterima − Total |

**Validasi:**
- Nama penyewa, **No. WhatsApp**, kamera, dan durasi wajib diisi.
- Uang diterima tunai tidak boleh kurang dari total.
- Jam selesai harus setelah jam mulai.
- **No. WhatsApp** (wajib): hanya angka, boleh diawali `08`, `62`, atau `+62`; panjang 9–15 digit. Sistem menormalkan ke format `08xxxxxxxxxx` untuk tampilan. Struk **tidak dapat disimpan atau dicetak** selama nomor kosong atau formatnya tidak valid; kolom menampilkan pesan error yang jelas.
- **Jaminan** bersifat opsional dan sepenuhnya diputuskan oleh kasir yang bertugas sesuai situasi; sistem tidak mewajibkannya. Jika dipilih, salah satu (foto atau nomor ID) harus diisi. Foto dibatasi ukuran dan formatnya (JPG/PNG/WebP).
- Data jaminan hanya tersimpan di riwayat transaksi dan **tidak dicetak di struk**.
- Kasir dapat mengecek nomor yang diketik pada **pratinjau struk** sebelum menyimpan dan mencetak. Nomor yang salah ketik diperbaiki sebelum disimpan (struk yang sudah disimpan tidak dapat diedit).

### 4.4 Aturan Durasi Lebih dari 2 Jam
- Katalog hanya memiliki tarif **1 jam** dan **2 jam**.
- Untuk durasi > 2 jam tersedia opsi **"Lebih dari 2 jam (Manual)"** yang bersifat **opsional dan mengikuti situasi di lapangan**: kasir mengisi sendiri durasi dan tarifnya.
- **Sistem tidak boleh menebak atau menghitung tarif otomatis** untuk durasi di luar katalog; nilai tarif sepenuhnya berasal dari input manual.
- Alur: kasir memilih "Lebih dari 2 jam (Manual)" → mengisi durasi (jam/menit) dan tarif → mengisi catatan alasan (opsional) → transaksi ditandai **"Tarif Manual"**.
- Tidak ada PIN atau persetujuan Owner di perangkat kasir. Pengawasan dilakukan Owner melalui riwayat dan laporan, dengan filter khusus transaksi "Tarif Manual".
- Jam Selesai dihitung dari Jam Mulai + durasi manual yang diisi kasir.
- Penentuan durasi, tarif, dan catatan pada opsi manual sepenuhnya diserahkan kepada kasir; tidak ada kewajiban catatan alasan.

### 4.5 Pratinjau Struk
- Pratinjau real-time sebelum disimpan/dicetak, tampil seperti struk thermal (font monospace, lebar 58 mm).
- Kasir dapat kembali mengedit sebelum konfirmasi.

### 4.6 Cetak Struk (Thermal 58 mm)
- Cetak via browser menggunakan CSS `@media print` dengan lebar halaman **58 mm** (area cetak efektif ±48 mm).
- Tanpa margin berlebih, font monospace, garis pemisah putus-putus.
- Tombol **Cetak** tersedia setelah struk disimpan; dapat dicetak ulang dari riwayat (ditandai "Cetak Ulang" dalam log).
- Sebelum mencetak, kasir memilih format **Struk Admin** atau **Struk Pelanggan/Penyewa** sesuai contoh pada bagian 5.

### 4.7 Ekspor PDF
- **PDF untuk Ringkasan** (laporan/rekap transaksi per periode, per kasir, per lokasi).
- Opsional: unduh PDF per struk tunggal.

### 4.8 Pembayaran QRIS Statis DANA
- Saat metode **QRIS DANA** dipilih, sistem menampilkan gambar QRIS statis DANA milik Evarti beserta total yang harus dibayar.
- **Verifikasi manual**: kasir mengecek notifikasi/aplikasi DANA, lalu menekan **"Pembayaran Terverifikasi"**.
- Transaksi QRIS berstatus `Menunggu Verifikasi` → `Lunas`. Struk final hanya dicetak setelah `Lunas`.
- Sistem mencatat siapa yang memverifikasi dan kapan.
- Integrasi otomatis (QRIS dinamis/webhook) menjadi pengembangan tahap berikutnya.

### 4.9 Riwayat Transaksi
**Kasir:**
- Riwayat dipisah menjadi dua tab: **Cafe** dan **Event**.
- Hanya menampilkan transaksi milik kasir tersebut.
- Pencarian (no. struk, nama penyewa, no. WhatsApp) dan filter tanggal.

**Owner:**
- Melihat seluruh transaksi dengan filter **Kasir 1 / Kasir 2 / Semua**, serta filter lokasi (Cafe/Event) dan tanggal.
- Dapat melihat detail, cetak ulang, dan menandai/membatalkan transaksi (void) dengan alasan.

### 4.10 Laporan & Dashboard
- Ringkasan: total pendapatan, jumlah transaksi, kamera terlaris, pendapatan per metode bayar, pendapatan per lokasi.
- Filter: hari ini, 7 hari, bulan ini, rentang kustom.
- Grafik sederhana (tren harian/mingguan).
- Ekspor ringkasan ke PDF.
- Dashboard Kasir menampilkan ringkasan miliknya saja (transaksi & pendapatan hari ini).

## 5. Format Struk

## 5.1 Format Struk admin

Struk admin adalah salinan internal untuk membantu kasir dan tim operasional. mengenali pesanan serta mengingat detail waktu sewa. Format ini dicetak terpisah dari struk pelanggan.

```text
            NEW ORDER
--------------------------------
No. Struk        EVT-20261017-001
Tanggal                17/10/2026
Jam Mulai                  06:40
Jam Selesai                08:40
Penyewa                    aryan
No. WA               081234567890
No. Pager                  P-07
--------------------------------
2 Jam - Casio
1 jam - canon ixus 285
```

**Ketentuan format struk admin:**
- Header **NEW ORDER** dicetak di bagian paling atas dan rata tengah.
- Baris **No. Struk** langsung mengikuti header, kemudian tanggal, jam mulai,
  jam selesai, nama penyewa, nomor WhatsApp, dan nomor pager jika diisi.
- Setelah data penyewa, setiap kamera dicetak pada baris tersendiri dengan
  format `Durasi - Nama Kamera`; kamera ditampilkan sesuai urutan pada
  transaksi.
- Struk admin tidak menampilkan harga, total pembayaran, metode pembayaran,
  uang diterima, kembalian, atau footer struk pelanggan.
- Pratinjau dan cetak admin berada pada tampilan tersendiri yang dapat dipilih
  dari pilihan format struk.

## 5.2 Format Struk pelanggan atau penyewa

Struk mengikuti desain yang sudah ditetapkan (lihat gambar referensi). Layout berurutan dari atas:

```
            evarti
 Weaving stories into your life
--------------------------------
No. Struk        EVT-20261017-001
Tanggal                17/10/2026
Jam Mulai                  06:40
Jam Selesai                08:40
Penyewa                    aryan
No. WA               081234567890
No. Pager                  P-07
--------------------------------
Casio
2 Jam                   Rp 15.000
canon ixus 285
1 jam                   Rp 15.000
--------------------------------
TOTAL                  Rp 30.000
Bayar                      Tunai
Diterima               Rp 50.000
Kembali                Rp 20.000
--------------------------------
 Keterlambatan dikenakan denda.
 Kerusakan/kehilangan menjadi
  tanggung jawab penyewa.
--------------------------------
 TikTok & IG: @evartistore

         Terima kasih!
```

**Ketentuan format:**
- Logo/nama **evarti** (serif) dan tagline di tengah atas.
- Label di kiri, nilai di kanan (rata kanan, nilai penting dicetak tebal).
- Tanggal format `DD/MM/YYYY`, jam format 24 jam `HH:MM`.
- Nominal format Rupiah: `Rp 15.000`.
- **No. Struk:** `PREFIX-YYYYMMDD-NNN` dengan awalan dibedakan per lokasi: **`EVT`** untuk Event dan **`CAF`** untuk Cafe (contoh: `EVT-20261017-001`, `CAF-20261017-001`). Nomor urut berjalan harian per awalan dan reset setiap hari.
- Footer: kebijakan denda & tanggung jawab, akun media sosial, dan ucapan terima kasih.
- Baris **No. WA** selalu tampil tepat di bawah baris Penyewa. Gambar referensi struk awal belum memuat baris ini, jadi layout final mengikuti gambar tersebut dengan tambahan baris No. WA.
- Nomor pager ditampilkan lengkap di bawah No. WA jika diisi; nomor ini membantu kasir mengenali perangkat pengingat saat waktu sewa habis.
- Untuk pembayaran QRIS: baris "Bayar" menampilkan `QRIS DANA`, baris Diterima/Kembali disembunyikan atau tampil sama dengan total/Rp 0.
- Untuk tarif manual: tampil keterangan "Tarif Manual" pada baris Harga.

## 6. Desain & UX

- **Tema:** identik **pink** (palet pink lembut sebagai warna utama, aksen putih/krem, teks abu gelap), tampilan **rapi, bersih, dan modern**.
- **Responsif utama:** mobile-first, nyaman dipakai di HP kasir saat di event, tablet, dan desktop.
- Target sentuh tombol minimal 44 px; tombol aksi utama (Buat Struk, Cetak) mudah dijangkau.
- Katalog kamera berbentuk kartu dengan foto besar; kamera terpilih diberi highlight jelas.
- Navigasi: sidebar (desktop) / bottom navigation atau menu hamburger (mobile).
- Halaman utama: Dashboard, Buat Struk, Riwayat, Laporan (khusus Owner), Katalog.
- Status transaksi menggunakan badge warna (Lunas, Menunggu Verifikasi, Tarif Manual, Void).

## 7. Aturan Bisnis

1. Tarif hanya dari katalog untuk durasi 1 jam dan 2 jam.
2. Durasi > 2 jam: kasir mengisi durasi dan tarif secara manual (opsional, sesuai situasi); transaksi ditandai "Tarif Manual"; tidak ada perhitungan otomatis.
3. Total = harga sewa (belum ada diskon/pajak pada versi 1).
4. Kembali = Uang Diterima − Total (tunai saja).
5. Struk yang sudah disimpan tidak dapat diedit; koreksi dilakukan melalui **void** oleh Owner lalu membuat transaksi baru.
6. Setiap transaksi terhubung ke akun kasir pembuat dan lokasi (Cafe/Event).
7. Kebijakan denda keterlambatan dan tanggung jawab kerusakan/kehilangan **hanya tertulis di footer struk**; sistem tidak menghitung atau mencatat nominal denda.
8. No. WhatsApp penyewa adalah data pribadi: hanya dapat dilihat oleh akun yang berwenang atas transaksi tersebut (kasir pembuat dan Owner), tidak dibagikan ke pihak lain, dan hanya digunakan untuk keperluan penyewaan (mis. menghubungi penyewa terkait keterlambatan atau pengembalian).
9. Jaminan (foto atau nomor ID) bersifat opsional dan ditentukan oleh kasir yang bertugas. Data ini sensitif: hanya dapat dilihat oleh kasir pembuat transaksi dan Owner, disimpan terproteksi (tidak dapat diakses publik), dan tidak ditampilkan di struk.

## 8. Model Data (Ringkas)

**users:** `id, username, password_hash, role (owner|kasir), name, created_at`

**cameras:** `id, name, image, price_1h, price_2h, active`

**transactions:**
`id, receipt_no, cashier_id, location (cafe|event), customer_name, customer_whatsapp (required), customer_pager_number (nullable), guarantee_type (none|photo|id_number), guarantee_photo (nullable), guarantee_id_number (nullable), camera_id, camera_name (snapshot), duration_label, start_time, end_time, price, is_manual_price, manual_note, total, payment_method (cash|qris_dana), amount_received, change, payment_status (paid|pending_verification|void), verified_by, verified_at, created_at, printed_count`

**audit_logs:** `id, user_id, action, transaction_id, detail, created_at`

> Nama kamera dan harga disalin (snapshot) ke transaksi agar perubahan katalog tidak mengubah riwayat.

## 9. Arsitektur & Struktur Folder

Backend dan frontend **dipisahkan**.

```
evarti-sewa-camera/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/      # auth, role guard, validation
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/         # receipt number, reports, pdf
│   │   └── utils/
│   ├── tests/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── cameras/          # foto kamera
│   ├── src/
│   │   ├── components/       # CameraCard, ReceiptPreview, dll
│   │   ├── pages/
│   │   ├── services/         # API client
│   │   ├── styles/           # tema pink, print.css (58mm)
│   │   └── utils/            # format rupiah, tanggal
│   └── package.json
├── docs/
│   └── PRD.md
└── README.md
```

**Usulan teknologi (dapat disesuaikan):** Frontend React/Next.js + Tailwind CSS; Backend Node.js (Express); Database PostgreSQL/MySQL; PDF via library server-side atau client-side.

## 10. Endpoint API (Gambaran)

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| POST | `/api/auth/login` | Publik | Login |
| POST | `/api/auth/logout` | Login | Logout |
| GET | `/api/cameras` | Login | Daftar katalog |
| POST | `/api/cameras` | Owner | Tambah kamera |
| PUT | `/api/cameras/:id` | Owner | Ubah nama, foto, harga |
| PATCH | `/api/cameras/:id/active` | Owner | Aktif/nonaktifkan kamera |
| POST | `/api/transactions` | Kasir | Buat transaksi/struk |
| GET | `/api/transactions` | Login | Riwayat (otomatis difilter sesuai peran; query: `location`, `cashier`, `date`) |
| GET | `/api/transactions/:id` | Login | Detail struk |
| PATCH | `/api/transactions/:id/verify` | Kasir/Owner | Verifikasi pembayaran QRIS |
| PATCH | `/api/transactions/:id/void` | Owner | Batalkan transaksi |
| GET | `/api/reports/summary` | Owner (Kasir: miliknya) | Ringkasan laporan |
| GET | `/api/reports/summary/pdf` | Owner | Ekspor PDF ringkasan |

## 11. Kebutuhan Non-Fungsional

**Keamanan**
- Password di-hash (bcrypt/argon2); tidak disimpan plain text.
- Autentikasi berbasis token/cookie aman, HTTPS wajib di produksi.
- Otorisasi di sisi server (bukan hanya sembunyi menu di UI).
- Validasi dan sanitasi input; proteksi dari SQL injection, XSS, dan CSRF.
- Rate limit pada endpoint login.
- Audit log untuk aksi sensitif (void, tarif manual, verifikasi QRIS, cetak ulang).

**Performa & Keandalan**
- Halaman termuat < 3 detik pada koneksi 4G.
- Pembuatan struk dan pratinjau terasa instan (< 1 detik).
- Backup database berkala.

**Kompatibilitas**
- Browser modern (Chrome, Safari, Edge) di Android, iOS, dan desktop.
- Cetak ke printer thermal 58 mm, mendukung koneksi **Bluetooth maupun USB**, melalui dialog cetak browser. Pengujian cetak dilakukan pada kedua jenis koneksi. Printer yang digunakan: **Rongta RPP02N** (juga dikenal sebagai EPPOS EP58M RPP02N), printer thermal portabel dengan kertas lebar **58 mm** (sering ditulis 57 mm). Desain cetak mengikuti lebar kertas 58 mm dengan area cetak efektif yang aman sekitar 48 mm.
- Karena cetak dari browser ke printer Bluetooth dapat berbeda perilakunya antar perangkat (Android, iOS, desktop), tahap pengujian wajib memverifikasi alur cetak di perangkat kasir yang sebenarnya. Jika dialog cetak browser tidak dapat mengakses printer Bluetooth, disiapkan alternatif seperti aplikasi perantara cetak (mis. RawBT di Android) atau pencetakan langsung via Web Bluetooth/ESC-POS pada fase lanjutan.

**Aksesibilitas & Kegunaan**
- Kontras warna memadai pada tema pink, ukuran font terbaca, label formulir jelas.

## 12. Metrik Keberhasilan

- Waktu rata-rata pembuatan struk < 1 menit.
- 100% transaksi tercatat dengan nomor struk unik.
- Tidak ada transaksi durasi > 2 jam tanpa persetujuan/penanda tarif manual.
- Struk tercetak sesuai lebar 58 mm tanpa terpotong pada printer yang digunakan.
- Owner dapat melihat rekap per kasir dan per lokasi tanpa pencatatan manual.

## 13. Rencana Rilis

| Fase | Cakupan |
|---|---|
| **MVP** | Login 3 akun, katalog dengan foto, formulir, pratinjau, cetak 58 mm, riwayat per kasir & lokasi, tarif manual > 2 jam, QRIS DANA statis (verifikasi manual), manajemen katalog Owner (tambah/ubah kamera, foto, harga) |
| **Fase 2** | Laporan & dashboard lengkap, ekspor PDF ringkasan, audit log, void transaksi |
| **Fase 3** | Verifikasi nomor WhatsApp, status unit kamera (disewa/tersedia), integrasi QRIS otomatis, pengingat keterlambatan |

## 14. Keputusan & Pertanyaan Terbuka

### Keputusan yang Sudah Ditetapkan
1. **Awalan nomor struk dibedakan:** `EVT` untuk Event, `CAF` untuk Cafe.
2. **Tarif > 2 jam:** durasi, tarif, dan catatan diisi manual oleh kasir sesuai situasi, tanpa PIN/antrean persetujuan dan tanpa kewajiban catatan alasan.
3. **Denda keterlambatan:** hanya tertulis di struk, tidak dihitung/dicatat di sistem.
4. **No. WhatsApp:** wajib diisi; **verifikasi nomor belum diterapkan** (dijadwalkan Fase 3).
5. **Printer thermal 58 mm:** Rongta RPP02N (EPPOS EP58M RPP02N), kertas 58 mm; koneksi Bluetooth dan USB diuji di perangkat kasir.
6. **Manajemen katalog oleh Owner:** diperlukan sejak MVP.
7. **Jaminan (foto atau nomor ID):** opsional, ditentukan oleh kasir yang bertugas; tidak dicetak di struk.

### Pertanyaan Terbuka
Tidak ada pertanyaan terbuka yang menghambat MVP. Hal yang akan dikonfirmasi saat pengujian: alur cetak ke RPP02N dari perangkat kasir (HP/tablet/laptop) melalui Bluetooth maupun USB.
