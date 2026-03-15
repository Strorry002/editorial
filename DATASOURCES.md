# 📡 Data Sources — Reference for Collection Agents

> **Проект:** immigrants-data  
> **Путь:** `d:\immigrants-data\`  
> **Стек:** Fastify + PostgreSQL (Prisma ORM) + TypeScript  
> **Дата:** 2026-03-14

---

## 🏗️ Архитектура: куда пишем данные

### Prisma-схема: 8 таблиц

| Таблица | Назначение | Ключевые поля |
|---------|-----------|--------------|
| `Country` | Справочник стран (ISO 3166) | `code` (US/CA/GB), `name`, `region`, `languages[]`, `currency`, `capitalCity`, `flag` |
| `VisaProgram` | Визовые программы | `countryCode`, `type` (work/student/tourist/investment/digital_nomad/family/asylum), `name`, `requirements` (JSON), `processingTime`, `approvalRate`, `officialUrl` |
| `LaborRegulation` | Трудовое право | `countryCode`, `category` (minimum_wage/work_permits/income_tax/diploma_recognition/worker_rights/social_security), `title`, `content` (JSON), `sourceUrl` |
| `CostOfLiving` | Стоимость жизни | `countryCode`, `city` (null=средняя по стране), `period`, `rentIndex`, `groceriesIndex`, `overallIndex`, `averageRent1br`, `mealCost` |
| `Statistic` | Статистика и метрики | `countryCode`, `category` (migration_flow/approval_rate/processing_time/diaspora/population), `metric`, `value`, `unit`, `period`, `comparison` (пред. значение) |
| `LegalUpdate` | Лента изменений законов | `countryCode`, `category` (visa/labor/tax/housing/healthcare/education/asylum), `title`, `summary`, `impactLevel` (low/medium/high/critical), `sourceUrl`, `telegramPosted` |
| `DataSource` | Реестр источников | `name`, `type` (api/scraper/manual), `baseUrl`, `frequency`, `lastFetchedAt`, `lastStatus` |
| `CollectionLog` | Лог сбора данных | `sourceName`, `status`, `recordsAdded`, `recordsUpdated`, `errorMessage`, `durationMs` |

### Формат записи в `content` (JSON) для `LaborRegulation`

```json
// category: "minimum_wage"
{ "hourly": 15.00, "monthly": 2600, "currency": "USD", "notes": "Federal minimum" }

// category: "income_tax"
{ "brackets": [{"from": 0, "to": 11600, "rate": 10}, {"from": 11601, "to": 47150, "rate": 12}], "currency": "USD" }

// category: "work_permits"
{ "types": ["employer-sponsored", "self-employed"], "tied_to_employer": true, "processing_weeks": 12 }

// category: "diploma_recognition"
{ "process": "credential evaluation", "agencies": ["WES", "NACES"], "regulated_professions": ["medicine", "law", "engineering"] }
```

### Формат `requirements` (JSON) для `VisaProgram`

```json
{
  "documents": ["passport", "employment letter", "degree transcript"],
  "conditions": ["job offer required", "employer must file petition"],
  "income_threshold": 60000,
  "fees": { "filing": 460, "biometrics": 85, "total": 545 },
  "language": { "test": "IELTS", "minimum_score": "6.0" }
}
```

---

## ✅ ИСТОЧНИК 1: Eurostat (ЕС) — Asylum & Residence Permits

**Тип:** REST API (JSON)  
**Авторизация:** Не требуется  
**Таблицы куда пишем:** `Statistic`, `LegalUpdate`  
**Частота:** Ежеквартально  
**Страны:** все страны ЕС (DE, FR, IT, ES, NL, SE, AT, BE, PL, и т.д.)

### Эндпоинты

#### 1.1 Заявки на убежище (asylum applications)
```
GET https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/migr_asyappctza
  ?format=JSON
  &lang=en
  &geo=DE&geo=FR&geo=IT&geo=ES&geo=NL&geo=SE&geo=AT&geo=BE
  &citizen=TOTAL
  &applicant=TOTAL
  &sex=T
  &age=TOTAL
  &time=2024&time=2023&time=2022
