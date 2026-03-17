/**
 * Editorial Team — AI Journalist Agents & Chief Editor Coordinator
 * Manages 5 journalist personas and assigns articles based on topic/region
 */
import { PrismaClient } from '@prisma/client';
import { generateAgentAvatar } from './ai.js';
import { getXAIClient, AI_MODEL } from './ai.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();
const xai = getXAIClient();

// ═══════════════════════════════════════════════════════════════
// AGENT DEFINITIONS — The Immigrants News Editorial Team
// ═══════════════════════════════════════════════════════════════

const AGENTS = [
    {
        name: 'sarah_mitchell',
        displayName: 'Sarah Mitchell',
        role: 'journalist',
        avatarDesc: 'a 35-year-old American woman journalist with brown hair, professional look, confident smile',
        basePrompt: `You are Sarah Mitchell, a Washington-based immigration policy analyst with 12 years of experience covering US border security, visa reforms, and federal immigration enforcement. Your writing style is authoritative and data-driven. You frequently reference specific bill numbers, executive orders, and enforcement statistics. You structure articles with clear policy implications and actionable takeaways for migrants.`,
        stylePrompt: 'Tone: analytical, authoritative. Use specific numbers and legal references. End sections with practical implications.',
        specialties: ['us', 'usa', 'border', 'enforcement', 'dhs', 'uscis', 'congress', 'federal'],
        regions: ['US', 'USA', 'CA', 'MX'],
    },
    {
        name: 'james_harrison',
        displayName: 'James Harrison',
        role: 'journalist',
        avatarDesc: 'a 42-year-old British man journalist with short dark hair, glasses, intellectual look, slight beard',
        basePrompt: `You are James Harrison, a London-based correspondent specializing in European immigration law, EU asylum policy, and Brexit-era mobility changes. With 15 years covering Westminster and Brussels, you bring deep institutional knowledge. Your writing combines legal precision with accessible storytelling, often drawing parallels between different European countries' approaches.`,
        stylePrompt: 'Tone: measured, institutional, with occasional dry wit. Compare policies across EU member states. Reference EU directives and UK Acts of Parliament.',
        specialties: ['uk', 'eu', 'europe', 'asylum', 'brexit', 'schengen', 'parliament', 'act'],
        regions: ['GB', 'UK', 'DE', 'FR', 'NL', 'SE', 'ES', 'IT', 'AT', 'PT'],
    },
    {
        name: 'elena_vasquez',
        displayName: 'Elena Vasquez',
        role: 'journalist',
        avatarDesc: 'a 30-year-old Latina woman journalist with dark wavy hair, warm expression, modern professional style',
        basePrompt: `You are Elena Vasquez, a digital nomad and visa specialist based between Lisbon and Mexico City. You've lived in 8 countries and hold dual citizenship. Your expertise covers work permits, digital nomad visas, golden visas, and the intersection of remote work with immigration law. Your writing is practical, personal, and action-oriented — you write as someone who has navigated these systems firsthand.`,
        stylePrompt: 'Tone: practical, personal, empowering. Include specific visa program names, costs, timelines. Address the reader directly.',
        specialties: ['visa', 'nomad', 'digital', 'work permit', 'golden', 'freelance', 'remote', 'residency'],
        regions: ['PT', 'ES', 'MX', 'CO', 'BR', 'TH', 'ID'],
    },
    {
        name: 'david_chen',
        displayName: 'David Chen',
        role: 'journalist',
        avatarDesc: 'a 38-year-old East Asian man journalist with neat black hair, clean-shaven, sharp professional look',
        basePrompt: `You are David Chen, a Singapore-based economics journalist covering migration flows across the Asia-Pacific region. With a background in economics from NUS and 10 years at major financial publications, you analyze immigration through the lens of labor markets, GDP impact, and demographic shifts. Your writing connects policy changes to broader economic narratives.`,
        stylePrompt: 'Tone: economic-analytical, data-heavy. Use charts-worthy statistics. Reference World Bank, OECD, and IMF data. Connect migration to economic indicators.',
        specialties: ['economic', 'labor', 'gdp', 'demographic', 'workforce', 'trade', 'oecd', 'world bank'],
        regions: ['SG', 'JP', 'AU', 'NZ', 'KR', 'IN', 'AE'],
    },
    {
        name: 'anna_kowalski',
        displayName: 'Anna Kowalski',
        role: 'journalist',
        avatarDesc: 'a 33-year-old Eastern European woman journalist with light brown hair in a bun, compassionate eyes, serious expression',
        basePrompt: `You are Anna Kowalski, a Geneva-based human rights journalist who has covered refugee crises across three continents. A former UNHCR communications officer, you bring firsthand field experience from camps in Jordan, Bangladesh, and Greece. Your writing centers human stories within policy frameworks, never letting statistics overshadow individual experiences.`,
        stylePrompt: 'Tone: compassionate yet rigorous. Lead with human impact, then policy context. Reference UNHCR data and international conventions. Use vivid scene-setting.',
        specialties: ['refugee', 'asylum', 'humanitarian', 'unhcr', 'rights', 'displacement', 'protection', 'crisis'],
        regions: ['UA', 'SY', 'AF', 'MM', 'SD', 'ET'],
    },
];

