import type { APIRoute } from 'astro';
import { getSearchTasks } from '../../services/aggregator';

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const provider = url.searchParams.get('p') || 'all';

    if (!query) {
        return new Response('Missing query', { status: 400 });
    }

    const tasks = getSearchTasks(query, provider);

    // Prepare text stream
    const headers = {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    };

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            // Helper to send JSON chunk
            const sendChunk = (data: any) => {
                const json = JSON.stringify(data);
                controller.enqueue(encoder.encode(`data: ${json}\n\n`));
            };

            // Start all tasks
            const promises = tasks.map(async ({ name, task }) => {
                try {
                    const results = await task();
                    if (results && results.length > 0) {
                        sendChunk({ provider: name, results });
                    }
                } catch (e) {
                    // Ignore individual errors specifically here, logged in aggregator
                }
            });

            // Wait for all to finish
            await Promise.all(promises);

            // Send done signal
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
        }
    });

    return new Response(stream, { headers });
};
