# Performance Optimization Guide

## Overview
Implementasi optimasi untuk handling data banyak dengan smooth performance.

## Components Created

### 1. **SkeletonLoader.astro**
Skeleton loading component untuk memberikan visual feedback saat loading.

**Features:**
- Shimmer animation effect
- Configurable count
- Matches MovieCard layout

**Usage:**
```astro
import SkeletonLoader from '../components/SkeletonLoader.astro';

<SkeletonLoader count={12} />
```

### 2. **InfiniteScroll.astro**
Infinite scroll trigger menggunakan Intersection Observer.

**Features:**
- Auto-load saat user scroll mendekati bottom
- Loading spinner
- Custom events untuk komunikasi

**Usage:**
```astro
import InfiniteScroll from '../components/InfiniteScroll.astro';

<InfiniteScroll />

<script>
  window.addEventListener('loadMore', () => {
    // Load more data
  });
</script>
```

### 3. **API Endpoint: /api/search**
Paginated search API dengan caching.

**Features:**
- Parallel fetching dari 3 sources
- Pagination support
- 5-minute cache
- HTML stripping untuk NetShort
- HEIC conversion untuk Melolo

**Usage:**
```javascript
fetch('/api/search?q=suami&page=1&size=12')
  .then(res => res.json())
  .then(data => {
    console.log(data.results);
    console.log(data.hasMore);
  });
```

## Implementation Steps

### Step 1: Add Skeleton Loading
```astro
<div id="results-grid" class="grid grid-cols-6 gap-6">
  <!-- Results will be loaded here -->
</div>

<div id="loading-skeleton">
  <SkeletonLoader count={12} />
</div>
```

### Step 2: Add Infinite Scroll
```astro
<InfiniteScroll />

<script>
  let currentPage = 1;
  
  window.addEventListener('loadMore', async () => {
    currentPage++;
    const data = await fetch(`/api/search?page=${currentPage}`);
    // Append results to grid
  });
</script>
```

### Step 3: Optimize Images
Images already use:
- `loading="lazy"` - Native lazy loading
- Fade-in animation on load
- Error handling with placeholder

## Performance Benefits

### 1. **Reduced Initial Load Time**
- Only load 12 items initially instead of all
- Lazy load images as they enter viewport

### 2. **Smooth Scrolling**
- Intersection Observer triggers load 100px before reaching bottom
- No janky scroll behavior

### 3. **Better UX**
- Skeleton loaders show immediate feedback
- Shimmer animation indicates loading
- Graceful error handling

### 4. **Efficient Memory Usage**
- Only render visible items
- Browser native lazy loading for images
- API response caching

## Advanced: Virtual Scrolling (Optional)

For extremely large datasets (1000+ items), consider virtual scrolling:

```javascript
// Use libraries like:
// - @tanstack/virtual
// - react-window
// - vue-virtual-scroller
```

## Testing

Test with different scenarios:
1. **Slow network** - Skeleton should show
2. **Fast scrolling** - Should load smoothly
3. **Large datasets** - Memory usage should stay low
4. **Mobile devices** - Touch scrolling should be smooth

## Browser Support

- ✅ Chrome 51+
- ✅ Firefox 55+
- ✅ Safari 12.1+
- ✅ Edge 15+

All features use native APIs (Intersection Observer, lazy loading).
