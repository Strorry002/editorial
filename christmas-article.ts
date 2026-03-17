/**
 * christmas-article.ts — Create Christmas editorial greeting article
 * Backdated to December 24, 2025
 */
import { PrismaClient } from '@prisma/client';
import { getXAIClient, AI_MODEL } from './src/services/ai.js';

const prisma = new PrismaClient();
const xai = getXAIClient();

async function main() {
    console.log('🎄 Creating Christmas editorial greeting...\n');

    // Generate the article body
    const completion = await xai.chat.completions.create({
        model: AI_MODEL,
        messages: [
            {
                role: 'system',
                content: `You are the editorial board of The Immigrants News, a publication dedicated to immigration news and immigrant communities worldwide. Write a warm, heartfelt Christmas and New Year greeting from the entire editorial team to your readers — immigrants, expats, refugees, and global citizens everywhere.

Rules:
- Write in English
- Tone: warm, inclusive, hopeful, personal
- Structure it as a letter from the editors
- Reference the immigrant experience during holidays (being far from home, building new traditions, finding family in community)
- Mention the editorial team members: Sarah Mitchell, James Harrison, Elena Vasquez, David Chen, Anna Kowalski
- Include a section about what readers can look forward to in 2026
- End with a heartfelt wish
- Length: 500-800 words
- Use ## Markdown subheadings
- Include a note about the animated Christmas greeting card (link: /api/covers/christmas-2025.html)
- Do NOT sound robotic or corporate`
            },
            {
                role: 'user',
                content: `Write the Christmas 2025 editorial greeting. Return JSON:
{
  "title": "headline",
  "excerpt": "2-3 warm sentences",
  "body": "full article in Markdown",
  "tags": ["tag1", "tag2"],
  "metaDescription": "SEO meta max 160 chars"
}`
            }
        ],
        temperature: 0.8,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty AI response');
    const result = JSON.parse(raw);

    // Add animated greeting link to the body
    const bodyWithGreeting = result.body + `\n\n---\n\n## 🎄 Our Animated Christmas Greeting\n\nWe've prepared a special animated greeting card for you. [**Watch our Christmas greeting →**](https://editorial.theimmigrants.news/christmas-2025.html)\n\n*From all of us at The Immigrants News — Merry Christmas and Happy New Year 2026!*`;

    const slug = 'merry-christmas-from-the-immigrants-news-2025';
    const publishedAt = new Date('2025-12-24T09:00:00Z');

    // Check if already exists
    const existing = await prisma.article.findFirst({ where: { slug } });
    if (existing) {
        console.log('   Already exists, updating...');
        await prisma.article.update({
            where: { id: existing.id },
            data: {
                title: result.title,
                excerpt: result.excerpt,
                body: bodyWithGreeting,
                tags: result.tags,
                metaDescription: result.metaDescription,
                coverImage: '/covers/christmas-2025-editorial.png',
            },
        });
    } else {
        await prisma.article.create({
            data: {
                title: result.title,
                slug,
                excerpt: result.excerpt,
                body: bodyWithGreeting,
                tags: result.tags || ['christmas', 'editorial', 'holiday'],
                metaDescription: result.metaDescription || '',
                language: 'en',
                status: 'published',
                author: 'The Editorial Team',
                coverImage: '/covers/christmas-2025-editorial.png',
                publishedAt,
                createdAt: publishedAt,
            },
        });
    }

    console.log(`✅ "${result.title}"`);
    console.log(`   Date: 2025-12-24`);
    console.log(`   Author: The Editorial Team`);
    console.log(`   Cover: /covers/christmas-2025-editorial.png`);
    console.log(`   Greeting: /christmas-2025.html`);
    console.log(`\n🎄 Done!`);

    await prisma.$disconnect();
    process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
