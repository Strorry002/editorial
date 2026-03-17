/**
 * Social Media Content Adaptation Service
 * Generates channel-specific content from article body using AI (xAI Grok)
 * Each channel has its own prompt style: Telegram, Facebook, Instagram, X/Twitter, LinkedIn
 */

import { getXAIClient, AI_MODEL } from './ai.js';

const xai = getXAIClient();

export type SocialChannel = 'telegram' | 'facebook' | 'instagram' | 'x_twitter' | 'linkedin';

interface ArticleContent {
    title: string;
    excerpt: string;
    body: string;
    tags: string[];
    slug: string;
    coverImage?: string | null;
    author?: string | null;
}

interface AdaptedContent {
    channel: SocialChannel;
    text: string;
    hashtags: string[];
    mediaNote?: string; // hint for what media to attach
}

/** Per-channel system prompts — no emojis, platform-native tone */
const DEFAULT_PROMPTS: Record<SocialChannel, string> = {
    telegram: `You are a senior correspondent writing for a Telegram news channel about immigration and global mobility.
Your audience: Russian-speaking migrants, expats, digital nomads, and people planning relocation.

You MUST output Telegram-compatible HTML formatting. This is critical.

STRUCTURE (follow this exact layout):

1. HEADLINE — wrap in <b> tags. Short, punchy, attention-grabbing. 1 line max.

2. HOOK (2-3 lines visible without expanding) — this is what the reader sees FIRST:
   - One striking fact or provocative statement
   - One sentence of key context
   - Use <b> to highlight the most important number or fact

3. Then write: <blockquote expandable>
   Inside the expandable block, put the FULL detailed analysis:
   - 4-6 short paragraphs
   - Use <b> to bold key terms, policy names, numbers, deadlines
   - Use <i> with quotation marks for any direct quotes or official statements: <i>"quoted text"</i>
   - Use <tg-spoiler> to wrap ONE surprising or little-known fact (creates intrigue — reader taps to reveal)
   - End with a provocative question or call-to-action
   Close with </blockquote>

4. After the blockquote — leave empty line, then "Читать полностью:" (we add the URL)

FORMATTING RULES:
- Write in Russian (Пиши на русском языке)
- NO emojis, NO icons — zero tolerance
- Total length: 1000-2000 characters including HTML tags
- Use exactly ONE <tg-spoiler>...</tg-spoiler> block for maximum impact
- Use <b> for 3-5 key highlights throughout
- Use <i>"..."</i> for 1-2 quotes if relevant
- Paragraphs inside blockquote: separate with blank lines
- DO NOT use markdown. ONLY Telegram HTML: <b>, <i>, <tg-spoiler>, <blockquote expandable>
- DO NOT add hashtags inside the text, return them separately in the JSON`,

    facebook: `You are a community manager writing for a Facebook group about immigration and relocation.
Audience: Russian-speaking families, professionals, and students planning or going through immigration.

RULES:
- Write in English
- NO emojis
- Length: 1000-2000 characters
- Start with a personal, relatable hook — as if sharing news with a friend
- Use a conversational, warm but informative tone
- Break into digestible paragraphs
- Include a personal angle: "how this affects YOU"
- Ask an engaging question at the end to drive comments
- Mention specific countries, visa types, deadlines
- Tone: friendly expert sharing insider knowledge
- Final line: link placeholder
- DO NOT add hashtags inside the text`,

    instagram: `You are a content creator writing captions for an Instagram post about immigration news.
Audience: Young professionals, digital nomads, and people dreaming of life abroad.

RULES:
- Write in English
- NO emojis
- Length: 500-800 characters (Instagram captions should be concise but punchy)
- First sentence must be a scroll-stopping hook
- Write in short, rhythmic phrases
- Focus on ONE key takeaway from the article
- Include a call-to-action: save this post, share with someone planning to move
- Tone: modern, confident, slightly edgy
- End with "Подробнее по ссылке в био"
- DO NOT add hashtags inside the text, return them separately
- Also return a mediaNote suggesting what the visual should show`,

    x_twitter: `You are a sharp commentator writing a thread for X (Twitter) about immigration policy.
Audience: Global professionals, policy wonks, journalists, tech workers planning relocation.

RULES:
- Write in English (X/Twitter audience is international)
- NO emojis
- Format as a thread: each tweet separated by [TWEET]
- First tweet: bold, provocative statement (max 280 chars)
- 3-5 tweets total, each under 280 characters
- Include data points, contrasts, and sharp observations
- Last tweet: link placeholder and invitation to follow
- Tone: informed, slightly provocative, data-driven
- DO NOT add hashtags inside the text, return them separately`,

    linkedin: `You are a thought leader writing about global talent mobility for LinkedIn.
Audience: HR professionals, hiring managers, immigration lawyers, C-suite executives.

RULES:
- Write in English
- NO emojis
- Length: 800-1500 characters
- Start with a counter-intuitive insight or striking statistic
- Professional but not boring — show personality
- Connect immigration policy to business impact, talent acquisition, workforce planning
- Include 2-3 specific data points or policy references
- End with a thoughtful question for the professional community
- Tone: executive briefing meets thought leadership
- Final line: link placeholder
- DO NOT add hashtags inside the text, return them separately`,
};

