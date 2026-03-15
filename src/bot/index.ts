import { Telegraf, Context } from 'telegraf';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function createBot(token: string) {
    const bot = new Telegraf(token);

    // Admin whitelist — only authorized users can interact
    const ALLOWED_USERS = [1767332486];
    bot.use((ctx, next) => {
        const userId = ctx.from?.id;
        if (userId && ALLOWED_USERS.includes(userId)) return next();
        return;
    });

    // /start
    bot.start((ctx) => {
        ctx.reply(
            `🌍 *Immigration Data Bot*\n\n` +
            `I provide real-time immigration data for 5+ countries.\n\n` +
            `*Commands:*\n` +
            `/country US — Country profile\n` +
            `/visa US work — Visa programs\n` +
            `/cost US — Cost of living\n` +
            `/compare US CA — Compare countries\n` +
            `/updates — Latest law changes\n` +
            `/countries — All available countries\n\n` +
            `Data source: TheImmigrants.news`,
            { parse_mode: 'Markdown' }
        );
    });

    // /help
    bot.help((ctx) => {
        ctx.reply(
            `🔍 *Available Commands*\n\n` +
            `/country {CODE} — Full country profile\n` +
            `/visa {CODE} {type?} — Visa programs (work/student/investment)\n` +
            `/cost {CODE} — Cost of living data\n` +
            `/labor {CODE} — Labor regulations\n` +
            `/compare {CODE1} {CODE2} — Side-by-side comparison\n` +
            `/updates {CODE?} — Latest legal updates\n` +
            `/countries — List all countries\n\n` +
            `Country codes: US, CA, GB, AU, DE`,
            { parse_mode: 'Markdown' }
        );
    });

    // /countries — list
    bot.command('countries', async (ctx) => {
        try {
            const countries = await prisma.country.findMany({ orderBy: { name: 'asc' } });
            if (!countries.length) return ctx.reply('No countries in database yet.');
            const list = countries.map(c => `${c.flag || ''} \`${c.code}\` ${c.name}`).join('\n');
            ctx.reply(`🌍 *Available Countries*\n\n${list}`, { parse_mode: 'Markdown' });
        } catch (e) {
            ctx.reply('⚠️ Database not available. Run seed first.');
        }
    });

    // /country US
    bot.command('country', async (ctx) => {
        const code = ctx.message.text.split(' ')[1]?.toUpperCase();
        if (!code) return ctx.reply('Usage: /country US');

        try {
            const country = await prisma.country.findUnique({
                where: { code },
                include: {
                    _count: {
                        select: { visaPrograms: true, laborRegulations: true, legalUpdates: true }
                    }
                }
            });
            if (!country) return ctx.reply(`❌ Country \`${code}\` not found.`, { parse_mode: 'Markdown' });

            const msg = [
                `${country.flag} *${country.name}* (${country.code})`,
                ``,
                `📍 Capital: ${country.capitalCity || 'N/A'}`,
                `💱 Currency: ${country.currency}`,
                `🗣 Languages: ${country.languages.join(', ')}`,
                `🌐 Region: ${country.region}`,
                ``,
                `📊 *Data available:*`,
                `• ${country._count.visaPrograms} visa programs`,
                `• ${country._count.laborRegulations} labor regulations`,
                `• ${country._count.legalUpdates} legal updates`,
                ``,
                `Use /visa ${code}, /cost ${code}, /labor ${code} for details`
            ].join('\n');

            ctx.reply(msg, { parse_mode: 'Markdown' });
        } catch (e) {
            ctx.reply('⚠️ Error fetching country data.');
        }
    });

    // /visa US work
    bot.command('visa', async (ctx) => {
        const parts = ctx.message.text.split(' ');
        const code = parts[1]?.toUpperCase();
        const type = parts[2]?.toLowerCase();
        if (!code) return ctx.reply('Usage: /visa US [work|student|investment|digital_nomad]');

        try {
            const where: any = { countryCode: code, isActive: true };
            if (type) where.type = type;

            const visas = await prisma.visaProgram.findMany({ where, orderBy: { type: 'asc' } });
            if (!visas.length) return ctx.reply(`No visa programs found for \`${code}\`${type ? ` (${type})` : ''}.`, { parse_mode: 'Markdown' });

            const country = await prisma.country.findUnique({ where: { code } });
            let msg = `${country?.flag || ''} *Visa Programs — ${country?.name || code}*\n`;
            if (type) msg += `Type: ${type}\n`;
            msg += `\n`;

            for (const v of visas.slice(0, 8)) {
                msg += `🛂 *${v.name}*\n`;
                msg += `   Type: ${v.type}`;
                if (v.processingTime) msg += ` | ⏱ ${v.processingTime}`;
                if (v.duration) msg += ` | 📅 ${v.duration}`;
                if (v.approvalRate) msg += ` | ✅ ${(v.approvalRate * 100).toFixed(0)}%`;
                msg += `\n`;
                if (v.description) msg += `   _${v.description.slice(0, 100)}_\n`;
                msg += `\n`;
            }

            if (visas.length > 8) msg += `_...and ${visas.length - 8} more_\n`;
            ctx.reply(msg, { parse_mode: 'Markdown' });
        } catch (e) {
            ctx.reply('⚠️ Error fetching visa data.');
        }
    });

    // /cost US
    bot.command('cost', async (ctx) => {
        const code = ctx.message.text.split(' ')[1]?.toUpperCase();
        if (!code) return ctx.reply('Usage: /cost US');

        try {
            const costs = await prisma.costOfLiving.findMany({
                where: { countryCode: code },
                orderBy: [{ city: 'asc' }, { period: 'desc' }],
                take: 10
            });
            if (!costs.length) return ctx.reply(`No cost data for \`${code}\`.`, { parse_mode: 'Markdown' });

            const country = await prisma.country.findUnique({ where: { code } });
            let msg = `${country?.flag || ''} *Cost of Living — ${country?.name || code}*\n\n`;

            for (const c of costs) {
                const label = c.city || '🏠 Country Average';
                msg += `📍 *${label}* (${c.period})\n`;
                if (c.averageRent1br) msg += `   🏠 1BR rent: $${c.averageRent1br}/mo\n`;
                if (c.mealCost) msg += `   🍽 Restaurant meal: $${c.mealCost}\n`;
                if (c.internetCost) msg += `   📶 Internet: $${c.internetCost}/mo\n`;
                if (c.overallIndex) msg += `   📊 Index: ${c.overallIndex}\n`;
                msg += `\n`;
            }

            ctx.reply(msg, { parse_mode: 'Markdown' });
        } catch (e) {
            ctx.reply('⚠️ Error fetching cost data.');
        }
    });

    // /labor US
    bot.command('labor', async (ctx) => {
        const code = ctx.message.text.split(' ')[1]?.toUpperCase();
        if (!code) return ctx.reply('Usage: /labor US');

        try {
            const regs = await prisma.laborRegulation.findMany({
                where: { countryCode: code },
                orderBy: { category: 'asc' }
            });
            if (!regs.length) return ctx.reply(`No labor data for \`${code}\`.`, { parse_mode: 'Markdown' });

            const country = await prisma.country.findUnique({ where: { code } });
            let msg = `${country?.flag || ''} *Labor Regulations — ${country?.name || code}*\n\n`;

            for (const r of regs) {
                msg += `⚖️ *${r.title}*\n`;
                msg += `   Category: ${r.category}\n`;
                const content = r.content as any;
                if (content.hourlyRate) msg += `   💰 $${content.hourlyRate}/hr\n`;
                if (content.workWeek) msg += `   ⏰ ${content.workWeek}h/week\n`;
                msg += `\n`;
            }

            ctx.reply(msg, { parse_mode: 'Markdown' });
        } catch (e) {
            ctx.reply('⚠️ Error fetching labor data.');
        }
    });

    // /compare US CA
    bot.command('compare', async (ctx) => {
        const parts = ctx.message.text.split(' ');
        const code1 = parts[1]?.toUpperCase();
        const code2 = parts[2]?.toUpperCase();
        if (!code1 || !code2) return ctx.reply('Usage: /compare US CA');

        try {
            const [c1, c2] = await Promise.all([
                prisma.country.findUnique({
                    where: { code: code1 },
                    include: {
                        costOfLiving: { where: { city: null }, take: 1, orderBy: { period: 'desc' } },
                        _count: { select: { visaPrograms: true } }
                    }
                }),
                prisma.country.findUnique({
                    where: { code: code2 },
                    include: {
                        costOfLiving: { where: { city: null }, take: 1, orderBy: { period: 'desc' } },
                        _count: { select: { visaPrograms: true } }
                    }
                }),
            ]);

            if (!c1 || !c2) return ctx.reply('One or both countries not found.');

            const cost1 = c1.costOfLiving[0];
            const cost2 = c2.costOfLiving[0];

            let msg = `📊 *${c1.flag} ${c1.name} vs ${c2.flag} ${c2.name}*\n\n`;

            msg += `| Metric | ${c1.code} | ${c2.code} |\n`;
            msg += `|--------|-----|-----|\n`;
            msg += `| Currency | ${c1.currency} | ${c2.currency} |\n`;
            msg += `| Visa programs | ${c1._count.visaPrograms} | ${c2._count.visaPrograms} |\n`;

            if (cost1 && cost2) {
                if (cost1.averageRent1br && cost2.averageRent1br)
                    msg += `| 1BR rent | $${cost1.averageRent1br} | $${cost2.averageRent1br} |\n`;
                if (cost1.mealCost && cost2.mealCost)
                    msg += `| Meal cost | $${cost1.mealCost} | $${cost2.mealCost} |\n`;
                if (cost1.overallIndex && cost2.overallIndex)
                    msg += `| Cost index | ${cost1.overallIndex} | ${cost2.overallIndex} |\n`;
            }

            msg += `\nUse /visa ${c1.code} and /visa ${c2.code} for visa details`;
            ctx.reply(msg, { parse_mode: 'Markdown' });
        } catch (e) {
            ctx.reply('⚠️ Error comparing countries.');
        }
    });

    // /updates
    bot.command('updates', async (ctx) => {
        const code = ctx.message.text.split(' ')[1]?.toUpperCase();

        try {
            const where: any = {};
            if (code) where.countryCode = code;

            const updates = await prisma.legalUpdate.findMany({
                where,
                orderBy: { publishedAt: 'desc' },
                take: 5,
                include: { country: { select: { flag: true, name: true } } }
            });

            if (!updates.length) return ctx.reply('No updates available.');

            let msg = `📋 *Latest Immigration Updates*\n\n`;

            for (const u of updates) {
                const icon = u.impactLevel === 'critical' ? '🔴' : u.impactLevel === 'high' ? '🟠' : '🟡';
                msg += `${icon} ${u.country.flag} *${u.title}*\n`;
                msg += `   ${u.summary.slice(0, 150)}\n`;
                if (u.sourceUrl) msg += `   [Source](${u.sourceUrl})\n`;
                msg += `\n`;
            }

            ctx.reply(msg, { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } });
        } catch (e) {
            ctx.reply('⚠️ Error fetching updates.');
        }
    });

    return bot;
}

/** Post an update to a Telegram channel */
export async function postToChannel(bot: Telegraf, channelId: string, update: {
    countryFlag?: string;
    countryName: string;
    title: string;
    summary: string;
    impactLevel: string;
    sourceUrl?: string;
}) {
    const icon = update.impactLevel === 'critical' ? '🔴' : update.impactLevel === 'high' ? '🟠' : '🟡';
    const msg = [
        `${icon} ${update.countryFlag || ''} *${update.countryName}*`,
        ``,
        `*${update.title}*`,
        update.summary,
        update.sourceUrl ? `\n[Source](${update.sourceUrl})` : '',
        `\n#immigration #${update.countryName.toLowerCase().replace(/\s+/g, '_')}`,
    ].join('\n');

    await bot.telegram.sendMessage(channelId, msg, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true },
    });
}
