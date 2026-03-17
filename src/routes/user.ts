import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { extractUser } from './auth.js';

const prisma = new PrismaClient();

export async function userRoutes(app: FastifyInstance) {

    // ── Like / Unlike article ──
    app.post('/likes/:articleId', async (request, reply) => {
        const user = extractUser(request);
        if (!user) { reply.status(401); return { error: 'Auth required' }; }
        const { articleId } = request.params as { articleId: string };

        const existing = await prisma.like.findUnique({
            where: { userId_articleId: { userId: user.userId, articleId } },
        });

        if (existing) {
            await prisma.like.delete({ where: { id: existing.id } });
            const count = await prisma.like.count({ where: { articleId } });
            return { liked: false, count };
        }

        await prisma.like.create({ data: { userId: user.userId, articleId } });
        const count = await prisma.like.count({ where: { articleId } });
        return { liked: true, count };
    });

    // ── My liked articles ──
    app.get('/likes', async (request, reply) => {
        const user = extractUser(request);
        if (!user) { reply.status(401); return { error: 'Auth required' }; }

        const likes = await prisma.like.findMany({
            where: { userId: user.userId },
            orderBy: { createdAt: 'desc' },
            select: { articleId: true, createdAt: true },
        });

        return { data: likes };
    });

    // ── Check if liked + counts ──
    app.get('/likes/:articleId', async (request) => {
        const user = extractUser(request);
        const { articleId } = request.params as { articleId: string };

        const [likeCount, saveCount] = await Promise.all([
            prisma.like.count({ where: { articleId } }),
            prisma.bookmark.count({ where: { articleId } }),
        ]);
        let liked = false;
        let saved = false;
        if (user) {
            const [existingLike, existingBookmark] = await Promise.all([
                prisma.like.findUnique({ where: { userId_articleId: { userId: user.userId, articleId } } }),
                prisma.bookmark.findUnique({ where: { userId_articleId: { userId: user.userId, articleId } } }),
            ]);
            liked = !!existingLike;
            saved = !!existingBookmark;
        }
        return { liked, saved, likeCount, saveCount };
    });

    // ── Bookmark / Unbookmark article ──
    app.post('/bookmarks/:articleId', async (request, reply) => {
        const user = extractUser(request);
        if (!user) { reply.status(401); return { error: 'Auth required' }; }
        const { articleId } = request.params as { articleId: string };
        const body = (request.body || {}) as { collectionId?: string };
        const collectionId = body.collectionId;

        const existing = await prisma.bookmark.findUnique({
            where: { userId_articleId: { userId: user.userId, articleId } },
        });

        if (existing) {
            await prisma.bookmark.delete({ where: { id: existing.id } });
            return { saved: false };
        }

        const bm = await prisma.bookmark.create({
            data: { userId: user.userId, articleId, collectionId: collectionId || null },
        });
        return { saved: true, bookmark: bm };
    });

    // ── My bookmarks ──
    app.get('/bookmarks', async (request, reply) => {
        const user = extractUser(request);
        if (!user) { reply.status(401); return { error: 'Auth required' }; }

        const bookmarks = await prisma.bookmark.findMany({
            where: { userId: user.userId },
            include: { collection: { select: { id: true, name: true, color: true } } },
            orderBy: { createdAt: 'desc' },
        });

        return { data: bookmarks };
    });

    // ── Move bookmark to collection ──
    app.patch('/bookmarks/:id', async (request, reply) => {
        const user = extractUser(request);
        if (!user) { reply.status(401); return { error: 'Auth required' }; }
        const { id } = request.params as { id: string };
        const { collectionId } = request.body as { collectionId: string | null };

        const bm = await prisma.bookmark.updateMany({
            where: { id, userId: user.userId },
            data: { collectionId },
        });

        return { updated: bm.count > 0 };
    });

    // ── Collections CRUD ──
    app.get('/collections', async (request, reply) => {
        const user = extractUser(request);
        if (!user) { reply.status(401); return { error: 'Auth required' }; }

        const collections = await prisma.collection.findMany({
            where: { userId: user.userId },
            include: { _count: { select: { bookmarks: true } } },
            orderBy: { createdAt: 'desc' },
        });

        return { data: collections };
    });

    app.post('/collections', async (request, reply) => {
        const user = extractUser(request);
        if (!user) { reply.status(401); return { error: 'Auth required' }; }
        const { name, color } = request.body as { name: string; color?: string };

        if (!name?.trim()) { reply.status(400); return { error: 'Name required' }; }

        const col = await prisma.collection.create({
            data: { userId: user.userId, name: name.trim(), color: color || '#a855f7' },
        });

        return { data: col };
    });

    app.delete('/collections/:id', async (request, reply) => {
        const user = extractUser(request);
        if (!user) { reply.status(401); return { error: 'Auth required' }; }
        const { id } = request.params as { id: string };

        // Unlink bookmarks first
        await prisma.bookmark.updateMany({
            where: { collectionId: id, userId: user.userId },
            data: { collectionId: null },
        });
        await prisma.collection.deleteMany({ where: { id, userId: user.userId } });

        return { deleted: true };
    });

    // ── User Profile ──
    app.get('/profile', async (request, reply) => {
        const payload = extractUser(request);
        if (!payload) { reply.status(401); return { error: 'Auth required' }; }

        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true, email: true, displayName: true, role: true,
                avatarUrl: true, telegramHandle: true, bio: true,
                createdAt: true, lastLoginAt: true,
                _count: { select: { comments: true, likes: true, bookmarks: true, collections: true } },
            },
        });

        return { data: user };
    });

    // ── Update Profile ──
    app.patch('/profile', async (request, reply) => {
        const payload = extractUser(request);
        if (!payload) { reply.status(401); return { error: 'Auth required' }; }

        const { displayName, telegramHandle, bio, avatarUrl } = request.body as {
            displayName?: string; telegramHandle?: string; bio?: string; avatarUrl?: string;
        };

        const data: Record<string, unknown> = {};
        if (displayName?.trim()) data.displayName = displayName.trim();
        if (telegramHandle !== undefined) data.telegramHandle = telegramHandle || null;
        if (bio !== undefined) data.bio = bio || null;
        if (avatarUrl !== undefined) data.avatarUrl = avatarUrl || null;

        const user = await prisma.user.update({
            where: { id: payload.userId },
            data,
            select: {
                id: true, email: true, displayName: true,
                avatarUrl: true, telegramHandle: true, bio: true,
            },
        });

        return { data: user };
    });
}
