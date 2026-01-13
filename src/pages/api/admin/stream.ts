import type { APIRoute } from 'astro';
import { getAnalyticsStore } from '../../../lib/analytics';

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
        return new Response('Missing sessionId', { status: 400 });
    }

    const store = getAnalyticsStore();
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

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            console.log(`[SSE] User connected: ${sessionId}`);

            // Send initial connection message
            controller.enqueue(encoder.encode('data: connected\n\n'));

            // Keep-alive ping every 15 seconds to prevent timeout
            const pingInterval = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': ping\n\n'));
                } catch (e) {
                    clearInterval(pingInterval);
                }
            }, 15000);

            // Listener functions
            const onKick = (kickedSessionId: string) => {
                if (kickedSessionId === sessionId) {
                    console.log(`[SSE] Kicking user: ${sessionId}`);
                    try {
                        controller.enqueue(encoder.encode(`data: kick\n\n`));
                        // Give a small delay before closing to ensure message is sent
                        setTimeout(() => {
                            try {
                                controller.close();
                                clearInterval(pingInterval);
                            } catch (e) { }
                        }, 100);
                    } catch (e) {
                        clearInterval(pingInterval);
                    }
                }
            };

            const onMaintenance = (data: any) => {
                console.log(`[SSE] Maintenance signal sent to: ${sessionId}`);
                try {
                    controller.enqueue(encoder.encode(`data: maintenance|${JSON.stringify(data)}\n\n`));
                } catch (e) {
                    clearInterval(pingInterval);
                }
            };

            // Subscribe
            store.events.on('kick', onKick);
            store.events.on('maintenance', onMaintenance);

            // Cleanup when connection closes (client disconnects)
            request.signal.addEventListener('abort', () => {
                console.log(`[SSE] User disconnected: ${sessionId}`);
                store.events.off('kick', onKick);
                store.events.off('maintenance', onMaintenance);
                clearInterval(pingInterval);
            });
        }
    });

    return new Response(stream, { headers });
};
