// YouGile Full Audit — Node.js (handles Unicode properly)
import { readFileSync } from 'fs';
const config = JSON.parse(readFileSync('C:\\Users\\Strorry\\.gemini\\antigravity\\mcp_config.json', 'utf8'));
const API_KEY = config.mcpServers.yougile.env.YOUGILE_API_KEY;
const DONE_COL = 'b00865e9-2f5b-452e-ab03-c07710097a6d';
const BACKLOG_COL = '0a6f041d-52f3-440f-868e-c6d5af87be9e';

const headers = { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json; charset=utf-8' };

async function api(method, path, body) {
    const r = await fetch(`https://yougile.com/api-v2${path}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return r.json();
}

async function newTask(title, desc, col, completed = true) {
    const r = await api('POST', '/tasks', { title, columnId: col, completed, description: desc });
    return r.id;
}

async function newSub(parentId, title, desc, col, completed = true) {
    const childId = await newTask(title, desc, col, completed);
    await api('POST', `/tasks/${parentId}/subtasks`, { childId });
    return childId;
}

async function chat(taskId, text) {
    await api('POST', `/chats/${taskId}/messages`, { text });
}

async function main() {
    console.log('Starting full project audit...');

    // ========== EPIC 1: Platform Foundation ==========
    console.log('EPIC 1: Platform Foundation...');
    const e1 = await newTask('\u{1F3D7}\uFE0F \u0424\u0443\u043d\u0434\u0430\u043c\u0435\u043d\u0442 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b', '<p>Next.js 15 frontend + Fastify backend + PostgreSQL. Docker deployment on Contabo VPS.</p>', DONE_COL);
    const s1a = await newSub(e1, '\u{1F3D7}\uFE0F Next.js 15 frontend', '<p>App Router, SSR, categories, articles, dark theme</p>', DONE_COL);
    await chat(s1a, 'Frontend: Next.js 15 App Router. Structure: app/[category], app/article/[slug], app/tools/*. SSR + force-dynamic. globals.css 4000+ lines custom styles. Dark theme via CSS variables. Components: NomadMap, AuthModal, MobileNav, NavControls, ArticleActions, CommentsSection, NewsletterForm, UserButton, CookieBanner.');
    const s1b = await newSub(e1, '\u{1F3D7}\uFE0F Fastify backend + Prisma ORM', '<p>REST API, JWT auth, PostgreSQL via Prisma</p>', DONE_COL);
    await chat(s1b, 'Backend: Fastify + TypeScript. Prisma 6 ORM + PostgreSQL. Routes: auth.ts, articles.ts (30KB!), agents.ts, countries.ts, tools.ts (26KB), admin.ts, publications.ts, comments.ts, subscribers.ts, user.ts, feed.ts. JWT auth with cookie. 11 route files total.');
    const s1c = await newSub(e1, '\u{1F3D7}\uFE0F Docker deploy (Contabo VPS)', '<p>docker-compose.prod.yml, nginx reverse proxy, SSL</p>', DONE_COL);
    await chat(s1c, 'Deploy: Docker Compose on Contabo 194.233.82.90:2222. Frontend port 3080, Backend port 4100, PostgreSQL port 5432. Nginx reverse proxy + SSL. Files uploaded via SCP, build via docker compose build --no-cache. GitHub repos: Strorry002/theimmigrants (frontend), Strorry002/editorial (backend).');
    const s1d = await newSub(e1, '\u{1F3D4}\uFE0F Auth + profiles', '<p>JWT login/register, email support, bookmarks</p>', DONE_COL);
    await chat(s1d, 'Auth: JWT tokens in cookie. Login by username or email (prefix matching: jbush finds jbush@jbush.com). Register with email. AuthModal component. UserButton dropdown. Profile: bookmarks, likes, comments history.');
    const s1e = await newSub(e1, '\u{1F3D4}\uFE0F Dark theme + Mobile Nav', '<p>CSS variables, hamburger menu, responsive design</p>', DONE_COL);
    await chat(s1e, 'Dark theme via prefers-color-scheme + manual toggle. MobileNav with hamburger. Custom dropdown instead of native select for dark mode compat. Responsive breakpoints for all screen sizes.');
    console.log('  EPIC 1 done:', e1);

    // ========== EPIC 2: AI Editorial Team ==========
    console.log('EPIC 2: AI Editorial Team...');
    const e2 = await newTask('\u{1F3D4}\uFE0F AI \u0440\u0435\u0434\u0430\u043a\u0446\u0438\u044f \u2014 10 \u0430\u0433\u0435\u043d\u0442\u043e\u0432', '<p>Autonomous AI newsroom with 10 journalist agents, each specializing in their region/topic.</p>', DONE_COL);
    const s2a = await newSub(e2, '\u{1F3D4}\uFE0F 10 AI agents + avatars', '<p>Real journalist personas with generated avatars</p>', DONE_COL);
    await chat(s2a, '10 agents: Jordan Bush (Americas), Maya Chen (Asia-Pacific), Astrid Larsen (Europe), Priya Kapoor (South Asia), Diego Rivera (LatAm), Yuki Tanaka (East Asia), Elena Vasquez (Data/Stats), Tom Williams (UK/Brexit), Sarah Kim (Policy), Fatima Al-Hassan (MENA). Prisma Agent model: bio, region, personality, avatar. Avatars: AI-gen casual journalist style (not corporate suits).');
    const s2b = await newSub(e2, '\u{1F3D4}\uFE0F Article workflow pipeline', '<p>idea - outline - draft - review - published</p>', DONE_COL);
    await chat(s2b, 'Workflow: idea -> outline -> draft -> review -> approved -> published -> archived. stageUpdatedAt tracks auto-progression. Each agent writes in their style/region. Chief Editor (Grok) reviews and approves. ArticleSource model links articles to LegalUpdate sources.');
    const s2c = await newSub(e2, '\u{1F3D7}\uFE0F Backfill 53 articles', '<p>Initial article import, agent assignment, categories</p>', DONE_COL);
    await chat(s2c, 'Backfill: 53 initial articles across categories: north-america, europe, schengen, asia-pacific, latin-america, middle-east, uk, data-analysis, policy, south-asia. Each article linked to sources via ArticleSource model. Category field added later with backfill script.');
    console.log('  EPIC 2 done:', e2);

    // ========== EPIC 3: Autopilot ==========
    console.log('EPIC 3: Autopilot Pipeline...');
    const e3 = await newTask('\u{1F3D4}\uFE0F Autopilot v2 \u2014 \u0430\u0432\u0442\u043e\u043d\u043e\u043c\u043d\u0430\u044f \u0440\u0435\u0434\u0430\u043a\u0446\u0438\u044f', '<p>Fully autonomous pipeline: news collection - analysis - writing - review - publish</p>', DONE_COL);
    const s3a = await newSub(e3, '\u{1F3D4}\uFE0F 3-hour cron autopilot', '<p>Every 3h: pick best update - assign agent - draft - chief editor - publish</p>', DONE_COL);
    await chat(s3a, 'Autopilot v2: cron every 3 hours. Pipeline: 1) Find unpublished updates with score > 7. 2) AI picks best one. 3) Assign to agent by region. 4) Generate draft (1000-1500 words). 5) Chief editor review (Grok). 6) Publish max 1 article per cycle. Rate limited to avoid spam.');
    const s3b = await newSub(e3, '\u{1F3D4}\uFE0F Feature Autopilot (Tue+Fri)', '<p>Long-form analytics articles Tue+Fri 14:00 UTC</p>', DONE_COL);
    await chat(s3b, 'Feature articles: cron Tue+Fri 14:00 UTC. Long analytical pieces (2000+ words) based on multiple sources. Topics: trends, comparisons, forecasts.');
    const s3c = await newSub(e3, '\u{1F3D4}\uFE0F Weekly Digest (Sun)', '<p>Weekly summary digest Sunday 10:00 UTC</p>', DONE_COL);
    await chat(s3c, 'Weekly Digest: cron Sun 10:00 UTC. Auto-generated week summary: key updates by region, statistics, trending topics.');
    const s3d = await newSub(e3, '\u{1F3D7}\uFE0F Telegram bot distribution', '<p>Publishing to @theimmigrants_news channel</p>', DONE_COL);
    await chat(s3d, 'Telegram: channel @theimmigrants_news (underscore!). Bot posts snippet + link. ArticleDistribution model tracks where/when published. Safe truncation for TG 4096 char limit. TELEGRAM_CHAT_ID fix: @theimmigrants_news not @theimmigrantsnews.');
    console.log('  EPIC 3 done:', e3);

    // ========== EPIC 4: Data Collection ==========
    console.log('EPIC 4: 19 Data Collectors...');
    const e4 = await newTask('\u{1F3D4}\uFE0F 19 \u043a\u043e\u043b\u043b\u0435\u043a\u0442\u043e\u0440\u043e\u0432 \u0434\u0430\u043d\u043d\u044b\u0445', '<p>RSS, legislation, statistics, immigration data from authoritative sources. Daily cron.</p>', DONE_COL);
    const s4a = await newSub(e4, '\u{1F4CB} RSS Feeds (20+ sources)', '<p>BBC, Reuters, Al Jazeera, Politico, Der Spiegel etc</p>', DONE_COL);
    await chat(s4a, 'RSS collector (rss-feeds.ts, 11KB): 20+ feeds - BBC World, Reuters Immigration, Al Jazeera, Politico Europe, Der Spiegel, The Guardian, NPR, VOA. Parsing via xml2js. Dedup by URL. Saves as LegalUpdate. Daily cron 06:00 UTC.');
    const s4b = await newSub(e4, '\u{1F4CB} Congress.gov API', '<p>US immigration bills and legislation</p>', DONE_COL);
    await chat(s4b, 'Congress collector (congress.ts, 8KB): API congress.gov, filters: immigration/visa/asylum keywords. Gets bills, latest actions, sponsor info. Weekly cron.');
    const s4c = await newSub(e4, '\u{1F4CB} EU Legislation (EUR-Lex)', '<p>European directives and regulations</p>', DONE_COL);
    await chat(s4c, 'EU collector (eu-legislation.ts, 10KB): EUR-Lex SPARQL endpoint. Filters: immigration, asylum, visa, residence permit. Parses CELEX numbers. eu-legislation + gov-legislation (16KB) for national laws.');
    const s4d = await newSub(e4, '\u{1F4CB} OECD Statistics (2 modules)', '<p>Migration data + tax tables from OECD</p>', DONE_COL);
    await chat(s4d, 'OECD: two collectors. 1) oecd.ts (8KB) - international migration, labor force, integration indicators. 2) oecd-tax.ts (11KB) - tax rates by country, comparisons. Weekly Monday cron.');
    const s4e = await newSub(e4, '\u{1F4CB} WHO + UNHCR + World Bank + UN DESA', '<p>Health, refugees, economy, demographics</p>', DONE_COL);
    await chat(s4e, 'International orgs: WHO GHO (who-gho.ts 7KB - health indicators), UNHCR (unhcr.ts 10KB - refugee data, asylum stats), World Bank (world-bank.ts 6KB - GDP, employment, poverty), UN DESA (un-desa.ts 5KB - population, migration flows). All APIs free, no keys needed.');
    const s4f = await newSub(e4, '\u{1F4CB} SG MOM + Teleport + REST Countries', '<p>Singapore work permits, city quality, country reference</p>', DONE_COL);
    await chat(s4f, 'singapore-mom.ts (5KB): Singapore Ministry of Manpower - work permits, employment passes, quotas. teleport.ts (9KB): city quality of life scores, 17 categories. rest-countries.ts (4KB): flags, currencies, languages, ISO codes for Country seed.');
    const s4g = await newSub(e4, '\u{1F4CB} NewsData.io', '<p>Breaking news by immigration keywords</p>', DONE_COL);
    await chat(s4g, 'newsdata.ts (11KB): backup news source. Query: immigration OR visa OR asylum OR refugee. API key required (NEWSDATA_API_KEY). Top headlines + filtered search. Used for breaking news when RSS is slow.');
    const s4h = await newSub(e4, '\u{1F4CB} Scheduler (cron orchestration)', '<p>scheduler.ts - all cron jobs orchestrated</p>', DONE_COL);
    await chat(s4h, 'scheduler.ts (7KB): Full cron schedule: 06:00 daily data collection, Mon 03:00 OECD, every 3h autopilot, Tue+Fri 14:00 features, Sun 10:00 digest, Wed 02:00 SDS batch, 07:00 safety feed scrape, 08:00 city alerts scan.');
    console.log('  EPIC 4 done:', e4);

    // ========== EPIC 5: SDS ==========
    console.log('EPIC 5: SDS Engines...');
    const e5 = await newTask('\u{1F3D4}\uFE0F SDS \u2014 8 AI \u0434\u0432\u0438\u0436\u043a\u043e\u0432, 157 \u0433\u043e\u0440\u043e\u0434\u043e\u0432', '<p>Statistical Data Service: AI-powered collection and analysis for 157 cities x 8 dimensions</p>', DONE_COL);
    const s5a = await newSub(e5, '\u{1F4CB} City seed: 65 countries, 157 cities', '<p>Prisma seed with coords, ISO codes, relations</p>', DONE_COL);
    await chat(s5a, 'Seed: 65 countries x 157 cities. Model City: name, slug, lat, lng, countryId, nomadScore. Vietnam: 6 cities (Hanoi, HCMC, Da Nang, Hoi An, Nha Trang, Phu Quoc). UAE: Dubai, Abu Dhabi. Latest additions: Nha Trang, Phu Quoc (March 2026).');
    const s5b = await newSub(e5, '\u{1F3D4}\uFE0F 8 AI engines (Grok)', '<p>Cost, Housing, Climate, Infra, Safety, Environment, Healthcare, Lifestyle</p>', DONE_COL);
    await chat(s5b, 'stats-data-service.ts (46KB!): 8 engines: 1) CostOfLiving - 35 price items incl BigMac. 2) Housing - rent 1br/3br, airbnb. 3) Climate - temp/humidity by month. 4) Infrastructure - internet, coworking, power reliability. 5) Safety - overall, night, women, petty crime. 6) Environment - air quality, green spaces, noise. 7) Healthcare - system quality, insurance, pharmacies. 8) Lifestyle - nightlife, food, culture, expat community. All use Grok grok-3-mini-fast via XAI_API_KEY.');
    const s5c = await newSub(e5, '\u{1F3D4}\uFE0F NomadScore calculator', '<p>Weighted formula: cost 20% + safety 20% + infra 20% + climate 15% + health 10% + env 10% + lifestyle 5%</p>', DONE_COL);
    await chat(s5c, 'calculateNomadScores(): weighted average from 7 categories. Normalization 0-100. City ranking. Tiers: Excellent (80+), Great (60+), Good (40+), Average (<40). Runs after each engine batch.');
    const s5d = await newSub(e5, '\u{1F3D4}\uFE0F Big Mac Index', '<p>bigmac_single price for all cities</p>', DONE_COL);
    await chat(s5d, 'Big Mac Index added to PRICE_ITEMS as bigmac_single. AI returns price in USD. Shown on CoL page as burger emoji. Some countries dont have McDonalds - AI returns N/A. Used as purchasing power proxy.');
    console.log('  EPIC 5 done:', e5);

    // ========== EPIC 6: Tools Pages ==========
    console.log('EPIC 6: Frontend Tools...');
    const e6 = await newTask('\u{1F3D4}\uFE0F 7 Tools \u0441\u0442\u0440\u0430\u043d\u0438\u0446', '<p>Interactive tools: Nomad Index, Cost of Living, Visa Guide, Statistics, Immigration Stats, Advisor, Safety Alerts</p>', DONE_COL);
    const s6a = await newSub(e6, '\u{1F3D4}\uFE0F Nomad Index + NomadMap', '<p>Leaflet map with 157 circles, score coloring, detail cards</p>', DONE_COL);
    await chat(s6a, 'NomadMap.tsx (16KB): Leaflet with dynamic import (SSR workaround). CircleMarker per city - size by score, color by tier. Tooltip with key metrics. Detail card on click: safety, internet, cost, climate, healthcare, lifestyle. Legend. SVG alert triangles with pulse animation for critical/warning. Reused on both Nomad Index and Cost of Living pages.');
    const s6b = await newSub(e6, '\u{1F3D4}\uFE0F AI Advisor chat', '<p>Immigration Q&A chatbot</p>', DONE_COL);
    await chat(s6b, 'Advisor page: chat UI with AI (Grok). User asks immigration question - AI answers with context. History in React state. Backend POST /advisor-chat. Regex dotAll flag fix for Safari compatibility.');
    const s6c = await newSub(e6, '\u{1F3D4}\uFE0F AI Nomad Brief', '<p>Per-city AI analysis using REAL DB data</p>', DONE_COL);
    await chat(s6c, 'POST /nomad-brief: completely rewritten. Fetches ALL from DB: 35 prices (USD + local currency context), VisaProgram (digital_nomad, work, freelance), SafetyScore, Infrastructure, active CityAlerts. CRITICAL RULES in prompt: use ONLY provided data, dont hallucinate prices, mention local currency. Temperature 0.5. Fixed bugs: internet speed vs cost confusion, Malaysia DN Rantau visa missing.');
    const s6d = await newSub(e6, '\u{1F3D4}\uFE0F Cost of Living page', '<p>155+ cities with prices, map, gasoline</p>', DONE_COL);
    await chat(s6d, 'CoL page: fetches /cost-comparison API (35 prices per city). NomadMap with costIndex-based coloring. City cards: rent 1BR/3BR, meal, BigMac, cappuccino, beer, monthly ticket, gasoline, utilities. Alerts triangles integrated. Gasoline price added last.');
    const s6e = await newSub(e6, '\u{1F3D4}\uFE0F Safety Alerts page', '<p>Alert dashboard with severity badges</p>', DONE_COL);
    await chat(s6e, 'Safety Alerts page: fetches /city-alerts API. Severity badges (critical red, warning orange, advisory yellow, info gray). Category breakdown. Methodology section explaining GDELT + AI pipeline. 169 alerts across 155 cities.');
    await newSub(e6, '\u{1F4CB} Statistics + Immigration Stats', '<p>Statistical dashboards with country data</p>', DONE_COL);
    await newSub(e6, '\u{1F4CB} Visa Guide', '<p>Visa guide with country filtering</p>', DONE_COL);
    console.log('  EPIC 6 done:', e6);

    // ========== EPIC 7: Legal Pages ==========
    console.log('EPIC 7: Legal Pages...');
    const e7 = await newTask('\u{1F4CB} Legal + About', '<p>Privacy Policy, Terms, Imprint, About Us, Editorial Policy, Cookie Banner</p>', DONE_COL);
    await newSub(e7, '\u{1F4CB} Privacy, Terms, Imprint', '<p>GDPR-compliant legal pages</p>', DONE_COL);
    await newSub(e7, '\u{1F4CB} About Us (10 agents)', '<p>Photos + bios for all journalist agents</p>', DONE_COL);
    await newSub(e7, '\u{1F4CB} Editorial Policy', '<p>Journalism standards and editorial guidelines</p>', DONE_COL);
    await newSub(e7, '\u{1F4CB} Cookie Banner', '<p>GDPR cookie consent component</p>', DONE_COL);
    console.log('  EPIC 7 done:', e7);

    // ========== EPIC 8: Social Features ==========
    console.log('EPIC 8: Social Features...');
    const e8 = await newTask('\u{1F3D4}\uFE0F Social features', '<p>Comments, likes, bookmarks, newsletter, user profiles</p>', DONE_COL);
    const s8a = await newSub(e8, '\u{1F3D4}\uFE0F Comments system', '<p>CommentsSection with nested replies</p>', DONE_COL);
    await chat(s8a, 'CommentsSection.tsx (9KB): threaded comments. Prisma Comment model with parentId for nesting. Like/dislike. Moderation. Backend: comments.ts route.');
    await newSub(e8, '\u{1F3D4}\uFE0F Likes + Bookmarks', '<p>ArticleActions: like, bookmark, share buttons</p>', DONE_COL);
    const s8c = await newSub(e8, '\u{1F3D4}\uFE0F Newsletter', '<p>Email subscription with validation</p>', DONE_COL);
    await chat(s8c, 'NewsletterForm.tsx (5KB): email validation, Subscriber model in Prisma. Backend subscribers.ts route. Used in homepage and article pages.');
    console.log('  EPIC 8 done:', e8);

    console.log('\n=== ALL 8 EPICS CREATED WITH CHAT ANNOTATIONS ===');
}

main().catch(err => { console.error(err); process.exit(1); });
