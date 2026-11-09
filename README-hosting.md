# Migrasi server Evarti beserta seluruh data

Panduan ini memindahkan aplikasi Evarti ke VPS baru, termasuk **isi database**, akun, katalog, riwayat transaksi, add-on manual, nomor struk, audit log, foto kamera, dan foto jaminan. Contoh menggunakan Ubuntu 24.04, Node.js 24, MySQL, Nginx, PM2, dan domain yang sama.

Dokumen ini berisi instruksi untuk dijalankan oleh pengelola server. Mengubah README tidak menjalankan migrasi atau mengganti konfigurasi server.

## 1. Pilih jalur dan siapkan informasi server

| Kondisi | Jalur |
| --- | --- |
| MySQL lama dipindahkan ke MySQL baru | Ikuti langkah utama 2–10 |
| Aplikasi pindah VPS, MySQL terkelola tetap digunakan | Ikuti langkah utama, tetap backup database; pada langkah 6 gunakan koneksi database lama dan lewati restore |
| SQLite lama dipindahkan ke MySQL | Gunakan pengganti langkah database pada bagian 11 |
| Tetap memakai SQLite pada VPS baru | Gunakan bagian 12 untuk langkah database |

Siapkan akses SSH, akses administrator database, domain/DNS, serta akun Linux untuk menjalankan aplikasi. Contoh berikut memakai akun Linux `deploy` yang memiliki akses `sudo`; gunakan akun aplikasi Anda sendiri jika berbeda. PM2 harus dijalankan dengan akun yang sama dari awal sampai akhir, tanpa `sudo pm2`.

Ganti nilai contoh berikut sesuai server Anda:

| Nilai | Contoh di panduan |
| --- | --- |
| Folder aplikasi | `/var/www/evarti-sewa-camera` |
| Domain | `app.example.com` |
| IP VPS tujuan | `IP_SERVER_BARU` |
| Database sumber | `evarti` |
| Database tujuan baru/kosong | `evarti_migrated` |
| User database aplikasi tujuan | `evarti_app` |
| Proses PM2 | `evarti-api` |

Periksa `DATABASE_CLIENT`, nama database, host, dan lokasi `.env` yang benar di server lama. Jangan menyalin password ke tiket, chat, atau repositori. Backend membaca `.env` di root proyek terlebih dahulu; jika tidak ada, baru memakai `back-end/.env`. Environment proses yang sudah diatur juga dapat mengambil prioritas atas isi file.

**Rencanakan jeda transaksi.** Hentikan seluruh proses penulis ke database sumber sampai perpindahan selesai. Panduan ini memakai backup final saat aplikasi berhenti; tidak menyediakan sinkronisasi transaksi yang masuk setelah backup. Turunkan TTL DNS sebelum jadwal migrasi jika memungkinkan. Siapkan server baru terlebih dahulu untuk memperpendek jeda.

### Data yang harus ikut

| Komponen | Isi/lokasi sebenarnya |
| --- | --- |
| Database MySQL | `users`, `sessions`, `cameras`, `addons`, `receipt_sequences`, `transactions`, `transaction_items`, `transaction_addons`, `audit_logs` |
| Foto kamera | `back-end/uploads/cameras/` |
| Foto jaminan | `back-end/uploads/private/` |
| Konfigurasi backend | `.env` efektif, termasuk `SESSION_SECRET` |
| Konfigurasi frontend | `Front-end/.env*` yang digunakan saat build |
| Kode aplikasi | Seluruh sumber terbaru dan `package-lock.json`, termasuk perubahan yang belum masuk Git |

Add-on manual tersimpan di `transaction_addons`, bukan di katalog `addons`. Nomor struk berurutan memerlukan `receipt_sequences`; jangan hanya memindahkan tabel `transactions`.

Folder upload **bukan** `uploads/` di root proyek. Database menyimpan referensi file; menyalin SQL tanpa folder `back-end/uploads/` akan membuat foto hilang dari tampilan. `node_modules/` dan `Front-end/dist/` akan dibuat ulang di server tujuan.

## 2. Persiapan VPS baru — sebelum menghentikan server lama

Masuk sebagai akun aplikasi, misalnya `deploy`. Contoh perintah menggunakan **Bash**. Variabel shell hanya berlaku di sesi tempat variabel diisi; isi ulang setelah membuka sesi SSH baru.

