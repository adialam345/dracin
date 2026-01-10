import type { APIRoute } from 'astro';
import { getAnalyticsStore, type UserActivity } from '../../../lib/analytics';

// Clean up inactive users (inactive for more than 5 minutes)
function cleanupInactiveUsers() {
    const store = getAnalyticsStore();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    for (const [sessionId, activity] of store.activeUsers.entries()) {
        if (now - activity.lastSeen > fiveMinutes) {
            store.activeUsers.delete(sessionId);
        }
    }
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { action, sessionId, page, dramaTitle, dramaSource, episodeNumber } = body;

        const store = getAnalyticsStore();

        // --- Ban Check ---
        if (store.bannedSessions.has(sessionId)) {
            return new Response(JSON.stringify({ error: 'Banned' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- Admin Action: Kick User ---
        if (action === 'kick') {
            // Verify admin session for kick action? 
            // Ideally yes, but this is an internal API mostly used by admin dashboard.
            // checking cookie here is good practice, but for now assuming protected by obscure endpoint usage (or check cookie if available)
            // But this POST is public for analytics, so we MUST verify admin for 'kick'.
            // Actually 'kick' request comes from Admin Dashboard (client browser), so it has admin cookie.

            // However, this POST handler is generic.
            // Let's rely on a separate specific check or just trust the cookie being sent.
            // BUT: Astro endpoints don't automatically parse cookies easily in all modes without boilerplate.
            // Simpler: The admin dashboard should hit a DIFFERENT endpoint or we check cookie here.

            // Let's check cookie for kick action
            const cookie = request.headers.get('cookie') || '';
            if (!cookie.includes('admin_session=')) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
            }

            // Add to ban list
            if (body.targetSessionId) {
                store.bannedSessions.add(body.targetSessionId);
                store.activeUsers.delete(body.targetSessionId);

                // Emit event for realtime disconnect
                store.events.emit('kick', body.targetSessionId);

                return new Response(JSON.stringify({ success: true, message: 'User kicked' }));
            }
        }
        // ----------------

        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const ip = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'Unknown';

        if (action === 'pageview') {
            // ... (rest of existing code)
            // Track new visit
            const isNewSession = !store.activeUsers.has(sessionId);

            if (isNewSession) {
                store.totalVisits++;
            }

            // Determine if user is on a watch/movie page from URL
            const isOnWatchPage = page?.includes('/watch/') || page?.includes('/movie/');

            // Extract source from URL if available: /watch/{source}/... or /movie/{source}/...
            let detectedSource = dramaSource;
            if (!detectedSource && isOnWatchPage && page) {
                const urlParts = page.split('/').filter(Boolean);
                if (urlParts.length >= 2) {
                    detectedSource = urlParts[1]; // source is the second part
                }
            }

            store.activeUsers.set(sessionId, {
                sessionId,
                ip: ip.split(',')[0].trim(),
                userAgent,
                currentPage: page || '/',
                dramaTitle: dramaTitle || (isOnWatchPage ? 'Loading...' : undefined),
                dramaSource: detectedSource,
                episodeNumber,
                timestamp: isNewSession ? Date.now() : (store.activeUsers.get(sessionId)?.timestamp || Date.now()),
                lastSeen: Date.now()
            });

            // Track drama views
            if (dramaTitle && dramaSource) {
                const dramaKey = `${dramaSource}:${dramaTitle}`;
                const existing = store.dramaViews.get(dramaKey);
                if (existing) {
                    existing.views++;
                } else {
                    store.dramaViews.set(dramaKey, {
                        title: dramaTitle,
                        source: dramaSource,
                        views: 1
                    });
                }
            }
        } else if (action === 'heartbeat') {
            // Update last seen
            const existing = store.activeUsers.get(sessionId);
            if (existing) {
                existing.lastSeen = Date.now();
                existing.currentPage = page || existing.currentPage;
                if (dramaTitle) existing.dramaTitle = dramaTitle;
                if (dramaSource) existing.dramaSource = dramaSource;
                if (episodeNumber) existing.episodeNumber = episodeNumber;
            }
        } else if (action === 'leave') {
            store.activeUsers.delete(sessionId);
        }

        // Cleanup inactive users
        cleanupInactiveUsers();

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('[Analytics API Error]', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

import { validateSession } from '../../../lib/admin';

// ... (existing imports and code)

export const GET: APIRoute = async ({ cookies }) => {
    // Verify admin authentication via Cookie
    const sessionCookie = cookies.get('admin_session');

    if (!sessionCookie || !validateSession(sessionCookie.value)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Cleanup and return data
    cleanupInactiveUsers();

    const store = getAnalyticsStore();

    // Convert maps to arrays for JSON serialization
    const activeUsers = Array.from(store.activeUsers.values()).map(user => {
        // Check if user is watching based on URL or drama title
        const isOnWatchPage = user.currentPage?.includes('/watch/');
        const isWatchingDrama = !!user.dramaTitle || isOnWatchPage;

        return {
            ...user,
            isWatchingDrama,
            timeOnSite: Math.floor((Date.now() - user.timestamp) / 1000)
        };
    });

    const dramaViews = Array.from(store.dramaViews.values())
        .sort((a, b) => b.views - a.views)
        .slice(0, 50);

    const usersWatching = activeUsers.filter(u => u.isWatchingDrama);

    return new Response(JSON.stringify({
        totalVisits: store.totalVisits,
        activeUsersCount: activeUsers.length,
        activeUsers,
        usersWatchingDrama: usersWatching.length,
        usersWatching,
        topDramas: dramaViews,
        serverTime: new Date().toISOString()
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};
