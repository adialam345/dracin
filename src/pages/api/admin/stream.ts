import type { APIRoute } from 'astro';

// Helper to get store (duplicated from analytics.ts but checking global)
// In a real app we'd export the getter from a shared lib
function getStore() {
    if (!globalThis.analyticsData) return null;
    return globalThis.analyticsData;
}

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
        return new Response('Missing sessionId', { status: 400 });
    }

    const store = getStore();
    if (!store) {
        return new Response('Analytics not initialized', { status: 500 });
    }

    // Set headers for SSE yang lebih robust
    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Sangat penting untuk Nginx agar tidak buffering
        'Content-Encoding': 'none', // Mencegah kompresi yang merusak SSE
        'Access-Control-Allow-Origin': '*'
    };

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection message
            controller.enqueue('data: connected\n\n');

            // Listener function
            const onKick = (kickedSessionId: string) => {
                if (kickedSessionId === sessionId) {
                    try {
                        controller.enqueue(`data: kick\n\n`);
                        controller.close(); // Close stream after kick
                    } catch (e) {
                        // Controller might be already closed
                    }
                }
            };

            // Subscribe
            store.events.on('kick', onKick);

            // Cleanup when connection closes (client disconnects)
            request.signal.addEventListener('abort', () => {
                store.events.off('kick', onKick);
            });
        }
    });

    return new Response(stream, { headers });
};
