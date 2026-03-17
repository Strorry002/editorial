import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const hash = await bcrypt.hash('J,hfpwjdf1998', 10);

    const user = await prisma.user.upsert({
        where: { email: 'at@theimmigrants.news' },
        create: {
            email: 'at@theimmigrants.news',
            passwordHash: hash,
            displayName: 'AT',
            role: 'admin',
        },
        update: {
            passwordHash: hash,
            role: 'admin',
        },
    });

    console.log('Admin created:', user.id, user.email, user.role);
    await prisma.$disconnect();
}

main();
