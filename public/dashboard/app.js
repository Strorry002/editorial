/* ===========================================================
   Immigrants Data Admin Dashboard — App Logic v5
   Tab-based Articles + Autopilot + Publications Kanban
   =========================================================== */

const API = '/api/v1';
const $content = document.getElementById('page-content');
const $title = document.getElementById('page-title');
const $lastSync = document.getElementById('last-sync');

let _updatesCache = [];

// -- Navigation --

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        loadPage(item.dataset.page);
    });
});

document.getElementById('btn-collect')?.addEventListener('click', () => {
    alert('Collection scheduled! Check logs in a few minutes.');
});

// -- Page Router --

async function loadPage(page) {
    $content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
    const titles = {
        overview: 'Overview', sources: 'Data Sources', logs: 'Collection Logs',
        updates: 'Legal Updates', countries: 'Countries',
        editorial: 'Editorial', agents: 'AI Agents',
    };
    $title.textContent = titles[page] || page;
    try {
        switch (page) {
            case 'overview': await renderOverview(); break;
            case 'sources': await renderSources(); break;
            case 'logs': await renderLogs(); break;
            case 'updates': await renderUpdates(); break;
            case 'countries': await renderCountries(); break;
            case 'editorial': await renderEditorial(); break;
            case 'agents': await renderAgents(); break;
        }
    } catch (err) {
        $content.innerHTML = `<div class="empty-state"><div class="icon">Warning</div><div class="msg">Error: ${err.message}</div></div>`;
    }
}

// -- Helpers --

async function api(path) {
    const res = await fetch(`${API}${path}`);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
}

async function apiPost(path, body) {
    const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
}