```

**Маппинг → `Statistic`:**
| Поле Statistic | Значение |
|---------------|----------|
| `countryCode` | из `geo` (DE, FR...) |
| `category` | `"asylum"` |
| `metric` | `"Total asylum applications"` |
| `value` | число из `value` |
| `unit` | `"people"` |
| `period` | из `time` (2024, 2023) |
| `sourceUrl` | `"https://ec.europa.eu/eurostat/databrowser/view/migr_asyappctza"` |

**Проверено:** ✅ DE: 351,600 (2023), 250,615 (2024)

#### 1.2 Первые ВНЖ (first residence permits)
```
GET https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/migr_resfirst
  ?format=JSON
  &lang=en
  &geo=DE&geo=FR&geo=IT&geo=ES&geo=NL
  &citizen=TOTAL
  &reason=TOTAL&reason=FAM&reason=EDUC&reason=EMP&reason=OTH
  &duration=TOTAL
  &time=2024&time=2023
```

**Маппинг → `Statistic`:**
| `metric` | `reason` |
|----------|----------|
| `"First residence permits (Total)"` | `TOTAL` |
| `"Residence permits for family reasons"` | `FAM` |
| `"Residence permits for education"` | `EDUC` |
| `"Residence permits for employment"` | `EMP` |
| `"Residence permits for other reasons"` | `OTH` |

**Дополнительные категории:**
- `category` = `"residence_permits"`
- `unit` = `"people"`

**Проверено:** ✅ DE: 662,888 total (2023), FR: 544,987 (2023)

#### 1.3 Решения по убежищу (asylum decisions)
```
GET https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/migr_asydcfsta
  ?format=JSON
  &lang=en
  &geo=DE&geo=FR&geo=IT
  &citizen=TOTAL
  &decision=TOTAL&decision=TOTAL_POS&decision=REJECTED
  &sex=T
  &age=TOTAL
  &time=2024&time=2023
```

**Маппинг → `Statistic`:**
- `metric` = `"Asylum decisions (total)"`, `"Asylum positive decisions"`, `"Asylum rejections"`
- `category` = `"asylum"`
- Approval rate = TOTAL_POS / TOTAL × 100 → записать отдельно как `category: "approval_rate"`

#### 1.4 Гражданство (acquisition of citizenship)
```
GET https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/migr_acq
  ?format=JSON
  &lang=en
  &geo=DE&geo=FR&geo=GB&geo=IT&geo=ES
  &citizen=TOTAL
  &sex=T
  &age=TOTAL
  &time=2023&time=2022
```

**Маппинг → `Statistic`:**
- `category` = `"naturalization"`
- `metric` = `"Acquisition of citizenship"`

### Как парсить ответ Eurostat

Eurostat возвращает SDMX-JSON. Структура:
```
response.value = { "0": 351600, "1": 250615, ... }  // плоский массив значений
response.dimension.geo.category.index = { "DE": 0, "FR": 1 }  // позиция → код страны
response.dimension.time.category.index = { "2023": 0, "2024": 1 }
response.size = [1, 1, 3, 4, 1, 8, 1, 2]  // размерности

Чтобы найти значение для DE+2024:
  geo_pos = dimension.geo.category.index["DE"]  // 0
  time_pos = dimension.time.category.index["2024"]  // 1
  flat_index = geo_pos * time_count + time_pos  // зависит от size[]
  value = response.value[flat_index]
