// Browser harness: serves the app over HTTP and drives every page in Chromium.
// Run: node qa/qa-pages.mjs      (needs: npm i -D playwright && npx playwright install chromium)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  try { const f = await readFile(join(ROOT, normalize(p))); res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(f); }
  catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const report = { passed: 0, failed: 0, errors: [] };
const ok = (c, m) => { if (c) report.passed++; else { report.failed++; report.errors.push(m); } };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on('pageerror', e => consoleErrors.push(e.message));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
const ready = () => page.waitForFunction(() => window.__adapter && !document.querySelector('.loading'));
// Block Google Fonts so the harness doesn't need the network
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
// Fresh dummy data each run
await page.goto(base + '/index.html' + '?mode=local'); await page.evaluate(() => localStorage.clear());

// ── Pipeline ────────────────────────────────────────────────────────
await page.goto(base + '/index.html' + '?mode=local'); await ready();
const activeRows = await page.locator('tbody tr.clickable').count();
ok(activeRows === 3, `active filter shows 3 rows (Mickleham, Wollert, Cobblebank) got ${activeRows}`);
await page.click('[data-filter="all"]');
ok((await page.locator('tbody tr.clickable').count()) === 5, 'All shows 5 rows');
ok(await page.locator('text=GapMaps pending').first().isVisible(), 'Cobblebank shows GapMaps pending');
ok((await page.locator('th', { hasText: 'Places' }).count()) === 0, 'no Places column');
await page.click('[data-view="board"]');
ok((await page.locator('.grid-4 .card').count()) === 5, 'board shows 5 cards');
await page.fill('#global-search', 'wollert');
await page.click('[data-view="table"]');
await page.fill('#global-search', 'wollert');
ok((await page.locator('tbody tr.clickable').count()) === 1, 'search narrows to Wollert');
const mickId = await page.evaluate(() => window.__adapter.feasibilityProjects().find(p => p.name.startsWith('Mickleham')).id);

// ── Site workspace ──────────────────────────────────────────────────
await page.goto(`${base}/site.html?id=${mickId}&mode=local`); await ready();
ok(await page.locator('h1', { hasText: 'Mickleham' }).isVisible(), 'site header');
const heroRatio = await page.locator('.hero.primary .v').textContent();
ok(/^\d\.\d\d×$/.test(heroRatio.trim()), `hero ratio formatted (${heroRatio.trim()})`);
ok((await page.locator('.chain .step').count()) === 5, 'demand chain has 5 steps');
ok((await page.locator('.chain .step.weak').count()) === 2, 'participation + CALD marked weak');
ok(await page.locator('text=Potential').first().isVisible(), 'potential competitors listed');
ok(await page.locator('text=watch only').first().isVisible(), 'un-counted potential shows watch only');
await page.click('[data-tab="site"]');
ok(await page.locator('text=Site details').isVisible(), 'site tab renders');
await page.click('[data-tab="activity"]');
await page.fill('#new-comment', 'QA comment'); await page.click('#btn-comment');
ok(await page.locator('text=QA comment').isVisible(), 'comment posted via write-through');
await page.selectOption('#status-select', 'go');
await page.waitForFunction(() => document.querySelector('.chip.go'));
ok(await page.locator('h1 + .chip.go, .chip.go').first().isVisible(), 'status change re-renders chip');
await page.selectOption('#status-select', 'conditional_go');

// ── Input page (edit existing) ──────────────────────────────────────
await page.goto(`${base}/new.html?id=${mickId}&mode=local`); await ready();
ok((await page.locator('#comps tr').count()) === 4, 'competitors table: 3 live + 1 permit');
ok((await page.locator('#pots tr').count()) === 3, 'potential table: 3 rows');
await page.fill('#proposed_places', '130'); await page.locator('#proposed_places').dispatchEvent('change');
await page.waitForFunction(() => window.__adapter.get('feasibility_data', new URLSearchParams(location.search).get('id')).proposed_places === 130);
ok(true, 'proposed_places saved write-through');
const potCount = page.locator('#pots tr').first().locator('[data-f="count_in_chain"]');
await potCount.uncheck();
await page.waitForFunction(() => window.__adapter.list('feasibility_competitors').filter(c => c.status === 'potential' && c.count_in_chain !== false).length === 0);
ok(true, 'count_in_chain toggle persists');
await page.click('[data-add="potential"]');
ok((await page.locator('#pots tr').count()) === 4, 'add potential competitor row');
await page.locator('#pots tr').last().locator('[data-del]').click();
ok((await page.locator('#pots tr').count()) === 3, 'remove row');
ok((await page.locator('#comps .pc button').count()) === 4, 'photo + button on every competitor row');
ok((await page.locator('#schools .pc button').count()) === 2, 'photo + button on every school row');

