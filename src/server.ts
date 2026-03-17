import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { createBot } from './bot/index.js';
import { startScheduler } from './collectors/scheduler.js';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { join } from 'path';

import { countriesRoutes } from './routes/countries.js';
import { feedRoutes } from './routes/feed.js';
import { adminRoutes } from './routes/admin.js';
import { publicationsRoutes } from './routes/publications.js';
import { articlesRoutes } from './routes/articles.js';
import { agentsRoutes } from './routes/agents.js';
import { toolsRoutes } from './routes/tools.js';
import { subscriberRoutes } from './routes/subscribers.js';
import { authRoutes } from './routes/auth.js';
import { commentsRoutes } from './routes/comments.js';
import { userRoutes } from './routes/user.js';

dotenv.config();

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

async function start() {
    // Plugins
    await app.register(cors, { origin: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] });
    await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
    await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

    // Static files (dashboard)
    await app.register(fastifyStatic, {
        root: join(process.cwd(), 'public'),
        prefix: '/',
    });

    // Decorate with prisma
    app.decorate('prisma', prisma);

    // Routes
    await app.register(countriesRoutes, { prefix: '/api/v1' });
    await app.register(feedRoutes, { prefix: '/api/v1' });
    await app.register(adminRoutes, { prefix: '/api/v1/admin' });
    await app.register(publicationsRoutes, { prefix: '/api/v1/publications' });
    await app.register(articlesRoutes, { prefix: '/api/v1/articles' });
    await app.register(agentsRoutes, { prefix: '/api/v1/agents' });
    await app.register(toolsRoutes, { prefix: '/api/v1/tools' });
    await app.register(subscriberRoutes, { prefix: '/api/v1/subscribers' });
    await app.register(authRoutes, { prefix: '/api/v1/auth' });
    await app.register(commentsRoutes, { prefix: '/api/v1/comments' });
    await app.register(userRoutes, { prefix: '/api/v1/user' });

    // Health check
    app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    // Dashboard redirect
    app.get('/', async (_, reply) => {
        return reply.redirect('/dashboard/index.html');
    });

    // Start
    const port = parseInt(process.env.PORT || '4100');
    const host = process.env.HOST || '0.0.0.0';

    try {
        await app.listen({ port, host });
        console.log(`🌍 Immigrants Data API running on http://${host}:${port}`);

        // Start Telegram bot if token is configured
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (botToken) {
            const bot = createBot(botToken);
            bot.launch().then(() => {
                console.log('🤖 Telegram bot started');
            }).catch((err: unknown) => {
                console.error('Failed to start Telegram bot:', err);
            });
            process.once('SIGINT', () => bot.stop('SIGINT'));
            process.once('SIGTERM', () => bot.stop('SIGTERM'));
        }

        // Start data collection scheduler
        startScheduler();
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});

start();

// Type augmentation for Fastify
declare module 'fastify' {
    interface FastifyInstance {
        prisma: PrismaClient;
    }
}
