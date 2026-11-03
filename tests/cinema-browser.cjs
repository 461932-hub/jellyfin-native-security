/* Isolated browser regressions for native navigation and session isolation. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.NATIVE_CINEMA_PLAYWRIGHT || 'playwright-core');
const assets = path.join(__dirname, '../web');
const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', user = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');
const requests = [], checks = [];
let fixtureMode = 'allowed', server, browser;
const note = name => { checks.push({ name, passed: true }); console.log('PASS ' + name); };

(async () => {
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://fixture.invalid');
        requests.push({ path: url.pathname, query: url.search, auth: req.headers.authorization || '' });
        const base = url.pathname.startsWith('/media/') ? '/media' : '';
        if (url.pathname.endsWith('/web/cinema-native.js') || url.pathname.endsWith('/web/cinema-native.css')) {
            const file = path.basename(url.pathname);
            res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'application/javascript' : 'text/css' });
            res.end(fs.readFileSync(path.join(assets, file))); return;
        }
        if (url.pathname.includes('/Users/') && url.pathname.endsWith('/Items')) {
            const permitted = fixtureMode === 'allowed' && req.headers.authorization === 'MediaBrowser Token="fixture-token"';
            res.writeHead(permitted ? 200 : 403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ Items: permitted ? [{ Id: id, Name: 'Native fixture title', Type: 'Movie',
                Overview: '<img src="https://outside.invalid/leak" onerror="window.injected=1">Safe description',
                ProductionYear: 2026, Genres: ['Drama'], ImageTags: { Thumb: 'fixture' }, BackdropImageTags: ['fixture'] }] : [] })); return;
        }
        if (url.pathname.includes('/Images/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(pixel); return; }
        if (url.pathname.endsWith('/web/index.html')) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<!doctype html><html><head><link rel="stylesheet" href="cinema-native.css">
              <style>body{margin:0}header{background:#444}.MuiToolbar-root{display:flex;align-items:center}.mainAnimatedPage{position:absolute;top:64px;left:0;right:0}.card{position:relative;width:200px;height:120px}.cardImageContainer{position:absolute;inset:0}.cardPadder{height:0;padding-bottom:56.25%}</style>
              <script>window.fixture={token:'fixture-token',user:'${user}',outside:false,plays:0};window.ApiClient={accessToken:()=>fixture.token,getCurrentUserId:()=>fixture.user,serverAddress:()=>fixture.outside?'https://outside.invalid':'${'http://127.0.0.1:' + server.address().port + base}'};</script>
              <script defer src="cinema-native.js"></script></head><body>
              <header class="MuiAppBar-root"><div class="MuiToolbar-root"><a class="MuiButton-root MuiButton-sizeLarge" href="#/">Native Home</a><button id="original-menu">Native menu</button></div></header>
              <div id="indexPage" class="mainAnimatedPage"><div id="homeTab" class="is-active"><div class="itemsContainer">
              <div class="card" data-id="${id}" data-type="Movie"><div class="cardPadder"></div><div class="cardImageContainer"></div><a id="original-details" href="#/details?id=${id}">Details</a><button id="original-play" data-action="play" onclick="fixture.plays++">Native play</button></div>
              </div></div></div></body></html>`); return;
        }
        res.writeHead(404); res.end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-background-networking'] });
    for (const base of ['', '/media']) {
        const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
        const page = await context.newPage(), external = [], errors = [];
        page.on('pageerror', error => errors.push(error.name));
        await context.route('**/*', route => {
            if (new URL(route.request().url()).origin !== origin) { external.push(new URL(route.request().url()).origin); return route.abort(); }
            return route.continue();
        });
        fixtureMode = 'allowed';
        await page.goto(origin + base + '/web/index.html');
        await page.locator('.native-cinema-hero').waitFor();
        await page.waitForFunction(() => document.querySelector('.native-cinema-hero-image')?.naturalWidth > 0);
        assert.equal(await page.evaluate(() => scrollY), 0, 'The asynchronously added preview must not skip the top of the page');
        assert.equal(await page.locator('.native-cinema-hero video,.native-cinema-hero audio').count(), 0);
        assert.equal(await page.locator('.native-cinema-hero-overview').textContent(), 'Safe description');
        assert.deepEqual(external, []); assert.equal(await page.evaluate(() => window.injected), undefined);
        assert.equal(await page.locator('header').evaluate(e => getComputedStyle(e).backgroundColor), 'rgba(0, 0, 0, 0)');
        note('Still-image hero, transparent header and inert metadata at base ' + (base || '/'));
        await page.locator('.native-cinema-primary').click();
        assert.equal(await page.evaluate(() => fixture.plays), 1);
        assert.equal(await page.locator('#original-play').count(), 1);
        assert.equal(await page.locator('.native-cinema-secondary').getAttribute('href'), '#/details?id=' + id);
        note('Hero delegates to the existing native play button and native detail link at ' + (base || '/'));
        const last = requests.findLast(req => req.path === base + '/Users/' + user + '/Items');
        assert.equal(last.auth, 'MediaBrowser Token="fixture-token"');
        assert(requests.every(req => !/[?&](api_?key|token|access_token)=/i.test(req.query)));
        note('Metadata uses same-origin authentication headers with no URL session tokens at ' + (base || '/'));
        await page.setViewportSize({ width: 390, height: 844 });
        const rect = await page.locator('.native-cinema-hero').boundingBox();
        assert(rect.x >= 0 && rect.x + rect.width <= 390);
        const action = await page.locator('.native-cinema-primary').boundingBox(); assert(action.x >= 0 && action.x + action.width <= 390);
        note('Hero and native-play action fit a 390 px viewport at ' + (base || '/'));
        await page.evaluate(() => { fixture.token = ''; document.querySelector('.native-cinema-hero').dispatchEvent(new Event('scroll', { bubbles: true })); });
        await page.locator('.native-cinema-hero').waitFor({ state: 'detached' });
        assert.equal(await page.locator('.native-cinema-art').count(), 0);
        await page.locator('#original-play').click({ force: true }); assert.equal(await page.evaluate(() => fixture.plays), 2);
        note('Logout removes added artwork while preserving original controls at ' + (base || '/'));
        fixtureMode = 'denied';
        await page.evaluate(() => { fixture.token = 'different-fixture-token'; fixture.user = 'cccccccccccccccccccccccccccccccc'; });
        await page.waitForTimeout(1600); assert.equal(await page.locator('.native-cinema-hero').count(), 0);
        assert.equal(await page.locator('#original-details').getAttribute('href'), '#/details?id=' + id);
        note('Denied metadata after an account change falls back to native controls at ' + (base || '/'));
        await page.evaluate(() => { fixture.outside = true; });
        await page.waitForTimeout(1500); assert.deepEqual(external, []); assert.equal(await page.locator('.native-cinema-hero').count(), 0);
        note('A foreign API-server origin cannot receive the session token at ' + (base || '/'));
        await page.goto(origin + base + '/web/index.html?cinema=off');
        assert.equal(await page.locator('.native-cinema-hero').count(), 0);
        assert.equal(await page.locator('html').getAttribute('class'), 'native-cinema-disabled');
        assert.equal(await page.locator('header').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(68, 68, 68)');
        assert.deepEqual(errors, []); note('Original-mode opt-out restores native styling at ' + (base || '/'));
        await context.close();
    }
    const folder = process.env.CINEMA_REPORT_DIR || path.join(__dirname, '../test-results'); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'cinema-browser.json'), JSON.stringify({ completed: true, checks, scope: 'Isolated browser fixtures; root and /media paths, no NAS credentials or media' }, null, 2) + '\n');
})().catch(error => { console.error(error.name + ': ' + error.message); process.exitCode = 1; }).finally(async () => {
    if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
});
