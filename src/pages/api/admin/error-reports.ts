import type { APIRoute } from 'astro';

interface ErrorReport {
    id: string;
    url: string;
    userAgent: string;
    ip: string;
    timestamp: number;
    resolved: boolean;
}

interface ErrorReportsStore {
    reports: ErrorReport[];
}

// Global error reports store
declare global {
    var errorReportsStore: ErrorReportsStore | undefined;
}

function getErrorReportsStore(): ErrorReportsStore {
    if (!globalThis.errorReportsStore) {
        globalThis.errorReportsStore = {
            reports: []
        };
    }
    return globalThis.errorReportsStore;
}

// POST - Submit new error report
export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url) {
            return new Response(JSON.stringify({ error: 'URL is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const store = getErrorReportsStore();
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const ip = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'Unknown';

        const report: ErrorReport = {
            id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            url,
            userAgent,
            ip: ip.split(',')[0].trim(),
            timestamp: Date.now(),
            resolved: false
        };

        // Add to the beginning of array (newest first)
        store.reports.unshift(report);

        // Keep only last 100 reports
        if (store.reports.length > 100) {
            store.reports = store.reports.slice(0, 100);
        }

        return new Response(JSON.stringify({ success: true, id: report.id }), {
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

// GET - Get all error reports (admin only)
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

    const store = getErrorReportsStore();

    return new Response(JSON.stringify({
        reports: store.reports,
        totalCount: store.reports.length,
        unresolvedCount: store.reports.filter(r => !r.resolved).length
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};

// DELETE - Remove a specific error report or mark as resolved
export const DELETE: APIRoute = async ({ request }) => {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    const ADMIN_USERNAME = import.meta.env.ADMIN_USERNAME || 'mrxnexsus';
    const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD || 'DramaIn2026!Secure';

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await request.json();
        const { id, action } = body;

        const store = getErrorReportsStore();

        if (action === 'resolve') {
            const report = store.reports.find(r => r.id === id);
            if (report) {
                report.resolved = true;
            }
        } else if (action === 'delete') {
            store.reports = store.reports.filter(r => r.id !== id);
        } else if (action === 'clear-all') {
            store.reports = [];
        }

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