```bash
bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg nginx mysql-client rsync tar gzip openssl build-essential python3
```

Pasang Node.js 24 dari repositori NodeSource jika Node.js yang sesuai belum tersedia:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/evarti-nodesource-setup.sh
sudo bash /tmp/evarti-nodesource-setup.sh
sudo apt-get install -y nodejs
node --version
npm --version
sudo npm install -g pm2
```

Proyek mensyaratkan Node.js minimal 20; contoh ini memakai Node.js 24 yang masih memiliki dukungan LTS. Gunakan arsitektur dan versi MySQL tujuan yang kompatibel dengan sumber. Hindari sekaligus melakukan downgrade MySQL dalam migrasi ini. Rujukan: [rilis Node.js](https://nodejs.org/en/about/previous-releases), [instalasi NodeSource](https://github.com/nodesource/distributions/blob/master/DEV_README.md).

Jika MySQL akan berada di VPS baru, pasang servernya:

```bash
sudo apt-get install -y mysql-server
sudo systemctl enable --now mysql
```

Jika memakai database terkelola, cukup pasang klien dan siapkan izin jaringan dari VPS baru ke layanan MySQL. Jangan membuka port database ke seluruh internet. Pastikan SSH tetap diizinkan ketika mengatur firewall; untuk website, izinkan TCP 80 dan 443.

Siapkan folder kerja:

```bash
APP_DIR=/var/www/evarti-sewa-camera
sudo install -d -m 755 -o "$USER" -g "$(id -gn)" "$APP_DIR"
```

Jangan menjalankan backend tujuan sebelum database dipulihkan atau migrasi SQLite selesai.

## 3. Server lama — hentikan transaksi dan buat backup final

Jalankan dari akun Linux yang mengelola proses PM2 lama:

```bash
bash
set -euo pipefail
APP_DIR=/var/www/evarti-sewa-camera
BACKUP_DIR="$HOME/evarti-migration/$(date +%Y%m%d-%H%M%S)"
umask 077
mkdir -p "$BACKUP_DIR/frontend-env"
cd "$APP_DIR"
pm2 status
pm2 stop evarti-api
```

Jika ada beberapa instance, worker, proses manual, atau server lain yang menulis ke database yang sama, hentikan semuanya. Website lama dapat menampilkan kegagalan API selama jeda ini; informasikan kepada kasir agar berhenti membuat transaksi. Jangan menjalankan perubahan struktur database selama dump.

### 3.1 Backup MySQL: struktur tabel dan seluruh isinya

Gunakan klien MySQL yang kompatibel dengan server sumber. Atur login backup satu kali agar password tidak ditulis pada argumen perintah atau riwayat shell:

```bash
mysql_config_editor set --login-path=evarti-source \
  --host=127.0.0.1 --port=3306 --user=USER_BACKUP --password
```

Ganti host, port, dan `USER_BACKUP`. Masukkan password saat diminta. Akun backup harus memiliki hak membaca seluruh tabel dan hak yang diperlukan `mysqldump`, termasuk `SHOW VIEW`/`TRIGGER` jika objek tersebut ada. Untuk database jarak jauh, tambahkan opsi TLS dan CA sesuai penyedia; contoh berikut mengasumsikan MySQL lokal.

```bash
SOURCE_DB=evarti
mysql --login-path=evarti-source --execute='SELECT VERSION();'
mysqldump --login-path=evarti-source \
  --single-transaction --quick --skip-lock-tables \
  --no-tablespaces --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  "$SOURCE_DB" > "$BACKUP_DIR/database.sql.partial"
