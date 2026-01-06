
// Admin Authentication & Rate Limiting Shared Logic

interface RateLimitData {
    count: number;
    timestamp: number;
}

interface AdminStore {
    sessions: Set<string>;
    rateLimits: Map<string, RateLimitData>;
}

declare global {
    var adminStore: AdminStore | undefined;
}

function getAdminStore(): AdminStore {
    if (!globalThis.adminStore) {
        globalThis.adminStore = {
            sessions: new Set(),
            rateLimits: new Map()
        };
    }
    return globalThis.adminStore;
}

const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

export function checkRateLimit(ip: string): { blocked: boolean; remaining: number } {
    const store = getAdminStore();
    const now = Date.now();
    const record = store.rateLimits.get(ip);

    if (!record) {
        return { blocked: false, remaining: MAX_ATTEMPTS };
    }

    // Reset if block duration passed
    if (now - record.timestamp > BLOCK_DURATION) {
        store.rateLimits.delete(ip);
        return { blocked: false, remaining: MAX_ATTEMPTS };
    }

    if (record.count >= MAX_ATTEMPTS) {
        return { blocked: true, remaining: 0 };
    }

    return { blocked: false, remaining: MAX_ATTEMPTS - record.count };
}

export function incrementRateLimit(ip: string) {
    const store = getAdminStore();
    const record = store.rateLimits.get(ip);

    if (!record) {
        store.rateLimits.set(ip, { count: 1, timestamp: Date.now() });
    } else {
        record.count++;
        // Verify we don't need to update timestamp for sliding window, 
        // fixed window from first fail is safer to avoid eternal lockout
    }
}

export function resetRateLimit(ip: string) {
    const store = getAdminStore();
    store.rateLimits.delete(ip);
}

export function createSession(): string {
    const store = getAdminStore();
    // Generate a simple random token
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    store.sessions.add(token);
    return token;
}

export function validateSession(token: string | undefined): boolean {
    if (!token) return false;
    const store = getAdminStore();
    return store.sessions.has(token);
}

export function destroySession(token: string) {
    const store = getAdminStore();
    store.sessions.delete(token);
}

// Centralized Credential Check
export function verifyCredentials(u: string, p: string): boolean {
    const ADMIN_USERNAME = import.meta.env.ADMIN_USERNAME || 'mrxnexsus';
    const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD || 'DramaIn2026!Secure';
    return u === ADMIN_USERNAME && p === ADMIN_PASSWORD;
}
