# Evarti frontend

## Menjalankan lokal

```sh
npm install
npm run dev
```

Login menggunakan akun yang password-nya dikonfigurasi di backend:

- `owner`
- `kasir1`
- `kasir2`

Lokasi transaksi Kasir 1 otomatis ditetapkan ke Cafe dan Kasir 2 ke Event.
Owner dapat memilih lokasi transaksi.

Frontend menggunakan cookie sesi backend dan API same-origin melalui proxy Vite.
Jalankan backend pada port `3000`, kemudian jalankan frontend dengan `npm run dev`.
Atur `VITE_API_URL` hanya jika API di-host pada origin terpisah; origin tersebut
harus diizinkan pada `FRONTEND_ORIGIN` backend dan memakai HTTPS saat production.

QRIS resmi DANA belum tersedia sebagai aset, jadi frontend menampilkan instruksi
verifikasi manual tanpa membuat QR palsu.

Build produksi lokal dapat diperiksa dengan `npm run build`.
