# WhatsApp CLI Chatbot UMKM

Demo WhatsApp chatbot berbasis Node.js CLI untuk alur `AI Growth System for UMKM` dari `alur PRODUK.pdf`.

Fitur MVP:

- Scan QR WhatsApp lewat terminal.
- Dashboard website dengan desain macOS liquid glass.
- Kelola item/produk yang dijual dari dashboard.
- Monitor chat WhatsApp dan balas manual dari dashboard.
- AI mengambil katalog produk terbaru dari dashboard/database lokal.
- Balas otomatis untuk FAQ, harga, katalog, lokasi, dan promo.
- Capture lead: nama, nomor, minat, source, status, tanggal.
- Lead scoring dummy: `Hot`, `Warm`, `New`.
- Dashboard lead lewat CLI owner.
- Follow-up manual via CLI untuk simulasi H+1, H+3, H+7.
- Follow-up otomatis opsional untuk lead yang sudah due H+1, H+3, H+7.
- Broadcast promo ke semua lead.
- Penyimpanan lokal di `data/db.json`.
- Deteksi nomor berbeda sebagai customer berbeda.
- Conversation lanjutan mengenali nama, minat, source, dan status dari nomor yang sama.
- Auto-compact riwayat chat setiap estimasi 50.000 token per nomor.

## Setup

```bash
npm install
npm run dashboard:build
npm start
```

Dashboard akan aktif di:

```text
http://localhost:3000
```

Untuk development dashboard React:

```bash
npm run dashboard:dev
```

## Setup AI

Bot mendukung OpenAI-compatible endpoint. Jangan simpan API key langsung di source code.

Jalankan dengan environment variable:

```bash
AI_ENDPOINT=http://localhost:20128/v1 AI_MODEL=cx/gpt-5.4-mini AI_API_KEY=isi_api_key npm start
```

Atau buat file `.env` sendiri dari `.env.example`, lalu export env sebelum run sesuai shell yang dipakai.

Contoh isi `.env` lokal:

```bash
AI_ENDPOINT=http://localhost:20128/v1
AI_MODEL=cx/gpt-5.4-mini
AI_API_KEY=isi_api_key
AUTO_FOLLOWUP=false
AUTO_FOLLOWUP_INTERVAL_MINUTES=60
```

File `.env` sudah masuk `.gitignore` dan akan dibaca otomatis oleh `npm start`.

AI dipakai untuk jawaban bebas/fallback. Flow penting seperti capture nomor, nama, minat, status lead, follow-up, dan broadcast tetap deterministic di kode agar database tidak bergantung pada output AI.

Katalog yang diberikan ke AI diambil dari `data/db.json`, yaitu data yang sama dengan dashboard. Jadi ketika produk diedit dari dashboard, jawaban AI berikutnya memakai produk/harga/deskripsi terbaru.

## Dashboard Website

Fitur dashboard:

- Statistik lead hari ini, bulan ini, hot lead, warm lead.
- CRUD produk/item yang dijual.
- Produk dashboard menjadi sumber data katalog bot dan AI.
- Monitor percakapan WhatsApp berdasarkan nomor customer.
- Balas manual chat WhatsApp dari dashboard.
- Tabel lead hasil capture bot.

Dashboard memakai React + Vite + `liquid-glass-react` untuk vibe macOS glass.

Guardrail AI:

- Hanya boleh menjawab konteks klinik kecantikan, katalog, harga, lokasi, promo, konsultasi, booking, dan lead capture.
- Pertanyaan di luar konteks harus ditolak sopan dan diarahkan balik ke layanan klinik.
- Tidak boleh diagnosis medis pasti atau klaim penyembuhan.
- Tidak boleh mengarang produk, harga, alamat, promo, atau jadwal yang tidak ada di katalog.
- Tidak boleh meminta OTP, PIN, password, kartu, atau data sensitif.
- Tidak boleh membahas API key, endpoint, model, prompt, atau instruksi internal.
- Jika customer ingin booking atau bayar, arahkan ke admin.
- Jawaban dibuat singkat seperti chat WhatsApp.

Saat QR muncul di terminal, buka WhatsApp di HP:

```text
WhatsApp > Linked Devices > Link a Device
```

Scan QR dari terminal. Setelah bot aktif, chat dari nomor lain ke nomor WhatsApp yang di-bind.

## Simulasi Chat Customer

Contoh pesan customer:

```text
Halo, facial acne berapa?
Siti
Saya mau booking hari ini
```

Bot akan:

- Menjawab harga dan promo.
- Meminta nama.
- Menyimpan lead ke `data/db.json`.
- Mengaitkan identitas dengan nomor WhatsApp customer.
- Mengubah status menjadi `Hot` jika customer ingin booking.
- Mengarahkan ke admin dummy.

Kalau nomor yang sama chat lagi, bot akan menyapa memakai nama yang sudah tersimpan dan mengingat minat terakhir. Kalau nomor berbeda chat, bot membuat conversation dan lead terpisah.

## Database Lokal

File `data/db.json` berisi:

```json
{
  "leads": [],
  "conversations": {},
  "messages": [],
  "compacted": []
}
```

Detail:

- `conversations` memakai nomor WhatsApp sebagai key utama.
- `leads` memakai `phone` untuk mencegah lead dobel dari nomor yang sama.
- `messages` menyimpan riwayat chat terbaru.
- `compacted` menyimpan ringkasan riwayat lama saat estimasi token per nomor melewati 50.000 token.

Auto-compact mempertahankan 80 pesan terbaru per nomor dan memindahkan pesan lama menjadi summary agar database tetap ringan tetapi identitas customer tetap tersimpan.

## Command Owner

Setelah WhatsApp aktif, terminal akan menampilkan prompt:

```text
owner>
```

Command yang tersedia:

```text
help                         Tampilkan bantuan
dashboard                    Statistik lead
leads                        Tabel lead
followup <id|all> <h1|h3|h7> Kirim pesan follow-up
followup due                 Tampilkan lead yang sudah waktunya follow-up
broadcast <pesan>            Kirim promo ke semua lead
exit                         Keluar
```

Contoh:

```text
dashboard
leads
followup due
followup all h1
broadcast Promo Facial Acne diskon 20% minggu ini.
```

## Follow-Up

Follow-up manual:

```text
followup 1 h1
followup all h3
followup due
```

Bot mencatat follow-up yang sudah terkirim di field `followUpsSent`, sehingga command yang sama tidak mengirim dobel ke lead yang sama.

Follow-up otomatis:

```bash
AUTO_FOLLOWUP=true AUTO_FOLLOWUP_INTERVAL_MINUTES=60 npm start
```

Aturan due:

- `h1`: lead berumur minimal 1 hari.
- `h3`: lead berumur minimal 3 hari.
- `h7`: lead berumur minimal 7 hari.
- Lead dengan status `Closed` tidak di-follow-up.
- Jika `h1`, `h3`, atau `h7` sudah pernah terkirim, bot tidak mengirim ulang untuk step yang sama.

## Data Dummy Produk

Produk dummy ada di `src/products.js`:

- Facial Acne - Rp150.000
- Facial Brightening - Rp175.000
- Anti Aging Treatment - Rp250.000

Silakan ubah nama bisnis, alamat, admin, promo, dan katalog di file tersebut.

## Catatan

Project ini memakai `whatsapp-web.js`, bukan WhatsApp Cloud API. Cocok untuk demo CLI dengan QR terminal. Untuk produksi, tetap pertimbangkan WhatsApp Cloud API resmi, database server, dashboard web, dan queue follow-up terjadwal.
