import { EventEmitter } from 'node:events';

export interface UserActivity {
    sessionId: string;
    ip: string;
    userAgent: string;
    currentPage: string;
    dramaTitle?: string;
    dramaSource?: string;
    episodeNumber?: number;
    timestamp: number;
    lastSeen: number;
}

export interface AnalyticsData {
    activeUsers: Map<string, UserActivity>;
    totalVisits: number;
    dramaViews: Map<string, { title: string; source: string; views: number }>;
    bannedSessions: Set<string>;
    events: EventEmitter;
}

declare global {
    var analyticsData: AnalyticsData | undefined;
}

export function getAnalyticsStore(): AnalyticsData {
    if (!globalThis.analyticsData) {
        globalThis.analyticsData = {
            activeUsers: new Map(),
            totalVisits: 0,
            dramaViews: new Map(),
            bannedSessions: new Set(),
            events: new EventEmitter()
        };
        globalThis.analyticsData.events.setMaxListeners(2000);
    }

    // Ensure all properties exist (for hot-reload safety)
    if (!globalThis.analyticsData.bannedSessions) {
        globalThis.analyticsData.bannedSessions = new Set();
    }
    if (!globalThis.analyticsData.events) {
        globalThis.analyticsData.events = new EventEmitter();
        globalThis.analyticsData.events.setMaxListeners(2000);
    }

    return globalThis.analyticsData;
}
