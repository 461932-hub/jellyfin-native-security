/* Hero scheduling and the real protected-image queue, including auth changes. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.NATIVE_CINEMA_PLAYWRIGHT || 'playwright-core');
const assets = path.join(__dirname, '../web'), loader = path.join(__dirname, '../server/Jellyfin.Api/Security/Web/image-client.js');
const userA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', userB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', parent = 'cccccccccccccccccccccccccccccccc';
const id = n => n.toString(16).padStart(32, '0'), checks = [], requests = [];
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');
let server, browser, holdCandidates, holdMetadata, holdImages, deniedImage = false;
const pendingCandidates = [], pendingMetadata = [], pendingImages = [];
const note = (name, base) => { checks.push({ name: name + ' at ' + (base || '/'), passed: true }); console.log('PASS ' + name + ' at ' + (base || '/')); };
const item = n => ({ Id: id(n), Name: 'Movie ' + n, Type: 'Movie', CommunityRating: 8.6, DateCreated: '2020-01-01T00:00:00Z', ImageTags: { Thumb: 'fixture' } });
const until = async predicate => { for (let i = 0; i < 100 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 10)); assert(predicate()); };

(async () => {
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://fixture.invalid'), base = url.pathname.startsWith('/media/') ? '/media' : '';
        const auth = req.headers.authorization || '';
        const record = { path: url.pathname, query: url.search, auth }; requests.push(record);
        const allowed = auth === 'MediaBrowser Token="fixture-a"' || auth === 'MediaBrowser Token="fixture-b"';
        if (url.pathname === base + '/MediaSecurity/image-client.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(fs.readFileSync(loader)); return; }
        if (/\/web\/cinema-(native\.(js|css)|boot\.js)$/.test(url.pathname)) {
            const file = path.basename(url.pathname); res.writeHead(200, { 'Content-Type': file.endsWith('.css') ? 'text/css' : 'application/javascript' }); res.end(fs.readFileSync(path.join(assets, file))); return;
        }
        if (url.pathname === base + '/Items') {
            const reply = () => { if (!res.destroyed && !res.writableEnded) { res.writeHead(allowed ? 200 : 401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ Items: allowed ? [item(42)] : [] })); } };
            if (holdCandidates) pendingCandidates.push(reply); else reply(); return;
        }
        if (url.pathname.includes('/Users/') && url.pathname.endsWith('/Items')) {
            const items = (url.searchParams.get('Ids') || '').split(',').filter(Boolean).map(value => item(parseInt(value, 16)));
            const reply = () => { if (!res.destroyed && !res.writableEnded) { res.writeHead(allowed ? 200 : 401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ Items: allowed ? items : [] })); } };
            if (holdMetadata) pendingMetadata.push(reply); else reply(); return;
        }
        if (url.pathname.includes('/Images/')) {
            record.imageId = parseInt(url.pathname.split('/').find(segment => /^[a-f0-9]{32}$/.test(segment)), 16);
            const reply = () => { if (!res.destroyed && !res.writableEnded) { res.writeHead(allowed && !deniedImage ? 200 : 401, { 'Content-Type': allowed && !deniedImage ? 'image/png' : 'text/plain' }); res.end(allowed && !deniedImage ? pixel : 'Unauthorized'); } };
            if (holdImages && record.imageId !== 42) pendingImages.push({ id: record.imageId, reply }); else reply(); return;
        }
        if (url.pathname.endsWith('/web/index.html')) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!doctype html><html><head><script>window.fixture={token:'fixture-a',user:'${userA}',options:[]};
              window.ApiClient={accessToken:()=>fixture.token,getCurrentUserId:()=>fixture.user,serverId:()=>'dddddddddddddddddddddddddddddddd',serverAddress:()=>'http://127.0.0.1:${server.address().port}${base}'};
              const originalFetch=fetch;window.fetch=(url,options)=>{fixture.options.push({path:new URL(url,location.href).pathname,priority:options?.priority});return originalFetch(url,options);};</script>
              <script src="${base}/MediaSecurity/image-client.js"></script><script src="cinema-boot.js"></script><link rel="stylesheet" href="cinema-native.css"><script defer src="cinema-native.js"></script>
              <style>body{margin:0}header{height:64px;position:fixed;inset:0 0 auto;z-index:1100}.MuiToolbar-root{height:64px}.mainAnimatedPage{position:relative;padding-top:64px;min-height:500px}.itemsContainer{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.card{height:130px}.card img{width:100%;height:120px}</style>
              </head><body><header class="MuiAppBar-root"><div class="MuiToolbar-root">Native header</div></header><main id="settingsPage" class="mainAnimatedPage"><div class="itemsContainer"></div></main></body></html>`); return;
        }
        res.writeHead(404); res.end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-background-networking'] });
    for (const base of ['', '/media']) {
        holdCandidates = true; holdMetadata = true; holdImages = true; deniedImage = false;
        const context = await browser.newContext({ viewport: { width: 1400, height: 900 } }), page = await context.newPage(), errors = [], external = [];
        page.on('pageerror', e => errors.push(e.name));
        await context.route('**/*', route => { if (new URL(route.request().url()).origin !== origin) { external.push(route.request().url()); return route.abort(); } return route.continue(); });
        await page.goto(origin + base + '/web/index.html#/settings');
        await page.waitForFunction(() => !document.documentElement.classList.contains('native-cinema-boot'));
        const start = requests.length;
        await page.evaluate(({ parent, base }) => {
            const main = document.querySelector('.mainAnimatedPage'); main.id = 'moviesPage'; location.hash = '/movies?topParentId=' + parent;
            for (let n = 1; n <= 40; n++) {
                const id = n.toString(16).padStart(32, '0'), card = document.createElement('article'); card.className = 'card'; card.dataset.id = id; card.dataset.type = 'Movie';
                card.textContent = 'Poster ' + n; main.querySelector('.itemsContainer').append(card);
            }
        }, { parent, base });
        await page.locator('.native-cinema-featured-placeholder').waitFor({ state: 'visible' });
        await until(() => pendingCandidates.length === 2 && pendingMetadata.length > 0);
        const reserved = await page.locator('.native-cinema-featured-placeholder').boundingBox();
        assert(Math.abs(reserved.height - (900 - 64 - 20)) < 2);
        assert((await page.locator('.card').first().boundingBox()).y >= reserved.y + reserved.height);
        note('Navigation reserves the full hero frame while the candidate query is pending, preventing a late grid jump', base);
        holdCandidates = false; for (const reply of pendingCandidates.splice(0)) reply();
        const hero = page.locator('.native-cinema-hero'); await hero.waitFor();
        await page.waitForFunction(() => document.querySelector('.native-cinema-hero-image')?.naturalWidth > 0);
        assert.equal(await hero.getAttribute('data-native-cinema-featured-id'), id(42));
        assert(holdMetadata && pendingMetadata.length > 0);
        assert.equal(await page.locator('.native-cinema-featured-placeholder').count(), 0);
        assert(Math.abs((await hero.boundingBox()).height - reserved.height) < 2);
        note('The selected hero renders before delayed card metadata and replaces its placeholder without changing height', base);
        holdMetadata = false; for (const reply of pendingMetadata.splice(0)) reply();
        await page.waitForFunction(() => document.querySelector('.mainAnimatedPage')?.dataset.nativeCinemaInitialized === 'true');
        const queueStart = requests.length;
        await page.evaluate(base => {
            for (const card of document.querySelectorAll('.card')) { const image = new Image(); image.src = base + '/Items/' + card.dataset.id + '/Images/Thumb?maxWidth=320'; card.append(image); }
        }, base);
        await until(() => pendingImages.length === 6);
        await page.evaluate(base => {
            const image = document.querySelector('.native-cinema-hero-image'); window.previousHeroBlob = image.src;
            image.src = base + '/Items/' + (42).toString(16).padStart(32, '0') + '/Images/Thumb?maxWidth=1920&quality=90';
        }, base);
        await page.evaluate(base => {
            const image = new Image(); image.id = 'priority-cached'; image.setAttribute('fetchpriority', 'high'); image.src = base + '/Items/' + (15).toString(16).padStart(32, '0') + '/Images/Thumb?maxWidth=320&api_key=unused-fixture-value'; document.body.append(image);
        }, base);
        pendingImages.shift().reply();
        await page.waitForFunction(() => document.querySelector('.native-cinema-hero-image')?.src !== previousHeroBlob && document.querySelector('.native-cinema-hero-image')?.naturalWidth > 0);
        await until(() => pendingImages.some(entry => entry.id === 15));
        const images = requests.slice(queueStart).filter(r => r.imageId);
        assert.equal(images[6].imageId, 42); assert.equal(images[7].imageId, 15);
        assert.equal(await hero.locator('img.native-cinema-hero-image').getAttribute('fetchpriority'), 'high');
        const priority = await page.evaluate(() => fixture.options.find(row => row.path.includes('/' + (42).toString(16).padStart(32, '0') + '/Images/'))?.priority);
        assert.equal(priority, 'high');
        note('A large image bypasses queued film covers after the next free slot and carries a high-priority fetch hint', base);
        pendingImages.find(entry => entry.id === 15).reply();
        await page.waitForFunction(() => document.querySelector('#priority-cached')?.naturalWidth > 0);
        assert.equal(requests.slice(queueStart).filter(r => r.imageId === 15).length, 1);
        assert(images.every(r => r.auth === 'MediaBrowser Token="fixture-a"' && !/api_?key|token=/i.test(r.query)));
        note('An already queued image can gain priority without duplicate fetches or credentials in its address', base);
        holdMetadata = false; for (const reply of pendingMetadata.splice(0)) reply();
        holdImages = false; for (const entry of pendingImages.splice(0)) entry.reply();
        await page.waitForFunction(() => [...document.querySelectorAll('.card img')].every(image => image.naturalWidth > 0));
        await page.evaluate(() => { document.querySelector('.mainAnimatedPage').id = 'settingsPage'; location.hash = '/settings'; });
        await hero.waitFor({ state: 'detached' });
        const beforeReturn = requests.length;
        await page.evaluate(parent => { document.querySelector('.mainAnimatedPage').id = 'moviesPage'; location.hash = '/movies?topParentId=' + parent; }, parent);
        await hero.waitFor(); await page.waitForFunction(() => document.querySelector('.native-cinema-hero-image')?.naturalWidth > 0);
        assert.equal(requests.slice(beforeReturn).filter(r => r.path.endsWith('/Items') && new URLSearchParams(r.query).has('MinCommunityRating')).length, 0);
        assert.equal(requests.slice(beforeReturn).filter(r => r.imageId === 42).length, 0);
        note('Returning to the library reuses its validated candidate pool and protected image cache', base);
        await page.evaluate(() => { document.querySelector('.mainAnimatedPage').id = 'settingsPage'; location.hash = '/settings'; });
        await hero.waitFor({ state: 'detached' });
        holdImages = true;
        const beforeAccount = requests.length;
        await page.evaluate(base => {
            for (let n = 101; n <= 112; n++) { const image = new Image(); image.id = 'old-' + n; image.src = base + '/Items/' + n.toString(16).padStart(32, '0') + '/Images/Thumb?maxWidth=321'; document.body.append(image); }
        }, base);
        await until(() => pendingImages.filter(row => row.id >= 101).length === 6);
        await page.evaluate(({ base, user }) => {
            fixture.token = 'fixture-b'; fixture.user = user; document.dispatchEvent(new Event('visibilitychange'));
            const image = new Image(); image.id = 'new-account'; image.setAttribute('fetchpriority', 'high'); image.src = base + '/Items/' + (200).toString(16).padStart(32, '0') + '/Images/Thumb?maxWidth=322'; document.body.append(image);
        }, { base, user: userB });
        const old = pendingImages.splice(0); holdImages = false; for (const entry of old) entry.reply();
        await page.waitForFunction(() => document.querySelector('#new-account')?.naturalWidth > 0);
        const accountRequests = requests.slice(beforeAccount).filter(r => r.imageId);
        assert.equal(accountRequests.filter(r => r.imageId >= 101 && r.imageId <= 112).length, 6);
        assert.equal(accountRequests.find(r => r.imageId === 200).auth, 'MediaBrowser Token="fixture-b"');
        assert.equal(await page.locator('#old-101').evaluate(image => image.getAttribute('src')), null);
        note('Account changes discard old queued jobs and never apply an old account response to an image', base);
        deniedImage = true;
        await page.evaluate(base => { const image = new Image(); image.id = 'denied'; image.onerror = () => image.dataset.denied = 'true'; image.setAttribute('fetchpriority', 'high'); image.src = base + '/Items/' + (201).toString(16).padStart(32, '0') + '/Images/Thumb?maxWidth=322'; document.body.append(image); }, base);
        await page.waitForFunction(() => document.querySelector('#denied')?.dataset.denied === 'true');
        assert.equal(await page.locator('#denied').evaluate(image => image.naturalWidth), 0);
        assert.equal(await page.locator('#denied').getAttribute('src'), null);
        note('High priority never permits a denied image to load', base);
        assert.deepEqual(errors, []); assert.deepEqual(external, []);
        await context.close();
    }
    const folder = process.env.CINEMA_REPORT_DIR || path.join(__dirname, '../test-results'); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'cinema-loading.json'), JSON.stringify({ completed: true, checks, scope: 'Real image adapter and Chromium; deliberately delayed covers, metadata and queries at / and /media; no NAS credentials or playback' }, null, 2) + '\n');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; }).finally(async () => {
    holdCandidates = holdMetadata = holdImages = false;
    for (const reply of pendingCandidates.splice(0)) reply(); for (const reply of pendingMetadata.splice(0)) reply(); for (const entry of pendingImages.splice(0)) entry.reply();
    if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
});
