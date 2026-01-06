# NetShort SSL Error 526 - Fix Documentation

## Problem
Error **526 Invalid SSL Certificate** terjadi saat mengakses video NetShort dari `awscdn.netshort.com` melalui Cloudflare Worker proxy (`video-proxy.mrxnexsus.workers.dev`).

### Error Details
```
GET https://video-proxy.mrxnexsus.workers.dev/?url=https%3A%2F%2Fawscdn.netshort.com%2F... 526
```

### Root Cause
1. **Cloudflare Worker SSL Validation**: Cloudflare Workers melakukan validasi SSL certificate yang ketat terhadap upstream servers
2. **Invalid SSL Certificate**: Server `awscdn.netshort.com` memiliki sertifikat SSL yang tidak valid atau self-signed
3. **No Bypass Option**: Cloudflare Workers **tidak mendukung** opsi untuk menonaktifkan SSL verification
   - Opsi `cf: { ssl: { strict: false } }` **TIDAK VALID** untuk Cloudflare Workers
   - Ini adalah limitasi platform Cloudflare Workers

## Solution Implemented

### 1. Fixed Invalid Worker Configuration
**File**: `f:\project\src\workers\proxy-worker.js`

**Before** (Invalid):
```javascript
const response = await fetch(targetUrl, {
    method: request.method,
    headers: headers,
    redirect: 'follow',
    cf: {
        ssl: { strict: false }  // ❌ INVALID - Not supported
    }
});
```

**After** (Fixed):
```javascript
const response = await fetch(targetUrl, {
    method: request.method,
    headers: headers,
    redirect: 'follow',
    // Workers handle SSL automatically - no bypass option available
});
```

### 2. Implemented VPS Proxy Fallback
**File**: `f:\project\src\components\VideoPlayer.astro`

Added fallback logic to use VPS proxy (`/api/proxy`) for NetShort content from `awscdn.netshort.com`:

```javascript
// Proxy Configuration
const PROXY_BASE = 'https://video-proxy.mrxnexsus.workers.dev/';
const VPS_PROXY = '/api/proxy'; // Fallback for SSL issues

// Helper to check if URL should use fallback proxy
const shouldUseFallback = (url: string, source: string) => {
  // NetShort from awscdn.netshort.com often has SSL issues with Cloudflare
  return source === 'netshort' && url.includes('awscdn.netshort.com');
};

// Proxy Logic
if (source === 'netshort' && shouldUseFallback(url, source) && !url.includes(VPS_PROXY)) {
    url = VPS_PROXY + '?url=' + encodeURIComponent(url);
    console.log('[VideoPlayer] Using VPS Proxy for NetShort (SSL fallback)');
}
```

### 3. Updated All NetShort References
Updated proxy logic in:
- ✅ Main video URL proxying (HLS and non-HLS)
- ✅ Subtitle track proxying (3 locations)
- ✅ Non-HLS video handling

## Benefits

### Bandwidth Distribution
- **Other Providers**: Continue using Cloudflare Worker (unlimited bandwidth)
  - DramaWave, DramaBox, ShortMax, FreShort, DramaDash, FlickReels, RadReel, Melolo
- **NetShort Only**: Use VPS proxy (limited bandwidth, but works)

### Why This Approach?
1. **Cloudflare Limitation**: Workers cannot bypass SSL validation
2. **Selective Fallback**: Only NetShort uses VPS, saving bandwidth for other providers
3. **Automatic Detection**: Uses `shouldUseFallback()` helper to detect problematic URLs
4. **Future-Proof**: If NetShort fixes their SSL, we can easily switch back to Worker

## Alternative Solutions (Not Implemented)

### Option 1: Use HTTP Instead of HTTPS
- ❌ Most CDNs don't support HTTP anymore
- ❌ Security risk
- ❌ Browsers block mixed content

### Option 2: Use Different Proxy Service
- ❌ Requires additional infrastructure
- ❌ Cost implications
- ❌ Complexity

### Option 3: Contact NetShort
- ❌ Not feasible for third-party integration
- ❌ No control over their infrastructure

## Testing

### Before Fix
```
[VideoPlayer] Using Worker Proxy
GET https://video-proxy.mrxnexsus.workers.dev/?url=... 526
❌ Video fails to load
```

### After Fix
```
[VideoPlayer] Using VPS Proxy for NetShort (SSL fallback)
GET /api/proxy?url=... 200
✅ Video loads successfully
```

## Monitoring

Watch for these console logs:
- `[VideoPlayer] Using VPS Proxy for NetShort (SSL fallback)` - Indicates fallback is working
- `[VideoPlayer] Using Proxy: ...` - Other providers using Worker

## Future Improvements

1. **Monitor NetShort SSL Status**: Check if they fix their certificate
2. **Bandwidth Tracking**: Monitor VPS bandwidth usage for NetShort
3. **Alternative CDN**: If NetShort provides alternative CDN, update `shouldUseFallback()`
4. **Rate Limiting**: Add rate limiting to VPS proxy if needed

## Related Files
- `f:\project\src\workers\proxy-worker.js` - Cloudflare Worker (fixed invalid config)
- `f:\project\src\components\VideoPlayer.astro` - Video player with fallback logic
- `f:\project\src\pages\api\proxy.ts` - VPS proxy endpoint (existing)
