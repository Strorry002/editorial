$apiKey = (Get-Content "C:\Users\Strorry\.gemini\antigravity\mcp_config.json" | ConvertFrom-Json).mcpServers.yougile.env.YOUGILE_API_KEY
$h = @{ "Authorization" = "Bearer $apiKey"; "Content-Type" = "application/json; charset=utf-8" }
$doneCol = "b00865e9-2f5b-452e-ab03-c07710097a6d"
$backlogCol = "0a6f041d-52f3-440f-868e-c6d5af87be9e"

function New-Task($title, $desc, $col, $completed = $true) {
    $body = @{ title = $title; columnId = $col; completed = $completed; description = $desc } | ConvertTo-Json -Depth 3
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $r = Invoke-RestMethod -Uri "https://yougile.com/api-v2/tasks" -Method Post -Headers $h -Body $bytes -ContentType "application/json; charset=utf-8"
    return $r.id
}

function New-Sub($parentId, $title, $desc, $col, $completed = $true) {
    $childId = New-Task $title $desc $col $completed
    $subBody = [System.Text.Encoding]::UTF8.GetBytes((@{ childId = $childId } | ConvertTo-Json))
    try { Invoke-RestMethod -Uri "https://yougile.com/api-v2/tasks/$parentId/subtasks" -Method Post -Headers $h -Body $subBody -ContentType "application/json; charset=utf-8" | Out-Null } catch {}
    return $childId
}

function Send-Chat($taskId, $text) {
    $body = [System.Text.Encoding]::UTF8.GetBytes((@{ text = $text } | ConvertTo-Json -Depth 3))
    try { Invoke-RestMethod -Uri "https://yougile.com/api-v2/chats/$taskId/messages" -Method Post -Headers $h -Body $body -ContentType "application/json; charset=utf-8" | Out-Null } catch {}
}

# ================================================================
# EPIC 1: Platform Foundation
# ================================================================
Write-Host "EPIC 1: Platform Foundation..."
$e1 = New-Task "ðŸ—ï¸ Ð¤ÑƒÐ½Ð´Ð°Ð¼ÐµÐ½Ñ‚ Ð¿Ð»Ð°Ñ‚Ñ„Ð¾Ñ€Ð¼Ñ‹" "<p>Next.js 15 frontend + Fastify backend + PostgreSQL. Docker deployment Ð½Ð° Contabo VPS.</p>" $doneCol
$s1a = New-Sub $e1 "ðŸ—ï¸ Next.js 15 frontend" "<p>App Router, SSR, ÐºÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸Ð¸, ÑÑ‚Ð°Ñ‚ÑŒÐ¸, Ñ‚Ñ‘Ð¼Ð½Ð°Ñ Ñ‚ÐµÐ¼Ð°</p>" $doneCol
Send-Chat $s1a "Ð¤Ñ€Ð¾Ð½Ñ‚ÐµÐ½Ð´ Ð½Ð° Next.js 15 Ñ App Router. Ð¡Ñ‚Ñ€ÑƒÐºÑ‚ÑƒÑ€Ð°: app/[category], app/article/[slug], app/tools/*. Ð˜ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐµÐ¼ SSR + force-dynamic Ð´Ð»Ñ Ð°ÐºÑ‚ÑƒÐ°Ð»ÑŒÐ½Ñ‹Ñ… Ð´Ð°Ð½Ð½Ñ‹Ñ…. globals.css â€” 4000 ÑÑ‚Ñ€Ð¾Ðº ÐºÐ°ÑÑ‚Ð¾Ð¼Ð½Ñ‹Ñ… ÑÑ‚Ð¸Ð»ÐµÐ¹. Ð¢Ñ‘Ð¼Ð½Ð°Ñ Ñ‚ÐµÐ¼Ð° Ñ‡ÐµÑ€ÐµÐ· CSS variables."
$s1b = New-Sub $e1 "ðŸ—ï¸ Fastify backend + Prisma" "<p>REST API, JWT auth, PostgreSQL Ñ‡ÐµÑ€ÐµÐ· Prisma ORM</p>" $doneCol
Send-Chat $s1b "Backend: Fastify Ñ TypeScript. Prisma 6 ORM, PostgreSQL. Ð Ð¾ÑƒÑ‚Ñ‹: auth, articles, agents, countries, tools, admin, publications, comments, subscribers, user. JWT Ð°Ð²Ñ‚Ð¾Ñ€Ð¸Ð·Ð°Ñ†Ð¸Ñ Ñ cookie."
$s1c = New-Sub $e1 "ðŸ—ï¸ Docker deployment (Contabo VPS)" "<p>docker-compose.prod.yml, nginx reverse proxy, SSL</p>" $doneCol
Send-Chat $s1c "Ð”ÐµÐ¿Ð»Ð¾Ð¹ Ñ‡ÐµÑ€ÐµÐ· Docker Compose Ð½Ð° Contabo (194.233.82.90:2222). Frontend: Ð¿Ð¾Ñ€Ñ‚ 3080. Backend: Ð¿Ð¾Ñ€Ñ‚ 4100. PostgreSQL: Ð¿Ð¾Ñ€Ñ‚ 5432. Nginx reverse proxy Ñ SSL. Ð¤Ð°Ð¹Ð»Ñ‹ Ð·Ð°Ð³Ñ€ÑƒÐ¶Ð°ÐµÐ¼ Ñ‡ÐµÑ€ÐµÐ· SCP, Ð±Ð¸Ð»Ð´Ð¸Ð¼ docker compose build --no-cache."
$s1d = New-Sub $e1 "ðŸ”ï¸ ÐÐ²Ñ‚Ð¾Ñ€Ð¸Ð·Ð°Ñ†Ð¸Ñ Ð¸ Ð¿Ñ€Ð¾Ñ„Ð¸Ð»Ð¸" "<p>JWT, login/register, email Ð¿Ð¾Ð´Ð´ÐµÑ€Ð¶ÐºÐ°, Ð¿Ñ€Ð¾Ñ„Ð¸Ð»ÑŒ Ñ Ð·Ð°ÐºÐ»Ð°Ð´ÐºÐ°Ð¼Ð¸</p>" $doneCol
Send-Chat $s1d "Auth: JWT tokens Ð² cookie. Login Ð¿Ð¾ username Ð¸Ð»Ð¸ email (prefix matching). Register Ñ email. AuthModal ÐºÐ¾Ð¼Ð¿Ð¾Ð½ÐµÐ½Ñ‚. UserButton Ñ dropdown. ÐŸÑ€Ð¾Ñ„Ð¸Ð»ÑŒ: Ð·Ð°ÐºÐ»Ð°Ð´ÐºÐ¸, Ð»Ð°Ð¹ÐºÐ¸, ÐºÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ñ‹."
$s1e = New-Sub $e1 "ðŸ”ï¸ Ð¢Ñ‘Ð¼Ð½Ð°Ñ Ñ‚ÐµÐ¼Ð° + Mobile Nav" "<p>CSS variables Ð´Ð»Ñ Ñ‚Ñ‘Ð¼Ð½Ð¾Ð¹ Ñ‚ÐµÐ¼Ñ‹, hamburger Ð¼ÐµÐ½ÑŽ, responsive</p>" $doneCol
Send-Chat $s1e "Ð¢Ñ‘Ð¼Ð½Ð°Ñ Ñ‚ÐµÐ¼Ð° Ñ‡ÐµÑ€ÐµÐ· prefers-color-scheme + toggle. MobileNav Ñ hamburger. Responsive breakpoints. Custom dropdown Ð²Ð¼ÐµÑÑ‚Ð¾ native select Ð´Ð»Ñ ÑÐ¾Ð²Ð¼ÐµÑÑ‚Ð¸Ð¼Ð¾ÑÑ‚Ð¸ Ñ dark mode."
Write-Host "  Done: $e1"