// Runtime overrides stored in JSON file
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const PROMPTS_FILE = join(process.cwd(), 'data', 'channel-prompts.json');
let runtimeOverrides: Partial<Record<SocialChannel, string>> = {};

async function loadOverrides() {
    try {
        const data = await readFile(PROMPTS_FILE, 'utf-8');
        runtimeOverrides = JSON.parse(data);
    } catch { /* file doesn't exist yet, use defaults */ }
}

// Load on startup
loadOverrides();

/** Get the prompt for a channel (override or default) */
export function getChannelPrompt(channel: SocialChannel): string {
    return runtimeOverrides[channel] || DEFAULT_PROMPTS[channel] || '';
}

/** Set a custom prompt for a channel */
export async function setChannelPrompt(channel: SocialChannel, prompt: string): Promise<void> {
    runtimeOverrides[channel] = prompt;
    await mkdir(join(process.cwd(), 'data'), { recursive: true });
    await writeFile(PROMPTS_FILE, JSON.stringify(runtimeOverrides, null, 2), 'utf-8');
}

/** Get all prompts (for admin display) */
export function getAllChannelPrompts(): Record<SocialChannel, { prompt: string; isCustom: boolean }> {
    const channels: SocialChannel[] = ['telegram', 'facebook', 'instagram', 'x_twitter', 'linkedin'];
    const result: Record<string, { prompt: string; isCustom: boolean }> = {};
    for (const ch of channels) {
        result[ch] = {
            prompt: runtimeOverrides[ch] || DEFAULT_PROMPTS[ch],
            isCustom: !!runtimeOverrides[ch],
        };
    }
    return result as Record<SocialChannel, { prompt: string; isCustom: boolean }>;
}

/** Reset a channel prompt to default */
export async function resetChannelPrompt(channel: SocialChannel): Promise<void> {
    delete runtimeOverrides[channel];
    await mkdir(join(process.cwd(), 'data'), { recursive: true });
    await writeFile(PROMPTS_FILE, JSON.stringify(runtimeOverrides, null, 2), 'utf-8');
}

// Use CHANNEL_PROMPTS as a getter that reads from overrides
const CHANNEL_PROMPTS = new Proxy(DEFAULT_PROMPTS, {
    get(target, prop: string) {
        return runtimeOverrides[prop as SocialChannel] || target[prop as SocialChannel];
    }
});

/**
 * Generate adapted content for a specific social channel using AI
 */
export async function adaptContentForChannel(
    article: ArticleContent,
    channel: SocialChannel,
): Promise<AdaptedContent> {
    const systemPrompt = CHANNEL_PROMPTS[channel];

    const userPrompt = `Adapt this immigration news article for ${channel}.

ARTICLE TITLE: ${article.title}
ARTICLE EXCERPT: ${article.excerpt}
ARTICLE BODY (first 2000 chars):
${article.body?.substring(0, 2000) || article.excerpt}

TAGS: ${article.tags.join(', ')}

Return JSON:
{
  "text": "the adapted post text",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "mediaNote": "suggestion for visual/media to accompany this post (optional)"
}`;

    const response = await xai.chat.completions.create({
        model: AI_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error(`Empty AI response for ${channel}`);

    const result = JSON.parse(content);

    return {
        channel,
        text: result.text || '',
        hashtags: result.hashtags || [],
        mediaNote: result.mediaNote || undefined,
    };
}

/**
 * Generate adapted content for ALL channels at once
 */
export async function adaptContentForAllChannels(
    article: ArticleContent,
    channels?: SocialChannel[],
): Promise<AdaptedContent[]> {
    const targetChannels = channels || ['telegram', 'facebook', 'instagram', 'x_twitter', 'linkedin'] as SocialChannel[];

    const results = await Promise.allSettled(
        targetChannels.map(ch => adaptContentForChannel(article, ch))
    );

    return results
        .filter((r): r is PromiseFulfilledResult<AdaptedContent> => r.status === 'fulfilled')
        .map(r => r.value);
}

/**
 * Get available channels and their descriptions
 */
export function getAvailableChannels(): { channel: SocialChannel; name: string; description: string; ready: boolean }[] {
    return [
        { channel: 'telegram', name: 'Telegram', description: 'Long engaging news post for channel', ready: true },
        { channel: 'facebook', name: 'Facebook', description: 'Conversational community post', ready: false },
        { channel: 'instagram', name: 'Instagram', description: 'Visual caption + reels idea', ready: false },
        { channel: 'x_twitter', name: 'X / Twitter', description: 'Sharp thread with data points', ready: false },
        { channel: 'linkedin', name: 'LinkedIn', description: 'Professional thought leadership', ready: false },
    ];
}
