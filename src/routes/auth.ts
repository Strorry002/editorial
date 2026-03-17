import { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'immigrants-secret-key-change-in-production';
const SALT_ROUNDS = 10;

type JwtPayload = { userId: string; email: string; role: string };

export function verifyToken(token: string): JwtPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
        return null;
    }
}

export function extractUser(request: FastifyRequest): JwtPayload | null {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    return verifyToken(auth.slice(7));
}

export async function authRoutes(app: FastifyInstance) {
    // Register
    app.post('/register', async (request, reply) => {
        const { email, password, displayName } = request.body as {
            email: string;
            password: string;
            displayName: string;
        };

        if (!email?.includes('@') || !password || password.length < 6) {
            reply.status(400);
            return { error: 'Valid email and password (6+ chars) required' };
        }

        if (!displayName || displayName.trim().length < 2) {
            reply.status(400);
            return { error: 'Display name (2+ chars) required' };
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            reply.status(409);
            return { error: 'Email already registered' };
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                displayName: displayName.trim(),
            },
        });

        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                avatarUrl: user.avatarUrl,
                createdAt: user.createdAt,
            },
        };
    });

    // Login
    app.post('/login', async (request, reply) => {
        const { email, password } = request.body as { email: string; password: string };

        if (!email || !password) {
            reply.status(400);
            return { error: 'Email/username and password required' };
        }

        // Support login by email OR displayName
        let user;
        if (email.includes('@')) {
            user = await prisma.user.findUnique({ where: { email } });
        } else {
            // Try displayName first (case-insensitive)
            user = await prisma.user.findFirst({
                where: { displayName: { equals: email, mode: 'insensitive' } },
            });
            // If not found, try email prefix (part before @)
            if (!user) {
                user = await prisma.user.findFirst({
                    where: { email: { startsWith: email.toLowerCase(), mode: 'insensitive' } },
                });
            }
        }
        if (!user || !user.isActive) {
            reply.status(401);
            return { error: 'Invalid credentials' };
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            reply.status(401);
            return { error: 'Invalid credentials' };
        }

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                avatarUrl: user.avatarUrl,
                createdAt: user.createdAt,
            },
        };
    });

    // Me (validate token)
    app.get('/me', async (request, reply) => {
        const payload = extractUser(request);
        if (!payload) {
            reply.status(401);
            return { error: 'Not authenticated' };
        }

        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user || !user.isActive) {
            reply.status(401);
            return { error: 'User not found' };
        }

        return {
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                avatarUrl: user.avatarUrl,
                createdAt: user.createdAt,
            },
        };
    });
}