# ================================================================
# EPIC 2: AI Editorial Team
# ================================================================
Write-Host "EPIC 2: AI Editorial Team..."
$e2 = New-Task "ðŸ”ï¸ AI Ñ€ÐµÐ´Ð°ÐºÑ†Ð¸Ñ â€” 10 Ð°Ð³ÐµÐ½Ñ‚Ð¾Ð²" "<p>ÐÐ²Ñ‚Ð¾Ð½Ð¾Ð¼Ð½Ð°Ñ Ñ€ÐµÐ´Ð°ÐºÑ†Ð¸Ñ Ñ 10 AI-Ð°Ð³ÐµÐ½Ñ‚Ð°Ð¼Ð¸. ÐšÐ°Ð¶Ð´Ñ‹Ð¹ ÑÐ¿ÐµÑ†Ð¸Ð°Ð»Ð¸Ð·Ð¸Ñ€ÑƒÐµÑ‚ÑÑ Ð½Ð° ÑÐ²Ð¾Ñ‘Ð¼ Ñ€ÐµÐ³Ð¸Ð¾Ð½Ðµ/Ñ‚ÐµÐ¼Ðµ.</p>" $doneCol
$s2a = New-Sub $e2 "ðŸ”ï¸ 10 AI-Ð°Ð³ÐµÐ½Ñ‚Ð¾Ð² Ñ Ð°Ð²Ð°Ñ‚Ð°Ñ€Ð°Ð¼Ð¸" "<p>ÐÐ°ÑÑ‚Ð¾ÑÑ‰Ð¸Ðµ Ð¶ÑƒÑ€Ð½Ð°Ð»Ð¸ÑÑ‚ÑÐºÐ¸Ðµ Ð¿ÐµÑ€ÑÐ¾Ð½Ñ‹: Jordan Bush, Maya Chen, Astrid Larsen Ð¸ Ð´Ñ€.</p>" $doneCol
Send-Chat $s2a "10 Ð°Ð³ÐµÐ½Ñ‚Ð¾Ð²: Jordan Bush (Americas), Maya Chen (Asia-Pacific), Astrid Larsen (Europe), Priya Kapoor (South Asia), Diego Rivera (LatAm), Yuki Tanaka (East Asia), Elena Vasquez (Data/Stats), Tom Williams (UK/Brexit), Sarah Kim (Policy), Fatima Al-Hassan (MENA). Prisma Ð¼Ð¾Ð´ÐµÐ»ÑŒ Agent Ñ bio, region, personality. ÐÐ²Ð°Ñ‚Ð°Ñ€Ñ‹ Ñ‡ÐµÑ€ÐµÐ· AI Ð³ÐµÐ½ÐµÑ€Ð°Ñ†Ð¸ÑŽ, ÑÑ‚Ð¸Ð»ÑŒ casual journalist (Ð½Ðµ corporate)."
$s2b = New-Sub $e2 "ðŸ”ï¸ Ð Ð°Ð±Ð¾Ñ‡Ð¸Ð¹ Ð¿Ñ€Ð¾Ñ†ÐµÑÑ ÑÑ‚Ð°Ñ‚ÐµÐ¹" "<p>Pipeline: idea â†’ outline â†’ draft â†’ review â†’ published. Ð¡Ñ‚Ð°Ñ‚ÑƒÑÑ‹ Ð² Prisma.</p>" $doneCol
Send-Chat $s2b "Workflow ÑÑ‚Ð°Ñ‚ÑŒÐ¸: idea â†’ outline â†’ draft â†’ review â†’ approved â†’ published â†’ archived. stageUpdatedAt Ð¾Ñ‚ÑÐ»ÐµÐ¶Ð¸Ð²Ð°ÐµÑ‚ Ð°Ð²Ñ‚Ð¾Ð¿Ñ€Ð¾Ð³Ñ€ÐµÑÑÐ¸ÑŽ. ÐšÐ°Ð¶Ð´Ñ‹Ð¹ Ð°Ð³ÐµÐ½Ñ‚ Ð¿Ð¸ÑˆÐµÑ‚ Ð² ÑÐ²Ð¾Ñ‘Ð¼ ÑÑ‚Ð¸Ð»Ðµ/Ñ€ÐµÐ³Ð¸Ð¾Ð½Ðµ. Chief Editor (Grok) Ð¿Ñ€Ð¾Ð²ÐµÑ€ÑÐµÑ‚ Ð¸ Ð°Ð¿Ð¿Ñ€ÑƒÐ²Ð¸Ñ‚."
$s2c = New-Sub $e2 "ðŸ—ï¸ Ð‘ÑÐºÑ„Ð¸Ð» 53 ÑÑ‚Ð°Ñ‚ÐµÐ¹" "<p>Ð˜Ð¼Ð¿Ð¾Ñ€Ñ‚ Ð¿ÐµÑ€Ð²Ð¾Ð½Ð°Ñ‡Ð°Ð»ÑŒÐ½Ñ‹Ñ… ÑÑ‚Ð°Ñ‚ÐµÐ¹, Ñ€Ð°ÑÐ¿Ñ€ÐµÐ´ÐµÐ»ÐµÐ½Ð¸Ðµ Ð¿Ð¾ Ð°Ð³ÐµÐ½Ñ‚Ð°Ð¼ Ð¸ ÐºÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸ÑÐ¼</p>" $doneCol
Send-Chat $s2c "Ð‘ÑÐºÑ„Ð¸Ð»: 53 Ð½Ð°Ñ‡Ð°Ð»ÑŒÐ½Ñ‹Ñ… ÑÑ‚Ð°Ñ‚ÑŒÐ¸ Ñ€Ð°ÑÐ¿Ñ€ÐµÐ´ÐµÐ»ÐµÐ½Ñ‹ Ð¿Ð¾ Ð°Ð³ÐµÐ½Ñ‚Ð°Ð¼. ÐšÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸Ð¸: north-america, europe, schengen, asia-pacific, latin-america, middle-east, uk, data-analysis, policy, south-asia. ÐšÐ°Ð¶Ð´Ð°Ñ ÑÑ‚Ð°Ñ‚ÑŒÑ Ð¸Ð¼ÐµÐµÑ‚ sources Ð¸Ð· LegalUpdate."
Write-Host "  Done: $e2"