```

---

## ✅ ИСТОЧНИК 2: Canada IRCC — Express Entry

**Тип:** JSON файл (прямая ссылка)  
**Авторизация:** Не требуется  
**Таблицы куда пишем:** `Statistic`, `VisaProgram`, `LegalUpdate`  
**Частота:** Еженедельно (раунды проходят ~2-3 раза в неделю)  
**Страны:** CA

### Эндпоинт

```
GET https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json
```

**Ответ — массив `rounds`:**
```json
{
  "rounds": [
    {
      "drawNumber": "402",
      "drawDate": "2026-03-05",
      "drawDateFull": "March 5, 2026",
      "drawName": "Senior managers with Canadian Work Experience, 2026-Version 1",
      "drawSize": "250",
      "drawCRS": "429",
      "drawCutOff": "January 23, 2026 at 13:23:54 UTC",
      "drawDistributionAsOn": "March 4, 2026",
      "dd1": "1,092", "dd2": "2,534", ... // CRS score distribution
    }
  ]
}
```

**Маппинг → `Statistic`:**
| Поле | Значение |
|------|----------|
| `countryCode` | `"CA"` |
| `category` | `"processing_time"` |
| `metric` | `"Express Entry CRS cutoff"` |
| `value` | `drawCRS` (число) |
| `unit` | `"points"` |
| `period` | `drawDate` |
| `metadata` | `{ "round": drawNumber, "program": drawName, "invitations": drawSize }` |

**Маппинг → `LegalUpdate` (при значительных изменениях CRS):**
| Поле | Значение |
|------|----------|
| `countryCode` | `"CA"` |
| `category` | `"visa"` |
| `title` | `"Express Entry Round #402: CRS 429"` |
| `summary` | `"250 invitations issued for Senior managers. CRS cutoff: 429"` |
| `impactLevel` | `"medium"` |
| `sourceUrl` | `"https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/submit-profile/rounds-invitations.html"` |

**Проверено:** ✅ Round #402 (2026-03-05): CRS 429, Round #400: CRS 508

---

## ✅ ИСТОЧНИК 3: World Bank — Migration & Economy

**Тип:** REST API (JSON)  
**Авторизация:** Не требуется  
**Таблицы куда пишем:** `Statistic`, `CostOfLiving`  
**Частота:** Ежегодно  
**Страны:** все (US, CA, GB, AU, DE и любые другие)

### Эндпоинт

```
GET https://api.worldbank.org/v2/country/{ISO2}/indicator/{INDICATOR}?format=json&per_page=5&mrv=5
```

### Индикаторы для сбора

| Indicator Code | Описание | Маппинг → таблица.category |
|---------------|----------|---------------------------|
| `SM.POP.NETM` | Net migration (5-year estimate) | `Statistic.migration_flow` |
| `SM.POP.TOTL` | International migrant stock (total) | `Statistic.migration_flow` |
| `SM.POP.TOTL.ZS` | Migrant stock (% of population) | `Statistic.migration_flow` |
| `NY.GDP.PCAP.PP.CD` | GDP per capita (PPP, current $) | `Statistic.population` |
| `SL.UEM.TOTL.ZS` | Unemployment rate (ILO, %) | `Statistic.population` |
| `SP.POP.TOTL` | Total population | `Statistic.population` |
| `FP.CPI.TOTL` | Consumer Price Index | `CostOfLiving.overallIndex` |
| `PA.NUS.PPPC.RF` | PPP conversion factor | `CostOfLiving.metadata` |
| `SE.XPD.TOTL.GD.ZS` | Education expenditure (% GDP) | `Statistic.population` |
| `SH.XPD.CHEX.PC.CD` | Health expenditure per capita | `Statistic.population` |

**Формат ответа:**
```json
[
  { "page": 1, "pages": 1, "total": 5 },
  [
    {
      "indicator": { "id": "SM.POP.TOTL", "value": "International migrant stock, total" },
      "country": { "id": "US", "value": "United States" },
      "date": "2024",
      "value": 52400000
    }
  ]
]
```

**⚠️ Важно:** ответ — массив из 2 элементов: `[metadata, data[]]`. Данные в `response[1]`.

**Проверено:** ✅ US: 52.4M мигрантов, AU: 30.4% населения — мигранты

---

## ✅ ИСТОЧНИК 4: RestCountries — Метаданные стран

**Тип:** REST API (JSON)  
**Авторизация:** Не требуется  
**Таблицы куда пишем:** `Country`  
**Частота:** Ежемесячно (данные редко меняются)  
**Страны:** все

### Эндпоинт

```
GET https://restcountries.com/v3.1/alpha/{ISO2}?fields=cca2,name,capital,region,subregion,languages,currencies,flag,timezones
```

**⚠️ Ответ — ОБЪЕКТ (не массив!):**
```json
{
  "flag": "🇺🇸",
  "name": { "common": "United States", "official": "United States of America" },
  "currencies": { "USD": { "name": "United States dollar", "symbol": "$" } },
  "languages": { "eng": "English" },
  "cca2": "US",
  "capital": ["Washington, D.C."],
  "region": "Americas",
  "subregion": "North America",
  "timezones": ["UTC-12:00", "UTC-11:00", "UTC-10:00", ...]
}
```

**Маппинг → `Country`:**
| Поле Country | Источник |
|-------------|---------|
| `code` | `cca2` |
| `name` | `name.common` |
| `capitalCity` | `capital[0]` |
| `region` | маппинг: Americas→north-america/south-america, Europe→europe, Oceania→oceania |
| `languages` | `Object.keys(languages)` → ["en", "fr"] |
| `currency` | `Object.keys(currencies)[0]` → "USD" |
| `flag` | `flag` → "🇺🇸" |
| `timezone` | `timezones[0]` |

**Проверено:** ✅ Все 5 стран работают

---

## ⚡ ИСТОЧНИК 5: USCIS News — Скрапинг

**Тип:** HTML scraping  
**Таблицы куда пишем:** `LegalUpdate`  
**Частота:** Ежедневно  
**Страны:** US

### URL для парсинга

```
https://www.uscis.gov/news/all-news
```

**Что извлекать:**
- Заголовок новости
- Дата публикации
- Краткое содержание
- Ссылка на полный текст
- Тип: News Release / Alert

**Маппинг → `LegalUpdate`:**
| Поле | Значение |
|------|----------|
| `countryCode` | `"US"` |
| `category` | определить из заголовка: visa/labor/asylum/tax |
| `title` | заголовок новости |
| `summary` | первый абзац или description |
| `impactLevel` | `"medium"` (пост-обработка: ключевые слова "suspend", "terminate" → high/critical) |
| `sourceUrl` | полная ссылка |

### Ключевые слова для категоризации

```
visa → "visa", "H-1B", "green card", "immigrant", "nonimmigrant", "petition"
labor → "employment", "work permit", "EAD", "labor certification", "PERM"
asylum → "asylum", "refugee", "TPS", "humanitarian", "parole"
tax → "fee", "premium processing", "filing fee"
```

---

## ⚡ ИСТОЧНИК 6: GOV.UK — Immigration Rules Changes

**Тип:** HTML scraping  
**Таблицы куда пишем:** `LegalUpdate`  
**Частота:** Ежедневно  
**Страны:** GB

### URL для парсинга

```
https://www.gov.uk/government/collections/immigration-rules-statement-of-changes
```

**Маппинг → `LegalUpdate`:**
- `countryCode` = `"GB"`
- `category` = `"visa"` (UK immigration rules)
- `title` = название Statement of Changes
- `impactLevel` = `"high"` (это изменения закона!)

---

## ⚡ ИСТОЧНИК 7: US Visa Bulletin — Monthly

**Тип:** HTML scraping  
**Таблицы куда пишем:** `Statistic`, `LegalUpdate`  
**Частота:** Ежемесячно  
**Страны:** US

### URL

```
https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html
```

**Что извлекать:**
- Текущий месяц: Final Action Dates и Dates for Filing
- Категории: EB-1, EB-2, EB-3, EB-4, EB-5 (employment)
- Категории: F-1, F-2A, F-2B, F-3, F-4 (family)
- По странам: All, China, India, Mexico, Philippines

**Маппинг → `Statistic`:**
- `category` = `"processing_time"`
- `metric` = `"Visa Bulletin EB-2 Final Action Date"`
- `value` = дата в формате timestamp
- `period` = месяц бюллетеня

---

## ⚡ ИСТОЧНИК 8: Australia — Visa Processing Times

**Тип:** HTML scraping  
**Таблицы куда пишем:** `Statistic`, `VisaProgram`  
**Частота:** Ежемесячно  
**Страны:** AU

### URL

```
https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times
```

**Что извлекать:**
- Visa subclass number (189, 190, 491, 482, 500...)
- Processing time (75th percentile)
- Processing time (90th percentile)

**Маппинг → `Statistic`:**
- `category` = `"processing_time"`
- `metric` = `"Australia visa 189 processing time (75%)"`
- `value` = количество дней/месяцев
- `unit` = `"months"`

---

## 📋 Приоритетные страны

### Tier 1 (полное покрытие, все источники)
| Код | Страна | Основные визы | Источники |
|-----|--------|--------------|-----------|
| US | США | H-1B, L-1, O-1, EB-1/2/3, Green Card | USCIS, Visa Bulletin, World Bank |
| CA | Канада | Express Entry, PNP, LMIA | IRCC Express Entry JSON, World Bank |
| GB | Великобритания | Skilled Worker, Global Talent, Innovator | GOV.UK, World Bank |
| AU | Австралия | 189, 190, 491, 482, 500 | HomeAffairs, World Bank |
| DE | Германия | EU Blue Card, Job Seeker, Student | Eurostat, World Bank |

### Tier 2 (Eurostat + World Bank)
| Код | Страна | Фокус |
|-----|--------|-------|
| FR | Франция | Talent Passport, Student |
| NL | Нидерланды | Highly Skilled Migrant, DAFT |
| SE | Швеция | Work Permit, Research |
| ES | Испания | Digital Nomad, Golden Visa |
| IT | Италия | Elective Residence, Work |
| AT | Австрия | Red-White-Red Card |

### Tier 3 (World Bank + ручные данные)
| Код | Страна | Фокус |
|-----|--------|-------|
| SG | Сингапур | EP, S Pass |
| AE | ОАЭ | Golden Visa, Freelancer |
| NZ | Новая Зеландия | Skilled Migrant |
| JP | Япония | HSP, Engineer |
| PT | Португалия | D7, Digital Nomad |

---

## 🛠️ Техническая информация для агента

### Подключение к БД

```bash
# .env файл
DATABASE_URL=postgresql://postgres:imm_secure_2026@db:5432/immigrants_data
```

### Prisma-команды

```bash
npx prisma db push      # Применить схему к БД
npx prisma generate      # Сгенерировать клиент
npx prisma studio        # GUI для данных (порт 5555)
npm run db:seed           # Заполнить начальные данные
```

### Как писать коллектор

Файл: `src/collectors/{source-name}.ts`

```typescript
import { BaseCollector, CollectorResult } from './base.js';

