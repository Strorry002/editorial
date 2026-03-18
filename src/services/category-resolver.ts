/**
 * Dual-axis category resolver: Region + Topic Type
 * Maps to frontend REGIONS and TOPIC_TYPES defined in theimmigrants/lib/config.ts.
 *
 * Region = geographic area (north-america, europe, schengen, southeast-asia, ...)
 * TopicType = content theme (golden-visas, work-permits, education, ...)
 */

// ── Region axis: Country code → region slug ──────────────────────
const COUNTRY_REGION_MAP: Record<string, string> = {
    // North America
    US: 'north-america', CA: 'north-america', MX: 'north-america',

    // UK
    GB: 'uk',

    // Europe (non-Schengen)
    IE: 'europe', UA: 'europe', BY: 'europe', RS: 'europe', BA: 'europe',
    ME: 'europe', AL: 'europe', MK: 'europe', MD: 'europe', GE: 'europe',
    AM: 'europe', AZ: 'europe', TR: 'europe', CY: 'europe', BG: 'europe',
    RO: 'europe', HR: 'europe',

    // Schengen Zone
    DE: 'schengen', FR: 'schengen', IT: 'schengen', ES: 'schengen',
    PT: 'schengen', NL: 'schengen', BE: 'schengen', AT: 'schengen',
    CH: 'schengen', SE: 'schengen', NO: 'schengen', DK: 'schengen',
    FI: 'schengen', PL: 'schengen', CZ: 'schengen', SK: 'schengen',
    HU: 'schengen', SI: 'schengen', EE: 'schengen', LV: 'schengen',
    LT: 'schengen', LU: 'schengen', MT: 'schengen', IS: 'schengen',
    LI: 'schengen', GR: 'schengen',

    // South America
    BR: 'south-america', AR: 'south-america', CL: 'south-america',
    CO: 'south-america', PE: 'south-america', EC: 'south-america',
    UY: 'south-america', PY: 'south-america', VE: 'south-america',
    BO: 'south-america', GY: 'south-america', SR: 'south-america',
    CR: 'south-america', PA: 'south-america',

    // Southeast Asia
    TH: 'southeast-asia', VN: 'southeast-asia', ID: 'southeast-asia',
    MY: 'southeast-asia', PH: 'southeast-asia', SG: 'southeast-asia',
    MM: 'southeast-asia', KH: 'southeast-asia', LA: 'southeast-asia',
    BN: 'southeast-asia', TL: 'southeast-asia',

    // Australia & NZ
    AU: 'australia-nz', NZ: 'australia-nz',

    // East Asia
    JP: 'east-asia', KR: 'east-asia', CN: 'east-asia', TW: 'east-asia',

    // South Asia
    IN: 'south-asia', PK: 'south-asia', BD: 'south-asia',
    LK: 'south-asia', NP: 'south-asia',

    // Middle East & North Africa
    AE: 'mena', SA: 'mena', QA: 'mena', BH: 'mena', KW: 'mena',
    OM: 'mena', IL: 'mena', EG: 'mena', MA: 'mena', TN: 'mena',
    JO: 'mena', LB: 'mena', IQ: 'mena', IR: 'mena',

    // Africa
    ZA: 'africa', NG: 'africa', KE: 'africa', ET: 'africa',
    GH: 'africa', TZ: 'africa', UG: 'africa', RW: 'africa',
};