# ================================================================
# EPIC 3: Autopilot Pipeline
# ================================================================
Write-Host "EPIC 3: Autopilot Pipeline..."
$e3 = New-Task "ðŸ”ï¸ Autopilot v2 â€” Ð°Ð²Ñ‚Ð¾Ð½Ð¾Ð¼Ð½Ð°Ñ Ñ€ÐµÐ´Ð°ÐºÑ†Ð¸Ñ" "<p>ÐŸÐ¾Ð»Ð½Ð¾ÑÑ‚ÑŒÑŽ Ð°Ð²Ñ‚Ð¾Ð½Ð¾Ð¼Ð½Ñ‹Ð¹ Ð¿Ð°Ð¹Ð¿Ð»Ð°Ð¹Ð½: ÑÐ±Ð¾Ñ€ Ð½Ð¾Ð²Ð¾ÑÑ‚ÐµÐ¹ â†’ Ð°Ð½Ð°Ð»Ð¸Ð· â†’ Ð½Ð°Ð¿Ð¸ÑÐ°Ð½Ð¸Ðµ â†’ review â†’ Ð¿ÑƒÐ±Ð»Ð¸ÐºÐ°Ñ†Ð¸Ñ</p>" $doneCol
$s3a = New-Sub $e3 "ðŸ”ï¸ 3-Ñ‡Ð°ÑÐ¾Ð²Ð¾Ð¹ cron autopilot" "<p>ÐšÐ°Ð¶Ð´Ñ‹Ðµ 3 Ñ‡Ð°ÑÐ°: Ð²Ñ‹Ð±Ð¾Ñ€ Ð»ÑƒÑ‡ÑˆÐ¸Ñ… Ð°Ð¿Ð´ÐµÐ¹Ñ‚Ð¾Ð² â†’ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ Ð°Ð³ÐµÐ½Ñ‚Ñƒ â†’ draft â†’ chief editor review â†’ publish</p>" $doneCol
Send-Chat $s3a "Autopilot v2: cron ÐºÐ°Ð¶Ð´Ñ‹Ðµ 3 Ñ‡Ð°ÑÐ°. Pipeline: 1) ÐÐ°Ñ…Ð¾Ð´Ð¸Ñ‚ unpublished updates ÑÐ¾ score > 7. 2) AI Ð²Ñ‹Ð±Ð¸Ñ€Ð°ÐµÑ‚ Ð»ÑƒÑ‡ÑˆÐ¸Ð¹. 3) ÐÐ°Ð·Ð½Ð°Ñ‡Ð°ÐµÑ‚ Ð°Ð³ÐµÐ½Ñ‚Ñƒ Ð¿Ð¾ Ñ€ÐµÐ³Ð¸Ð¾Ð½Ñƒ. 4) Ð“ÐµÐ½ÐµÑ€Ð¸Ñ€ÑƒÐµÑ‚ draft (1000-1500 ÑÐ»Ð¾Ð²). 5) Chief editor review (Grok). 6) ÐŸÑƒÐ±Ð»Ð¸ÐºÑƒÐµÑ‚ 1 ÑÑ‚Ð°Ñ‚ÑŒÑŽ. Rate limit: Ð¼Ð°ÐºÑ 1 Ð¿ÑƒÐ±Ð»Ð¸ÐºÐ°Ñ†Ð¸Ñ Ð·Ð° Ñ†Ð¸ÐºÐ»."
$s3b = New-Sub $e3 "ðŸ”ï¸ Feature Autopilot (Ð’Ñ‚+ÐŸÑ‚)" "<p>Ð”Ð»Ð¸Ð½Ð½Ñ‹Ðµ Ð°Ð½Ð°Ð»Ð¸Ñ‚Ð¸Ñ‡ÐµÑÐºÐ¸Ðµ ÑÑ‚Ð°Ñ‚ÑŒÐ¸ Ð¿Ð¾ Ð²Ñ‚Ð¾Ñ€Ð½Ð¸ÐºÐ°Ð¼ Ð¸ Ð¿ÑÑ‚Ð½Ð¸Ñ†Ð°Ð¼ 14:00 UTC</p>" $doneCol
Send-Chat $s3b "Feature articles: cron Tue+Fri 14:00 UTC. Ð”Ð»Ð¸Ð½Ð½Ñ‹Ðµ Ð°Ð½Ð°Ð»Ð¸Ñ‚Ð¸Ñ‡ÐµÑÐºÐ¸Ðµ Ð¼Ð°Ñ‚ÐµÑ€Ð¸Ð°Ð»Ñ‹ (2000+ ÑÐ»Ð¾Ð²) Ð½Ð° Ð¾ÑÐ½Ð¾Ð²Ðµ Ð½ÐµÑÐºÐ¾Ð»ÑŒÐºÐ¸Ñ… Ð¸ÑÑ‚Ð¾Ñ‡Ð½Ð¸ÐºÐ¾Ð². Ð¢ÐµÐ¼Ð°Ñ‚Ð¸ÐºÐ°: Ñ‚Ñ€ÐµÐ½Ð´Ñ‹, ÑÑ€Ð°Ð²Ð½ÐµÐ½Ð¸Ñ, Ð¿Ñ€Ð¾Ð³Ð½Ð¾Ð·Ñ‹."
$s3c = New-Sub $e3 "ðŸ”ï¸ Weekly Digest (Ð’Ñ)" "<p>Ð•Ð¶ÐµÐ½ÐµÐ´ÐµÐ»ÑŒÐ½Ñ‹Ð¹ Ð´Ð°Ð¹Ð´Ð¶ÐµÑÑ‚ Ð¿Ð¾ Ð²Ð¾ÑÐºÑ€ÐµÑÐµÐ½ÑŒÑÐ¼ 10:00 UTC</p>" $doneCol
Send-Chat $s3c "Weekly Digest: cron Sun 10:00 UTC. ÐÐ²Ñ‚Ð¾Ð¼Ð°Ñ‚Ð¸Ñ‡ÐµÑÐºÐ°Ñ ÑÐ²Ð¾Ð´ÐºÐ° Ð·Ð° Ð½ÐµÐ´ÐµÐ»ÑŽ: ÐºÐ»ÑŽÑ‡ÐµÐ²Ñ‹Ðµ Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ñ Ð¿Ð¾ Ñ€ÐµÐ³Ð¸Ð¾Ð½Ð°Ð¼, ÑÑ‚Ð°Ñ‚Ð¸ÑÑ‚Ð¸ÐºÐ°, trending topics."
$s3d = New-Sub $e3 "ðŸ—ï¸ Telegram Ð±Ð¾Ñ‚ Ð´Ð¸ÑÑ‚Ñ€Ð¸Ð±ÑƒÑ†Ð¸Ñ" "<p>ÐŸÑƒÐ±Ð»Ð¸ÐºÐ°Ñ†Ð¸Ñ Ð² @theimmigrants_news ÐºÐ°Ð½Ð°Ð», ArticleDistribution tracking</p>" $doneCol
Send-Chat $s3d "Telegram: ÐºÐ°Ð½Ð°Ð» @theimmigrants_news. Ð‘Ð¾Ñ‚ Ð¿ÑƒÐ±Ð»Ð¸ÐºÑƒÐµÑ‚ ÑÐ½Ð¸Ð¿Ð¿ÐµÑ‚ + ÑÑÑ‹Ð»ÐºÑƒ. ArticleDistribution Ð¼Ð¾Ð´ÐµÐ»ÑŒ Ð¾Ñ‚ÑÐ»ÐµÐ¶Ð¸Ð²Ð°ÐµÑ‚ ÐºÑƒÐ´Ð° Ð¸ ÐºÐ¾Ð³Ð´Ð° Ð¾Ð¿ÑƒÐ±Ð»Ð¸ÐºÐ¾Ð²Ð°Ð½Ð¾. Safe truncation Ð´Ð»Ñ TG Ð»Ð¸Ð¼Ð¸Ñ‚Ð° 4096 ÑÐ¸Ð¼Ð²Ð¾Ð»Ð¾Ð²."
Write-Host "  Done: $e3"

