
import type { APIRoute } from 'astro';
import { checkRateLimit, incrementRateLimit, resetRateLimit, createSession, verifyCredentials } from '../../../lib/admin';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
    // Get IP for rate limiting
    // In production with reverse proxy, you might need x-forwarded-for
    const ip = request.headers.get('x-forwarded-for') || clientAddress;

    // 1. Check Rate Limit
    const { blocked, remaining } = checkRateLimit(ip);
    if (blocked) {
        return new Response(JSON.stringify({
            error: 'Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit.'
        }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await request.json();
        const { username, password } = body;

        // 2. Verify Credentials
        if (verifyCredentials(username, password)) {
            // Success
            resetRateLimit(ip);
            const token = createSession();

            // Set Cookie
            cookies.set('admin_session', token, {
                path: '/',
                httpOnly: true,
                secure: import.meta.env.PROD, // Secure only in prod (HTTPS)
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 // 24 hours
            });

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            // Failed
            incrementRateLimit(ip);
            return new Response(JSON.stringify({
                error: 'Username atau password salah',
                remainingAttempts: remaining - 1
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid Request' }), {
            status: 400
        });
    }
}

export const DELETE: APIRoute = async ({ cookies }) => {
    cookies.delete('admin_session', { path: '/' });
    return new Response(JSON.stringify({ success: true }));
}