// ── Topic type axis: keyword → topic slug ───────────────────────
const TOPIC_KEYWORDS: Array<{ keywords: string[]; topic: string }> = [
    {
        topic: 'golden-visas',
        keywords: ['golden visa', 'investor visa', 'cbi', 'rbi', 'citizenship by investment',
            'residency by investment', 'eb-5', 'eb5', 'investor program',
            'investment visa', 'golden residency', 'real estate visa'],
    },
    {
        topic: 'business',
        keywords: ['startup visa', 'entrepreneur visa', 'business visa', 'self-employed',
            'freelancer visa', 'business immigration', 'startup permit',
            'innovator visa', 'tech visa', 'founder visa', 'e-2', 'e2 visa',
            'l-1', 'l1 visa', 'intra-company'],
    },
    {
        topic: 'work-permits',
        keywords: ['work permit', 'work visa', 'h-1b', 'h1b', 'blue card',
            'skilled worker', 'labor visa', 'employment visa', 'sponsored',
            'talent visa', 'critical skills', 'points-based', 'tier 2'],
    },
    {
        topic: 'digital-nomads',
        keywords: ['digital nomad', 'nomad visa', 'remote work visa', 'freelance permit',
            'nomad', 'remote work', 'coworking', 'coliving',
            'location independent', 'dnv', 'dtv'],
    },
    {
        topic: 'education',
        keywords: ['student visa', 'study visa', 'university', 'master', 'phd',
            'scholarship', 'opt', 'cpt', 'language school', 'education visa',
            'student permit', 'academic', 'graduate', 'postgraduate',
            'international student', 'tuition', 'school visa'],
    },
    {
        topic: 'passive-income',
        keywords: ['retirement visa', 'retiree visa', 'pensioner', 'passive income visa',
            'non-lucrative', 'd7 visa', 'thailand elite', 'panama pensionado',
            'malaysia mm2h', 'my second home', 'independent means',
            'fixed income visa', 'self-sufficient', 'rentier'],
    },
    {
        topic: 'citizenship',
        keywords: ['citizenship', 'naturaliz', 'dual citizenship', 'passport',
            'nationality', 'allegiance', 'oath of citizenship', 'stateless',
            'renounce', 'jus soli', 'jus sanguinis', 'descent visa'],
    },
    {
        topic: 'family',
        keywords: ['family visa', 'family reunion', 'spouse visa', 'dependent visa',
            'marriage visa', 'fiancé visa', 'k-1', 'family reunification',
            'child visa', 'parent visa', 'partner visa'],
    },
    {
        topic: 'asylum-refugees',
        keywords: ['asylum', 'refugee', 'humanitarian', 'protection',
            'temporary protected', 'tps', 'persecution', 'resettlement',
            'unhcr', 'displaced'],
    },
    {
        topic: 'policy-law',
        keywords: ['immigration policy', 'immigration law', 'legislation', 'reform',
            'regulation', 'directive', 'executive order', 'bill',
            'congressional', 'parliament', 'enforcement', 'dhs',
            'border policy', 'immigration court'],
    },
    {
        topic: 'relocation',
        keywords: ['relocation', 'cost of living', 'moving abroad', 'expat guide',
            'how to move', 'living in', 'best countries', 'banking abroad',
            'healthcare abroad', 'expat life', 'settling', 'apartment',
            'international moving'],
    },
    {
        topic: 'travel',
        keywords: ['travel visa', 'tourist visa', 'arrival card', 'e-visa',
            'visa on arrival', 'visa waiver', 'esta', 'etias', 'eta',
            'border crossing', 'entry requirements', 'customs', 'qr code',
            'transit visa', 'airport', 'packing', 'luggage', 'flight'],
    },
    {
        topic: 'rights',
        keywords: ['migrant rights', 'human rights', 'detention', 'deportation',
            'discrimination', 'labor rights', 'trafficking',
            'undocumented', 'overstay', 'due process'],
    },
];

// Valid slugs
const VALID_REGIONS = [
    'north-america', 'uk', 'europe', 'schengen', 'south-america',
    'southeast-asia', 'east-asia', 'south-asia', 'australia-nz',
    'mena', 'africa', 'global',
] as const;

const VALID_TOPIC_TYPES = [
    'golden-visas', 'business', 'work-permits', 'digital-nomads',
    'education', 'passive-income', 'citizenship', 'family',
    'asylum-refugees', 'policy-law', 'relocation', 'travel', 'rights',
] as const;

// ── Backward-compatible category mappings (for old code) ──────────
// Old categories that were topic-based rather than region-based
const OLD_CATEGORY_TO_TOPIC: Record<string, string> = {
    'digital-nomads': 'digital-nomads',
    'visas-residency': 'policy-law',
    'human-rights': 'rights',
    'immigration-policy': 'policy-law',
};

const OLD_CATEGORY_TO_REGION: Record<string, string | null> = {
    'digital-nomads': null,      // no region, keep whatever was set
    'visas-residency': null,
    'human-rights': null,
    'immigration-policy': null,
};

/**
 * Resolve REGION from country codes.
 */
function resolveRegion(countryCodes: string[]): string {
    for (const code of countryCodes) {
        const mapped = COUNTRY_REGION_MAP[code.toUpperCase()];
        if (mapped) return mapped;
    }
    return 'global';
}

/**
 * Resolve TOPIC TYPE from tags + title keywords.
 */
function resolveTopicType(tags: string[], title?: string): string {
    const searchTexts = [
        ...tags.map(t => t.toLowerCase()),
        ...(title ? [title.toLowerCase()] : []),
    ];

    for (const { keywords, topic } of TOPIC_KEYWORDS) {
        for (const text of searchTexts) {
            for (const kw of keywords) {
                if (text.includes(kw)) return topic;
            }
        }
    }
    return 'policy-law'; // default topic
}

/**
 * Resolve BOTH axes: { region, topicType }
 */
export function resolveDualCategory(
    countryCodes: string[],
    tags: string[],
    title?: string,
): { region: string; topicType: string } {
    return {
        region: resolveRegion(countryCodes),
        topicType: resolveTopicType(tags, title),
    };
}

/**
 * BACKWARD COMPATIBLE: resolveCategory still works for old code.
 * Returns region slug (same as old category for region-based categories).
 */
export function resolveCategory(
    countryCodes: string[],
    tags: string[],
    title?: string,
): string {
    // Check tag-based overrides first for backward compat
    const topicType = resolveTopicType(tags, title);

    // Some old topic-based categories should stay as-is for backward compat
    if (['digital-nomads'].includes(topicType)) {
        return topicType;
    }

    // For everything else, return region
    return resolveRegion(countryCodes);
}

export function isValidCategory(slug: string): boolean {
    return (VALID_REGIONS as readonly string[]).includes(slug)
        || (VALID_TOPIC_TYPES as readonly string[]).includes(slug)
        // Old categories still valid
        || ['immigration-policy', 'visas-residency', 'human-rights', 'digital-nomads'].includes(slug);
}

export {
    VALID_REGIONS,
    VALID_TOPIC_TYPES,
    COUNTRY_REGION_MAP,
    TOPIC_KEYWORDS,
    resolveRegion,
    resolveTopicType,
};