# ================================================================
# EPIC 4: Data Collection (19 ÐºÐ¾Ð»Ð»ÐµÐºÑ‚Ð¾Ñ€Ð¾Ð²)
# ================================================================
Write-Host "EPIC 4: Data Collection..."
$e4 = New-Task "ðŸ”ï¸ 19 ÐºÐ¾Ð»Ð»ÐµÐºÑ‚Ð¾Ñ€Ð¾Ð² Ð´Ð°Ð½Ð½Ñ‹Ñ…" "<p>RSS, Ð·Ð°ÐºÐ¾Ð½Ð¾Ð´Ð°Ñ‚ÐµÐ»ÑŒÑÑ‚Ð²Ð¾, ÑÑ‚Ð°Ñ‚Ð¸ÑÑ‚Ð¸ÐºÐ°, Ð¸Ð¼Ð¼Ð¸Ð³Ñ€Ð°Ñ†Ð¸Ñ â€” ÐµÐ¶ÐµÐ´Ð½ÐµÐ²Ð½Ñ‹Ð¹ ÑÐ±Ð¾Ñ€ Ð¸Ð· Ð°Ð²Ñ‚Ð¾Ñ€Ð¸Ñ‚ÐµÑ‚Ð½Ñ‹Ñ… Ð¸ÑÑ‚Ð¾Ñ‡Ð½Ð¸ÐºÐ¾Ð²</p>" $doneCol
$s4a = New-Sub $e4 "ðŸ“‹ RSS Feeds (20+ Ð¸ÑÑ‚Ð¾Ñ‡Ð½Ð¸ÐºÐ¾Ð²)" "<p>BBC, Reuters, Al Jazeera, Politico, Der Spiegel Ð¸ Ð´Ñ€.</p>" $doneCol
Send-Chat $s4a "RSS ÐºÐ¾Ð»Ð»ÐµÐºÑ‚Ð¾Ñ€: 20+ Ñ„Ð¸Ð´Ð¾Ð² â€” BBC World, Reuters Immigration, Al Jazeera, Politico Europe, Der Spiegel, The Guardian, NPR, VOA. ÐŸÐ°Ñ€ÑÐ¸Ð½Ð³ Ñ‡ÐµÑ€ÐµÐ· xml2js. Ð”ÐµÐ´ÑƒÐ¿Ð»Ð¸ÐºÐ°Ñ†Ð¸Ñ Ð¿Ð¾ URL. Ð¡Ð¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ð¸Ðµ ÐºÐ°Ðº LegalUpdate."
$s4b = New-Sub $e4 "ðŸ“‹ Congress.gov API" "<p>Ð—Ð°ÐºÐ¾Ð½Ð¾Ð¿Ñ€Ð¾ÐµÐºÑ‚Ñ‹ Ð¡Ð¨Ð Ð¿Ð¾ Ð¸Ð¼Ð¼Ð¸Ð³Ñ€Ð°Ñ†Ð¸Ð¸</p>" $doneCol
Send-Chat $s4b "Congress ÐºÐ¾Ð»Ð»ÐµÐºÑ‚Ð¾Ñ€: API congress.gov, Ñ„Ð¸Ð»ÑŒÑ‚Ñ€ Ð¿Ð¾ immigration/visa/asylum. ÐŸÐ¾Ð»ÑƒÑ‡Ð°ÐµÑ‚ bills, Ð¿Ð¾ÑÐ»ÐµÐ´Ð½Ð¸Ðµ actions, sponsor info."
$s4c = New-Sub $e4 "ðŸ“‹ EU Legislation (EUR-Lex)" "<p>Ð•Ð²Ñ€Ð¾Ð¿ÐµÐ¹ÑÐºÐ¸Ðµ Ð´Ð¸Ñ€ÐµÐºÑ‚Ð¸Ð²Ñ‹ Ð¸ Ñ€ÐµÐ³Ð»Ð°Ð¼ÐµÐ½Ñ‚Ñ‹</p>" $doneCol
Send-Chat $s4c "EU ÐºÐ¾Ð»Ð»ÐµÐºÑ‚Ð¾Ñ€: EUR-Lex SPARQL endpoint. Ð¤Ð¸Ð»ÑŒÑ‚Ñ€: immigration, asylum, visa, residence permit. ÐŸÐ°Ñ€ÑÐ¸Ð½Ð³ CELEX Ð½Ð¾Ð¼ÐµÑ€Ð¾Ð²."
$s4d = New-Sub $e4 "ðŸ“‹ OECD Statistics (2 Ð¼Ð¾Ð´ÑƒÐ»Ñ)" "<p>ÐœÐ¸Ð³Ñ€Ð°Ñ†Ð¸Ð¾Ð½Ð½Ñ‹Ðµ Ð´Ð°Ð½Ð½Ñ‹Ðµ + Ð½Ð°Ð»Ð¾Ð³Ð¾Ð²Ñ‹Ðµ Ñ‚Ð°Ð±Ð»Ð¸Ñ†Ñ‹</p>" $doneCol
Send-Chat $s4d "OECD: Ð´Ð²Ð° ÐºÐ¾Ð»Ð»ÐµÐºÑ‚Ð¾Ñ€Ð°. 1) oecd.ts â€” Ð¼ÐµÐ¶Ð´ÑƒÐ½Ð°Ñ€Ð¾Ð´Ð½Ð°Ñ Ð¼Ð¸Ð³Ñ€Ð°Ñ†Ð¸Ñ, Ñ€Ð°Ð±Ð¾Ñ‡Ð°Ñ ÑÐ¸Ð»Ð°, Ð¸Ð½Ñ‚ÐµÐ³Ñ€Ð°Ñ†Ð¸Ñ. 2) oecd-tax.ts â€” Ð½Ð°Ð»Ð¾Ð³Ð¾Ð²Ñ‹Ðµ ÑÑ‚Ð°Ð²ÐºÐ¸ Ð¿Ð¾ ÑÑ‚Ñ€Ð°Ð½Ð°Ð¼, ÑÑ€Ð°Ð²Ð½ÐµÐ½Ð¸Ñ."
$s4e = New-Sub $e4 "ðŸ“‹ WHO + UNHCR + World Bank + UN DESA" "<p>Ð—Ð´Ð¾Ñ€Ð¾Ð²ÑŒÐµ, Ð±ÐµÐ¶ÐµÐ½Ñ†Ñ‹, ÑÐºÐ¾Ð½Ð¾Ð¼Ð¸ÐºÐ°, Ð´ÐµÐ¼Ð¾Ð³Ñ€Ð°Ñ„Ð¸Ñ</p>" $doneCol
Send-Chat $s4e "ÐœÐµÐ¶Ð´ÑƒÐ½Ð°Ñ€Ð¾Ð´Ð½Ñ‹Ðµ: WHO GHO (health indicators), UNHCR (refugee data, asylum stats), World Bank (GDP, employment, poverty), UN DESA (population, migration flows). Ð’ÑÐµ API Ð±ÐµÑÐ¿Ð»Ð°Ñ‚Ð½Ñ‹Ðµ."
$s4f = New-Sub $e4 "ðŸ“‹ Government: SG MOM + Teleport" "<p>Singapore Ministry of Manpower + Teleport quality of life</p>" $doneCol
Send-Chat $s4f "Singapore MOM: work permits, employment passes, quotas. Teleport: city quality of life scores Ð¿Ð¾ 17 ÐºÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸ÑÐ¼ (housing, cost, safety, internet Ð¸ Ð´Ñ€.)."
$s4g = New-Sub $e4 "ðŸ“‹ NewsData.io" "<p>Ð”Ð¾Ð¿Ð¾Ð»Ð½Ð¸Ñ‚ÐµÐ»ÑŒÐ½Ñ‹Ðµ Ð½Ð¾Ð²Ð¾ÑÑ‚Ð¸ Ð¿Ð¾ ÐºÐ»ÑŽÑ‡ÐµÐ²Ñ‹Ð¼ ÑÐ»Ð¾Ð²Ð°Ð¼</p>" $doneCol
Send-Chat $s4g "NewsData.io: backup source Ð´Ð»Ñ breaking news. query=immigration OR visa OR asylum OR refugee. API key required. Top headlines + filtered search."
$s4h = New-Sub $e4 "ðŸ“‹ REST Countries" "<p>Ð¡Ð¿Ñ€Ð°Ð²Ð¾Ñ‡Ð½Ð¸Ðº ÑÑ‚Ñ€Ð°Ð½: Ñ„Ð»Ð°Ð³Ð¸, Ð²Ð°Ð»ÑŽÑ‚Ñ‹, ÑÐ·Ñ‹ÐºÐ¸, visa requirements</p>" $doneCol
Send-Chat $s4h "REST Countries API: seed Ð´Ð°Ð½Ð½Ñ‹Ñ… Ð´Ð»Ñ Country model. Ð¤Ð»Ð°Ð³Ð¸ (emoji), Ð²Ð°Ð»ÑŽÑ‚Ñ‹, ÑÐ·Ñ‹ÐºÐ¸, Ñ€ÐµÐ³Ð¸Ð¾Ð½Ñ‹, ISO ÐºÐ¾Ð´Ñ‹. Ð˜ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐµÑ‚ÑÑ Ð´Ð»Ñ UI Ð¸ Ð¼Ð°Ð¿Ð¿Ð¸Ð½Ð³Ð° Ð´Ð°Ð½Ð½Ñ‹Ñ…."
Write-Host "  Done: $e4"

