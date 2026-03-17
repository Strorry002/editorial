/**
 * Facebook Page Publishing Service
 * Posts articles to The Immigrants News Facebook Page via Graph API
 */

import { adaptContentForChannel } from './social-adapter.js';

const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID || '';
const FB_PAGE_TOKEN = process.env.FACEBOOK_PAGE_TOKEN || '';
const FB_API = 'https://graph.facebook.com/v21.0';
const SITE_URL = process.env.SITE_URL || 'https://theimmigrants.news';

interface ArticleData {
    title: string;
    excerpt: string;
    body: string;
    slug: string;
    coverImage?: string | null;
    tags?: string[];
    author?: string | null;
}

interface FacebookResult {
    success: boolean;
    postId?: string;
    error?: string;
}

/**
 * Publish article to Facebook Page
 */
export async function publishToFacebook(article: ArticleData): Promise<FacebookResult> {
    if (!FB_PAGE_TOKEN || !FB_PAGE_ID) {
        return { success: false, error: 'FACEBOOK_PAGE_TOKEN or FACEBOOK_PAGE_ID not set' };
    }

    try {
        const articleUrl = `${SITE_URL}/article/${article.slug}`;

        // Generate AI-adapted content for Facebook
        const adapted = await adaptContentForChannel({
            title: article.title,
            excerpt: article.excerpt || '',
            body: article.body || article.excerpt || '',
            tags: article.tags || [],
            slug: article.slug,
            coverImage: article.coverImage,
            author: article.author,
        }, 'facebook');

        // Build post message
        let message = adapted.text;

        // Ensure article link is included
        if (!message.includes(articleUrl)) {
            message += `\n\n🔗 ${articleUrl}`;
        }

        // Add hashtags
        if (adapted.hashtags.length > 0) {
            message += '\n\n' + adapted.hashtags.map(h => `#${h.replace(/[\s-]/g, '_')}`).join(' ');
        }

        // Try posting with photo first
        if (article.coverImage) {
            let photoUrl = article.coverImage;

            if (photoUrl.startsWith('/')) {
                // Local file — upload via multipart
                const { readFileSync } = await import('fs');
                const { join } = await import('path');
                const filePath = join(process.cwd(), 'public', photoUrl);

                try {
                    const fileBuffer = readFileSync(filePath);
                    const formData = new FormData();
                    formData.append('message', message);
                    formData.append('access_token', FB_PAGE_TOKEN);
                    formData.append('source', new Blob([fileBuffer], { type: 'image/webp' }), 'cover.webp');

                    const result = await fetch(`${FB_API}/${FB_PAGE_ID}/photos`, {
                        method: 'POST',
                        body: formData,
                    });
                    const data = await result.json();

                    if (data.id) {
                        console.log(`[facebook] Photo post published: ${data.id}`);
                        return { success: true, postId: data.id };
                    }
                    console.warn('[facebook] Photo upload failed:', data.error?.message);
                } catch (e: any) {
                    console.warn('[facebook] File read error:', e.message);
                }
            } else if (photoUrl.startsWith('http')) {
                // External URL photo
                const result = await fetch(`${FB_API}/${FB_PAGE_ID}/photos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: photoUrl,
                        message,
                        access_token: FB_PAGE_TOKEN,
                    }),
                });
                const data = await result.json();

                if (data.id) {
                    console.log(`[facebook] URL photo post published: ${data.id}`);
                    return { success: true, postId: data.id };
                }
                console.warn('[facebook] URL photo failed:', data.error?.message);
            }
        }

        // Fallback: text + link post
        const result = await fetch(`${FB_API}/${FB_PAGE_ID}/feed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                link: articleUrl,
                access_token: FB_PAGE_TOKEN,
            }),
        });
        const data = await result.json();

        if (data.id) {
            console.log(`[facebook] Text post published: ${data.id}`);
            return { success: true, postId: data.id };
        }

        return { success: false, error: data.error?.message || 'Unknown Facebook error' };

    } catch (err: any) {
        console.error('[facebook] Error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Test Facebook Page connectivity
 */
export async function testFacebookPage(): Promise<FacebookResult> {
    if (!FB_PAGE_TOKEN || !FB_PAGE_ID) {
        return { success: false, error: 'FB credentials not set' };
    }

    try {
        const result = await fetch(`${FB_API}/${FB_PAGE_ID}?fields=name,fan_count,link&access_token=${FB_PAGE_TOKEN}`);
        const data = await result.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        return {
            success: true,
            postId: data.id,
            error: `Page: ${data.name} (${data.fan_count} fans)`,
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
