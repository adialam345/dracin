# GoodShort Provider Implementation

## Overview
Provider untuk mengakses konten dari GoodShort menggunakan Web API (`www.goodshort.com`).

## Endpoints yang Diimplementasikan

### 1. Get Detail
- **URL**: `POST https://www.goodshort.com/hwycreels/book/detail`
- **Body**: `{ "bookId": "31001223187" }`
- **Response Structure**:
  ```json
  {
    "data": {
      "book": { ... },
      "chapterVo": { ... },
      "chapterVoList": [
        {
          "id": 15862162,
          "chapterName": "001",
          "m3u8Path": "https://v3.goodshort.com/...",
          "price": 0,
          ...
        }
      ]
    }
  }
  ```

### 2. Get Video URL
- Video URL langsung tersedia di `chapterVoList[].m3u8Path`
- Tidak perlu request tambahan untuk mendapatkan URL video
- URL sudah dalam format m3u8 yang siap diputar

## Fitur yang Belum Diimplementasikan

### Home Feed
- Endpoint web API untuk home feed belum ditemukan
- Saat ini mengembalikan array kosong
- Perlu investigasi lebih lanjut untuk menemukan endpoint yang tepat

### Search
- Endpoint web API untuk search belum ditemukan
- Saat ini mengembalikan array kosong
- Perlu investigasi lebih lanjut untuk menemukan endpoint yang tepat

## Cara Penggunaan

```typescript
import { getGoodShortDetail, getGoodShortVideoUrl } from './providers/goodshort';

// Mendapatkan detail drama
const detail = await getGoodShortDetail('31001223187');
console.log(detail.drama.title); // "Dapat 5 Anak, Ibunya Ratu"
console.log(detail.episodes.length); // 73

// Mendapatkan URL video untuk episode tertentu
const videoUrl = await getGoodShortVideoUrl('31001223187', '15862162');
console.log(videoUrl); // "https://v3.goodshort.com/mts/books/..."
```

## Catatan Penting

1. **Tidak Ada Signature**: Web API tidak memerlukan signature seperti mobile API
2. **M3U8 Direct**: URL video langsung tersedia dalam format m3u8
3. **Free Episodes**: Episode dengan `price: 0` adalah episode gratis
4. **Locked Episodes**: Episode dengan `price > 0` memerlukan unlock (tidak ada m3u8Path)

## Testing

Jalankan test script:
```bash
npx tsx test_goodshort.ts
```

## Contoh Response

Lihat file `test_goodshort.ts` untuk contoh penggunaan lengkap.