# ================================================================
# EPIC 5: City Database + SDS
# ================================================================
Write-Host "EPIC 5: SDS..."
$e5 = New-Task "ðŸ”ï¸ SDS â€” 8 AI Ð´Ð²Ð¸Ð¶ÐºÐ¾Ð², 157 Ð³Ð¾Ñ€Ð¾Ð´Ð¾Ð²" "<p>Statistical Data Service: AI-powered ÑÐ±Ð¾Ñ€ Ð¸ Ð°Ð½Ð°Ð»Ð¸Ð· Ð´Ð°Ð½Ð½Ñ‹Ñ… Ð¿Ð¾ 157 Ð³Ð¾Ñ€Ð¾Ð´Ð°Ð¼ x 8 Ð¸Ð·Ð¼ÐµÑ€ÐµÐ½Ð¸Ð¹</p>" $doneCol
$s5a = New-Sub $e5 "ðŸ“‹ City seed: 65 ÑÑ‚Ñ€Ð°Ð½, 157 Ð³Ð¾Ñ€Ð¾Ð´Ð¾Ð²" "<p>Prisma seed: ÐºÐ¾Ð¾Ñ€Ð´Ð¸Ð½Ð°Ñ‚Ñ‹, ÑÑ‚Ñ€Ð°Ð½Ñ‹ Ñ ISO ÐºÐ¾Ð´Ð°Ð¼Ð¸, countryId relations</p>" $doneCol
Send-Chat $s5a "Seed: 65 ÑÑ‚Ñ€Ð°Ð½ x 157 Ð³Ð¾Ñ€Ð¾Ð´Ð¾Ð². ÐœÐ¾Ð´ÐµÐ»ÑŒ City: name, slug, lat, lng, countryId, nomadScore. Ð’ÑŒÐµÑ‚Ð½Ð°Ð¼: 6 Ð³Ð¾Ñ€Ð¾Ð´Ð¾Ð² (Hanoi, HCMC, Da Nang, Hoi An, Nha Trang, Phu Quoc). UAE: Dubai, Abu Dhabi."
$s5b = New-Sub $e5 "ðŸ”ï¸ 8 AI Ð´Ð²Ð¸Ð¶ÐºÐ¾Ð² (Grok)" "<p>Cost, Housing, Climate, Infrastructure, Safety, Environment, Healthcare, Lifestyle</p>" $doneCol
Send-Chat $s5b "8 Ð´Ð²Ð¸Ð¶ÐºÐ¾Ð² Ð² stats-data-service.ts: 1) CostOfLiving â€” 35 Ñ†ÐµÐ½Ð¾Ð²Ñ‹Ñ… Ð¿Ð¾Ð·Ð¸Ñ†Ð¸Ð¹. 2) Housing â€” rent 1br/3br, airbnb. 3) Climate â€” temperature, humidity Ð¿Ð¾ Ð¼ÐµÑÑÑ†Ð°Ð¼. 4) Infrastructure â€” internet speed, coworking, power. 5) Safety â€” overall, night, women, petty crime. 6) Environment â€” air quality, green spaces, noise. 7) Healthcare â€” system quality, insurance cost, pharmacies. 8) Lifestyle â€” nightlife, food, culture, expat community. Ð’ÑÐµ Ð¸ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÑŽÑ‚ Grok grok-3-mini-fast."
$s5c = New-Sub $e5 "ðŸ”ï¸ NomadScore ÐºÐ°Ð»ÑŒÐºÑƒÐ»ÑÑ‚Ð¾Ñ€" "<p>Ð¤Ð¾Ñ€Ð¼ÑƒÐ»Ð°: Ñ†ÐµÐ½Ñ‹ 20% + Ð±ÐµÐ·Ð¾Ð¿Ð°ÑÐ½Ð¾ÑÑ‚ÑŒ 20% + Ð¸Ð½Ñ„Ñ€Ð° 20% + ÐºÐ»Ð¸Ð¼Ð°Ñ‚ 15% + Ð·Ð´Ð¾Ñ€Ð¾Ð²ÑŒÐµ 10% + ÑÑ€ÐµÐ´Ð° 10% + ÑÑ‚Ð¸Ð»ÑŒ 5%</p>" $doneCol
Send-Chat $s5c "calculateNomadScores(): weighted average Ð¸Ð· 7 ÐºÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸Ð¹. ÐÐ¾Ñ€Ð¼Ð°Ð»Ð¸Ð·Ð°Ñ†Ð¸Ñ 0-100. Ranking Ð¿Ð¾ Ð³Ð¾Ñ€Ð¾Ð´Ð°Ð¼. Ð”ÐµÐ»ÐµÐ½Ð¸Ðµ Ð½Ð° Ñ‚Ð¸Ñ€Ñ‹: Excellent (80+), Great (60+), Good (40+), Average (<40)."
$s5d = New-Sub $e5 "ðŸ”ï¸ Big Mac Index" "<p>bigmac_single price Ð´Ð»Ñ 157 Ð³Ð¾Ñ€Ð¾Ð´Ð¾Ð²</p>" $doneCol
Send-Chat $s5d "Big Mac Index: Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½ Ð² PRICE_ITEMS ÐºÐ°Ðº 'bigmac_single'. AI Ð·Ð°Ð¿Ñ€Ð°ÑˆÐ¸Ð²Ð°ÐµÑ‚ Ñ†ÐµÐ½Ñƒ Ð² USD. ÐžÑ‚Ð¾Ð±Ñ€Ð°Ð¶Ð°ÐµÑ‚ÑÑ Ð½Ð° CoL page ÐºÐ°Ðº ðŸ” Big Mac: $X.XX. ÐÑŽÐ°Ð½Ñ: Ð½ÐµÐºÐ¾Ñ‚Ð¾Ñ€Ñ‹Ðµ ÑÑ‚Ñ€Ð°Ð½Ñ‹ Ð½Ðµ Ð¸Ð¼ÐµÑŽÑ‚ McDonalds â€” AI ÑÑ‚Ð°Ð²Ð¸Ñ‚ N/A."
Write-Host "  Done: $e5"

