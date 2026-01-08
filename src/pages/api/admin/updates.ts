import type { APIRoute } from 'astro';
import { validateSession } from '../../../lib/admin';
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = path.join(process.cwd(), 'public/data/updates.json');

// Interface for Update Item
interface UpdateItem {
    id: number;
    date: string;
    title: string;
    content: string;
    tag: string;
    color: string;
    timestamp: number;
}

// Helper to read data
async function getUpdates(): Promise<UpdateItem[]> {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

// Helper to save data
async function saveUpdates(updates: UpdateItem[]) {
    await fs.writeFile(DATA_FILE, JSON.stringify(updates, null, 2), 'utf-8');
}

// GET: Fetch all updates
export const GET: APIRoute = async ({ cookies }) => {
    // Verify admin
    const sessionCookie = cookies.get('admin_session');
    if (!sessionCookie || !validateSession(sessionCookie.value)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const updates = await getUpdates();
    return new Response(JSON.stringify(updates), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};

// POST: Add new update
export const POST: APIRoute = async ({ request, cookies }) => {
    // Verify admin
    const sessionCookie = cookies.get('admin_session');
    if (!sessionCookie || !validateSession(sessionCookie.value)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    try {
        const body = await request.json();
        const updates = await getUpdates();

        const newItem: UpdateItem = {
            id: Date.now(),
            date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
            timestamp: Date.now(),
            title: body.title,
            content: body.content,
            tag: body.tag || 'Info',
            color: body.color || 'bg-blue-500/20 text-blue-400 border-blue-500/30'
        };

        // Add to beginning
        updates.unshift(newItem);
        await saveUpdates(updates);

        return new Response(JSON.stringify({ success: true, item: newItem }), { status: 201 });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Failed to create update' }), { status: 500 });
    }
};

// DELETE: Remove update
export const DELETE: APIRoute = async ({ request, cookies }) => {
    // Verify admin
    const sessionCookie = cookies.get('admin_session');
    if (!sessionCookie || !validateSession(sessionCookie.value)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    try {
        const { id } = await request.json();
        let updates = await getUpdates();

        updates = updates.filter(item => item.id !== Number(id));
        await saveUpdates(updates);

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Failed to delete update' }), { status: 500 });
    }
};

// PUT: Edit update
export const PUT: APIRoute = async ({ request, cookies }) => {
    // Verify admin
    const sessionCookie = cookies.get('admin_session');
    if (!sessionCookie || !validateSession(sessionCookie.value)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    try {
        const body = await request.json();
        const updates = await getUpdates();

        const index = updates.findIndex(item => item.id === Number(body.id));
        if (index !== -1) {
            updates[index] = { ...updates[index], ...body };
            await saveUpdates(updates);
            return new Response(JSON.stringify({ success: true, item: updates[index] }), { status: 200 });
        }

        return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404 });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Failed to update item' }), { status: 500 });
    }
};
