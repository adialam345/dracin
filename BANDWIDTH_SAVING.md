# Panduan Menghemat Bandwidth VPS

Saya telah melakukan optimasi otomatis pada kode untuk menghemat bandwidth server/VPS Anda. Berikut adalah detailnya dan langkah tambahan yang bisa Anda ambil.

## 1. Optimasi Otomatis (Sudah Diterapkan)

Saya telah memodifikasi `src/pages/api/proxy.ts` untuk:

*   **Dukungan Caching Cerdas (304 Not Modified)**:
    Jika browser pengguna sudah memiliki video segment (file `.ts`) di cache, proxy sekarang akan mengembalikan respons `304 Not Modified` (tanpa body/data) alih-alih mengunduh ulang file dari server source. Ini secara drastis mengurangi penggunaan bandwidth untuk pengguna yang me-replay video atau seeking backward.
    
*   **Caching Playlist (M3U8)**:
    File playlist sekarang memiliki header `Cache-Control`.
    *   **VOD (Film/Drama Selesai)**: Dicache selama **1 jam**.
    *   **Live**: Dicache selama **15 detik**.
    Sebelumnya, setiap request playlist akan membebani VPS. Sekarang browser akan menyimpannya.

## 2. Solusi Ultimate: Cloudflare Worker (Opsional)

Jika Anda ingin **menghemat bandwidth hampir 100%**, Anda bisa memindahkan beban proxy dari VPS Anda ke **Cloudflare Workers** (Gratis 100k request/hari).

Saya telah membuatkan skrip worker di:
`src/workers/proxy-worker.js`

### Cara Menggunakan:

1.  Login ke [Cloudflare Dashboard](https://dash.cloudflare.com/).
2.  Masuk ke menu **Workers & Pages** -> **Create Application** -> **Create Worker**.
3.  Beri nama (misalnya: `video-proxy`).
4.  Klik **Deploy**.
5.  Klik **Edit Code**.
6.  Salin semua isi dari file `src/workers/proxy-worker.js` dan tempel ke editor Cloudflare.
7.  Klik **Save and Deploy**.
8.  Salin URL Worker Anda (contoh: `https://video-proxy.username.workers.dev`).

### Update Kode Web:

Setelah Anda punya URL Worker, Anda bisa mengganti URL proxy di kode web Anda (misalnya di `src/components/VideoPlayer.astro` atau `src/services/utils.ts`) untuk menggunakan URL worker tersebut alih-alih `/api/proxy`.

Atau cukup gunakan Cloudflare untuk domain utama Anda, dan Cloudflare akan otomatis meng-cache konten proxied berkat header `Cache-Control` yang saya tambahkan.