// ── Input page (create new) ─────────────────────────────────────────
await page.goto(`${base}/new.html?mode=local`); await ready();
await page.click('#btn-create');
ok(await page.locator('#name.err').isVisible(), 'required-field validation paints name red');
await page.fill('#name', 'QA Site — Test Rd'); await page.fill('#site_address', '1 Test Rd, Testville VIC 3000'); await page.fill('#proposed_places', '90');
await page.click('#btn-create');
await page.waitForURL(/site\.html\?id=/); await ready();
ok(await page.locator('h1', { hasText: 'QA Site' }).isVisible(), 'create → opens workspace');
ok(await page.locator('text=GapMaps').first().isVisible(), 'new site shows missing data');

// ── Report workspace ────────────────────────────────────────────────
await page.goto(`${base}/report.html?id=${mickId}&mode=local`); await ready();
ok((await page.locator('[data-slide]').count()) === 12, '12 slides in rail');
ok(await page.locator('.slide .eyebrow', { hasText: 'Executive summary' }).isVisible(), 'exec summary is the default slide');
ok(await page.locator('#btn-pdf').isDisabled(), 'Export PDF blocked while pre-flight has blockers');
ok(await page.locator('.iss.block', { hasText: 'Trend tag' }).isVisible(), 'trend-tag blocker shown');
await page.fill('#sum', 'Effective ratio 9.99× is made up.'); await page.locator('#sum').dispatchEvent('blur');
ok(await page.locator('.toast.err').isVisible(), 'prose figure that does not match data is flagged');
await page.fill('#sum', 'Checked prose.'); await page.locator('#sum').dispatchEvent('change');
await page.waitForFunction(() => (window.__adapter.get('feasibility_data', new URLSearchParams(location.search).get('id')).report_config.slides || {}).exec?.summary === 'Checked prose.');
ok(true, 'summary saved to report_config');
await page.click('[data-slide="cover"]');
ok(await page.locator('.slide', { hasText: 'Effective demand signal' }).isVisible(), 'cover slide renders');
ok(await page.locator('.editor').locator('text=no free prose').isVisible(), 'generated slides have no prose editor');

// ── Phone ───────────────────────────────────────────────────────────
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/m/index.html?id=${mickId}&mode=local`); await ready();
ok(await page.locator('.shoot').isVisible(), 'phone: take photo button');
ok((await page.locator('[data-tag]').count()) >= 8, 'phone: tag chips for site + competitors + schools');
ok((await page.locator('text=checklist').count()) === 0, 'phone: no checklist');
await page.fill('#note', 'Walked the frontage.'); await page.click('#save-note');
ok(await page.locator('.note', { hasText: 'Walked the frontage.' }).isVisible(), 'phone: note saved');

// ── Role: acquisitions (view-only) ──────────────────────────────────
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${base}/site.html?id=${mickId}&mode=local`); await ready();
await page.evaluate(() => { window.__adapter.role = 'acquisitions'; window.__adapter._emit('change', {}); });
ok(await page.locator('.hero', { hasText: 'hidden' }).isVisible(), 'view-only role hides land price');
ok((await page.locator('#status-select').count()) === 0, 'view-only role has no status control');

// ── Supabase mode: no session → sign-in card (network to jsdelivr may be blocked in CI; tolerate) ──
await page.goto(`${base}/index.html?mode=supabase`);
const signin = await page.waitForSelector('#signin, .empty', { timeout: 20000 }).catch(() => null);
ok(!!signin, 'supabase mode shows sign-in card (or a clear error when offline)');
const netErrs = consoleErrors.filter(e => /jsdelivr|Failed to fetch|net::/i.test(e)); consoleErrors.splice(0, consoleErrors.length, ...consoleErrors.filter(e => !netErrs.includes(e)));

ok(consoleErrors.length === 0, 'no console errors: ' + consoleErrors.slice(0, 3).join(' | '));
await browser.close(); server.close();
console.log(JSON.stringify(report, null, 2));
process.exit(report.failed ? 1 : 0);
