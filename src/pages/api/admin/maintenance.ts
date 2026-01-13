import type { APIRoute } from 'astro';
import { validateSession } from '../../../lib/admin';
import { getAnalyticsStore } from '../../../lib/analytics';
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = path.join(process.cwd(), 'public/data/maintenance.json');

// Interface for Maintenance Data
interface MaintenanceData {
    isMaintenance: boolean;
    message: string;
    expectedReturn: string;
}

// Helper to read data
async function getMaintenance(): Promise<MaintenanceData> {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return {
            isMaintenance: false,
            message: 'Situs sedang dalam pemeliharaan rutin.',
            expectedReturn: 'Segera'
        };
    }
}

// Helper to save data
async function saveMaintenance(data: MaintenanceData) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET: Fetch maintenance status
export const GET: APIRoute = async ({ cookies }) => {
    // Verify admin
    const sessionCookie = cookies.get('admin_session');
    if (!sessionCookie || !validateSession(sessionCookie.value)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const maintenance = await getMaintenance();
    return new Response(JSON.stringify(maintenance), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};

// POST: Update maintenance status
export const POST: APIRoute = async ({ request, cookies }) => {
    // Verify admin
    const sessionCookie = cookies.get('admin_session');
    if (!sessionCookie || !validateSession(sessionCookie.value)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    try {
        const body = await request.json();
        const maintenance: MaintenanceData = {
            isMaintenance: !!body.isMaintenance,
            message: body.message || 'Situs sedang dalam pemeliharaan rutin.',
            expectedReturn: body.expectedReturn || 'Segera'
        };

        await saveMaintenance(maintenance);

        // Emit event for real-time detected
        const store = getAnalyticsStore();
        store.events.emit('maintenance', maintenance);

        return new Response(JSON.stringify({ success: true, data: maintenance }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Failed to update maintenance' }), { status: 500 });
    }
};
