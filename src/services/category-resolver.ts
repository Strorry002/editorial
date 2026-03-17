/**
 * Resolve article category slug from country code + tags.
 * Maps to frontend CATEGORIES defined in theimmigrants/lib/config.ts.
 */

// Country code → category slug mapping
const COUNTRY_CATEGORY_MAP: Record<string, string> = {
    // North America
    US: 'north-america',
    CA: 'north-america',
    MX: 'north-america',

    // Europe (non-Schengen or general)
    GB: 'europe',
    IE: 'europe',
    UA: 'europe',
    BY: 'europe',
    RS: 'europe',
    BA: 'europe',
    ME: 'europe',
    AL: 'europe',
    MK: 'europe',
    MD: 'europe',
    GE: 'europe',
    AM: 'europe',
    AZ: 'europe',
    TR: 'europe',
    CY: 'europe',
    BG: 'europe',
    RO: 'europe',
    HR: 'europe',

    // Schengen Zone
    DE: 'schengen',
    FR: 'schengen',
    IT: 'schengen',
    ES: 'schengen',
    PT: 'schengen',
    NL: 'schengen',
    BE: 'schengen',
    AT: 'schengen',
    CH: 'schengen',
    SE: 'schengen',
    NO: 'schengen',
    DK: 'schengen',
    FI: 'schengen',
    PL: 'schengen',
    CZ: 'schengen',
    SK: 'schengen',
    HU: 'schengen',
    SI: 'schengen',
    EE: 'schengen',
    LV: 'schengen',
    LT: 'schengen',
    LU: 'schengen',
    MT: 'schengen',
    IS: 'schengen',
    LI: 'schengen',
    GR: 'schengen',

    // South America
    BR: 'south-america',
    AR: 'south-america',
    CL: 'south-america',
    CO: 'south-america',
    PE: 'south-america',
    EC: 'south-america',
    UY: 'south-america',
    PY: 'south-america',
    VE: 'south-america',
    BO: 'south-america',
    GY: 'south-america',
    SR: 'south-america',
    CR: 'south-america',
    PA: 'south-america',

    // Southeast Asia
    TH: 'southeast-asia',
    VN: 'southeast-asia',
    ID: 'southeast-asia',
    MY: 'southeast-asia',
    PH: 'southeast-asia',
    SG: 'southeast-asia',
    MM: 'southeast-asia',
    KH: 'southeast-asia',
    LA: 'southeast-asia',
    BN: 'southeast-asia',
    TL: 'southeast-asia',

    // Australia & NZ
    AU: 'australia-nz',
    NZ: 'australia-nz',

    // Additional Asia (mapped to immigration-policy by default)
    JP: 'immigration-policy',
    KR: 'immigration-policy',
    CN: 'immigration-policy',
    IN: 'immigration-policy',
    PK: 'immigration-policy',
    BD: 'immigration-policy',
    LK: 'immigration-policy',
    NP: 'immigration-policy',

    // Middle East / Africa (mapped to immigration-policy)
    AE: 'immigration-policy',
    SA: 'immigration-policy',
    QA: 'immigration-policy',
    IL: 'immigration-policy',
    ZA: 'immigration-policy',
    NG: 'immigration-policy',
    EG: 'immigration-policy',
    MA: 'immigration-policy',
    KE: 'immigration-policy',
    ET: 'immigration-policy',
};

// Tag keywords that override country-based mapping
const TAG_CATEGORY_OVERRIDES: Record<string, string> = {
    'digital-nomad': 'digital-nomads',
    'digital nomad': 'digital-nomads',
    'nomad': 'digital-nomads',
    'remote work': 'digital-nomads',
    'nomad visa': 'digital-nomads',
    'visa': 'visas-residency',
    'residency': 'visas-residency',
    'golden visa': 'visas-residency',
    'work permit': 'visas-residency',
    'green card': 'visas-residency',
    'residence permit': 'visas-residency',
    'asylum': 'human-rights',
    'refugee': 'human-rights',
    'human rights': 'human-rights',
    'deportation': 'human-rights',
    'detention': 'human-rights',
    'schengen': 'schengen',
    'eu': 'europe',
    'european union': 'europe',
};

// Valid category slugs (must match frontend CATEGORIES in lib/config.ts)
const VALID_CATEGORIES = [
    'north-america',
    'europe',
    'schengen',
    'south-america',
    'southeast-asia',
    'australia-nz',
    'digital-nomads',
    'immigration-policy',
    'visas-residency',
    'human-rights',
] as const;

/**
 * Resolve category slug from country code(s) and tags.
 * Priority:
 * 1. Tag-based overrides (asylum → human-rights, nomad → digital-nomads)
 * 2. Country code mapping
 * 3. Default: immigration-policy
 */
export function resolveCategory(
    countryCodes: string[],
    tags: string[],
    title?: string,
): string {
    // 1. Check tag overrides first (strongest signal)
    for (const tag of tags) {
        const lower = tag.toLowerCase();
        for (const [keyword, category] of Object.entries(TAG_CATEGORY_OVERRIDES)) {
            if (lower.includes(keyword)) {
                return category;
            }
        }
    }

    // 2. Check title keywords
    if (title) {
        const lowerTitle = title.toLowerCase();
        for (const [keyword, category] of Object.entries(TAG_CATEGORY_OVERRIDES)) {
            if (lowerTitle.includes(keyword)) {
                return category;
            }
        }
    }

    // 3. Map from country code
    for (const code of countryCodes) {
        const mapped = COUNTRY_CATEGORY_MAP[code.toUpperCase()];
        if (mapped) return mapped;
    }

    // 4. Default
    return 'immigration-policy';
}

/**
 * Validate that a category slug is valid.
 */
export function isValidCategory(slug: string): boolean {
    return (VALID_CATEGORIES as readonly string[]).includes(slug);
}

export { VALID_CATEGORIES, COUNTRY_CATEGORY_MAP };
