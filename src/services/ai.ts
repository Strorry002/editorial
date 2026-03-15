import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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
 * Uses GPT-4o-mini for cost efficiency (~$0.01 per article).
 */
export async function generateArticleDraft(
    existingTitle: string,
    sources: SourceMaterial[],
    language: string = 'ru',
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

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt.trim() },
            { role: 'user', content: userPrompt.trim() },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    const result = JSON.parse(content) as GenerateResult;

    // Ensure all fields present
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
 * Returns a DALL-E / SD prompt string.
 */
export function generateCoverPrompt(title: string, tags: string[], countryFlags: string[]): string {
    const tagStr = tags.join(', ');
    const flags = countryFlags.join(' ');

    return `Editorial illustration for immigration news article. Topic: "${title}". Keywords: ${tagStr}. Countries: ${flags}. Style: modern flat editorial illustration, muted professional colors, no text, clean composition, 16:9 aspect ratio, suitable for news website header.`;
}

/**
 * Generate cover image via DALL-E 3
 */
export async function generateCoverImage(prompt: string): Promise<string> {
    const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1792x1024', // ~16:9
        quality: 'standard',
    });

    return response.data?.[0]?.url || '';
}
