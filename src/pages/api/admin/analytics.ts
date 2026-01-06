import type { APIRoute } from 'astro';

// Simple in-memory storage for analytics (resets on server restart)
// For production, use a database like Redis, MongoDB, or PostgreSQL

interface UserActivity {
    sessionId: string;
    ip: string;
    userAgent: string;
    currentPage: string;
    dramaTitle?: string;
    dramaSource?: string;
    episodeNumber?: number;
    timestamp: number;
    lastSeen: number;
}

interface AnalyticsData {
    activeUsers: Map<string, UserActivity>;
    totalVisits: number;
    dramaViews: Map<string, { title: string; source: string; views: number }>;
}

// Global analytics store
declare global {
    var analyticsData: AnalyticsData | undefined;
}

function getAnalyticsStore(): AnalyticsData {
    if (!globalThis.analyticsData) {
        globalThis.analyticsData = {
            activeUsers: new Map(),
            totalVisits: 0,
            dramaViews: new Map()
        };
    }
    return globalThis.analyticsData;
}

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
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const ip = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'Unknown';

        if (action === 'pageview') {
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
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const GET: APIRoute = async ({ request }) => {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Decode Basic auth
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    // Admin credentials from environment variables
    const ADMIN_USERNAME = import.meta.env.ADMIN_USERNAME || 'mrxnexsus';
    const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD || 'DramaIn2026!Secure';

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
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