test -s "$BACKUP_DIR/database.sql.partial"
mv "$BACKUP_DIR/database.sql.partial" "$BACKUP_DIR/database.sql"
gzip "$BACKUP_DIR/database.sql"
gzip -t "$BACKUP_DIR/database.sql.gz"
```

Dump ini menyertakan DDL tabel dan datanya, bukan hanya skema. Tabel aplikasi MySQL menggunakan InnoDB. `--single-transaction` membantu menjaga snapshot konsisten; penghentian penulis juga menyelaraskan database dengan file upload. Dump tidak menyertakan user/grant MySQL atau konfigurasi replikasi; akun database tujuan dibuat terpisah. Opsi di atas ditujukan untuk klien Oracle MySQL, bukan `mariadb-dump`. Rujukan: [panduan mysqldump](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html).

Untuk koneksi MySQL terkelola, gunakan opsi seperti `--ssl-mode=VERIFY_IDENTITY --ssl-ca=/path/ca-provider.pem` pada perintah klien sesuai ketentuan penyedia. Opsi TLS pada klien backup terpisah dari `MYSQL_SSL` milik aplikasi.

### 3.2 Catat jumlah baris dan total transaksi sumber

Simpan query berikut untuk dijalankan kembali setelah restore:

```bash
cat > "$BACKUP_DIR/verify.sql" <<'SQL'
SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'cameras', COUNT(*) FROM cameras
UNION ALL SELECT 'addons', COUNT(*) FROM addons
UNION ALL SELECT 'receipt_sequences', COUNT(*) FROM receipt_sequences
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'transaction_items', COUNT(*) FROM transaction_items
UNION ALL SELECT 'transaction_addons', COUNT(*) FROM transaction_addons
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
ORDER BY 1;
SELECT COUNT(*) AS transaction_count, COALESCE(SUM(total), 0) AS all_totals,
       COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) AS paid_totals,
       MAX(receipt_no) AS max_receipt_no
FROM transactions;
SELECT location_prefix, receipt_date, last_number
FROM receipt_sequences ORDER BY location_prefix, receipt_date;
SQL
mysql --login-path=evarti-source --batch --skip-column-names "$SOURCE_DB" \
  < "$BACKUP_DIR/verify.sql" > "$BACKUP_DIR/database-before.tsv"
```

### 3.3 Backup konfigurasi, upload, dan kode terbaru

```bash
if [ -f .env ]; then
  cp .env "$BACKUP_DIR/backend.env"
else
  cp back-end/.env "$BACKUP_DIR/backend.env"
fi
for env_file in Front-end/.env Front-end/.env.local Front-end/.env.production Front-end/.env.production.local; do
  if [ -f "$env_file" ]; then
    cp "$env_file" "$BACKUP_DIR/frontend-env/$(basename "$env_file")"
  fi
done
mkdir -p back-end/uploads
tar -czf "$BACKUP_DIR/uploads.tar.gz" -C "$APP_DIR" back-end/uploads
tar --exclude='node_modules' --exclude='.git' --exclude='.env*' \
  --exclude='.data' --exclude='./Front-end/dist' \
  --exclude='./back-end/uploads' --exclude='./uploads' \
  -czf "$BACKUP_DIR/source.tar.gz" -C "$APP_DIR" .
```

Jika proses lama memperoleh variabel penting dari konfigurasi PM2 atau environment sistem, masukkan nilai efektif yang diperlukan ke `backend.env` secara aman sebelum melanjutkan. Simpan juga sertifikat CA database khusus jika digunakan. Jangan mencetak konfigurasi rahasia ke log.

Arsip kode ini menjaga perubahan lokal yang belum masuk Git. Jika memilih clone dari Git, pastikan seluruh perubahan yang ingin dipindahkan sudah tersedia pada commit yang benar; clone saja tidak membawa database, `.env`, atau upload.

Periksa arsip dan buat checksum:

```bash
tar -tzf "$BACKUP_DIR/source.tar.gz" > /dev/null
tar -tzf "$BACKUP_DIR/uploads.tar.gz" > /dev/null
cd "$BACKUP_DIR"
sha256sum database.sql.gz uploads.tar.gz source.tar.gz backend.env verify.sql database-before.tsv > SHA256SUMS
find frontend-env -type f -exec sha256sum {} + >> SHA256SUMS
sha256sum -c SHA256SUMS
```

Untuk jalur SQLite, gunakan backup pada bagian 11/12 sebagai pengganti `database.sql.gz` dan pemeriksaan MySQL di atas; sesuaikan nama file dalam checksum. Backup berisi data penyewa, hash password, dan rahasia aplikasi. Simpan di luar direktori publik Nginx dengan akses terbatas.

## 4. Kirim backup ke server baru

Masih dari **server lama**, dengan `BACKUP_DIR` tetap terisi:

```bash
ssh deploy@IP_SERVER_BARU 'umask 077; mkdir -p "$HOME/evarti-migration"'
rsync -av --progress "$BACKUP_DIR/" deploy@IP_SERVER_BARU:evarti-migration/
```

Pastikan direktori tujuan khusus untuk migrasi ini dan tidak mencampur backup lain. Data ditransfer melalui SSH. Jika SSH tidak memakai port 22, tambahkan opsi SSH port yang sesuai ke kedua perintah.

Jangan menghapus backup ataupun database sumber setelah transfer.

## 5. Server baru — pulihkan kode dan konfigurasi

Jalankan sebagai akun aplikasi tujuan:

```bash
bash
set -euo pipefail
APP_DIR=/var/www/evarti-sewa-camera
MIGRATION_DIR="$HOME/evarti-migration"
cd "$MIGRATION_DIR"
sha256sum -c SHA256SUMS
```

Pastikan folder aplikasi tujuan kosong dan memang disiapkan untuk migrasi ini. Gunakan folder baru jika sudah ada aplikasi lain di lokasi tersebut.

```bash
if [ -n "$(ls -A "$APP_DIR")" ]; then
  echo 'Folder tujuan tidak kosong; pilih folder aplikasi baru sebelum melanjutkan.'
  exit 1