export class MyCollector extends BaseCollector {
  readonly sourceName = 'my_source';       // уникальный ID
  readonly description = 'Description';

  async collect(): Promise<CollectorResult> {
    let added = 0, updated = 0, skipped = 0;
    
    // 1. Fetch data
    const data = await this.fetchJson('https://api.example.com/data');
    
    // 2. Upsert into DB
    const existing = await this.prisma.statistic.findFirst({ where: {...} });
    if (existing) {
      await this.prisma.statistic.update({ where: { id: existing.id }, data: {...} });
      updated++;
    } else {
      await this.prisma.statistic.create({ data: {...} });
      added++;
    }
    
    return { source: this.sourceName, status: 'success', recordsAdded: added, recordsUpdated: updated, recordsSkipped: skipped, durationMs: 0 };
  }
}
```

### Зарегистрировать в scheduler

Файл: `src/collectors/scheduler.ts` — добавить import и в массив `collectors`.

### Запуск

```bash
npm run collect              # Все коллекторы
npm run collect:oecd         # Один конкретный
npx tsx src/collectors/run.ts my_source  # Любой по имени
```

---

## ⚠️ Известные ограничения

| Источник | Проблема | Обход |
|----------|---------|-------|
| UN DESA data API | Endpoints `/data/indicators/` возвращают 401 | Использовать World Bank SM.POP вместо |
| OECD SDMX | Мигрировали на новую платформу, старые URL 404 | Перегенерировать URL через data-explorer.oecd.org |
| Numbeo | Защита от ботов, нет API | Scraping с прокси или ручной ввод |
| USCIS RSS | Старые RSS URL 404 | Парсить HTML страницу /news/all-news |
