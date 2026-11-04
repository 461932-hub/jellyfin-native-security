/* Notification behavior, account boundaries and bounded polling in a real browser. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.NATIVE_CINEMA_PLAYWRIGHT || 'playwright-core');
const assets = path.join(__dirname, '../web'), checks = [], requests = [], pending = [];
const userA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', userB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const serverId = 'cccccccccccccccccccccccccccccccc';
const movieId = i => (0x100 + i).toString(16).padStart(32, '0');
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');
let browser, server, hold = false, denied = false, rows = [], aborted = 0;
const note = (name, base) => { checks.push({ name: name + ' at ' + (base || '/'), passed: true }); console.log('PASS ' + name + ' at ' + (base || '/')); };

(async () => {
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://fixture.invalid');
        const base = url.pathname.startsWith('/media/') ? '/media' : '';
        const auth = req.headers.authorization || '';
        requests.push({ path: url.pathname, query: url.search, auth });
        const permitted = auth === 'MediaBrowser Token="fixture-token-a"' || auth === 'MediaBrowser Token="fixture-token-b"';
        if (/\/web\/cinema-(native\.(js|css)|boot\.js)$/.test(url.pathname)) {
            const name = path.basename(url.pathname);
            res.writeHead(200, { 'Content-Type': name.endsWith('.css') ? 'text/css' : 'application/javascript' });
            res.end(fs.readFileSync(path.join(assets, name))); return;
        }
        if (url.pathname === base + '/Items') {
            res.once('close', () => { if (!res.writableEnded) aborted++; });
            const expectedUser = auth.includes('fixture-token-a') ? userA : userB;
            const allowed = permitted && !denied && url.searchParams.get('UserId') === expectedUser;
            const data = expectedUser === userB ? [{ Id: movieId(20), Type: 'Movie', Name: 'Account B only', DateCreated: new Date().toISOString() }] : rows;
            const send = () => { if (!res.destroyed) { res.writeHead(allowed ? 200 : 403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ Items: allowed ? data : [] })); } };
            if (hold) pending.push(send); else send(); return;
        }
        if (/\/Users\/[a-f0-9]{32}\/Items\/[a-f0-9]{32}$/.test(url.pathname)) {
            res.writeHead(permitted ? 200 : 403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ Id: url.pathname.split('/').at(-1), Type: 'Movie', Name: 'Authorized movie information', Overview: 'Existing Cinema information view', ImageTags: { Thumb: 'fixture' } })); return;
        }
        if (url.pathname.includes('/Images/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(pixel); return; }
        if (url.pathname.endsWith('/web/index.html')) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!doctype html><html><head><script src="cinema-boot.js"></script><link rel="stylesheet" href="cinema-native.css">
              <style>body{margin:0}.mainAnimatedPage{min-height:500px}header{position:relative;z-index:1100}.MuiToolbar-root{display:flex;justify-content:flex-end;align-items:center}.native-tools{display:flex;align-items:center}button.native-control{width:40px;height:44px}</style>
              <script>window.fixture={token:'fixture-token-a',user:'${userA}',outside:false,hidden:false,...window.fixtureStart};
                Object.defineProperty(document,'hidden',{configurable:true,get:()=>fixture.hidden});
                window.ApiClient={accessToken:()=>fixture.token,getCurrentUserId:()=>fixture.user,serverId:()=>'${serverId}',serverAddress:()=>fixture.outside?'https://outside.invalid':'http://127.0.0.1:${server.address().port}${base}'};</script>
              <script defer src="cinema-native.js"></script></head><body>
              <header class="MuiAppBar-root"><div class="MuiToolbar-root"><span class="native-tools">
                <button class="native-control" id="native-sync" aria-label="Synchronwiedergabe"><svg data-testid="GroupsIcon"></svg></button>
                <button class="native-control" id="native-cast">Cast</button><button class="native-control" id="native-search">Search</button>
                <button class="native-control" id="native-user" aria-controls="app-user-menu">User</button>
              </span></div></header><main id="settingsPage" class="mainAnimatedPage">Native content</main></body></html>`); return;
        }
        res.writeHead(404); res.end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-background-networking'] });
    for (const base of ['', '/media']) {
        const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
        const page = await context.newPage(), errors = [], external = [];
        const now = Date.now();
        rows = [
            { Id: movieId(1), DateCreated: new Date(now - 1000).toISOString(), Name: '<img src="https://outside.invalid/leak" onerror="window.injected=1">' },
            ...[2, 3, 4, 5, 6].map(i => ({ Id: movieId(i), DateCreated: new Date(now - i * 3600000).toISOString(), Name: 'Recent movie ' + i })),
            { Id: movieId(1), DateCreated: new Date(now - 2000).toISOString(), Name: 'Duplicate' },
            { Id: movieId(7), DateCreated: new Date(now - 5 * 86400000).toISOString(), Name: 'Too old' },
            { Id: movieId(8), DateCreated: new Date(now + 86400000).toISOString(), Name: 'Future movie' },
            { Id: movieId(9), DateCreated: 'invalid', Name: 'Invalid date' },
            { Id: 'https://outside.invalid/not-an-id', DateCreated: new Date(now).toISOString(), Name: 'Invalid id' },
            { Id: movieId(10), DateCreated: new Date(now).toISOString(), Name: 'A series', Type: 'Series' }
        ].map(item => ({ Type: 'Movie', ImageTags: { Thumb: 'fixture' }, ...item }));
        denied = false; hold = false;
        page.on('pageerror', error => errors.push(error.name));
        await context.route('**/*', route => {
            if (new URL(route.request().url()).origin !== origin) { external.push(new URL(route.request().url()).origin); return route.abort(); }
            return route.continue();
        });
        await page.clock.install({ time: now });
        await page.goto(origin + base + '/web/index.html');
        const bell = page.locator('.native-cinema-news-button'), badge = page.locator('.native-cinema-news-badge'), panel = page.getByRole('region', { name: 'Neue Filme' });
        await page.waitForFunction(() => document.querySelector('.native-cinema-news-badge')?.textContent === '5');
        assert.equal(await bell.count(), 1);
        assert.equal(await page.locator('.native-control').count(), 4);
        assert.equal(await bell.locator('svg path').getAttribute('d'), 'M4 17h16l-2-3V9a6 6 0 0 0-12 0v5l-2 3Zm6 3a2 2 0 0 0 4 0M12 1v2');
        note('Original Cinema bell and five unread movies coexist with every native control', base);
        const listRequest = requests.filter(r => r.path === base + '/Items').at(-1), query = new URLSearchParams(listRequest.query);
        assert.equal(listRequest.auth, 'MediaBrowser Token="fixture-token-a"'); assert.equal(query.get('UserId'), userA);
        assert.equal(query.get('Limit'), '5'); assert.equal(query.get('IncludeItemTypes'), 'Movie'); assert.equal(query.get('SortBy'), 'DateCreated');
        assert(!/api_?key|token/i.test(listRequest.query));
        note('News query is user-scoped, newest first and limited to five with header authentication', base);
        await bell.click(); await panel.waitFor();
        const entries = page.locator('.native-cinema-news-item'); assert.equal(await entries.count(), 5);
        assert((await entries.first().textContent()).includes('<img src=')); assert.equal(await page.evaluate(() => window.injected), undefined);
        assert.equal(await page.getByText('Duplicate', { exact: true }).count(), 0); assert.equal(await page.getByText('Too old', { exact: true }).count(), 0);
        assert.equal(await page.getByText('Future movie', { exact: true }).count(), 0); assert.deepEqual(external, []);
        note('Five-day filter removes duplicates, old or future dates, wrong types and unsafe IDs while names stay inert text', base);
        assert(await badge.isHidden());
        const seenKey = 'cinema-news-seen:' + serverId + ':' + userA;
        assert(Number(await page.evaluate(key => localStorage.getItem(key), seenKey)) > 0);
        assert.equal(await bell.getAttribute('aria-expanded'), 'true');
        note('Opening marks the current account seen and clears its unread badge', base);
        await page.keyboard.press('Escape'); assert(await panel.isHidden()); assert(await bell.evaluate(node => document.activeElement === node));
        await bell.press('ArrowDown'); assert(await entries.first().evaluate(node => document.activeElement === node));
        await page.locator('main').click({ position: { x: 10, y: 20 } }); assert(await panel.isHidden());
        note('Escape restores focus, ArrowDown enters the list and outside clicks dismiss it', base);
        await bell.click(); await entries.first().click();
        await page.getByRole('dialog', { name: 'Authorized movie information', exact: true }).waitFor();
        assert(await panel.isHidden()); assert.equal(await page.locator('.native-cinema-original-details').getAttribute('href'), '#/details?id=' + movieId(1));
        await page.keyboard.press('Escape'); await page.clock.runFor(650); await page.locator('.native-cinema-info').waitFor({ state: 'detached' });
        note('A notification opens the existing authorized Cinema information view and original detail link', base);
        await page.reload();
        await page.waitForFunction(() => document.querySelectorAll('.native-cinema-news-item').length === 5);
        assert(await badge.isHidden());
        note('Seen history persists through reload without saving film data or access tokens', base);
        const beforeRequests = requests.filter(r => r.path === base + '/Items').length;
        for (let i = 0; i < 4; i++) { await bell.click(); await bell.click(); }
        assert.equal(requests.filter(r => r.path === base + '/Items').length, beforeRequests);
        const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === base + '/Items');
        await page.clock.fastForward(60000);
        await refreshed;
        assert.equal(requests.filter(r => r.path === base + '/Items').length, beforeRequests + 1);
        note('Repeated opening cannot flood the API and the visible client refreshes once per minute', base);
        rows.unshift({ Id: movieId(30), Type: 'Movie', Name: 'New arrival', ImageTags: { Thumb: 'fixture' }, DateCreated: new Date(await page.evaluate(() => Date.now()) + 1000).toISOString() });
        const arrived = page.waitForResponse(response => new URL(response.url()).pathname === base + '/Items');
        await page.clock.fastForward(60000); await arrived;
        await page.waitForFunction(() => document.querySelector('.native-cinema-news-badge')?.textContent === '1'); assert(await badge.isVisible());
        note('Newly added movies update the red unread count without opening the bell', base);
        await page.evaluate(key => {
            const value = String(Date.now()); localStorage.setItem(key, value);
            dispatchEvent(new StorageEvent('storage', { key, newValue: value, storageArea: localStorage }));
        }, seenKey);
        assert(await badge.isHidden());
        note('A matching cross-tab seen event clears the current account unread count', base);
        await page.evaluate(() => { fixture.hidden = true; });
        const beforeHidden = requests.filter(r => r.path === base + '/Items').length;
        await page.clock.fastForward(60000);
        assert.equal(requests.filter(r => r.path === base + '/Items').length, beforeHidden);
        const visible = page.waitForResponse(response => new URL(response.url()).pathname === base + '/Items');
        await page.evaluate(() => { fixture.hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
        await visible;
        assert.equal(requests.filter(r => r.path === base + '/Items').length, beforeHidden + 1);
        note('Hidden tabs do not poll and becoming visible refreshes the list', base);
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 700 }); await bell.click();
            const rect = await panel.boundingBox(); assert(rect.x >= 15 && rect.x + rect.width <= width - 15);
            await page.keyboard.press('Escape');
        }
        note('Popover remains inside 390 px and 320 px viewports', base);
        await page.setViewportSize({ width: 1100, height: 800 });
        await page.evaluate(() => { const node = document.querySelector('.native-tools'); node.replaceChildren(...[...node.children].filter(child => !child.classList.contains('native-cinema-news')).map(child => child.cloneNode(true))); });
        await page.clock.runFor(150); assert.equal(await bell.count(), 1); assert.equal(await page.locator('.native-cinema-news-panel').count(), 1);
        assert.equal(await page.locator('.native-control').count(), 4);
        note('Replacing a native header remounts exactly one bell without replacing native buttons', base);
        await page.evaluate(({ user, key }) => { fixture.user = user; fixture.token = 'fixture-token-b'; document.dispatchEvent(new Event('visibilitychange')); }, { user: userB, key: seenKey });
        await page.waitForFunction(() => document.querySelector('.native-cinema-news-item')?.textContent.includes('Account B only'));
        assert.equal(await badge.textContent(), '1'); assert.equal(await entries.count(), 1);
        assert.equal(await page.evaluate(key => localStorage.getItem(key.replace('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')), seenKey), null);
        note('Account changes discard prior film rows and use a separate unread history', base);
        denied = true; await page.clock.fastForward(60000);
        await page.waitForFunction(() => document.querySelector('.native-cinema-news-empty')?.textContent.includes('nicht geladen'));
        assert.equal(await entries.count(), 0); assert(await badge.isHidden());
        note('Denied or revoked access removes cached films and shows a loading error', base);
        denied = false; hold = true; await page.clock.fastForward(60000);
        for (let i = 0; i < 50 && !pending.length; i++) await new Promise(resolve => setTimeout(resolve, 10));
        assert(pending.length > 0); const beforeAbort = aborted;
        await page.evaluate(() => { fixture.token = ''; document.dispatchEvent(new Event('visibilitychange')); });
        assert.equal(await bell.count(), 0); assert.equal(await page.locator('.native-cinema-news-panel').count(), 0);
        hold = false; for (const send of pending.splice(0)) send();
        for (let i = 0; i < 50 && aborted === beforeAbort; i++) await new Promise(resolve => setTimeout(resolve, 10));
        assert(aborted > beforeAbort); assert.equal(await entries.count(), 0);
        note('Logout aborts an outstanding query and removes the bell, badge and all film rows', base);
        await page.evaluate(() => { fixture.token = 'fixture-token-a'; fixture.user = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; fixture.outside = true; document.dispatchEvent(new Event('visibilitychange')); });
        await page.clock.runFor(200); assert.equal(await bell.count(), 0); assert.deepEqual(external, []);
        assert(requests.every(r => !/api_?key|token=/i.test(r.query)));
        note('A foreign API origin cannot receive news requests or authentication and request URLs contain no tokens', base);
        const beforeOptOut = requests.filter(r => r.path === base + '/Items').length;
        await page.goto(origin + base + '/web/index.html?cinema=off'); assert.equal(await bell.count(), 0);
        assert.equal(requests.filter(r => r.path === base + '/Items').length, beforeOptOut);
        assert.deepEqual(errors, []); note('Original-mode opt-out adds no bell or notification polling', base);
        await context.close();
    }
    const folder = process.env.CINEMA_REPORT_DIR || path.join(__dirname, '../test-results'); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'cinema-news.json'), JSON.stringify({ completed: true, checks, scope: 'Isolated Chromium; original Cinema notification behavior, account isolation, privacy, root and /media; no NAS credentials or playback' }, null, 2) + '\n');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; }).finally(async () => {
    hold = false; for (const send of pending.splice(0)) send();
    if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
});
