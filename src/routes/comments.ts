import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { extractUser } from './auth.js';

const prisma = new PrismaClient();

export async function commentsRoutes(app: FastifyInstance) {
    // List comments for an article (public)
    app.get('/:articleId', async (request) => {
        const { articleId } = request.params as { articleId: string };

        const comments = await prisma.comment.findMany({
            where: { articleId },
            include: {
                user: {
                    select: { id: true, displayName: true, avatarUrl: true, role: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        return { data: comments, total: comments.length };
    });

    // Create comment (authenticated)
    app.post('/', async (request, reply) => {
        const payload = extractUser(request);
        if (!payload) {
            reply.status(401);
            return { error: 'Authentication required' };
        }

        const { articleId, body, parentId } = request.body as {
            articleId: string;
            body: string;
            parentId?: string;
        };

        if (!articleId || !body?.trim()) {
            reply.status(400);
            return { error: 'Article ID and comment body required' };
        }

        if (body.trim().length > 2000) {
            reply.status(400);
            return { error: 'Comment too long (max 2000 chars)' };
        }

        const comment = await prisma.comment.create({
            data: {
                articleId,
                body: body.trim(),
                userId: payload.userId,
                parentId: parentId || null,
            },
            include: {
                user: {
                    select: { id: true, displayName: true, avatarUrl: true, role: true },
                },
            },
        });

        return { data: comment };
    });

    // Delete comment (own or admin)
    app.delete('/:commentId', async (request, reply) => {
        const payload = extractUser(request);
        if (!payload) {
            reply.status(401);
            return { error: 'Authentication required' };
        }

        const { commentId } = request.params as { commentId: string };
        const comment = await prisma.comment.findUnique({ where: { id: commentId } });

        if (!comment) {
            reply.status(404);
            return { error: 'Comment not found' };
        }

        if (comment.userId !== payload.userId && payload.role !== 'admin') {
            reply.status(403);
            return { error: 'Not authorized to delete this comment' };
        }

        await prisma.comment.delete({ where: { id: commentId } });
        return { status: 'deleted' };
    });
}