fi
tar --no-same-owner -xzf "$MIGRATION_DIR/source.tar.gz" -C "$APP_DIR"
tar --no-same-owner -xzf "$MIGRATION_DIR/uploads.tar.gz" -C "$APP_DIR"
cp "$MIGRATION_DIR/backend.env" "$APP_DIR/.env"
for env_file in "$MIGRATION_DIR"/frontend-env/.env*; do
  if [ -f "$env_file" ]; then
    cp "$env_file" "$APP_DIR/Front-end/$(basename "$env_file")"
  fi
done
chmod 600 "$APP_DIR/.env"
find "$APP_DIR/back-end/uploads" -type d -exec chmod 700 {} +
find "$APP_DIR/back-end/uploads" -type f -exec chmod 600 {} +
cd "$APP_DIR"
npm ci
```

Jalankan `npm ci` dari root proyek agar kedua workspace terpasang sesuai lockfile. Jangan menyalin `node_modules` dari server lama: modul native SQLite dapat berbeda menurut sistem operasi, arsitektur, dan versi Node.js. Dependency frontend untuk build juga diperlukan, sehingga jangan memakai `--omit=dev` pada tahap ini.

Edit `.env` dengan editor:

```bash
nano "$APP_DIR/.env"
```

Contoh konfigurasi tujuan dengan MySQL lokal:

```dotenv
NODE_ENV=production
PORT=3000
DATABASE_CLIENT=mysql
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=evarti_app
MYSQL_PASSWORD=GANTI_DENGAN_PASSWORD_DATABASE_TUJUAN
MYSQL_DATABASE=evarti_migrated
MYSQL_SSL=false
SESSION_SECRET=SALIN_NILAI_ASLI_DARI_SERVER_LAMA
FRONTEND_ORIGIN=https://app.example.com
COOKIE_SECURE=true
OWNER_PASSWORD=SALIN_NILAI_VALID_DARI_ENV_LAMA
CASHIER1_PASSWORD=SALIN_NILAI_VALID_DARI_ENV_LAMA
CASHIER2_PASSWORD=SALIN_NILAI_VALID_DARI_ENV_LAMA
```

Nilai contoh di atas harus diganti. Gunakan `MYSQL_SSL=true` untuk layanan database yang memerlukan TLS. Ketiga password bootstrap harus tetap valid, minimal 12 karakter; server memvalidasinya saat startup meskipun akun sudah dipulihkan. Password login akun yang sudah ada berasal dari hash dalam tabel `users`; mengganti variabel password bootstrap tidak mereset akun lama.

Pertahankan `SESSION_SECRET` lama jika ingin sesi yang masih valid tetap dapat dikenali pada domain yang sama. Jika menggantinya atau mengganti domain, pengguna dapat perlu login kembali. Jangan memakai placeholder sebagai secret; panjang minimal 32 karakter.

Untuk frontend dan API pada domain yang sama, pastikan konfigurasi frontend efektif memiliki `VITE_API_URL=` kosong. Periksa juga `.env.local`, `.env.production`, `.env.production.local`, dan environment shell agar tidak ada URL API lama yang mengambil prioritas. Nilai `VITE_*` dimasukkan saat build, sehingga perubahan URL memerlukan build ulang.

## 6. Server baru — pulihkan seluruh database sebelum startup

Bagian utama ini untuk **MySQL ke MySQL lokal**. Untuk SQLite gunakan bagian 11/12. Untuk MySQL terkelola, jalankan SQL melalui akun administrator penyedia dan sesuaikan opsi host/TLS.

Buka konsol administrator MySQL:

```bash
sudo mysql
```

Buat database tujuan baru. Gunakan password kuat yang sama dengan `MYSQL_PASSWORD` pada `.env`. Jika nama database atau user sudah ada, pilih nama baru; jangan menimpa database aktif.

```sql
CREATE DATABASE evarti_migrated CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'evarti_app'@'127.0.0.1' IDENTIFIED BY 'GANTI_DENGAN_PASSWORD_DATABASE_TUJUAN';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
ON evarti_migrated.* TO 'evarti_app'@'127.0.0.1';
EXIT;
```

Jika database berada di host lain, batas host akun MySQL harus sesuai alamat sumber koneksi VPS tujuan, bukan otomatis `127.0.0.1`. Gunakan akun administrator terpisah untuk restore.

Pastikan jumlah tabel di database tujuan adalah **0**:

```bash
sudo mysql --batch --skip-column-names --execute="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'evarti_migrated';"
```

Jika tidak 0, berhenti dan pilih database tujuan baru. Dump dapat berisi perintah penggantian tabel; jangan memulihkannya ke database yang sudah berisi data.

```bash
gzip -dk "$MIGRATION_DIR/database.sql.gz"
sudo mysql --default-character-set=utf8mb4 evarti_migrated < "$MIGRATION_DIR/database.sql"
sudo mysql --batch --skip-column-names evarti_migrated \
  < "$MIGRATION_DIR/verify.sql" > "$MIGRATION_DIR/database-after.tsv"
