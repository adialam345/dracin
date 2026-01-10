import { type UnifiedDrama } from '../adapter';

// Import Providers
import * as Dramabox from '../providers/dramabox';
import * as Netshort from '../providers/netshort';
import * as Melolo from '../providers/melolo';
import * as RadReel from '../providers/radreel';
import * as DramaWave from '../providers/dramawave';
import * as FlickReels from '../providers/dramaflickreels';
import * as DramaDash from '../providers/dramadash';
import * as ShortMax from '../providers/shortmax';
import * as StarShort from '../providers/starshort';
import * as FreeShort from '../providers/freeshort';
import * as HiShort from '../providers/hishort';
import * as GoodShort from '../providers/goodshort';
import * as DotDrama from '../providers/dotdrama';
import * as StardustTV from '../providers/stardusttv';
import * as ReelLife from '../providers/reelife';
import * as Meloshort from '../providers/meloshort';
import * as Vigloo from '../providers/vigloo';

export const Providers = {
    Dramabox,
    Netshort,
    Melolo,
    RadReel,
    DramaWave,
    FlickReels,
    DramaDash,
    ShortMax,
    StarShort,
    FreeShort,
    HiShort,
    GoodShort,
    DotDrama,
    StardustTV,
    ReelLife,
    Meloshort,
    Vigloo
};

// Caches dengan limit ukuran untuk hemat RAM
class LimitedMap<K, V> extends Map<K, V> {
    constructor(private maxSize: number) {
        super();
    }
    set(key: K, value: V): this {
        if (this.size >= this.maxSize) {
            const firstKey = this.keys().next().value;
            if (firstKey) this.delete(firstKey);
        }
        return super.set(key, value);
    }
}

export const dramaDetailsCache = new LimitedMap<string, UnifiedDrama>(500); // Max 500 drama
export const episodeDetailsCache = new LimitedMap<string, any[]>(200);   // Max 200 list episode

// Helpers
export const shuffle = (array: any[]) => array.sort(() => Math.random() - 0.5);

export async function safeExecute<T>(promise: Promise<T[]>, name: string): Promise<T[]> {
    const timeoutMsg = 'AGGREGATOR_TIMEOUT';
    const timeout = new Promise<T[]>((_, reject) =>
        setTimeout(() => reject(new Error(timeoutMsg)), 6000)
    );

    try {
        const result = await Promise.race([promise, timeout]);
        if (Array.isArray(result)) {
            console.log(`[Aggregator] ${name}: ${result.length} items`);
        }
        return result;
    } catch (e: any) {
        if (e.message === timeoutMsg) {
            console.warn(`[Aggregator] Timeout fetching ${name} (skipping)`);
        } else {
            console.error(`[Aggregator] Error fetching ${name}:`, e.message || e);
        }
        return [];
    }
}