# ================================================================
# EPIC 6: Frontend Tools Pages
# ================================================================
Write-Host "EPIC 6: Tools Pages..."
$e6 = New-Task "ðŸ”ï¸ 7 Tools ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†" "<p>Ð˜Ð½Ñ‚ÐµÑ€Ð°ÐºÑ‚Ð¸Ð²Ð½Ñ‹Ðµ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ñ‹: Nomad Index, Cost of Living, Visa Guide, Statistics, Immigration Stats, Advisor, Safety Alerts</p>" $doneCol
$s6a = New-Sub $e6 "ðŸ”ï¸ Nomad Index + NomadMap" "<p>Leaflet ÐºÐ°Ñ€Ñ‚Ð° Ñ 157 ÐºÑ€ÑƒÐ¶ÐºÐ°Ð¼Ð¸, score-based coloring, detail cards Ñ 6 subscores</p>" $doneCol
Send-Chat $s6a "NomadMap.tsx: Leaflet ÐºÐ°Ñ€Ñ‚Ð° Ñ dynamic import (SSR workaround). CircleMarker Ð´Ð»Ñ ÐºÐ°Ð¶Ð´Ð¾Ð³Ð¾ Ð³Ð¾Ñ€Ð¾Ð´Ð°, Ñ€Ð°Ð·Ð¼ÐµÑ€ Ð¿Ð¾ score, Ñ†Ð²ÐµÑ‚ Ð¿Ð¾ tier. Tooltip Ñ Ð¾ÑÐ½Ð¾Ð²Ð½Ñ‹Ð¼Ð¸ Ð¼ÐµÑ‚Ñ€Ð¸ÐºÐ°Ð¼Ð¸. Detail card Ð¿Ñ€Ð¸ ÐºÐ»Ð¸ÐºÐµ: safety, internet, cost, climate, healthcare, lifestyle. Legend Ð²Ð½Ð¸Ð·Ñƒ. Ð¢ÐµÐ¿ÐµÑ€ÑŒ Ñ‚Ð°ÐºÐ¶Ðµ SVG Ñ‚Ñ€ÐµÑƒÐ³Ð¾Ð»ÑŒÐ½Ð¸ÐºÐ¸ Ð´Ð»Ñ Ð°Ð»ÐµÑ€Ñ‚Ð¾Ð²."
$s6b = New-Sub $e6 "ðŸ”ï¸ AI Advisor (Ñ‡Ð°Ñ‚)" "<p>AI Ñ‡Ð°Ñ‚-Ð±Ð¾Ñ‚ Ð´Ð»Ñ ÐºÐ¾Ð½ÑÑƒÐ»ÑŒÑ‚Ð°Ñ†Ð¸Ð¹ Ð¿Ð¾ Ð¸Ð¼Ð¼Ð¸Ð³Ñ€Ð°Ñ†Ð¸Ð¸</p>" $doneCol
Send-Chat $s6b "Advisor page: Ñ‡Ð°Ñ‚ Ñ AI (Grok). ÐŸÐ¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ Ð·Ð°Ð´Ð°Ñ‘Ñ‚ Ð²Ð¾Ð¿Ñ€Ð¾Ñ â€” AI Ð¾Ñ‚Ð²ÐµÑ‡Ð°ÐµÑ‚ Ñ ÑƒÑ‡Ñ‘Ñ‚Ð¾Ð¼ immigration context. History Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑÑ Ð² state. Streaming response. Backend endpoint POST /advisor-chat."
$s6c = New-Sub $e6 "ðŸ”ï¸ Visa Guide" "<p>Ð“Ð¸Ð´ Ð¿Ð¾ Ð²Ð¸Ð·Ð°Ð¼ Ñ Ñ„Ð¸Ð»ÑŒÑ‚Ñ€Ð°Ñ†Ð¸ÐµÐ¹ Ð¿Ð¾ ÑÑ‚Ñ€Ð°Ð½Ð°Ð¼</p>" $doneCol
$s6d = New-Sub $e6 "ðŸ”ï¸ Statistics + Immigration Stats" "<p>Ð¡Ñ‚Ð°Ñ‚Ð¸ÑÑ‚Ð¸Ñ‡ÐµÑÐºÐ¸Ðµ Ð´Ð°ÑˆÐ±Ð¾Ñ€Ð´Ñ‹</p>" $doneCol
$s6e = New-Sub $e6 "ðŸ”ï¸ AI Nomad Brief" "<p>ÐšÐ½Ð¾Ð¿ÐºÐ° 'AI Brief' Ð½Ð° ÐºÐ°Ñ€Ñ‚Ðµ â€” Ñ€ÐµÐ°Ð»ÑŒÐ½Ñ‹Ðµ Ð´Ð°Ð½Ð½Ñ‹Ðµ Ð¸Ð· Ð‘Ð”, CRITICAL RULES</p>" $doneCol
Send-Chat $s6e "POST /nomad-brief: Ð¿ÐµÑ€ÐµÐ¿Ð¸ÑÐ°Ð½. Ð‘ÐµÑ€Ñ‘Ñ‚ Ð’Ð¡Ð• Ð¸Ð· Ð‘Ð”: 35 Ñ†ÐµÐ½ Ð² USD, VisaProgram (digital_nomad), SafetyScore, Infrastructure, active CityAlerts. ÐŸÑ€Ð¾Ð¼Ð¿Ñ‚ Ñ CRITICAL RULES: 'Ð¸ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐ¹ Ð¢ÐžÐ›Ð¬ÐšÐž Ð´Ð°Ð½Ð½Ñ‹Ðµ', 'ÐÐ• Ð²Ñ‹Ð´ÑƒÐ¼Ñ‹Ð²Ð°Ð¹ Ñ†Ð¸Ñ„Ñ€Ñ‹'. Temperature 0.5. Ð’Ð°Ð»ÑŽÑ‚Ð° Ñ ÐºÐ¾Ð½Ñ‚ÐµÐºÑÑ‚Ð¾Ð¼ (USD + local)."
Write-Host "  Done: $e6"

