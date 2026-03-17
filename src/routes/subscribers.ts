import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function subscriberRoutes(app: FastifyInstance) {
    // Subscribe
    app.post('/subscribe', async (request, reply) => {
        const { email, topics, lang } = request.body as {
            email: string;
            topics?: string[];
            lang?: string;
        };

        if (!email || !email.includes('@')) {
            reply.status(400);
            return { error: 'Valid email required' };
        }

        // Check if already subscribed
        const existing = await prisma.subscriber.findUnique({ where: { email } });

        if (existing && existing.active) {
            // Update topics if re-subscribing
            const updated = await prisma.subscriber.update({
                where: { email },
                data: {
                    topics: topics || existing.topics,
                    lang: lang || existing.lang,
                },
            });
            return { status: 'updated', id: updated.id, message: 'Subscription preferences updated' };
        }

        if (existing && !existing.active) {
            // Reactivate
            const reactivated = await prisma.subscriber.update({
                where: { email },
                data: {
                    active: true,
                    topics: topics || existing.topics,
                    lang: lang || existing.lang,
                    unsubscribedAt: null,
                },
            });
            return { status: 'reactivated', id: reactivated.id, message: 'Welcome back!' };
        }

        // New subscriber
        const subscriber = await prisma.subscriber.create({
            data: {
                email,
                topics: topics || [],
                lang: lang || 'en',
            },
        });

        return { status: 'subscribed', id: subscriber.id, message: 'Thanks for subscribing!' };
    });

    // Unsubscribe
    app.post('/unsubscribe', async (request, reply) => {
        const { email } = request.body as { email: string };

        if (!email) {
            reply.status(400);
            return { error: 'Email required' };
        }

        const existing = await prisma.subscriber.findUnique({ where: { email } });
        if (!existing) {
            reply.status(404);
            return { error: 'Email not found' };
        }

        await prisma.subscriber.update({
            where: { email },
            data: { active: false, unsubscribedAt: new Date() },
        });

        return { status: 'unsubscribed', message: 'You have been unsubscribed' };
    });

    // List subscribers (admin)
    app.get('/', async (request) => {
        const { active } = request.query as { active?: string };
        const where = active !== undefined ? { active: active !== 'false' } : {};

        const subscribers = await prisma.subscriber.findMany({
            where,
            orderBy: { subscribedAt: 'desc' },
        });

        return { data: subscribers, total: subscribers.length };
    });
}
