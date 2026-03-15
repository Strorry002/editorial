# 🔧 Agent Prompt: Fix Data Collectors — Quality & Relevance

> **Проект:** `d:\immigrants-data\`  
> **Стек:** Fastify + PostgreSQL (Prisma) + TypeScript  
> **Файлы коллекторов:** `src/collectors/*.ts`  
> **Справочник источников:** `DATASOURCES.md` (в корне проекта)  
> **Prisma-схема:** `prisma/schema.prisma`

---

## 🎯 Задача

Пофикси все коллекторы в `src/collectors/`. Сейчас они собирают мусор и пишут мало полезного текста. Нужно сделать так, чтобы в БД попадали ТОЛЬКО релевантные иммиграционные обновления с полным текстом.

---

## 🐛 Диагностика: 4 критические проблемы

### 1. Нерелевантный контент (CRITICAL)

RSS-фиды (особенно GOV.UK) пишут в БД **все новости подряд**, включая мусор:
- ❌ "Litter louts face losing their driving licences" — штрафы за мусор
- ❌ "Correspondence from the Independent Adviser on Ministerial Standards" — бюрократия
- ❌ EU-декларация про Конго — дипломатия

**Фикс:** Добавь фильтрацию по ключевым словам ПЕРЕД записью в БД.

```typescript
// Минимальный набор — должно совпасть хотя бы одно слово
const IMMIGRATION_KEYWORDS = [
    'immigration', 'immigrant', 'visa', 'asylum', 'refugee',
    'deportation', 'citizenship', 'naturalization', 'residency',
    'work permit', 'green card', 'border', 'migrant', 'migration',
    'skilled worker', 'points system', 'express entry', 'h-1b',
    'settlement', 'leave to remain', 'right to work',
    'family reunion', 'sponsor', 'biometric', 'travel ban',
    'foreign worker', 'labour market', 'occupation list'
];

function isImmigrationRelevant(title: string, summary: string): boolean {
    const text = (title + ' ' + summary).toLowerCase();
    return IMMIGRATION_KEYWORDS.some(kw => text.includes(kw));
}

// Использование: if (!isImmigrationRelevant(title, summary)) { skipped++; continue; }
```

### 2. Пустой / формальный `details` (HIGH)

Сейчас `details` содержит бесполезный текст типа `"Source: GOV.UK Immigration"`.

**Фикс:** По `sourceUrl` загрузи полный текст статьи и распарси body:

```typescript
async function fetchArticleContent(url: string): Promise<string | null> {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'ImmigrantsDataBot/1.0' },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const html = await res.text();
        
        // Извлеки основной контент (убери навигацию, футеры, скрипты)
        // Для GOV.UK: <div class="govspeak"> ... </div>
        // Для Congress: <div class="overview"> ... </div>  
        // Для EC: <div class="ecl-paragraph"> ... </div>
        
        const bodyMatch = html.match(
            /<(?:div|article|section)[^>]*class="[^"]*(?:govspeak|article-body|content-body|field-body|entry-content|post-content)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article|section)>/i
        );
        
        if (bodyMatch) {
            return stripHtml(bodyMatch[1]).trim().substring(0, 2000);
        }
        
        // Fallback: meta description
        const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/) ||
                          html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/) ;
        if (metaMatch) return metaMatch[1];
        
        return null;
    } catch {
        return null;
    }
}

// Записывай в details:
// details: articleContent || `${bill.originChamber} | Updated: ${bill.updateDate}`
```

### 3. `effectiveDate` не заполняется (HIGH)

Все 5 seed-записей и многие от RSS имеют `effectiveDate: null`. Пользователь видит только дату сбора (сегодня) вместо реальной даты события.

**Фикс:** Извлекай дату из:
- **RSS/Atom:** `<pubDate>` или `<updated>` или `<dc:date>`
- **Congress:** `bill.latestAction.actionDate` (уже есть, но пишется в `publishedAt`, а не в `effectiveDate`)
- **EU:** `<dc:date>` или дата из заголовка

```typescript
// При создании LegalUpdate:
await prisma.legalUpdate.create({
    data: {
        // ...
        effectiveDate: pubDate ? new Date(pubDate) : null,    // ← дата самой новости
        publishedAt: pubDate ? new Date(pubDate) : new Date(), // ← тоже из новости
        // createdAt автоматически ставится Prisma (дата сбора)
    },
});
```

**Важно:** `publishedAt` тоже должен быть датой новости, а НЕ `new Date()`.

### 4. Кодировка UTF-8 (MEDIUM)

В БД попадают битые символы: `D�claration`, `£` → `�`.

**Фикс:** Убедись что при fetch используется правильная кодировка:

```typescript
const res = await fetch(url);
const buffer = await res.arrayBuffer();
const text = new TextDecoder('utf-8').decode(buffer);
```

Или проще — в `base.ts` метод `fetchJson` и `fetchText` должны форсировать UTF-8.

---

## 📋 Файлы для фикса

| Файл | Что фиксить |
|------|-------------|
| `src/collectors/base.ts` | Добавь `fetchText()` method с UTF-8, добавь `isImmigrationRelevant()` |
| `src/collectors/rss-feeds.ts` | Фильтрация по keywords, `effectiveDate` из `<pubDate>`, fetch article body для `details` |
| `src/collectors/eu-legislation.ts` | Фильтрация (сейчас пишет ВСЕ EU пресс-релизы), `effectiveDate`, fix кодировки |
| `src/collectors/congress.ts` | `effectiveDate` из `bill.latestAction.actionDate`, расширить `details` (уже норм) |
| `src/collectors/newsdata.ts` | Проверь фильтрацию и `effectiveDate` |
| `src/seed/index.ts` | Обновить 5 seed-записей: добавить `effectiveDate`, расширить `summary` и `details` |

---

## ✅ Критерии готовности

1. **Запусти `npm run collect`** и проверь что:
   - ❌ "Litter louts", EU Congo декларации и прочий мусор НЕ попадают в БД
   - ✅ Только иммиграционные новости проходят фильтр
   - ✅ `details` содержит 200+ символов полезного текста (не "Source: GOV.UK")
   - ✅ `effectiveDate` заполнен для записей из RSS (дата из pubDate)
   - ✅ Нет битой кодировки (£, é, ö отображаются корректно)

2. **Проверь на дашборде** http://localhost:4100/dashboard/index.html:
   - В Legal Updates → клик на запись → модалка показывает полный текст
   - Дата новости (📅) отличается от даты сбора (🤖)

3. **TypeScript:** `npx tsc --noEmit` — 0 ошибок

---

## ⚠️ Не делай

- НЕ меняй Prisma-схему — она уже правильная
- НЕ трогай дашборд (HTML/CSS/JS) — он работает
- НЕ меняй API-роуты (src/routes/*) — они работают
- НЕ удаляй существующие записи из БД
- НЕ добавляй новые npm-зависимости без необходимости (для XML используй regex, уже так сделано)

---

## 🗄️ Полезные команды

```bash
npm run collect                    # Все коллекторы
npx tsx src/collectors/run.ts rss_feeds  # Один конкретный
npx prisma studio                  # GUI для БД (порт 5555)
npx tsc --noEmit                   # Проверка типов
```

## 🗄️ Текущее состояние БД

- PostgreSQL в Docker: `localhost:5452`
- DATABASE_URL в `.env`
- 5 стран (US/CA/GB/AU/DE), 22 визы, ~100 legal_updates (из них 95 с details)