diff -u "$MIGRATION_DIR/database-before.tsv" "$MIGRATION_DIR/database-after.tsv"
```

`diff` yang tidak mengeluarkan perbedaan menunjukkan ringkasan jumlah baris, total nominal, dan urutan struk cocok. Lakukan sebelum backend mulai menerima koneksi/login. Untuk memastikan isi lengkap, tetap pertahankan dump dan cek beberapa transaksi beserta item/add-on lama; hitungan baris saja bukan pemeriksaan seluruh nilai. Rujukan: [restore dump SQL MySQL](https://dev.mysql.com/doc/refman/8.4/en/reloading-sql-format-dumps.html).

Untuk database terkelola yang tetap sama, **jangan import dump ke database tersebut**. Arahkan `.env` ke koneksi lama, pastikan server lama sudah berhenti menulis, dan bandingkan data sebelum startup tujuan.

## 7. Build dan jalankan backend tujuan

```bash
cd "$APP_DIR"
npm run build
chmod 755 "$APP_DIR" "$APP_DIR/Front-end"
find "$APP_DIR/Front-end/dist" -type d -exec chmod 755 {} +
find "$APP_DIR/Front-end/dist" -type f -exec chmod 644 {} +
pm2 start back-end/src/server.js --name evarti-api --interpreter node --cwd "$APP_DIR"
pm2 status
pm2 logs evarti-api --lines 50 --nostream
curl --fail http://127.0.0.1:3000/api/health
```

API yang berhasil berjalan mengembalikan `{"status":"ok"}`. Backend hanya bind ke `127.0.0.1`; Nginx perlu berada pada host yang sama. Pemeriksaan health ini menguji proses HTTP, bukan kesamaan semua data.

Catatan perilaku startup versi kode ini:

- Backend membuat tabel yang belum ada dan menambahkan kolom `customer_pager_number` jika perlu.
- Add-on bawaan hanya diisi saat bootstrap akun pertama. Dengan tabel `users` yang dipulihkan, katalog add-on lama tetap dipakai.
- Kamera bawaan yang tidak ditemukan masih ditambahkan oleh proses seed, dan nama akun standar diselaraskan. Karena itu perbandingan hasil restore dilakukan **sebelum startup**, dan katalog kamera perlu diperiksa kembali setelah startup.
- Menjalankan aplikasi pada database kosong sebelum restore akan membuat akun/data awal. Jika terlanjur, hentikan backend dan gunakan database tujuan baru untuk restore atau migrasi SQLite.

Aktifkan PM2 saat reboot:

```bash
pm2 startup
```

Jalankan perintah `sudo ...` yang ditampilkan PM2, kemudian:

```bash
pm2 save
```

Jangan menyalin dump PM2 lama lalu menjalankannya tanpa memeriksa path dan environment-nya. Rujukan: [startup PM2](https://pm2.keymetrics.io/docs/usage/startup/).

## 8. Nginx, HTTPS, dan perpindahan DNS

Buat konfigurasi pada **server baru**:

```bash
sudo nano /etc/nginx/sites-available/evarti
```

```nginx
server {
    listen 80;
    server_name app.example.com;
    root /var/www/evarti-sewa-camera/Front-end/dist;
    index index.html;

    # Batas Nginx harus cukup untuk upload foto 2–3 MB plus multipart.
    client_max_body_size 5m;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Foto dilayani lewat endpoint API yang memeriksa akses pengguna. **Jangan** membuat `alias` publik untuk `back-end/uploads/private/`, `.env`, SQL, atau direktori backup. `root` Nginx harus menunjuk hanya ke hasil build frontend.

```bash
sudo ln -s /etc/nginx/sites-available/evarti /etc/nginx/sites-enabled/evarti
sudo nginx -t
sudo systemctl reload nginx
```

Jika symlink sudah ada, periksa targetnya dan gunakan konfigurasi yang benar; tidak perlu membuatnya lagi. `client_max_body_size` menghindari batas default Nginx yang lebih kecil daripada batas foto aplikasi. Rujukan: [direktif Nginx](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size).

Sebelum mengganti DNS, cek dari komputer pengelola dengan IP tujuan sebenarnya:

```bash
curl --fail --resolve app.example.com:80:IP_SERVER_BARU http://app.example.com/api/health
curl --head --resolve app.example.com:80:IP_SERVER_BARU http://app.example.com/
```

Ini memeriksa routing HTTP di server baru. Dengan `COOKIE_SECURE=true`, pengujian login harus melalui **HTTPS**. Untuk uji login sebelum pindah DNS, siapkan sertifikat domain yang sah melalui DNS-01/plugin DNS penyedia, lalu gunakan pemetaan hosts lokal ke IP baru. Perubahan hosts lokal tidak mengubah tujuan validasi HTTP-01 Let's Encrypt.

Jika memakai alur sederhana dengan jeda layanan, lanjutkan:

1. Pastikan database, upload, dan health tujuan sudah diperiksa.
2. Ubah record DNS A ke IP baru; perbarui/hapus AAAA lama jika memakai IPv6.
3. Tunggu DNS publik mengarah ke server baru, kemudian pasang sertifikat.
4. Selesaikan pemeriksaan HTTPS dan login pada bagian 9 sebelum kasir kembali bekerja.

Contoh Certbot di Ubuntu dengan paket Nginx:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.example.com --redirect
sudo certbot renew --dry-run
```

Pastikan port 80 dan 443 dapat diakses publik. Certbot HTTP-01 memerlukan domain mengarah ke mesin yang melayani challenge. Alternatif instalasi dan plugin tersedia di [panduan Certbot](https://certbot.eff.org/instructions?ws=nginx&os=snap). Jangan mencampur dua instalasi Certbot yang berbeda pada satu server.

Pertahankan backend lama dalam keadaan berhenti selama peralihan DNS. Pengunjung yang masih menggunakan cache DNS lama bisa gagal mengakses API sampai cache berakhir; menghidupkan dua backend dengan database terpisah akan memecah transaksi.

## 9. Pemeriksaan akhir sebelum operasional dibuka

```bash
curl --fail https://app.example.com/api/health
curl --head https://app.example.com/
pm2 status
pm2 logs evarti-api --lines 100 --nostream
```

Periksa lewat browser:

- Login owner dan kasir memakai password lama yang ada di database.
- Jumlah dan harga kamera/add-on sesuai, termasuk opsi yang dinonaktifkan/dihapus.
- Riwayat transaksi lama, status pembayaran, total, item kamera, dan add-on manual terbaca.
- Foto kamera dan foto jaminan lama dapat dibuka oleh akun yang berhak.
- Laporan periode lama dan unduhan PDF sesuai.
- Pratinjau/cetak ulang struk lama memuat data yang benar. Cetak ulang menambah penghitung cetak.
- Setelah operator menyetujui pembukaan layanan, transaksi baru mendapatkan nomor struk yang benar dan tersimpan di database tujuan. Jika melakukan transaksi uji di produksi, catat sebagai uji dan tangani lewat mekanisme void yang tersedia; jangan menghapus baris secara manual.
- Setelah restart backend, transaksi dan perubahan katalog tetap ada.

Buat backup baru setelah verifikasi berhasil. Simpan backup final server lama sampai periode retensi yang Anda tentukan berakhir. Jangan menghapus database lama langsung setelah website pertama kali berhasil dibuka.

## 10. Rollback jika perpindahan bermasalah

**Jika belum ada transaksi/perubahan baru pada server tujuan:**

1. Hentikan backend tujuan: `pm2 stop evarti-api` pada server baru.
2. Jika database lama masih utuh dan tidak tertimpa, arahkan DNS kembali ke IP lama.
3. Jalankan `pm2 start evarti-api` pada server lama.
4. Periksa HTTPS, login, dan riwayat; hanya satu server yang boleh menerima penulisan.

**Jika sudah ada transaksi atau perubahan pada server tujuan:**

Jangan langsung menghidupkan database lama yang sudah tertinggal. Hentikan penulisan di kedua sisi, backup database dan upload terbaru dari tujuan, lalu pulihkan data terbaru ke server yang akan dipakai dengan prosedur restore yang sama. Verifikasi data dan urutan struk sebelum membuka layanan. Memulai server lama tanpa membawa perubahan terbaru dapat menghilangkan transaksi yang dibuat setelah perpindahan.

Jika kedua aplikasi menggunakan layanan MySQL yang sama, tidak perlu menggandakan database saat rollback, tetapi tetap sinkronkan file upload baru dan pastikan hanya backend yang dipilih berjalan.

## 11. Alternatif: migrasi SQLite lama ke MySQL

Gunakan bagian ini sebagai pengganti langkah dump/restore MySQL. Backup kode, `.env`, dan upload tetap wajib.

### Server lama

Pastikan `DATABASE_CLIENT=sqlite` dan temukan **file SQLite yang benar** dari `DATABASE_PATH` serta working directory proses lama. Path relatif dapat menunjuk ke `.data/evarti.sqlite` di root atau `back-end/.data/evarti.sqlite`. Jangan mengira kedua file itu sama.

Hentikan seluruh backend penulis, lalu gunakan utilitas SQLite:

```bash
sudo apt-get install -y sqlite3
SQLITE_SOURCE=/path/absolut/ke/evarti.sqlite
sqlite3 "$SQLITE_SOURCE" ".backup '$BACKUP_DIR/evarti.sqlite'"
sqlite3 "$BACKUP_DIR/evarti.sqlite" 'PRAGMA integrity_check;'
```

Hasil integritas harus `ok`. API backup SQLite membuat snapshot file yang konsisten; jangan menyalin file utama database yang masih aktif sambil mengabaikan file WAL. Rujukan: [SQLite backup](https://www.sqlite.org/backup.html).

Kirim `evarti.sqlite`, kode, konfigurasi, dan upload melalui SSH. Ganti `database.sql.gz` dengan `evarti.sqlite` pada daftar checksum. Query `verify.sql` dan output `.tsv` pada bagian MySQL tidak diperlukan untuk jalur ini; catat jumlah baris tabel sumber sebagai pembanding terpisah.

### Server baru

1. Pulihkan kode/upload dan jalankan `npm ci` dari root proyek.
2. Buat database/user MySQL baru seperti bagian 6; database belum memiliki data aplikasi.
3. Atur `.env` tujuan untuk MySQL.
4. **Jangan menjalankan `server.js` atau PM2 terlebih dahulu.**
5. Jalankan dari root proyek menggunakan path SQLite absolut:

```bash
cd "$APP_DIR"
node back-end/scripts/migrate-sqlite-to-mysql.js "$MIGRATION_DIR/evarti.sqlite"
```

Script membuat tabel MySQL tanpa seed, memeriksa foreign key SQLite, menolak tabel tujuan yang sudah berisi data, lalu menyalin kesembilan tabel dalam satu transaksi. Log menampilkan jumlah baris setiap tabel. File SQLite sumber tidak dihapus. Bandingkan hitungan tabel sumber dan tujuan sebelum startup, lalu lanjutkan ke bagian 7–9.

Jika script menolak karena MySQL sudah terisi seed, hentikan backend dan gunakan database tujuan baru. Jangan mengosongkan database aktif hanya untuk melewati pemeriksaan script.

## 12. Alternatif: tetap memakai SQLite di server baru

Buat backup `evarti.sqlite` dengan prosedur SQLite di bagian 11. Pulihkan kode, upload, dan `.env` seperti biasa. Sebelum backend tujuan berjalan:

```bash
mkdir -p "$APP_DIR/.data"
cp "$MIGRATION_DIR/evarti.sqlite" "$APP_DIR/.data/evarti.sqlite"
chmod 700 "$APP_DIR/.data"
chmod 600 "$APP_DIR/.data/evarti.sqlite"
```

Atur `.env`:

```dotenv
DATABASE_CLIENT=sqlite
DATABASE_PATH=/var/www/evarti-sewa-camera/.data/evarti.sqlite
```

Gunakan path absolut agar restart PM2 dari working directory berbeda tidak membuat database baru. Konfigurasi produksi, secret, password bootstrap valid, upload, HTTPS, dan pemeriksaan aplikasi tetap mengikuti bagian utama. Backend memerlukan izin menulis direktori `.data` untuk file WAL/SHM. Jangan menunjuk `DATABASE_PATH=:memory:` untuk data yang harus bertahan setelah restart.

## 13. Troubleshooting dan backup sesudah migrasi

| Gejala | Pemeriksaan |
| --- | --- |
| Data terlihat kosong | Periksa database/client yang dipakai, `MYSQL_DATABASE`, host, path SQLite, dan environment PM2; pastikan dump berisi data dan dipulihkan sebelum bootstrap |
| Password lama gagal | Pastikan tabel `users` berasal dari backup yang benar; variabel bootstrap tidak mengubah hash password akun lama |
| Sesi berakhir | Login ulang; periksa `SESSION_SECRET`, HTTPS, domain cookie, dan waktu sistem |
| Foto hilang | Pastikan seluruh `back-end/uploads/` ikut dipulihkan dan dimiliki user backend |
| `EACCES` saat upload | Pastikan user PM2 memiliki direktori upload dan izin menulis; jangan memakai `chmod 777` |
| HTTP 413 | Periksa `client_max_body_size` Nginx serta batas upload aplikasi: kamera 3 MB, jaminan 2 MB |
| API mengarah ke VPS lama | Periksa DNS A/AAAA dan konfigurasi `VITE_API_URL` yang dipakai saat build; build ulang frontend setelah koreksi |
| HTTP 502 | Periksa PM2, log backend, port loopback 3000, dan proxy Nginx |
| CORS / CSRF gagal | Cocokkan domain HTTPS dengan `FRONTEND_ORIGIN`; muat ulang halaman dan login ulang |
| Koneksi MySQL ditolak | Periksa host, port, grant host user, password tujuan, firewall, dan opsi TLS |
| Gagal bootstrap setelah restore | Periksa tiga variabel password minimal 12 karakter dan `SESSION_SECRET` valid; jangan mengganti tabel akun untuk memperbaiki konfigurasi |

Setelah mengubah `.env`, pastikan environment lama pada definisi proses PM2 tidak menimpanya. Restart dari akun dan direktori yang benar:

```bash
cd "$APP_DIR"
pm2 restart evarti-api --update-env
pm2 save
```

`--update-env` memperbarui environment proses dari sesi pemanggil; opsi ini tidak otomatis menghapus variabel lama yang masih Anda tetapkan dalam konfigurasi PM2. Koreksi definisi environment jika ada nilai yang bertentangan.

Backup berkala harus mencakup database, `.env`, dan upload sebagai satu paket yang dapat dipulihkan. Untuk snapshot database dan file yang benar-benar selaras, gunakan jeda penulisan atau mekanisme snapshot terkoordinasi. Simpan salinan di lokasi terpisah dan lakukan uji restore ke database uji, bukan langsung ke database operasional.
