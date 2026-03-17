import OpenAI from 'openai';

// AI Provider — xAI Grok (preferred) or OpenAI (fallback)
const useXAI = !!process.env.XAI_API_KEY;
const xai = new OpenAI({
    apiKey: useXAI ? process.env.XAI_API_KEY : process.env.OPENAI_API_KEY,
    baseURL: useXAI ? 'https://api.x.ai/v1' : undefined,
});

export const AI_MODEL = useXAI ? 'grok-3-mini-fast' : 'gpt-4o-mini';
export const AI_IMAGE_MODEL = useXAI ? 'grok-imagine-image' : 'dall-e-3';
console.log(`[ai] Using ${useXAI ? 'xAI Grok' : 'OpenAI'} (model: ${AI_MODEL})`);

interface SourceMaterial {
    title: string;
    summary: string;
    details?: string | null;
    countryCode: string;
    countryName?: string;
    category: string;
    impactLevel: string;
    effectiveDate?: string | null;
    sourceUrl?: string | null;
}

interface GenerateResult {
    title: string;
    excerpt: string;
    body: string;
    tags: string[];
    metaDescription: string;
}

/**
 * Generate an article draft from source LegalUpdate materials.
 * Uses Grok grok-3-mini-fast for cost efficiency.
 */
export async function generateArticleDraft(
    existingTitle: string,
    sources: SourceMaterial[],
    language: string = 'en',
    agentStyle?: string | null,
): Promise<GenerateResult> {

    const sourcesText = sources.map((s, i) => `
--- Source ${i + 1} ---
Title: ${s.title}
Country: ${s.countryName || s.countryCode} (${s.countryCode})
Category: ${s.category} | Impact: ${s.impactLevel}
Date: ${s.effectiveDate || 'Not specified'}
Summary: ${s.summary}
${s.details ? `Details: ${s.details}` : ''}
${s.sourceUrl ? `Source URL: ${s.sourceUrl}` : ''}
`).join('\n');

    const systemPrompt = language === 'ru' ? `
Ты — профессиональный журналист-аналитик, специализирующийся на иммиграционном праве и международной мобильности.

Правила:
- Пиши на русском языке
- Стиль: информативный, аналитический, без воды
- Структура: вступление → основные изменения → анализ последствий → выводы
- Используй подзаголовки (## Markdown) для структуры
- Упоминай конкретные цифры, даты, названия законов из источников
- В конце добавь раздел "Что это значит для мигрантов"
- Длина: 800-1500 слов
- НЕ выдумывай факты — используй ТОЛЬКО информацию из предоставленных источников
` : `
You are a professional immigration law analyst and journalist.

Rules:
- Write in English
- Style: informative, analytical, no fluff
- Structure: intro → key changes → impact analysis → takeaways
- Use ## Markdown subheadings
- Cite specific numbers, dates, law names from sources
- End with "What this means for migrants" section
- Length: 800-1500 words
- Do NOT invent facts — use ONLY the provided source materials
`;

    // Inject agent persona if available
    const finalPrompt = agentStyle
        ? `${agentStyle}\n\n${systemPrompt.trim()}`
        : systemPrompt;

    const userPrompt = `
Create an article based on these source materials.

Article working title: "${existingTitle}"

Source materials:
${sourcesText}

Respond in JSON format:
{
  "title": "Final article title (catchy, informative)",
  "excerpt": "1-2 sentence preview for social media (max 200 chars)",
  "body": "Full article in Markdown",
  "tags": ["tag1", "tag2", "tag3"],
  "metaDescription": "SEO meta description (max 160 chars)"
}
`;

    const completion = await xai.chat.completions.create({
        model: AI_MODEL,
        messages: [
            { role: 'system', content: finalPrompt.trim() },
            { role: 'user', content: userPrompt.trim() },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from xAI Grok');

    const result = JSON.parse(content) as GenerateResult;

    return {
        title: result.title || existingTitle,
        excerpt: result.excerpt || '',
        body: result.body || '',
        tags: result.tags || [],
        metaDescription: result.metaDescription || '',
    };
}

/**
 * Generate a cover image prompt from article metadata.
 */
export function generateCoverPrompt(title: string, tags: string[], countryFlags: string[]): string {
    const tagStr = tags.join(', ');
    const flags = countryFlags.join(' ');

    return `Editorial illustration for immigration news article. Topic: "${title}". Keywords: ${tagStr}. Countries: ${flags}. Style: modern flat editorial illustration, muted professional colors, no text, clean composition, 16:9 aspect ratio, suitable for news website header.`;
}

/**
 * Generate cover image via xAI Grok grok-2-image
 */
export async function generateCoverImage(prompt: string): Promise<string> {
    const response = await xai.images.generate({
        model: AI_IMAGE_MODEL,
        prompt,
        n: 1,
    });

    return response.data?.[0]?.url || '';
}

/**
 * Generate a photorealistic agent avatar
 */
export async function generateAgentAvatar(description: string): Promise<string> {
    const prompt = `Professional headshot portrait photo of ${description}. Neutral grey studio background, soft lighting, editorial style, looking at camera, confident expression, shoulders visible. Photorealistic, high quality, 1:1 square crop.`;

    try {
        const response = await xai.images.generate({
            model: AI_IMAGE_MODEL,
            prompt,
            n: 1,
        });

        const url = response.data?.[0]?.url;
        if (!url) {
            console.error('[avatar] xAI returned no URL. Response:', JSON.stringify(response.data || response));
            throw new Error('xAI returned no image URL');
        }
        console.log('[avatar] Generated:', url.substring(0, 80) + '...');
        return url;
    } catch (err: any) {
        console.error('[avatar] Generation failed:', err.message, err.status || '', err.code || '');
        throw new Error(`Avatar generation failed: ${err.message}`);
    }
}

/**
 * Get xAI client instance for external use
 */
export function getXAIClient(): OpenAI {
    return xai;
}
