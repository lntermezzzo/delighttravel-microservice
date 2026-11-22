# DELIGHT TRAVEL — Core Microservice

> Microservice inti untuk sistem rekomendasi wisata dan pertukaran budaya **DELIGHT TRAVEL**, dibangun sebagai Tugas 2 mata kuliah II3160 Teknologi Sistem Terintegrasi × II3140 Pengembangan Aplikasi Web dan Mobile.

**Kelompok `sabeb` — Kelas K01**

| Nama | NIM | Peran |
|---|---|---|
| Ahmad Rizal Fahmi | 18224085 | Backend & Microservice (TST) |
| Daniel Benaya Toar Supaath | 18224047 | Mobile Developer (PWAM) |

**URL Publik:** <https://sabeb.stei.fun/api>
**Repositori:** <https://github.com/lntermezzzo/delighttravel-microservice>

---

## Deskripsi Singkat

DELIGHT TRAVEL adalah sistem yang membantu wisatawan menemukan **acara, atraksi budaya, dan destinasi wisata** di sekitarnya berdasarkan minat kategori yang mereka pilih dan lokasi mereka saat itu. Microservice ini adalah layanan inti (core service) yang menyediakan tiga bounded context dari rancangan DDD Tugas 1:

- **Katalog Acara & Atraksi** (supporting) — CRUD destinasi/acara
- **Rekomendasi** (core) — perhitungan skor relevansi berbasis minat kategori + kedekatan jarak (haversine)
- **Identitas & Akses** (generic) — registrasi, login, dan pengelolaan minat pengguna dengan JWT

## Arsitektur

```
┌─────────────┐         ┌────────────────────────────┐
│   Client    │         │   Cloudflare Edge Network  │
│ (mobile/web)│────────▶│  https://sabeb.stei.fun    │
└─────────────┘         └──────────────┬─────────────┘
                                       │
                                       ▼
                        ┌────────────────────────────┐
                        │  Cloudflare Tunnel (k01-   │
                        │  sabeb) — native systemd   │
                        │  service di host STB       │
                        └──────────────┬─────────────┘
                                       │
                      ┌────────────────┴──────────────┐
                      │                               │
                      ▼ /api/*                        ▼ (lainnya)
          ┌────────────────────────┐    ┌──────────────────────┐
          │  Gateway (nginx)       │    │  (aaPanel di :1122)  │
          │  HOST port 80          │    └──────────────────────┘
          │  container :80         │
          │  — reverse proxy       │
          └───────────┬────────────┘
                      │ proxy_pass
                      ▼
          ┌────────────────────────┐
          │  core-service (Express)│
          │  container :3000       │
          │  ┌──────────────────┐  │
          │  │ SQLite (volume)  │  │
          │  │ users / dest /   │  │
          │  │ user_interests   │  │
          │  └──────────────────┘  │
          └────────────────────────┘
```

Setiap container dibatasi `mem_limit` dan `cpus` agar STB tidak hang:

| Service | Image | Memory | CPU |
|---|---|---|---|
| core-service | node:20-bookworm-slim (custom build) | 256 MB | 0.5 |
| gateway | nginx:1.28-alpine | 64 MB | default |

Cloudflare Tunnel sengaja **tidak** dijalankan di Docker — ia dipasang sebagai `cloudflared` systemd service native di host STB, dengan token yang dikelola oleh asisten kelas.

## Stack Teknologi

- **Runtime:** Node.js 20 (bookworm-slim base image)
- **Web framework:** Express.js 4
- **Database:** SQLite (embedded, via `better-sqlite3`) — WAL mode, file di volume Docker
- **Autentikasi:** JSON Web Token (`jsonwebtoken`) + bcrypt (`bcryptjs`) untuk hash password
- **Gateway:** nginx 1.28 (alpine) sebagai reverse proxy `/api/*` → `core-service:3000`
- **Containerization:** Docker + Docker Compose
- **Public exposure:** Cloudflare Tunnel (`cloudflared`)

## Cara Mendapat Akses

Microservice ini terbuka untuk publik melalui `https://sabeb.stei.fun/api`. Tidak perlu allow-list, API key, atau pendaftaran organisasi — cukup panggil endpoint yang dibutuhkan. Untuk endpoint yang memerlukan autentikasi (bertanda `Bearer` di tabel endpoint), ikuti langkah berikut:

1. **Daftar akun** dengan `POST /api/auth/register` (lihat contoh di bawah). Dapatkan JWT.
2. **Atau login** dengan `POST /api/auth/login` kalau akun sudah ada.
3. **Sertakan token** di setiap request terproteksi lewat header `Authorization: Bearer <token>`.

Token berlaku selama 7 hari. Semua endpoint publik (`GET /destinations`, `GET /recommendations`, `GET /health`) bisa langsung dipakai tanpa autentikasi.

## Daftar Endpoint

Base URL: `https://sabeb.stei.fun/api`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `POST` | `/auth/register` | — | Daftar akun baru → mengembalikan JWT |
| `POST` | `/auth/login` | — | Login → mengembalikan JWT |
| `POST` | `/auth/interests` | Bearer | Simpan minat kategori pengguna (untuk rekomendasi) |
| `GET` | `/destinations` | — | List destinasi, bisa difilter `?category=&city=` |
| `GET` | `/destinations/:id` | — | Detail satu destinasi |
| `POST` | `/destinations` | Bearer | Tambah destinasi baru |
| `PUT` | `/destinations/:id` | Bearer | Ubah destinasi |
| `DELETE` | `/destinations/:id` | Bearer | Hapus destinasi |
| `GET` | `/recommendations` | opsional | Dapatkan rekomendasi destinasi berdasarkan lokasi + minat |