# ================================================================
# EPIC 7: Legal/Content Pages
# ================================================================
Write-Host "EPIC 7: Legal Pages..."
$e7 = New-Task "ðŸ“‹ Legal ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†Ñ‹ + About" "<p>Privacy Policy, Terms of Service, Imprint, About Us, Editorial Policy</p>" $doneCol
New-Sub $e7 "ðŸ“‹ Privacy, Terms, Imprint" "<p>GDPR-compliant ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†Ñ‹</p>" $doneCol
New-Sub $e7 "ðŸ“‹ About Us (10 Ð°Ð³ÐµÐ½Ñ‚Ð¾Ð²)" "<p>Ð¤Ð¾Ñ‚Ð¾ + Ð±Ð¸Ð¾Ð½Ðµ ÐºÐ°Ð¶Ð´Ð¾Ð³Ð¾ Ð°Ð³ÐµÐ½Ñ‚Ð°-Ð¶ÑƒÑ€Ð½Ð°Ð»Ð¸ÑÑ‚Ð°</p>" $doneCol
New-Sub $e7 "ðŸ“‹ Editorial Policy" "<p>ÐŸÐ¾Ð»Ð¸Ñ‚Ð¸ÐºÐ° Ñ€ÐµÐ´Ð°ÐºÑ†Ð¸Ð¸, ÑÑ‚Ð°Ð½Ð´Ð°Ñ€Ñ‚Ñ‹ Ð¶ÑƒÑ€Ð½Ð°Ð»Ð¸ÑÑ‚Ð¸ÐºÐ¸</p>" $doneCol
New-Sub $e7 "ðŸ“‹ Cookie Banner" "<p>GDPR cookie consent ÐºÐ¾Ð¼Ð¿Ð¾Ð½ÐµÐ½Ñ‚</p>" $doneCol
Write-Host "  Done: $e7"

