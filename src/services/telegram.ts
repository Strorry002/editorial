/**
 * Telegram Distribution Service
 * Posts AI-adapted articles to @theimmigrantsnews via Bot API
 */

import { adaptContentForChannel } from './social-adapter.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '@theimmigrantsnews';
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_ID || '1767332486';
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
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

interface TelegramResult {
    success: boolean;
    messageId?: number;
    error?: string;
    adaptedText?: string;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Sanitize HTML for Telegram.
 * Telegram supports: b, i, u, s, a, code, pre, blockquote, tg-spoiler
 * We keep: b, i, a — everything else gets converted or stripped
 */
function sanitizeTelegramHtml(html: string): string {
    let text = html
        // Headers → bold
        .replace(/<h[1-6][^>]*>/gi, '\n<b>')
        .replace(/<\/h[1-6]>/gi, '</b>\n')
        // Strong/em → b/i
        .replace(/<strong[^>]*>/gi, '<b>').replace(/<\/strong>/gi, '</b>')
        .replace(/<em[^>]*>/gi, '<i>').replace(/<\/em>/gi, '</i>')
        // Block elements → newlines
        .replace(/<\/?(p|div|section|article|header|footer|nav|figure|figcaption)[^>]*>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        // Lists
        .replace(/<[ou]l[^>]*>/gi, '').replace(/<\/[ou]l>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ').replace(/<\/li>/gi, '\n')
        // Blockquote → remove (we add our own expandable one)
        .replace(/<\/?blockquote[^>]*>/gi, '\n')
        // Strip any remaining unsupported tags, keep b, i, a
        .replace(/<\/?(?!(?:b|i|a)\b)[a-z][^>]*>/gi, '');

    // Fix newlines
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    // Validate balanced tags — for each of b, i, a
    for (const tag of ['b', 'i', 'a']) {
        const openRe = new RegExp(`<${tag}\\b`, 'gi');
        const closeRe = new RegExp(`</${tag}>`, 'gi');
        const opens = (text.match(openRe) || []).length;
        const closes = (text.match(closeRe) || []).length;
        if (opens !== closes) {
            // Unbalanced — strip this tag entirely
            const stripOpen = new RegExp(`<${tag}[^>]*>`, 'gi');
            const stripClose = new RegExp(`</${tag}>`, 'gi');
            text = text.replace(stripOpen, '').replace(stripClose, '');
        }
    }

    return text;
}

/**
 * Publish article to Telegram with AI-adapted content
 */
export async function publishToTelegram(article: ArticleData): Promise<TelegramResult> {
    if (!BOT_TOKEN) {
        return { success: false, error: 'TELEGRAM_BOT_TOKEN not set' };
    }

    try {
        // Generate AI-adapted content for Telegram
        const adapted = await adaptContentForChannel({
            title: article.title,
            excerpt: article.excerpt || '',
            body: article.body || article.excerpt || '',
            tags: article.tags || [],
            slug: article.slug,
            coverImage: article.coverImage,
            author: article.author,
        }, 'telegram');

        const articleUrl = `${SITE_URL}/article/${article.slug}`;
        const sanitizedBody = sanitizeTelegramHtml(adapted.text);

        // Build hashtags
        const hashtagsLine = adapted.hashtags.length > 0
            ? adapted.hashtags.map(h => `#${h.replace(/[\s-]/g, '_')}`).join(' ')
            : '';

        // === Strategy: Photo + short caption, then reply with full article ===

        // Short caption for photo (title + excerpt, no body)
        const shortCaption = `<b>${escapeHtml(article.title)}</b>\n\n<i>${escapeHtml((article.excerpt || '').substring(0, 200))}</i>`;

        // Full article text with expandable body
        let fullText = `<b>${escapeHtml(article.title)}</b>\n\n`;
        fullText += `<blockquote expandable>${sanitizedBody}</blockquote>\n\n`;
        fullText += `<a href="${articleUrl}">Read full article →</a>`;
        if (hashtagsLine) fullText += '\n\n' + hashtagsLine;

        let photoMessageId: number | undefined;

        // Step 1: Send photo with short caption
        if (article.coverImage) {
            if (article.coverImage.startsWith('/')) {
                // Local file upload
                const { readFileSync } = await import('fs');
                const { join } = await import('path');
                const filePath = join(process.cwd(), 'public', article.coverImage);

                try {
                    const fileBuffer = readFileSync(filePath);
                    const formData = new FormData();
                    formData.append('chat_id', CHAT_ID);
                    formData.append('caption', shortCaption.substring(0, 1024));
                    formData.append('parse_mode', 'HTML');
                    formData.append('photo', new Blob([fileBuffer], { type: 'image/webp' }), 'cover.webp');

                    const photoResult = await fetch(`${TG_API}/sendPhoto`, {
                        method: 'POST',
                        body: formData,
                    });
                    const photoData = await photoResult.json();
                    if (photoData.ok) {
                        photoMessageId = photoData.result?.message_id;
                    } else {
                        console.warn('[telegram] Local photo failed:', photoData.description);
                    }
                } catch (e: any) {
                    console.warn('[telegram] File error:', e.message);
                }
            } else if (article.coverImage.startsWith('http')) {
                const photoResult = await fetch(`${TG_API}/sendPhoto`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: CHAT_ID,
                        photo: article.coverImage,
                        caption: shortCaption.substring(0, 1024),
                        parse_mode: 'HTML',
                    }),
                });
                const photoData = await photoResult.json();
                if (photoData.ok) {
                    photoMessageId = photoData.result?.message_id;
                } else {
                    console.warn('[telegram] URL photo failed:', photoData.description);
                }
            }
        }

        // Step 2: Send full article text (as reply if photo was sent)
        const textBody: any = {
            chat_id: CHAT_ID,
            text: fullText.substring(0, 4096),
            parse_mode: 'HTML',
            disable_web_page_preview: true,
        };
        if (photoMessageId) {
            textBody.reply_to_message_id = photoMessageId;
        }

        const textResult = await fetch(`${TG_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(textBody),
        });
        const textData = await textResult.json();

        if (!textData.ok) {
            // Fallback: try without expandable blockquote (older clients)
            console.warn('[telegram] Formatted text failed:', textData.description, '— retrying plain');
            const plainText = `<b>${escapeHtml(article.title)}</b>\n\n${sanitizedBody.substring(0, 3500)}\n\n<a href="${articleUrl}">Read full article →</a>${hashtagsLine ? '\n\n' + hashtagsLine : ''}`;
            const plainBody: any = {
                chat_id: CHAT_ID,
                text: plainText.substring(0, 4096),
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            };
            if (photoMessageId) plainBody.reply_to_message_id = photoMessageId;

            const plainResult = await fetch(`${TG_API}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(plainBody),
            });
            const plainData = await plainResult.json();