### Skema Objek Utama

**Destination**
```json
{
  "id": 1,
  "title": "Festival Kuliner Braga",
  "category": "kuliner",
  "description": "Festival kuliner tahunan di kawasan Braga",
  "lat": -6.9175,
  "lng": 107.6191,
  "city": "Bandung",
  "open_hours": "16:00-22:00",
  "image_url": "",
  "created_at": "2026-11-22 14:56:35"
}
```

**User** (hanya field publik)
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "Ahmad"
}
```

## Contoh Request

Semua contoh di bawah bisa langsung dijalankan dari terminal/PowerShell.

### 1. Health check
```bash
curl https://sabeb.stei.fun/api/health
```
Response:
```json
{"status":"ok","service":"delighttravel-core"}
```

### 2. List destinasi
```bash
curl https://sabeb.stei.fun/api/destinations
curl "https://sabeb.stei.fun/api/destinations?category=kuliner"
curl "https://sabeb.stei.fun/api/destinations?city=Bandung"
```

### 3. Detail satu destinasi
```bash
curl https://sabeb.stei.fun/api/destinations/1
```

### 4. Register akun
```bash
curl -X POST https://sabeb.stei.fun/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"ahmad@example.com","password":"rahasia123","name":"Ahmad"}'
```
Response:
```json
{"token":"eyJhbGciOi...","user":{"id":1,"email":"ahmad@example.com","name":"Ahmad"}}
```

### 5. Login
```bash
curl -X POST https://sabeb.stei.fun/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ahmad@example.com","password":"rahasia123"}'
```

### 6. Simpan minat kategori (butuh token)
```bash
TOKEN="eyJhbGciOi..."   # dari register/login
curl -X POST https://sabeb.stei.fun/api/auth/interests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"categories":["kuliner","budaya"]}'
```

### 7. Tambah destinasi (butuh token)
```bash
curl -X POST https://sabeb.stei.fun/api/destinations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Gedung Sate",
    "category":"budaya",
    "description":"Gedung pemerintahan ikonik Bandung",
    "lat":-6.9024, "lng":107.6188,
    "city":"Bandung",
    "open_hours":"09:00-15:00"
  }'
```

### 8. Dapatkan rekomendasi
Tanpa login (pakai query `categories` eksplisit):
```bash
curl "https://sabeb.stei.fun/api/recommendations?lat=-6.9175&lng=107.6191&categories=kuliner,budaya"
```
Dengan login (otomatis pakai minat tersimpan):
```bash
curl "https://sabeb.stei.fun/api/recommendations?lat=-6.9175&lng=107.6191" \
  -H "Authorization: Bearer $TOKEN"
```
Response (contoh, dipotong):
```json
{
  "items": [
    {
      "id": 1,
      "title": "Festival Kuliner Braga",
      "category": "kuliner",
      "distance_km": 0.0,
      "score": 80.0,
      "reasons": ["cocok dengan minat 'kuliner'","sangat dekat (0.0 km)"],
      "...": "..."
    }
  ],
  "total": 3
}
```

**Formula skor rekomendasi:**
- Up to **50 poin** jika kategori destinasi cocok dengan minat user
- Up to **30 poin** berbasis kedekatan jarak (haversine), menurun seiring jarak

## Struktur Repositori

```
delighttravel-microservice/
├── core-service/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js            # entrypoint, seed data awal
│       ├── db.js               # inisialisasi SQLite + skema
│       ├── middleware/auth.js  # requireAuth, optionalAuth, signToken
│       └── routes/
│           ├── auth.js
│           ├── destinations.js
│           └── recommendations.js
├── nginx.conf                  # gateway: /api/* → core-service:3000
├── docker-compose.yml          # core-service + gateway, dengan mem_limit & cpus
├── .env.example                # template env; .env asli tidak di-commit
├── .gitignore
└── README.md
```

## Menjalankan Secara Lokal

Butuh Docker + Docker Compose.

```bash
# 1. clone repo
git clone https://github.com/lntermezzzo/delighttravel-microservice.git
cd delighttravel-microservice

# 2. siapkan env (isi JWT_SECRET dengan string random, misal `openssl rand -hex 32`)
cp .env.example .env
nano .env

# 3. bangun & jalankan
docker compose up -d --build

# 4. cek berjalan
curl localhost/api/health
curl localhost/api/destinations
```

Catatan: file `docker-compose.yml` mem-publish gateway di **host port 80** karena itu syarat ingress rule tunnel kami. Untuk pengembangan lokal di mesin yang port 80-nya sudah dipakai, ubah mapping di `docker-compose.yml` menjadi `"8080:80"` lalu akses `localhost:8080/api/...`.

## Deployment di STB

Microservice di-deploy di STB Armbian kelompok kami (port 80 host untuk gateway, port 3000 internal container untuk core-service). Akses publik dialirkan lewat **Cloudflare Tunnel** (`k01-sabeb`) yang dipasang sebagai `cloudflared` systemd service **native di host**, bukan container. Ingress rule dikonfigurasi oleh asisten kelas:

```
sabeb.stei.fun/api/*  →  http://localhost:80   (gateway microservice ini)
sabeb.stei.fun/*      →  https://localhost:1122 (aaPanel di STB, di luar scope tugas ini)
```
