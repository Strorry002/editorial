/**
 * Cover Image Service
 * Generates AI covers and saves to public/covers/
 */
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { generateCoverImage, generateCoverPrompt } from './ai.js';

const COVERS_DIR = join(process.cwd(), 'public', 'covers');

export async function generateArticleCover(
    title: string,
    excerpt: string,
    fileName: string,
): Promise<string> {
    await mkdir(COVERS_DIR, { recursive: true });

    const prompt = generateCoverPrompt(title, excerpt.split(/\s+/).slice(0, 5), []);
    console.log(`[covers] Generating cover for: ${title.substring(0, 50)}...`);

    const imageUrl = await generateCoverImage(prompt);
    if (!imageUrl) throw new Error('No image URL returned from AI');

    // Download and save
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to download cover: ${res.statusText}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const filePath = join(COVERS_DIR, fileName);
    await writeFile(filePath, buffer);

    console.log(`[covers] Saved: ${fileName} (${(buffer.length / 1024).toFixed(0)} KB)`);
    return `/covers/${fileName}`;
}