# ================================================================
# EPIC 8: Social Features
# ================================================================
Write-Host "EPIC 8: Social..."
$e8 = New-Task "ðŸ”ï¸ Ð¡Ð¾Ñ†Ð¸Ð°Ð»ÑŒÐ½Ñ‹Ðµ Ñ„Ð¸Ñ‡Ð¸" "<p>ÐšÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ð°Ñ€Ð¸Ð¸, Ð»Ð°Ð¹ÐºÐ¸, Ð·Ð°ÐºÐ»Ð°Ð´ÐºÐ¸, Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ°, Ð¿Ñ€Ð¾Ñ„Ð¸Ð»ÑŒ</p>" $doneCol
$s8a = New-Sub $e8 "ðŸ”ï¸ ÐšÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ð°Ñ€Ð¸Ð¸" "<p>CommentsSection Ñ nested replies, moderation</p>" $doneCol
Send-Chat $s8a "CommentsSection.tsx: threaded comments. Prisma Ð¼Ð¾Ð´ÐµÐ»ÑŒ Comment Ñ parentId Ð´Ð»Ñ nested replies. Like/dislike. Moderation workflow. Markdown support."
New-Sub $e8 "ðŸ”ï¸ Ð›Ð°Ð¹ÐºÐ¸ + Ð·Ð°ÐºÐ»Ð°Ð´ÐºÐ¸" "<p>ArticleActions: like, bookmark, share</p>" $doneCol
New-Sub $e8 "ðŸ”ï¸ Newsletter Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ°" "<p>NewsletterForm Ñ email Ð²Ð°Ð»Ð¸Ð´Ð°Ñ†Ð¸ÐµÐ¹, Subscriber model</p>" $doneCol
Write-Host "  Done: $e8"

Write-Host ""
Write-Host "=== ALL EPICS CREATED ==="
