import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = path.join(process.cwd(), 'public/data/maintenance.json');

export const GET: APIRoute = async () => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        const maintenance = JSON.parse(data);
        return new Response(JSON.stringify(maintenance), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
    } catch (e) {
        return new Response(JSON.stringify({ isMaintenance: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
