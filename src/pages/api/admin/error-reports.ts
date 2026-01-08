import type { APIRoute } from 'astro';

interface ErrorReport {
    id: string;
    url: string;
    description?: string;
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
        const { url, description } = body;

        if (!url && !description) {
            return new Response(JSON.stringify({ error: 'URL or description is required' }), {
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
            url: url || 'General Report',
            description: description || '',
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

import { validateSession } from '../../../lib/admin';

// GET - Get all error reports (admin only)
export const GET: APIRoute = async ({ cookies }) => {
    // Verify admin authentication via Cookie
    const sessionCookie = cookies.get('admin_session');

    if (!sessionCookie || !validateSession(sessionCookie.value)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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
export const DELETE: APIRoute = async ({ request, cookies }) => {
    // Verify admin authentication via Cookie
    const sessionCookie = cookies.get('admin_session');

    if (!sessionCookie || !validateSession(sessionCookie.value)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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