async function apiPatch(path, body) {
    const res = await fetch(`${API}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
}

async function apiDelete(path) {
    const res = await fetch(`${API}${path}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
}

function unwrap(r) { return r && Array.isArray(r.data) ? r.data : Array.isArray(r) ? r : []; }
function fmt(n) { if (n == null) return '—'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return n.toLocaleString?.() ?? n; }
function ago(d) { if (!d) return 'Never'; const m = Math.floor((Date.now() - new Date(d)) / 6e4); if (m < 1) return 'Just now'; if (m < 60) return m + 'm ago'; const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'; return Math.floor(h / 24) + 'd ago'; }
function dateShort(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function dateFull(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
function statusBadge(s) { const m = { success: 'badge-success', error: 'badge-error', partial: 'badge-warning' }; return `<span class="badge ${m[s] || 'badge-dim'}">${s || '—'}</span>`; }
function impactBadge(l) { const m = { critical: 'badge-error', high: 'badge-warning', medium: 'badge-info', low: 'badge-dim' }; return `<span class="badge ${m[l] || 'badge-dim'}">${l}</span>`; }
function categoryIcon(c) { return { visa: '🛂', labor: '👷', asylum: '🏥', tax: '💵', housing: '🏠', healthcare: '🩺', education: '🎓', legislation: '📜', immigration: '✈️' }[c] || '📜'; }
function renderDates(u) { const n = u.effectiveDate ? dateShort(u.effectiveDate) : null, s = dateShort(u.createdAt); return n ? `<span title="News date">📅 ${n}</span><span title="Collected" style="opacity:.6">🤖 ${s}</span>` : `<span title="Collected">🤖 ${s}</span>`; }

const CH_ICONS = { telegram: 'TG', twitter: 'TW', instagram: 'IG', linkedin: 'LI', website: 'WB', newsletter: 'NL' };
function channelDots(dists) {
    if (!dists?.length) return '';
    return '<div class="kanban-card-channels">' + dists.map(d =>
        `<span class="ch-dot ${d.status}" title="${d.channel}: ${d.status}">${CH_ICONS[d.channel] || d.channel[0].toUpperCase()}</span>`
    ).join('') + '</div>';
}

// -- Modal --

const $modal = document.getElementById('modal');

function openUpdateModal(updateId) {
    const u = _updatesCache.find(x => x.id === updateId);
    if (!u) return;
    document.getElementById('modal-icon').className = `modal-header-icon feed-icon ${u.category}`;
    document.getElementById('modal-icon').textContent = categoryIcon(u.category);
    document.getElementById('modal-title').textContent = `${u.country?.flag || ''} ${u.title}`;
    document.getElementById('modal-sub').innerHTML = `<span>${u.countryCode} ${u.country?.name || ''}</span><span class="badge badge-dim">${u.category}</span>${impactBadge(u.impactLevel)}`;
    document.getElementById('modal-summary').textContent = u.summary || 'No summary.';
    document.getElementById('modal-details-section').innerHTML = u.details ? `<div class="modal-details">${u.details}</div>` : '';
    document.getElementById('modal-meta').innerHTML = `
        <div class="modal-meta-item"><span class="modal-meta-label">📅 News date</span><span class="modal-meta-value">${u.effectiveDate ? dateShort(u.effectiveDate) : 'N/A'}</span></div>
        <div class="modal-meta-item"><span class="modal-meta-label">🤖 Collected</span><span class="modal-meta-value">${dateFull(u.createdAt)}</span></div>
        <div class="modal-meta-item"><span class="modal-meta-label">🏳️ Country</span><span class="modal-meta-value">${u.country?.flag || ''} ${u.country?.name || u.countryCode}</span></div>
        <div class="modal-meta-item"><span class="modal-meta-label">📊 Impact</span><span class="modal-meta-value">${impactBadge(u.impactLevel)}</span></div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        ${u.sourceUrl ? `<a href="${u.sourceUrl}" target="_blank" class="btn btn-primary btn-sm">🔗 Source</a>` : ''}
        <button class="btn btn-sm" style="background:var(--bg-card);color:var(--text-secondary);border:1px solid var(--border)" onclick="closeModal()">Close</button>
    `;
    $modal.classList.add('open');
}

function closeModal() { $modal.classList.remove('open'); }
$modal.addEventListener('click', e => { if (e.target === $modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ===========================================================
// OVERVIEW
// ===========================================================

async function renderOverview() {
    const raw = await api('/admin/overview');
    const data = raw.counts || raw;
    const stats = [
        { icon: '🌍', value: data.countries, label: 'Countries', color: 'blue' },
        { icon: '🛂', value: data.visas || data.visaPrograms, label: 'Visa Programs', color: 'green' },
        { icon: '⚖️', value: data.labor || data.laborRegulations, label: 'Labor Regulations', color: 'purple' },
        { icon: '💰', value: data.costs || data.costRecords, label: 'Cost Records', color: 'yellow' },
        { icon: '📊', value: data.stats || data.statistics, label: 'Statistics', color: 'cyan' },
        { icon: '📢', value: data.updates || data.legalUpdates, label: 'Legal Updates', color: 'red' },
    ];
    if (raw.lastSync) $lastSync.textContent = `Last sync: ${ago(raw.lastSync)}`;

    $content.innerHTML = `
        <div class="stats-grid">${stats.map(s => `<div class="stat-card ${s.color}"><div class="stat-icon">${s.icon}</div><div class="stat-value">${fmt(s.value)}</div><div class="stat-label">${s.label}</div></div>`).join('')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
            <div class="card"><div class="card-header"><div class="card-title">📢 Recent Updates</div></div><div class="card-body" id="recent-updates"><div class="loading"><div class="spinner"></div></div></div></div>
            <div class="card"><div class="card-header"><div class="card-title">📋 Recent Collections</div></div><div class="card-body" id="recent-logs"><div class="loading"><div class="spinner"></div></div></div></div>
        </div>
    `;

    try {
        const updates = unwrap(await api('/feed/updates?limit=5'));
        _updatesCache = updates;
        document.getElementById('recent-updates').innerHTML = updates.length
            ? updates.map(u => `<div class="feed-item" onclick="openUpdateModal('${u.id}')"><div class="feed-icon ${u.category}">${categoryIcon(u.category)}</div><div class="feed-body"><div class="feed-title">${u.country?.flag || ''} ${u.title}</div><div class="feed-meta"><span>${u.countryCode}</span>${impactBadge(u.impactLevel)}${renderDates(u)}</div></div></div>`).join('')
            : '<div class="empty-state"><div class="icon">📭</div><div class="msg">No updates</div></div>';
    } catch (e) { document.getElementById('recent-updates').innerHTML = `<div class="empty-state"><div class="msg">${e.message}</div></div>`; }

    try {
        const logs = unwrap(await api('/admin/logs?limit=5'));
        document.getElementById('recent-logs').innerHTML = logs.length
            ? `<table><thead><tr><th>Source</th><th>Status</th><th>Records</th><th>Time</th></tr></thead><tbody>${logs.map(l => `<tr><td><strong>${l.sourceName}</strong></td><td>${statusBadge(l.status)}</td><td class="mono">+${l.recordsAdded}/~${l.recordsUpdated}</td><td>${ago(l.createdAt)}</td></tr>`).join('')}</tbody></table>`
            : '<div class="empty-state"><div class="icon">📭</div><div class="msg">No logs</div></div>';
    } catch (e) { document.getElementById('recent-logs').innerHTML = `<div class="empty-state"><div class="msg">${e.message}</div></div>`; }
}

// ===========================================================
// DATA SOURCES
// ===========================================================

async function renderSources() {
    const sources = unwrap(await api('/admin/sources'));
    if (!sources.length) { $content.innerHTML = '<div class="empty-state"><div class="icon">📡</div><div class="msg">No data sources</div></div>'; return; }
    $content.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">📡 Data Sources</div><span class="badge badge-info">${sources.length}</span></div><div class="card-body table-wrap"><table><thead><tr><th>Source</th><th>Type</th><th>Frequency</th><th>Countries</th><th>Status</th><th>Last Fetch</th><th>Active</th></tr></thead><tbody>${sources.map(s => `<tr><td><strong>${s.name}</strong>${s.description ? `<br><small style="color:var(--text-dim)">${s.description}</small>` : ''}</td><td><span class="badge ${s.type === 'api' ? 'badge-success' : 'badge-dim'}">${s.type}</span></td><td>${s.frequency}</td><td class="mono">${(s.countries || []).join(', ')}</td><td>${statusBadge(s.lastStatus)}</td><td>${ago(s.lastFetchedAt)}</td><td>${s.isActive ? '✅' : '⛔'}</td></tr>`).join('')}</tbody></table></div></div>`;
}

// ===========================================================
// COLLECTION LOGS
// ===========================================================

async function renderLogs() {
    const logs = unwrap(await api('/admin/logs?limit=200'));
    if (!logs.length) { $content.innerHTML = '<div class="empty-state"><div class="icon">📋</div><div class="msg">No logs yet</div></div>'; return; }
    $content.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">📋 Collection History</div><span class="badge badge-info">${logs.length}</span></div><div class="card-body table-wrap"><table><thead><tr><th>Source</th><th>Status</th><th>Added</th><th>Updated</th><th>Skipped</th><th>Duration</th><th>Error</th><th>Time</th></tr></thead><tbody>${logs.map(l => `<tr><td><strong>${l.sourceName}</strong></td><td>${statusBadge(l.status)}</td><td class="mono" style="color:var(--green)">+${l.recordsAdded}</td><td class="mono" style="color:var(--yellow)">~${l.recordsUpdated}</td><td class="mono">${l.recordsSkipped}</td><td class="mono">${l.durationMs ? (l.durationMs / 1000).toFixed(1) + 's' : '—'}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(l.errorMessage || '').replace(/"/g, '&quot;')}">${l.errorMessage || '—'}</td><td>${ago(l.createdAt)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

// ===========================================================
// LEGAL UPDATES
// ===========================================================

let updatesFilter = { country: '', category: '' };
async function renderUpdates() {
    const allUpdates = unwrap(await api('/feed/updates?limit=500'));
    _updatesCache = allUpdates;
    if (!allUpdates.length) { $content.innerHTML = '<div class="empty-state"><div class="icon">⚖️</div><div class="msg">No updates</div></div>'; return; }

    const countries = [...new Set(allUpdates.map(u => u.countryCode))].sort();
    const categories = [...new Set(allUpdates.map(u => u.category))].sort();
    let filtered = allUpdates;
    if (updatesFilter.country) filtered = filtered.filter(u => u.countryCode === updatesFilter.country);
    if (updatesFilter.category) filtered = filtered.filter(u => u.category === updatesFilter.category);

    $content.innerHTML = `
        <div class="card" style="margin-bottom:16px"><div class="card-body" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <span style="font-size:12px;color:var(--text-dim);font-weight:600">FILTERS:</span>
            <select id="f-country" style="background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:12px"><option value="">All Countries</option>${countries.map(c => `<option value="${c}" ${updatesFilter.country === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
            <select id="f-cat" style="background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:12px"><option value="">All Categories</option>${categories.map(c => `<option value="${c}" ${updatesFilter.category === c ? 'selected' : ''}>${categoryIcon(c)} ${c}</option>`).join('')}</select>
            <span class="badge badge-info">${filtered.length}/${allUpdates.length}</span>
            ${updatesFilter.country || updatesFilter.category ? '<button id="clear-f" class="workflow-btn">Clear</button>' : ''}
        </div></div>
        <div class="card"><div class="card-header"><div class="card-title">Legal Updates</div></div><div class="card-body">
            ${filtered.length === 0 ? '<div class="empty-state"><div class="msg">No matches</div></div>' : filtered.map(u => `
                <div class="feed-item" onclick="openUpdateModal('${u.id}')">
                    <div class="feed-icon ${u.category}">${categoryIcon(u.category)}</div>
                    <div class="feed-body">
                        <div class="feed-title">${u.country?.flag || ''} ${u.title}</div>
                        <div style="font-size:12px;color:var(--text-secondary);margin:4px 0;line-height:1.4">${u.summary || ''}</div>
                        <div class="feed-meta"><span style="font-weight:600">${u.countryCode}</span><span class="badge badge-dim">${u.category}</span>${impactBadge(u.impactLevel)}${renderDates(u)}${u.sourceUrl ? `<a href="${u.sourceUrl}" target="_blank" style="color:var(--accent);text-decoration:none;font-size:11px" onclick="event.stopPropagation()">Source</a>` : ''}</div>
                    </div>
                </div>
            `).join('')}
        </div></div>
    `;
    document.getElementById('f-country')?.addEventListener('change', e => { updatesFilter.country = e.target.value; renderUpdates(); });
    document.getElementById('f-cat')?.addEventListener('change', e => { updatesFilter.category = e.target.value; renderUpdates(); });
    document.getElementById('clear-f')?.addEventListener('click', () => { updatesFilter = { country: '', category: '' }; renderUpdates(); });
}

// ===========================================================
// COUNTRIES
// ===========================================================

async function renderCountries() {
    const raw = await api('/countries');
    const countries = Array.isArray(raw) ? raw : unwrap(raw);
    if (!countries.length) { $content.innerHTML = '<div class="empty-state"><div class="icon">🗺️</div><div class="msg">No countries</div></div>'; return; }
    $content.innerHTML = `<div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">${countries.map(c => `
        <div class="stat-card blue" style="cursor:pointer" onclick="loadCountryDetail('${c.code}')">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span style="font-size:32px">${c.flag || '🏳️'}</span><div><div style="font-size:16px;font-weight:700">${c.name}</div><div style="font-size:11px;color:var(--text-dim)">${c.code} - ${c.region}</div></div></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px"><div><span style="color:var(--text-dim)">Capital:</span> ${c.capitalCity || '—'}</div><div><span style="color:var(--text-dim)">Currency:</span> ${c.currency}</div></div>
        </div>
    `).join('')}</div>`;
}

async function loadCountryDetail(code) {
    $title.textContent = `${code}`;
    $content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
        const data = await api(`/countries/${code}`);
        const c = data.country || data;
        $content.innerHTML = `
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px"><span style="font-size:48px">${c.flag || '🏳️'}</span><div><h2 style="font-size:24px;font-weight:700">${c.name}</h2><div style="color:var(--text-dim);font-size:13px">${c.code} - ${c.region} - ${c.capitalCity || ''} - ${c.currency}</div></div></div>
            ${data.visaPrograms?.length ? `<div class="card"><div class="card-header"><div class="card-title">Visa Programs</div><span class="badge badge-info">${data.visaPrograms.length}</span></div><div class="card-body table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Duration</th><th>Processing</th></tr></thead><tbody>${data.visaPrograms.map(v => `<tr><td><strong>${v.name}</strong></td><td><span class="badge badge-purple">${v.type}</span></td><td>${v.duration || '—'}</td><td>${v.processingTime || '—'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
            ${data.laborRegulations?.length ? `<div class="card"><div class="card-header"><div class="card-title">Labor</div><span class="badge badge-info">${data.laborRegulations.length}</span></div><div class="card-body table-wrap"><table><thead><tr><th>Category</th><th>Title</th></tr></thead><tbody>${data.laborRegulations.map(l => `<tr><td><span class="badge badge-dim">${l.category}</span></td><td>${l.title}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
            ${data.statistics?.length ? `<div class="card"><div class="card-header"><div class="card-title">Statistics</div><span class="badge badge-info">${data.statistics.length}</span></div><div class="card-body table-wrap"><table><thead><tr><th>Metric</th><th>Value</th><th>Unit</th><th>Period</th></tr></thead><tbody>${data.statistics.map(s => `<tr><td>${s.metric}</td><td class="mono" style="font-weight:600">${fmt(s.value)}</td><td>${s.unit || ''}</td><td>${s.period}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
            <button class="btn btn-primary" onclick="loadPage('countries')" style="margin-top:16px">Back</button>
        `;
    } catch (err) { $content.innerHTML = `<div class="empty-state"><div class="icon">!</div><div class="msg">${err.message}</div></div>`; }
}

// ===========================================================
// PUBLICATIONS KANBAN
// ===========================================================

const PUB_COLS = [
    { key: 'raw', label: '📥 Raw', color: 'var(--text-dim)', desc: 'Сырые инфоповоды' },
    { key: 'draft', label: '✏️ Draft', color: 'var(--yellow)', desc: 'Текст подготовлен' },
    { key: 'review', label: '👀 Review', color: 'var(--accent)', desc: 'На проверке' },
    { key: 'approved', label: '✅ Approved', color: 'var(--green)', desc: 'Готово к публикации' },
    { key: 'published', label: '🚀 Published', color: 'var(--purple)', desc: 'Опубликовано' },
];

const CHANNELS = ['telegram', 'twitter', 'website'];

async function renderPublications() {
    const kanban = await api('/publications/kanban');
    const total = Object.values(kanban).reduce((s, a) => s + a.length, 0);

    $content.innerHTML = `
        <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px">
            <span class="badge badge-info">${total} total</span>
        </div>
        <div class="kanban-board">
            ${PUB_COLS.map(col => {
        const items = kanban[col.key] || [];
        return `
                    <div class="kanban-col">
                        <div class="kanban-col-header" style="border-top:2px solid ${col.color}">
                            ${col.label}
                            <span class="kanban-col-count">${items.length}</span>
                        </div>
                        <div class="kanban-col-body" data-col="${col.key}" ondragover="event.preventDefault();this.style.background='rgba(99,102,241,0.08)'" ondragleave="this.style.background=''" ondrop="dropPubCard(event,'${col.key}');this.style.background=''">
                            ${items.length === 0 ? `<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:11px">${col.desc}</div>` :
                items.map(u => renderPubCard(u, col.key)).join('')}
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function renderPubCard(u, colKey) {
    const colIdx = PUB_COLS.findIndex(c => c.key === colKey);
    const nextCol = PUB_COLS[colIdx + 1];
    const prevCol = PUB_COLS[colIdx - 1];

    // Header is always the same
    const header = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="font-size:16px">${u.country?.flag || '🏳️'}</span>
            <span class="badge badge-dim" style="font-size:9px">${u.category}</span>
            ${impactBadge(u.impactLevel)}
            ${u.assignedTo ? `<span style="font-size:9px;color:var(--text-dim)">👤${u.assignedTo}</span>` : ''}
        </div>
        <div class="kanban-card-title">${u.title}</div>
    `;

    // Progressive content: grows with each stage
    let body = '';

    // RAW: just summary
    if (u.summary) {
        body += `<div style="font-size:11px;color:var(--text-secondary);margin:6px 0;line-height:1.4;max-height:${colKey === 'raw' ? '40' : '60'}px;overflow:hidden">${u.summary}</div>`;
    }

    // DRAFT+: show publishedContent preview if exists
    if (colIdx >= 1 && u.publishedContent) {
        body += `<div style="font-size:10px;color:var(--accent);margin:4px 0;padding:4px 6px;background:rgba(99,102,241,0.06);border-radius:4px;max-height:50px;overflow:hidden">✏️ ${u.publishedContent.substring(0, 120)}...</div>`;
    }

    // REVIEW+: show reviewNote if exists
    if (colIdx >= 2 && u.reviewNote) {
        body += `<div style="font-size:10px;margin:4px 0;padding:4px 6px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:4px;max-height:40px;overflow:hidden">👀 ${u.reviewNote}</div>`;
    }

    // APPROVED+: source link
    if (colIdx >= 3 && u.sourceUrl) {
        body += `<div style="margin:4px 0"><a href="${u.sourceUrl}" target="_blank" style="font-size:10px;color:var(--accent);text-decoration:none" onclick="event.stopPropagation()">🔗 Source</a></div>`;
    }

    // PUBLISHED or APPROVED: show distribution channels with status + published links
    let channelBar = '';
    if (colIdx >= 3) {
        const dists = u.distributions || [];
        const sentDists = dists.filter(d => d.status === 'sent');
        const errorDists = dists.filter(d => d.status === 'error');
        const pendingDists = dists.filter(d => d.status === 'pending');
        const missingCh = CHANNELS.filter(ch => !dists.find(d => d.channel === ch));

        // Published links (prominent)
        let pubLinks = '';
        if (sentDists.length) {
            pubLinks = `<div style="margin-top:6px">
                <div style="font-size:9px;color:var(--text-dim);font-weight:600;margin-bottom:3px">PUBLISHED:</div>
                ${sentDists.map(d => {
                const icon = CH_ICONS[d.channel] || d.channel[0].toUpperCase();
                if (d.externalUrl) {
                    return `<a href="${d.externalUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:var(--green);text-decoration:none;margin-right:8px" onclick="event.stopPropagation()" title="Open ${d.channel}">${icon} ${d.channel} ↗</a>`;
                }
                return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:var(--green);margin-right:8px">${icon} ${d.channel} ✓</span>`;
            }).join('')}
            </div>`;
        }

        // Errors (retry buttons)
        let errBtns = '';
        if (errorDists.length) {
            errBtns = `<div style="margin-top:4px">
                ${errorDists.map(d => `<button class="ch-btn ch-error" onclick="event.stopPropagation();retryDistribute('${u.id}','${d.channel}','${d.id}')" title="${d.channel}: ERROR - Retry">${CH_ICONS[d.channel] || d.channel[0].toUpperCase()} retry</button>`).join(' ')}
            </div>`;
        }

        // Pending
        let pendBtns = '';
        if (pendingDists.length) {
            pendBtns = pendingDists.map(d => `<span class="ch-btn ch-pending">${CH_ICONS[d.channel] || d.channel[0].toUpperCase()} ...</span>`).join(' ');
        }

        // Not yet sent
        let sendBtns = '';
        if (missingCh.length) {
            sendBtns = missingCh.map(ch => `<button class="ch-btn" onclick="event.stopPropagation();distributePub('${u.id}','${ch}')" title="Send to ${ch}">${CH_ICONS[ch] || ch[0].toUpperCase()}</button>`).join(' ');
        }

        channelBar = pubLinks + errBtns + (pendBtns || sendBtns ? `<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">${pendBtns}${sendBtns}</div>` : '');
    }

    // Workflow buttons
    const actions = `<div style="display:flex;gap:4px;margin-top:6px">
        ${prevCol ? `<button class="workflow-btn" style="font-size:10px;padding:2px 6px" onclick="event.stopPropagation();movePub('${u.id}','${prevCol.key}')" title="← ${prevCol.label}">←</button>` : ''}
        <div style="flex:1"></div>
        ${nextCol ? `<button class="workflow-btn primary" style="font-size:10px;padding:2px 6px" onclick="event.stopPropagation();movePub('${u.id}','${nextCol.key}')" title="→ ${nextCol.label}">→ ${nextCol.label.split(' ').pop()}</button>` : ''}
    </div>`;

    // Date
    const dateInfo = `<div style="font-size:9px;color:var(--text-dim);margin-top:4px">${renderDates(u)}</div>`;

    return `
        <div class="kanban-card" draggable="true" ondragstart="event.dataTransfer.setData('text/plain','${u.id}')" onclick="openPubCard('${u.id}','${colKey}')" style="cursor:grab">
            ${header}
            ${body}
            ${channelBar}
            ${dateInfo}
            ${actions}
        </div>
    `;
}

async function openPubCard(id, currentStatus) {
    const u = await api(`/publications?status=&limit=500`).then(r => unwrap(r).find(x => x.id === id));
    if (!u) return;
    _updatesCache = [u];

    const colIdx = PUB_COLS.findIndex(c => c.key === currentStatus);
    const next = PUB_COLS[colIdx + 1];
    const prev = PUB_COLS[colIdx - 1];

    document.getElementById('modal-icon').className = `modal-header-icon feed-icon ${u.category}`;
    document.getElementById('modal-icon').textContent = categoryIcon(u.category);
    document.getElementById('modal-title').textContent = `${u.country?.flag || ''} ${u.title}`;
    document.getElementById('modal-sub').innerHTML = `
        <span class="badge badge-dim">${currentStatus.toUpperCase()}</span>
        <span>${u.countryCode}</span>
        <span class="badge badge-dim">${u.category}</span>
        ${impactBadge(u.impactLevel)}
        ${u.assignedTo ? `<span>👤 ${u.assignedTo}</span>` : ''}
    `;
    document.getElementById('modal-summary').textContent = u.summary || '';

    // Build details section with all accumulated content
    let details = '';
    if (u.details) details += `<div class="modal-details" style="margin-bottom:12px">${u.details}</div>`;

    // Published content editor
    details += `<div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;margin-bottom:6px">Текст для публикации</div>
        <textarea id="pub-content" class="editor-textarea" rows="5">${u.publishedContent || u.summary || ''}</textarea>
        <button class="workflow-btn" style="margin-top:6px" onclick="savePubContent('${id}')">💾 Сохранить текст</button>
    </div>`;

    // Review note
    if (u.reviewNote) {
        details += `<div style="margin-bottom:12px;padding:10px;background:rgba(251,191,36,0.08);border:1px solid var(--yellow);border-radius:6px;font-size:12px"><div style="font-weight:700;margin-bottom:4px">👀 Review Note</div>${u.reviewNote}</div>`;
    }

    // Distributions
    const dists = u.distributions || [];
    details += `<div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;margin-bottom:6px">Каналы публикации</div>
        <div style="display:flex;flex-direction:column;gap:6px">
        ${CHANNELS.map(ch => {
        const d = dists.find(x => x.channel === ch);
        if (!d) {
            return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px">
                    <span style="font-weight:700;font-size:12px;width:20px">${CH_ICONS[ch]}</span>
                    <span style="flex:1;font-size:12px;color:var(--text-dim)">${ch} - не отправлено</span>
                    <button class="workflow-btn" style="font-size:10px;padding:2px 8px" onclick="distributePub('${id}','${ch}')">Отправить</button>
                </div>`;
        }
        const statusColors = { sent: 'var(--green)', error: 'var(--red)', pending: 'var(--yellow)' };
        const statusIcon = { sent: '✓', error: '✗', pending: '...' };
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-card);border:1px solid ${statusColors[d.status] || 'var(--border)'};border-radius:6px">
                <span style="font-weight:700;font-size:12px;width:20px">${CH_ICONS[ch]}</span>
                <span style="flex:1;font-size:12px">${ch} <span style="color:${statusColors[d.status]}">${statusIcon[d.status]} ${d.status}</span></span>
                ${d.externalUrl ? `<a href="${d.externalUrl}" target="_blank" style="font-size:10px;color:var(--accent)">Open</a>` : ''}
                ${d.status === 'error' ? `<button class="workflow-btn" style="font-size:10px;padding:2px 8px;color:var(--red);border-color:var(--red)" onclick="retryDistribute('${id}','${ch}','${d.id}')">Retry</button>` : ''}
                ${d.sentAt ? `<span style="font-size:9px;color:var(--text-dim)">${ago(d.sentAt)}</span>` : ''}
            </div>`;
    }).join('')}
        </div>
    </div>`;

    document.getElementById('modal-details-section').innerHTML = details;

    document.getElementById('modal-meta').innerHTML = `
        <div class="modal-meta-item"><span class="modal-meta-label">📅 News date</span><span class="modal-meta-value">${u.effectiveDate ? dateShort(u.effectiveDate) : '—'}</span></div>
        <div class="modal-meta-item"><span class="modal-meta-label">🤖 Collected</span><span class="modal-meta-value">${dateFull(u.createdAt)}</span></div>
        <div class="modal-meta-item"><span class="modal-meta-label">📊 Impact</span><span class="modal-meta-value">${impactBadge(u.impactLevel)}</span></div>
    `;

    const btns = [];
    if (prev) btns.push(`<button class="workflow-btn" onclick="movePub('${id}','${prev.key}')">← ${prev.label}</button>`);
    if (next) btns.push(`<button class="workflow-btn primary" onclick="movePub('${id}','${next.key}')">→ ${next.label}</button>`);
    if (u.sourceUrl) btns.push(`<a href="${u.sourceUrl}" target="_blank" class="workflow-btn">🔗 Source</a>`);

    document.getElementById('modal-footer').innerHTML = btns.join('');
    $modal.classList.add('open');
}

async function movePub(id, status) {
    await apiPatch(`/publications/${id}/status`, { status });
    closeModal();
    renderPublications();
}

async function savePubContent(id) {
    const content = document.getElementById('pub-content')?.value || '';
    await apiPatch(`/publications/${id}/content`, { publishedContent: content });
    alert('Текст сохранен!');
}

async function distributePub(id, channel) {
    try {
        await apiPost(`/publications/${id}/distribute`, { channels: [channel] });
        renderPublications();
        // If modal is open, reopen it
        if ($modal.classList.contains('open')) {
            const curStatus = _updatesCache[0]?.workflowStatus || 'raw';
            openPubCard(id, curStatus);
        }
    } catch (err) {
        alert('Distribution error: ' + err.message);
    }
}

async function retryDistribute(id, channel, distId) {
    try {
        // Reset to pending, then mark as sent (in real app, this would call actual sending logic)
        await apiPatch(`/publications/distributions/${distId}`, { status: 'pending', errorMessage: '' });
        renderPublications();
        if ($modal.classList.contains('open')) {
            const curStatus = _updatesCache[0]?.workflowStatus || 'raw';
            openPubCard(id, curStatus);
        }
    } catch (err) {
        alert('Retry error: ' + err.message);
    }
}

// ===========================================================
// ARTICLES -- TAB-BASED WORKFLOW
// ===========================================================

const ART_TABS = [
    { key: 'idea', label: '💡 Ideas', aiAction: 'Подобрать', aiEndpoint: null },
    { key: 'outline', label: '📋 Outline', aiAction: '📋 AI план', aiEndpoint: 'generate-outline' },
    { key: 'draft', label: '✏️ Draft', aiAction: '🤖 AI черновик', aiEndpoint: 'generate-draft' },
    { key: 'review', label: '👀 Review', aiAction: '🔍 AI ревью', aiEndpoint: 'ai-review' },
    { key: 'approved', label: '✅ Ready', aiAction: null, aiEndpoint: null },
    { key: 'published', label: '🚀 Published', aiAction: null, aiEndpoint: null },
];

let _artTab = 'idea';
let _artKanban = {};

async function renderArticles() {
    _artKanban = await api('/articles/kanban');
    renderArticleTab(_artTab);
}

function renderArticleTab(tab) {
    _artTab = tab;
    const items = _artKanban[tab] || [];
    const tabDef = ART_TABS.find(t => t.key === tab) || ART_TABS[0];

    $content.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
            ${ART_TABS.map(t => {
        const count = (_artKanban[t.key] || []).length;
        return `<button class="workflow-btn ${t.key === tab ? 'primary' : ''}" onclick="renderArticleTab('${t.key}')">${t.label} <span class="kanban-col-count">${count}</span></button>`;
    }).join('')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
            <button class="workflow-btn primary" onclick="showNewArticleForm()">+ Новая статья</button>
            <button class="workflow-btn" onclick="runAutopilotUI()">🤖⚡ Автопилот</button>
            ${tabDef.aiAction && items.length ? `<button class="workflow-btn" onclick="aiProcessAll('${tab}','${tabDef.aiEndpoint}')">🤖 ${tabDef.aiAction} все (${items.length})</button>` : ''}
        </div>

        <div class="card">
            <div class="card-header">
                <div class="card-title">${tabDef.label}</div>
                <span class="badge badge-info">${items.length}</span>
            </div>
            <div class="card-body">
                ${items.length === 0
            ? '<div class="empty-state"><div class="icon">📭</div><div class="msg">Пусто</div></div>'
            : items.map(a => renderArticleCard(a, tab)).join('')
        }
            </div>
        </div>
    `;
}

function renderArticleCard(a, tab) {
    const tabDef = ART_TABS.find(t => t.key === tab);
    const nextTab = ART_TABS[ART_TABS.findIndex(t => t.key === tab) + 1];
    const prevTab = ART_TABS[ART_TABS.findIndex(t => t.key === tab) - 1];

    return `
        <div class="feed-item" style="padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;gap:12px;align-items:flex-start">
                ${a.coverImage ? `<img src="${a.coverImage}" style="width:60px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0">` : `<div style="width:60px;height:40px;background:var(--bg-card);border:1px solid var(--border);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">📝</div>`}
                <div style="flex:1;min-width:0">
                    <div class="feed-title" style="cursor:pointer" onclick="openArticleEditor('${a.id}')">${a.title}</div>
                    <div style="font-size:11px;color:var(--text-dim);margin:4px 0">
                        ${a.excerpt ? `<span>${a.excerpt.substring(0, 100)}...</span>` : ''}
                    </div>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;font-size:10px">
                        ${(a.tags || []).map(t => `<span class="tag-chip">${t}</span>`).join('')}
                        ${a._count?.sources ? `<span style="color:var(--text-dim)">📎 ${a._count.sources} src</span>` : ''}
                        ${a.agent ? `<span style="color:var(--accent)">${a.agent.avatar || '🤖'} ${a.agent.name}</span>` : (a.author ? `<span style="color:var(--text-dim)">👤 ${a.author}</span>` : '')}
                        ${channelDots(a.distributions)}
                    </div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0;flex-wrap:wrap">
                    ${prevTab ? `<button class="workflow-btn" onclick="moveArticle('${a.id}','${prevTab.key}')" title="${prevTab.label}">←</button>` : ''}
                    ${tabDef?.aiEndpoint ? `<button class="workflow-btn" onclick="aiSingleStep('${a.id}','${tabDef.aiEndpoint}')" title="${tabDef.aiAction}">🤖</button>` : ''}
                    ${tab === 'idea' || tab === 'outline' ? `<button class="workflow-btn" style="background:var(--accent);color:white" onclick="runArticlePipeline('${a.id}')" title="Full AI Pipeline">⚡</button>` : ''}
                    ${!a.coverImage && ['draft', 'review', 'approved'].includes(tab) ? `<button class="workflow-btn" onclick="genCover('${a.id}')" title="Generate Cover">🎨</button>` : ''}
                    ${nextTab ? `<button class="workflow-btn primary" onclick="moveArticle('${a.id}','${nextTab.key}')" title="${nextTab.label}">→</button>` : ''}
                    <button class="workflow-btn" onclick="openArticleEditor('${a.id}')" title="Edit">✏️</button>
                </div>
            </div>
        </div>
    `;
}

// -- New Article --

function showNewArticleForm() {
    document.getElementById('modal-icon').className = 'modal-header-icon';
    document.getElementById('modal-icon').textContent = '📝';
    document.getElementById('modal-title').textContent = 'Новая статья';
    document.getElementById('modal-sub').innerHTML = '';
    document.getElementById('modal-summary').textContent = '';
    document.getElementById('modal-details-section').innerHTML = '';
    document.getElementById('modal-meta').innerHTML = `
        <div class="modal-meta-item" style="grid-column:span 2">
            <span class="modal-meta-label">Заголовок</span>
            <input id="new-art-title" type="text" placeholder="О чем статья..." style="width:100%;padding:8px;background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;font-size:13px">
        </div>
        <div class="modal-meta-item">
            <span class="modal-meta-label">Теги (через запятую)</span>
            <input id="new-art-tags" type="text" placeholder="visa, europe, 2026" style="width:100%;padding:8px;background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;font-size:13px">
        </div>
        <div class="modal-meta-item">
            <span class="modal-meta-label">Язык</span>
            <select id="new-art-lang" style="padding:8px;background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;font-size:13px">
                <option value="ru">Русский</option><option value="en">English</option>
            </select>
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="workflow-btn" onclick="closeModal()">Отмена</button>
        <button class="workflow-btn primary" onclick="createArticle()">Создать</button>
    `;
    $modal.classList.add('open');
}

async function createArticle() {
    const title = document.getElementById('new-art-title')?.value;
    if (!title) return alert('Введите заголовок');
    const tags = (document.getElementById('new-art-tags')?.value || '').split(',').map(t => t.trim()).filter(Boolean);
    const language = document.getElementById('new-art-lang')?.value || 'ru';
    await apiPost('/articles', { title, tags, language });
    closeModal();
    renderArticles();
}

// -- Article Editor Modal --

async function openArticleEditor(id) {
    const article = await api(`/articles/${id}`);
    if (!article) return;

    const tabIdx = ART_TABS.findIndex(t => t.key === article.status);
    const next = ART_TABS[tabIdx + 1];
    const prev = ART_TABS[tabIdx - 1];

    document.getElementById('modal-icon').className = 'modal-header-icon';
    document.getElementById('modal-icon').textContent = '📝';
    document.getElementById('modal-title').textContent = article.title;
    document.getElementById('modal-sub').innerHTML = `
        <span class="badge badge-dim">${article.status.toUpperCase()}</span>
        ${(article.tags || []).map(t => `<span class="tag-chip">${t}</span>`).join('')}
        ${article.author ? `<span>👤 ${article.author}</span>` : ''}
        <span>${article.language.toUpperCase()}</span>
    `;

    document.getElementById('modal-summary').textContent = article.excerpt || '';

    document.getElementById('modal-details-section').innerHTML = `
        <div style="margin-bottom:16px">
            <div style="font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;margin-bottom:6px">Текст (Markdown)</div>
            <textarea id="art-body" class="editor-textarea" rows="10">${article.body || ''}</textarea>
            <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
                <button class="workflow-btn" onclick="saveArticleBody('${id}')">💾 Сохранить</button>
                <button class="workflow-btn" onclick="aiSingleStep('${id}','generate-outline')">📋 AI план</button>
                <button class="workflow-btn primary" onclick="generateDraft('${id}')">🤖 AI черновик</button>
                <button class="workflow-btn" onclick="aiSingleStep('${id}','ai-review')">🔍 AI ревью</button>
            </div>
        </div>

        ${article.reviewNote ? `<div style="margin-bottom:16px;padding:10px;background:rgba(251,191,36,0.08);border:1px solid var(--yellow);border-radius:6px;font-size:12px;line-height:1.5"><div style="font-weight:700;margin-bottom:4px">AI Review</div><div style="white-space:pre-wrap">${article.reviewNote}</div></div>` : ''}

        <div style="margin-bottom:16px">
            <div style="font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;margin-bottom:6px">Обложка</div>
            ${article.coverImage ? `<img src="${article.coverImage}" style="max-width:300px;border-radius:6px;margin-bottom:8px;display:block">` : ''}
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                <button class="workflow-btn" onclick="generateCover('${id}')">🎨 Сгенерировать</button>
                <label class="workflow-btn" style="cursor:pointer">📁 Загрузить <input type="file" accept="image/*" style="display:none" onchange="uploadCover('${id}',this)"></label>
            </div>
        </div>

        <div style="margin-bottom:16px">
            <div style="font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;margin-bottom:6px">Источники (${article.sources?.length || 0})</div>
            <div id="art-sources">${(article.sources || []).map(s => `
                <span class="source-chip">${s.update?.country?.flag || ''} ${s.update?.title?.substring(0, 40) || ''}... <span class="remove" onclick="removeSource('${id}','${s.id}')">x</span></span>
            `).join('') || '<span style="color:var(--text-dim);font-size:11px">Нет привязанных источников</span>'}</div>
            <div style="margin-top:6px;display:flex;gap:6px">
                <input id="art-search-q" type="text" placeholder="Поиск новостей для привязки..." style="flex:1;padding:6px 10px;background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;font-size:12px">
                <button class="workflow-btn" onclick="searchSources('${id}')">🔍</button>
            </div>
            <div id="art-search-results" style="margin-top:6px"></div>
        </div>
    `;

    document.getElementById('modal-meta').innerHTML = `
        <div class="modal-meta-item"><span class="modal-meta-label">Создана</span><span class="modal-meta-value">${dateFull(article.createdAt)}</span></div>
        <div class="modal-meta-item"><span class="modal-meta-label">Обновлена</span><span class="modal-meta-value">${dateFull(article.updatedAt)}</span></div>
        <div class="modal-meta-item"><span class="modal-meta-label">Источники</span><span class="modal-meta-value">${article.sources?.length || 0}</span></div>
        <div class="modal-meta-item"><span class="modal-meta-label">Slug</span><span class="modal-meta-value" style="font-size:10px;font-family:monospace">${article.slug}</span></div>
    `;

    const btns = [];
    if (prev) btns.push(`<button class="workflow-btn" onclick="moveArticle('${id}','${prev.key}')">← ${prev.label}</button>`);
    if (next) btns.push(`<button class="workflow-btn primary" onclick="moveArticle('${id}','${next.key}')">→ ${next.label}</button>`);
    btns.push(`<button class="workflow-btn" style="color:var(--red);border-color:var(--red)" onclick="deleteArticle('${id}')">🗑️</button>`);
    document.getElementById('modal-footer').innerHTML = btns.join('');
    $modal.classList.add('open');
}

// -- Article Actions --

async function saveArticleBody(id) {
    const body = document.getElementById('art-body')?.value || '';
    await apiPatch(`/articles/${id}`, { body });
    alert('Сохранено!');
}

async function moveArticle(id, status) {
    await apiPatch(`/articles/${id}/status`, { status });
    closeModal();
    renderArticles();
}

async function deleteArticle(id) {
    if (!confirm('Удалить статью?')) return;
    await apiDelete(`/articles/${id}`);
    closeModal();
    renderArticles();
}

async function generateDraft(id) {
    if (!confirm('Сгенерировать AI черновик? Перезапишет текущий текст.')) return;
    const btn = event?.target;
    if (btn) { btn.textContent = 'Генерирую...'; btn.disabled = true; }
    try {
        await apiPost(`/articles/${id}/generate-draft`, {});
        openArticleEditor(id);
    } catch (err) {
        alert('AI error: ' + err.message);
        if (btn) { btn.textContent = '🤖 AI черновик'; btn.disabled = false; }
    }
}

async function generateCover(id) {
    const btn = event?.target;
    if (btn) { btn.textContent = 'Генерирую...'; btn.disabled = true; }
    try {
        await apiPost(`/articles/${id}/generate-cover`, {});
        openArticleEditor(id);
    } catch (err) {
        alert('Cover error: ' + err.message);
        if (btn) { btn.textContent = '🎨 Сгенерировать'; btn.disabled = false; }
    }
}

async function uploadCover(id, input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API}/articles/${id}/upload-cover`, { method: 'POST', body: formData });
    if (!res.ok) return alert('Upload failed');
    openArticleEditor(id);
}

async function aiSingleStep(id, endpoint) {
    const btn = event?.target;
    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
        await apiPost(`/articles/${id}/${endpoint}`, {});
        if ($modal.classList.contains('open')) {
            openArticleEditor(id);
        } else {
            renderArticles();
        }
    } catch (err) {
        alert('AI error: ' + err.message);
        if (btn) { btn.textContent = '🤖'; btn.disabled = false; }
    }
}

async function aiProcessAll(tab, endpoint) {
    const items = _artKanban[tab] || [];
    if (!items.length) return;
    if (!confirm(`AI обработает ${items.length} статей. Продолжить?`)) return;

    for (const a of items) {
        try {
            await apiPost(`/articles/${a.id}/${endpoint}`, {});
        } catch (err) {
            console.error(`AI failed for ${a.id}:`, err);
        }
    }
    renderArticles();
}

async function runAutopilotUI() {
    if (!confirm('Запустить автопилот?\nAI подберет новости, создаст статьи, напишет черновики.')) return;
    const btn = event?.target;
    if (btn) { btn.textContent = 'Автопилот работает...'; btn.disabled = true; }
    try {
        const result = await apiPost('/articles/autopilot', { autoDraft: true, hoursBack: 48 });
        alert(`Автопилот завершен!\nСоздано: ${result.created}\nЧерновиков: ${result.drafted}\nПропущено: ${result.skipped}`);
        renderArticles();
    } catch (err) {
        alert('Ошибка автопилота: ' + err.message);
        if (btn) { btn.textContent = '🤖⚡ Автопилот'; btn.disabled = false; }
    }
}

async function searchSources(articleId) {
    const q = document.getElementById('art-search-q')?.value;
    if (!q) return;
    const { data } = await api(`/articles/search-updates?q=${encodeURIComponent(q)}`);
    document.getElementById('art-search-results').innerHTML = data.length
        ? data.map(u => `<div class="feed-item" style="padding:4px 0;cursor:pointer" onclick="addSource('${articleId}','${u.id}')"><div class="feed-icon ${u.category}" style="width:24px;height:24px;font-size:12px">${categoryIcon(u.category)}</div><div class="feed-body"><div class="feed-title" style="font-size:11px">${u.country?.flag || ''} ${u.title}</div></div></div>`).join('')
        : '<span style="color:var(--text-dim);font-size:11px">Ничего не найдено</span>';
}

async function addSource(articleId, updateId) {
    await apiPost(`/articles/${articleId}/sources`, { updateId });
    openArticleEditor(articleId);
}

async function removeSource(articleId, srcId) {
    await apiDelete(`/articles/${articleId}/sources/${srcId}`);
    openArticleEditor(articleId);
}

// -- Init --
loadPage('overview');

// -- Drag & Drop for Publications Kanban --
function dropPubCard(event, targetCol) {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    if (id) movePub(id, targetCol);
}

// ===========================================================
// ===========================================================
// EDITORIAL — Unified Pipeline Kanban
// ===========================================================

const EDIT_COLS = [
    { key: 'inbox', label: 'Inbox', color: '#6366f1', desc: 'Raw news items from collectors', status: null },
    { key: 'grouped', label: 'Grouped', color: '#f59e0b', desc: 'AI-grouped into article topics', status: 'idea' },
    { key: 'draft', label: 'Draft', color: '#3b82f6', desc: 'Article being written', status: 'draft' },
    { key: 'review', label: 'Review', color: '#8b5cf6', desc: 'Under editorial review', status: 'review' },
    { key: 'ready', label: 'Ready', color: '#10b981', desc: 'Approved, awaiting publish', status: 'approved' },
    { key: 'published', label: 'Published', color: '#06b6d4', desc: 'Live on channels', status: 'published' },
];

async function renderEditorial() {
    // Fetch both raw inbox + article kanban
    const [pubKanban, artKanban, agents] = await Promise.all([
        api('/publications/kanban'),
        api('/articles/kanban'),
        api('/agents'),
    ]);

    const inbox = pubKanban.raw || [];
    const grouped = [...(artKanban.idea || []), ...(artKanban.outline || [])];
    const drafts = artKanban.draft || [];
    const reviews = artKanban.review || [];
    const ready = artKanban.approved || [];
    const published = artKanban.published || [];
    const total = inbox.length + grouped.length + drafts.length + reviews.length + ready.length + published.length;

    const colData = { inbox, grouped, draft: drafts, review: reviews, ready, published };

    $content.innerHTML = `
        <div style="margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span class="badge badge-info">${total} items</span>
            <button class="workflow-btn primary" onclick="editorialAutopilot()">AI Autopilot</button>
            <button class="workflow-btn" onclick="editorialChiefEditor()">Chief Editor</button>
        </div>
        <div class="kanban-board">
            ${EDIT_COLS.map(col => {
        const items = colData[col.key] || [];
        return `
                    <div class="kanban-col">
                        <div class="kanban-col-header" style="border-top:2px solid ${col.color}">
                            ${col.label}
                            <span class="kanban-col-count">${items.length}</span>
                        </div>
                        <div class="kanban-col-body" data-col="${col.key}"
                             ondragover="event.preventDefault();this.style.background='rgba(99,102,241,0.08)'"
                             ondragleave="this.style.background=''"
                             ondrop="dropEditCard(event,'${col.key}');this.style.background=''">
                            ${items.length === 0
                ? `<div style="text-align:center;padding:24px 8px;color:var(--text-dim);font-size:11px">${col.desc}</div>`
                : items.map(item => renderEditCard(item, col.key, agents)).join('')}
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function renderEditCard(item, colKey, agents) {
    if (colKey === 'inbox') return renderInboxCard(item);
    return renderPipelineCard(item, colKey, agents);
}

function renderInboxCard(u) {
    const flag = u.country?.flag || '🌐';
    const cat = u.category || '';
    const impact = u.impactLevel === 'high' ? 'HIGH' : u.impactLevel === 'medium' ? 'MED' : 'LOW';
    return `
        <div class="kanban-card" style="cursor:default">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <span style="font-size:16px">${flag}</span>
                <span style="font-size:11px;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.title}</span>
                <span style="font-size:9px;padding:1px 4px;border-radius:3px;background:${u.impactLevel === 'high' ? 'var(--red)' : u.impactLevel === 'medium' ? 'var(--yellow)' : 'var(--green)'};color:#fff;font-weight:600">${impact}</span>
            </div>
            <div style="font-size:10px;color:var(--text-dim);margin-bottom:4px">${cat} · ${u.countryCode || ''}</div>
            ${u.summary ? `<div style="font-size:10px;color:var(--text-secondary);margin-bottom:4px;line-height:1.3">${u.summary.substring(0, 100)}${u.summary.length > 100 ? '...' : ''}</div>` : ''}
        </div>
    `;
}

function renderPipelineCard(a, colKey, agents) {
    const agentName = a.agent?.displayName || a.agent?.name || a.author || '';
    const coverThumb = a.coverImage ? `<img src="${a.coverImage}" style="width:44px;height:30px;object-fit:cover;border-radius:3px;flex-shrink:0">` : '';

    // Progressive content based on stage
    let body = '';
    if (colKey === 'grouped') {
        body = `<div style="font-size:10px;color:var(--text-dim)">${a._count?.sources || 0} sources</div>`;
    } else if (colKey === 'draft') {
        const words = a.body ? a.body.split(/\s+/).length : 0;
        body = `<div style="font-size:10px;color:var(--text-dim)">${words} words</div>`;
        if (a.excerpt) body += `<div style="font-size:10px;color:var(--text-secondary);margin-top:2px;line-height:1.3">${a.excerpt.substring(0, 80)}...</div>`;
    } else if (colKey === 'review') {
        body = a.reviewNote
            ? `<div style="font-size:10px;color:var(--yellow);margin-top:2px">${a.reviewNote.substring(0, 80)}...</div>`
            : `<div style="font-size:10px;color:var(--text-dim)">Awaiting review</div>`;
        if (a.needsResearch) body += `<div style="font-size:9px;color:var(--yellow);margin-top:2px;font-weight:600">Needs Research</div>`;
    } else if (colKey === 'ready') {
        const words = a.body ? a.body.split(/\s+/).length : 0;
        body = `<div style="font-size:10px;color:var(--green)">${words} words · ready to publish</div>`;
        if (a.researchNote) body += `<div style="font-size:9px;color:var(--cyan);margin-top:2px">Researched</div>`;
    } else if (colKey === 'published') {
        const dists = (a.distributions || []).filter(d => d.status === 'sent');
        const siteUrl = `http://localhost:3003/articles/${a.slug || a.id}`;
        body = `<div style="display:flex;flex-direction:column;gap:3px">`;
        if (dists.length) body += `<div style="font-size:10px;color:var(--green)">${dists.map(d => d.channel).join(', ')}</div>`;
        body += `<a href="${siteUrl}" target="_blank" style="font-size:10px;color:var(--accent);text-decoration:underline" onclick="event.stopPropagation()">View on site</a></div>`;
    }

    // Action buttons by stage
    let actions = '';
    if (colKey === 'grouped') {
        actions = `
            <button class="workflow-btn" style="background:var(--accent);color:white;font-size:9px;padding:2px 6px" onclick="event.stopPropagation();runArticlePipeline('${a.id}')" title="Full AI Pipeline">Pipeline</button>
        `;
    } else if (colKey === 'draft' || colKey === 'review' || colKey === 'ready') {
        actions = !a.coverImage ? `<button class="workflow-btn" style="font-size:9px;padding:2px 6px" onclick="event.stopPropagation();genCover('${a.id}')" title="Generate Cover">Cover</button>` : '';
        // Research button
        actions += `<button class="workflow-btn" style="font-size:9px;padding:2px 6px" onclick="event.stopPropagation();runResearch('${a.id}')" title="AI Research & Verification">Research</button>`;
        // Add view link for ready articles
        if (colKey === 'ready') {
            const siteUrl = `http://localhost:3003/articles/${a.slug || a.id}`;
            actions += `<a href="${siteUrl}" target="_blank" style="font-size:9px;padding:2px 6px;color:var(--accent);text-decoration:underline" onclick="event.stopPropagation()">View</a>`;
        }
    }

    return `
        <div class="kanban-card" draggable="true"
             ondragstart="event.dataTransfer.setData('text/plain','art:${a.id}')"
             onclick="openArticleEditor('${a.id}')"
             style="cursor:grab">
            <div style="display:flex;gap:6px;align-items:flex-start">
                ${coverThumb}
                <div style="flex:1;min-width:0">
                    <div style="font-size:11px;font-weight:600;line-height:1.3;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.title}</div>
                    ${agentName ? `<div style="font-size:9px;color:var(--accent)">${agentName}</div>` : ''}
                </div>
            </div>
            ${body}
            <div style="display:flex;gap:4px;margin-top:4px;align-items:center;flex-wrap:wrap">
                ${(a.tags || []).slice(0, 3).map(t => `<span style="font-size:8px;padding:1px 4px;background:var(--bg-surface);border-radius:3px;color:var(--text-dim)">${t}</span>`).join('')}
                <div style="flex:1"></div>
                ${actions}
            </div>
        </div>
    `;
}

// Drag & drop for editorial kanban
function dropEditCard(event, targetCol) {
    event.preventDefault();
    const raw = event.dataTransfer.getData('text/plain');
    if (!raw) return;

    if (raw.startsWith('art:')) {
        const articleId = raw.substring(4);
        // Map column to article status
        const statusMap = { grouped: 'idea', draft: 'draft', review: 'review', ready: 'approved', published: 'published' };
        const newStatus = statusMap[targetCol];
        if (newStatus) {
            apiPatch(`/articles/${articleId}`, { status: newStatus }).then(() => renderEditorial());
        }
    }
}

async function editorialAutopilot() {
    const btn = event?.target;
    if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
    try {
        const result = await apiPost('/articles/autopilot', { autoDraft: false, hoursBack: 720 });
        alert(`Autopilot: ${result.created} articles created, ${result.drafted} drafted`);
        renderEditorial();
    } catch (e) {
        alert('Error: ' + e.message);
    }
    if (btn) { btn.textContent = '🤖 AI Autopilot'; btn.disabled = false; }
}

async function editorialChiefEditor() {
    const btn = event?.target;
    if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
    try {
        const result = await apiPost('/articles/chief-editor', {});
        alert(`Chief Editor: ${result.progressed} progressed\n${(result.details || []).join('\n')}`);
        renderEditorial();
    } catch (e) {
        alert('Error: ' + e.message);
    }
    if (btn) { btn.textContent = '👔 Chief Editor'; btn.disabled = false; }
}

// ===========================================================
// AGENTS -- Management UI
// ===========================================================

let _agentsCache = [];

async function renderAgents() {
    _agentsCache = await api('/agents');

    $content.innerHTML = `
        <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px">
            <span class="badge badge-info">${_agentsCache.length} agents</span>
            <button class="workflow-btn primary" onclick="seedAgents()">Seed Defaults</button>
            <button class="workflow-btn" onclick="showCreateAgent()">+ New Agent</button>
            <button class="workflow-btn" onclick="runChiefEditorNow()">Run Chief Editor</button>
        </div>

        <div id="agent-form-area"></div>

        <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
            ${_agentsCache.map(a => `
                <div class="stat-card" style="border-left:3px solid ${a.role === 'editor' ? 'var(--yellow)' : a.role === 'reviewer' ? 'var(--purple)' : 'var(--accent)'}">
                    <div style="margin-bottom:12px">
                        <div style="font-size:18px;font-weight:700">${a.displayName || a.name}</div>
                        <div style="font-size:10px;color:var(--text-dim)">${a.name} · ${a.role} · ${a._count?.articles || 0} articles</div>
                    </div>
                    <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;line-height:1.4">
                        <strong>Style:</strong> ${a.stylePrompt || '(default)'}
                    </div>
                    <div style="font-size:10px;color:var(--text-dim);margin-bottom:8px;padding:6px;background:var(--bg-surface);border-radius:4px;max-height:60px;overflow:hidden">
                        <strong>Base:</strong> ${a.basePrompt.substring(0, 150)}...
                    </div>
                    ${a.formatting && Object.keys(a.formatting).length ? `
                        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
                            ${Object.entries(a.formatting).map(([k, v]) => `<span class="badge badge-dim" style="font-size:9px">${k}: ${v}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div style="display:flex;gap:6px">
                        <button class="workflow-btn" onclick="editAgent('${a.id}')">Edit</button>
                        <button class="workflow-btn" style="color:var(--red)" onclick="deleteAgent('${a.id}')">Delete</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function seedAgents() {
    await apiPost('/agents/seed', {});
    renderAgents();
}

async function runChiefEditorNow() {
    const result = await apiPost('/articles/chief-editor', {});
    alert('Chief Editor: ' + result.progressed + ' articles progressed\n' + (result.details || []).join('\n'));
}

function showCreateAgent() {
    const area = document.getElementById('agent-form-area');
    area.innerHTML = `
        <div class="card" style="margin-bottom:16px">
            <div class="card-header"><div class="card-title">New Agent</div></div>
            <div class="card-body">
                <div style="display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;font-size:12px">
                    <label>Display Name:</label><input id="ag-displayname" class="editor-textarea" style="height:auto;padding:6px" placeholder="e.g. Sarah Mitchell">
                    <label>Internal ID:</label><input id="ag-name" class="editor-textarea" style="height:auto;padding:6px" placeholder="e.g. storyteller">
                    <label>Role:</label>
                    <select id="ag-role" class="editor-textarea" style="height:auto;padding:6px">
                        <option value="journalist">Journalist</option>
                        <option value="editor">Editor</option>
                        <option value="reviewer">Reviewer</option>
                    </select>
                    <label>Style:</label><textarea id="ag-style" class="editor-textarea" rows="2" placeholder="Tone, voice, quirks..."></textarea>
                    <label>Length:</label>
                    <select id="ag-length" class="editor-textarea" style="height:auto;padding:6px">
                        <option value="short">Short (300-500 words)</option>
                        <option value="medium" selected>Medium (800-1200 words)</option>
                        <option value="long">Long (1500+ words)</option>
                    </select>
                </div>
                <div style="margin-top:10px;display:flex;gap:8px">
                    <button class="workflow-btn primary" onclick="saveNewAgent()">Create</button>
                    <button class="workflow-btn" onclick="document.getElementById('agent-form-area').innerHTML=''">Cancel</button>
                </div>
            </div>
        </div>
    `;
}

async function saveNewAgent() {
    const name = document.getElementById('ag-name').value;
    const displayName = document.getElementById('ag-displayname').value;
    const role = document.getElementById('ag-role').value;
    const stylePrompt = document.getElementById('ag-style').value;
    const length = document.getElementById('ag-length').value;

    if (!name) return alert('Internal ID required');
    if (!displayName) return alert('Display Name required');

    await apiPost('/agents', {
        name, displayName, role, stylePrompt,
        formatting: { length, useEmoji: false, headerStyle: 'h2' },
    });
    renderAgents();
}

async function editAgent(id) {
    const a = _agentsCache.find(x => x.id === id);
    if (!a) return;

    const area = document.getElementById('agent-form-area');
    area.innerHTML = `
        <div class="card" style="margin-bottom:16px">
            <div class="card-header"><div class="card-title">Edit: ${a.displayName || a.name}</div></div>
            <div class="card-body">
                <div style="display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;font-size:12px">
                    <label>Display Name:</label><input id="ag-displayname" class="editor-textarea" style="height:auto;padding:6px" value="${a.displayName || ''}">
                    <label>Internal ID:</label><input id="ag-name" class="editor-textarea" style="height:auto;padding:6px" value="${a.name}">
                    <label>Role:</label>
                    <select id="ag-role" class="editor-textarea" style="height:auto;padding:6px">
                        <option value="journalist" ${a.role === 'journalist' ? 'selected' : ''}>Journalist</option>
                        <option value="editor" ${a.role === 'editor' ? 'selected' : ''}>Editor</option>
                        <option value="reviewer" ${a.role === 'reviewer' ? 'selected' : ''}>Reviewer</option>
                    </select>
                    <label>Style:</label><textarea id="ag-style" class="editor-textarea" rows="3">${a.stylePrompt || ''}</textarea>
                    <label>Base Prompt:</label><textarea id="ag-base" class="editor-textarea" rows="4">${a.basePrompt}</textarea>
                    <label>Length:</label>
                    <select id="ag-length" class="editor-textarea" style="height:auto;padding:6px">
                        <option value="short" ${a.formatting?.length === 'short' ? 'selected' : ''}>Short</option>
                        <option value="medium" ${a.formatting?.length === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="long" ${a.formatting?.length === 'long' ? 'selected' : ''}>Long</option>
                    </select>
                </div>
                <div style="margin-top:10px;display:flex;gap:8px">
                    <button class="workflow-btn primary" onclick="saveEditAgent('${id}')">Save</button>
                    <button class="workflow-btn" onclick="document.getElementById('agent-form-area').innerHTML=''">Cancel</button>
                </div>
            </div>
        </div>
    `;
}

async function saveEditAgent(id) {
    const data = {
        name: document.getElementById('ag-name').value,
        displayName: document.getElementById('ag-displayname').value,
        role: document.getElementById('ag-role').value,
        stylePrompt: document.getElementById('ag-style').value,
        basePrompt: document.getElementById('ag-base').value,
        formatting: {
            length: document.getElementById('ag-length').value,
            useEmoji: false,
            headerStyle: 'h2',
        },
    };
    await apiPatch(`/agents/${id}`, data);
    renderAgents();
}

async function deleteAgent(id) {
    if (!confirm('Delete this agent?')) return;
    await apiDelete(`/agents/${id}`);
    renderAgents();
}

// -- Article Pipeline & Cover --
async function runArticlePipeline(articleId) {
    if (!confirm('Run full AI pipeline (outline → draft → review → approve)?')) return;
    const btn = event?.target;
    if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
    try {
        const result = await apiPost(`/articles/${articleId}/run-pipeline`, {});
        alert('Pipeline: ' + result.status + '\n' + (result.steps || []).join(' → '));
        renderEditorial();
    } catch (e) {
        alert('Pipeline error: ' + e.message);
        if (btn) { btn.textContent = 'Pipeline'; btn.disabled = false; }
    }
}

async function genCover(articleId) {
    const btn = event?.target;
    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
        await apiPost(`/articles/${articleId}/generate-cover`, {});
        renderEditorial();
    } catch (e) {
        alert('Cover generation error: ' + e.message);
        if (btn) { btn.textContent = 'Cover'; btn.disabled = false; }
    }
}

async function runResearch(articleId) {
    const btn = event?.target;
    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
        const result = await apiPost(`/articles/${articleId}/research`, {});
        alert(`Research: ${result.verified ? 'Verified' : 'Needs attention'} (${result.confidence}% confidence)`);
        renderEditorial();
    } catch (e) {
        alert('Research error: ' + e.message);
        if (btn) { btn.textContent = 'Research'; btn.disabled = false; }
    }
}