            if (!plainData.ok) {
                return { success: false, error: plainData.description || 'Failed to send text' };
            }
            return { success: true, messageId: plainData.result?.message_id, adaptedText: adapted.text };
        }

        return {
            success: true,
            messageId: textData.result?.message_id,
            adaptedText: adapted.text,
        };

    } catch (err: any) {
        console.error('[telegram] Error:', err.message);
        return { success: false, error: err.message };
    }
}

async function sendTextMessage(text: string): Promise<TelegramResult> {
    const result = await fetch(`${TG_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: CHAT_ID,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: false,
        }),
    });

    const data = await result.json();

    if (!data.ok) {
        return { success: false, error: data.description || 'Unknown Telegram error' };
    }

    return { success: true, messageId: data.result?.message_id };
}

/**
 * Test bot connectivity
 */
export async function testTelegramBot(): Promise<TelegramResult> {
    if (!BOT_TOKEN) {
        return { success: false, error: 'TELEGRAM_BOT_TOKEN not set' };
    }

    try {
        const result = await fetch(`${TG_API}/getMe`);
        const data = await result.json();

        if (!data.ok) {
            return { success: false, error: data.description };
        }

        return {
            success: true,
            messageId: 0,
            error: `Bot: @${data.result.username} (${data.result.first_name})`,
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Send a report message to the owner's personal Telegram DM
 */
export async function sendOwnerReport(text: string): Promise<TelegramResult> {
    if (!BOT_TOKEN) {
        return { success: false, error: 'TELEGRAM_BOT_TOKEN not set' };
    }

    try {
        const result = await fetch(`${TG_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: OWNER_CHAT_ID,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            }),
        });

        const data = await result.json();

        if (!data.ok) {
            console.error('[telegram] Owner report failed:', data.description);
            return { success: false, error: data.description || 'Failed to send owner report' };
        }

        return { success: true, messageId: data.result?.message_id };
    } catch (err: any) {
        console.error('[telegram] Owner report error:', err.message);
        return { success: false, error: err.message };
    }
}