// ═══════════════════════════════════════════════════════════════
// SEED AGENTS — Create agents with AI-generated avatars
// ═══════════════════════════════════════════════════════════════

export async function seedAgents(): Promise<void> {
    const avatarDir = join(process.cwd(), 'public', 'avatars');
    await mkdir(avatarDir, { recursive: true });

    for (const agentDef of AGENTS) {
        const existing = await prisma.agent.findUnique({ where: { name: agentDef.name } });
        if (existing) {
            console.log(`  ✓ ${agentDef.displayName} already exists`);
            continue;
        }

        console.log(`  🎨 Creating ${agentDef.displayName}...`);

        // Generate avatar
        let avatarPath = '';
        try {
            const avatarUrl = await generateAgentAvatar(agentDef.avatarDesc);
            if (avatarUrl) {
                const res = await fetch(avatarUrl);
                const buf = Buffer.from(await res.arrayBuffer());
                const fileName = `${agentDef.name}.webp`;
                await writeFile(join(avatarDir, fileName), buf);
                avatarPath = `/avatars/${fileName}`;
                console.log(`    ✅ Avatar saved: ${fileName}`);
            }
        } catch (e: any) {
            console.warn(`    ⚠️ Avatar failed: ${e.message}`);
            avatarPath = '';
        }

        await prisma.agent.create({
            data: {
                name: agentDef.name,
                displayName: agentDef.displayName,
                role: agentDef.role,
                avatar: avatarPath,
                basePrompt: agentDef.basePrompt,
                stylePrompt: agentDef.stylePrompt,
                formatting: {
                    specialties: agentDef.specialties,
                    regions: agentDef.regions,
                },
            },
        });
        console.log(`  ✅ ${agentDef.displayName} created`);
    }
}

// ═══════════════════════════════════════════════════════════════
// CHIEF EDITOR — Assigns the best agent to an article
// ═══════════════════════════════════════════════════════════════

export async function assignAgent(
    articleTitle: string,
    tags: string[],
    region?: string | null,
): Promise<string | null> {
    const agents = await prisma.agent.findMany({ where: { isActive: true } });
    if (agents.length === 0) return null;

    // Score each agent based on keyword/region match
    const scores = agents.map(agent => {
        const fmt = agent.formatting as any;
        const specialties: string[] = fmt?.specialties || [];
        const regions: string[] = fmt?.regions || [];

        let score = 0;
        const titleLower = articleTitle.toLowerCase();
        const tagsLower = tags.map(t => t.toLowerCase());

        // Specialty keyword matching
        for (const kw of specialties) {
            if (titleLower.includes(kw)) score += 3;
            if (tagsLower.some(t => t.includes(kw))) score += 2;
        }

        // Region matching
        if (region && regions.includes(region)) score += 5;

        // Add small random factor for variety
        score += Math.random() * 1.5;

        return { agent, score };
    });

    // Pick highest score
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];

    console.log(`[chief-editor] Assigned "${articleTitle.substring(0, 40)}..." → ${best.agent.displayName} (score: ${best.score.toFixed(1)})`);
    return best.agent.id;
}

// ═══════════════════════════════════════════════════════════════
// GET AGENT — For display purposes
// ═══════════════════════════════════════════════════════════════

export async function getAgentById(id: string) {
    return prisma.agent.findUnique({ where: { id } });
}

export function getAgentDefinitions() {
    return AGENTS;
}
