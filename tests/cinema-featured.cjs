/* Daily, library-scoped four-star hero selection in Chromium. No real media. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.NATIVE_CINEMA_PLAYWRIGHT || 'playwright-core');
const assets = path.join(__dirname, '../web'), checks = [], requests = [], pending = [];
const userA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', userB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const moviesA = '11111111111111111111111111111111', moviesB = '22222222222222222222222222222222', series = '33333333333333333333333333333333';
const id = i => (0x100 + i).toString(16).padStart(32, '0');
const title = (i, type = 'Movie', extra = {}) => ({ Id: id(i), Type: type, IsFolder: type === 'Series', Name: type + ' ' + i,
    CommunityRating: 8 + i % 3, DateCreated: '2020-01-01T00:00:00Z', ImageTags: { Thumb: 'fixture' }, Overview: 'Information for ' + id(i), ...extra });
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');
let browser, server, pools, hold = false, denied = false, aborted = 0;
const note = (name, base) => { checks.push({ name: name + ' at ' + (base || '/'), passed: true }); console.log('PASS ' + name + ' at ' + (base || '/')); };

(async () => {
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://fixture.invalid'), base = url.pathname.startsWith('/media/') ? '/media' : '';
        const auth = req.headers.authorization || '';
        requests.push({ path: url.pathname, query: url.search, auth });
        const permitted = ['MediaBrowser Token="fixture-a"', 'MediaBrowser Token="fixture-b"'].includes(auth) && !denied;
        if (/\/web\/cinema-(native\.(js|css)|boot\.js)$/.test(url.pathname)) {
            const file = path.basename(url.pathname); res.writeHead(200, { 'Content-Type': file.endsWith('.css') ? 'text/css' : 'application/javascript' }); res.end(fs.readFileSync(path.join(assets, file))); return;
        }
        if (url.pathname === base + '/Items' && url.searchParams.has('MinCommunityRating')) {
            const parent = url.searchParams.get('ParentId'), expectedUser = auth.includes('fixture-a') ? userA : userB;
            const allowed = permitted && url.searchParams.get('UserId') === expectedUser;
            let items = auth.includes('fixture-b') ? [title(80), title(81)] : parent ? pools[parent] || [] : Object.values(pools).flat();
            items = [...items].sort(url.searchParams.get('SortBy') === 'DateCreated'
                ? (a, b) => Date.parse(b.DateCreated) - Date.parse(a.DateCreated) : (a, b) => b.CommunityRating - a.CommunityRating).slice(0, Number(url.searchParams.get('Limit')));
            const reply = () => { if (!res.destroyed) { res.writeHead(allowed ? 200 : 403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ Items: allowed ? items : [] })); } };
            res.once('close', () => { if (!res.writableEnded) aborted++; });
            if (hold) pending.push(reply); else reply(); return;
        }
        if (url.pathname.includes('/Users/') && url.pathname.endsWith('/Items')) {
            res.writeHead(permitted ? 200 : 403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ Items: permitted ? [title(0, 'Movie', { CommunityRating: 3 })] : [] })); return;
        }
        if (/\/Users\/[a-f0-9]{32}\/Items\/[a-f0-9]{32}$/.test(url.pathname)) {
            const wanted = url.pathname.split('/').at(-1), item = Object.values(pools).flat().find(i => i.Id === wanted);
            res.writeHead(permitted && item ? 200 : 403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(item || {})); return;
        }
        if (url.pathname.includes('/Images/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(pixel); return; }
        if (url.pathname.endsWith('/web/index.html')) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!doctype html><html><head><script src="cinema-boot.js"></script><link rel="stylesheet" href="cinema-native.css">
              <style>body{margin:0}header{height:64px;position:fixed;inset:0 0 auto;z-index:1100}.MuiToolbar-root{height:64px}.mainAnimatedPage{position:relative;padding-top:64px}.itemsContainer{height:2600px}.card{height:120px;width:200px}.cardImageContainer{height:100px}</style>
              <script>window.fixture={token:'fixture-a',user:'${userA}',outside:false,hidden:false,played:null,...window.fixtureStart};
              Object.defineProperty(document,'hidden',{configurable:true,get:()=>fixture.hidden});
              window.ApiClient={accessToken:()=>fixture.token,getCurrentUserId:()=>fixture.user,serverId:()=>'ffffffffffffffffffffffffffffffff',serverAddress:()=>fixture.outside?'https://outside.invalid':'http://127.0.0.1:${server.address().port}${base}'};</script>
              <script defer src="cinema-native.js"></script></head><body><header class="MuiAppBar-root"><div class="MuiToolbar-root">Native header</div></header>
              <main id="moviesPage" class="mainAnimatedPage"><section id="homeTab" class="is-active"><div class="itemsContainer"><article class="card" data-id="${id(0)}" data-type="Movie"><div class="cardImageContainer"></div><a href="#/details?id=${id(0)}">Unrated first card</a></article></div></section></main>
              <script>document.querySelector('.itemsContainer').addEventListener('command',e=>{if(e.detail?.command==='play'){fixture.played={id:e.target.dataset.id,folder:e.target.dataset.isfolder};e.preventDefault();}});</script></body></html>`); return;
        }
        res.writeHead(404); res.end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-background-networking'] });
    for (const base of ['', '/media']) {
        pools = { [moviesA]: [title(1), title(2), title(3), title(4), title(5, 'Movie', { CommunityRating: 7.99 }),
            title(6, 'Movie', { IsVirtual: true }), title(7, 'Episode'), title(8, 'Movie', { CommunityRating: null }),
            title(9, 'Movie', { CommunityRating: '9' }), title(10, 'Movie', { DateCreated: 'bad' }),
            title(11, 'Movie', { DateCreated: '2099-01-01T00:00:00Z' }), title(12, 'Movie', { ImageTags: {} })],
            [moviesB]: [title(20), title(21), title(22)], [series]: [title(30, 'Series'), title(31, 'Series')] };
        hold = false; denied = false;
        const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: 'Europe/Berlin' });
        const page = await context.newPage(), errors = [], external = [];
        page.on('pageerror', e => errors.push(e.name));
        await context.route('**/*', route => {
            if (new URL(route.request().url()).origin !== origin) { external.push(new URL(route.request().url()).origin); return route.abort(); }
            return route.continue();
        });
        await page.clock.install({ time: new Date('2026-11-04T12:00:00+01:00') });
        const address = origin + base + '/web/index.html';
        const hero = page.locator('.native-cinema-hero'), selected = () => hero.getAttribute('data-native-cinema-featured-id');
        const advance = async ms => { await page.clock.fastForward(ms); await page.clock.runFor(300); };
        const navigate = async (pageId, hash) => {
            await page.evaluate(({ pageId, hash }) => { document.querySelector('.mainAnimatedPage').id = pageId; location.hash = hash; }, { pageId, hash });
            await page.clock.runFor(300);
        };
        const heroRequests = () => requests.filter(r => r.path === base + '/Items' && new URLSearchParams(r.query).has('MinCommunityRating'));
        await page.goto(address + '#/movies?topParentId=' + moviesA);
        await hero.waitFor(); const initial = await selected();
        assert([1, 2, 3, 4].map(id).includes(initial)); assert.notEqual(initial, id(0));
        assert.equal(await hero.getAttribute('data-native-cinema-featured-library'), moviesA);
        assert((await hero.locator('.native-cinema-hero-meta').textContent()).includes('/ 5'));
        note('Hero uses a real four-to-five-star candidate instead of the first visible grid card', base);
        const first = heroRequests().slice(-2); assert.equal(first.length, 2);
        for (const request of first) {
            const query = new URLSearchParams(request.query); assert.equal(query.get('ParentId'), moviesA); assert.equal(query.get('UserId'), userA);
            assert.equal(query.get('IncludeItemTypes'), 'Movie'); assert.equal(query.get('MinCommunityRating'), '8');
            assert.equal(request.auth, 'MediaBrowser Token="fixture-a"');
        }
        assert.deepEqual(first.map(r => new URLSearchParams(r.query).get('Limit')).sort(), ['16', '64']);
        note('Best-rated and newest-rated queries are bounded, authenticated and restricted to the current library', base);
        await hero.locator('.native-cinema-primary').click();
        assert.deepEqual(await page.evaluate(() => fixture.played), { id: initial, folder: 'false' });
        await hero.locator('.native-cinema-secondary').click(); await page.locator('.native-cinema-info-overview').waitFor();
        assert.equal(await page.locator('.native-cinema-original-details').getAttribute('href'), '#/details?id=' + initial);
        await page.keyboard.press('Escape'); await page.clock.runFor(650); await page.locator('.native-cinema-info').waitFor({ state: 'detached' });
        note('Off-screen selections retain the native play command and existing authorized information view', base);
        await page.reload(); await hero.waitFor(); assert.equal(await selected(), initial);
        const count = heroRequests().length;
        await navigate('moviesPage', '/movies?topParentId=' + moviesA + '&sortBy=Name'); assert.equal(await selected(), initial);
        assert.equal(heroRequests().length, count);
        note('The same day keeps its selection through reload, sorting and repeated native refreshes', base);
        await advance(86400000); await page.waitForFunction(previous => document.querySelector('.native-cinema-hero')?.dataset.nativeCinemaFeaturedId !== previous, initial);
        const tomorrow = await selected(); assert([1, 2, 3, 4].map(id).includes(tomorrow)); assert.notEqual(tomorrow, initial);
        note('The next local calendar day selects a different eligible title', base);
        const newId = id(40); pools[moviesA].push(title(40, 'Movie', { CommunityRating: 8, DateCreated: new Date(await page.evaluate(() => Date.now()) - 1000).toISOString() }));
        const offset = await page.evaluate(() => { scrollTo(0, 1100); return scrollY; });
        await advance(61000); await page.waitForFunction(wanted => document.querySelector('.native-cinema-hero')?.dataset.nativeCinemaFeaturedId === wanted, newId);
        assert(Math.abs(await page.evaluate(() => scrollY) - offset) < 2);
        assert.equal(await hero.locator('.native-cinema-hero-title').textContent(), 'Movie 40');
        assert((await hero.locator('.native-cinema-hero-image').getAttribute('src')).includes('/Items/' + newId + '/Images/'));
        note('A newly added four-star movie takes priority without mixing its picture or moving the catalogue scroll position', base);
        pools[moviesA] = [...Array.from({ length: 70 }, (_, i) => title(100 + i, 'Movie', { CommunityRating: 10 })),
            title(41, 'Movie', { CommunityRating: 8, DateCreated: new Date(await page.evaluate(() => Date.now()) - 1000).toISOString() })];
        await advance(61000); await page.waitForFunction(wanted => document.querySelector('.native-cinema-hero')?.dataset.nativeCinemaFeaturedId === wanted, id(41));
        note('The newest-rated query promotes an eight-of-ten arrival even when 70 older tens exclude it from the best-rated page', base);
        await advance(20000); assert.equal(await selected(), id(41));
        note('There is no timed slideshow or unwanted title change within a day', base);
        await navigate('moviesPage', '/movies?topParentId=' + moviesB);
        await page.waitForFunction(parent => document.querySelector('.native-cinema-hero')?.dataset.nativeCinemaFeaturedLibrary === parent, moviesB);
        assert([20, 21, 22].map(id).includes(await selected()));
        await navigate('tvshowsPage', '/tv?topParentId=' + series);
        await page.waitForFunction(parent => document.querySelector('.native-cinema-hero')?.dataset.nativeCinemaFeaturedLibrary === parent, series);
        assert([30, 31].map(id).includes(await selected()));
        await hero.locator('.native-cinema-primary').click(); assert.equal((await page.evaluate(() => fixture.played)).folder, 'true');
        assert.equal(new URLSearchParams(heroRequests().at(-1).query).get('IncludeItemTypes'), 'Series');
        note('Switching libraries excludes unrelated movies, and series use their own ratings and native folder play command', base);
        await navigate('indexPage', '/home'); await hero.waitFor();
        assert.equal(await hero.getAttribute('data-native-cinema-featured-library'), 'home');
        assert.equal(new URLSearchParams(heroRequests().at(-1).query).get('IncludeItemTypes'), 'Movie,Series');
        assert.equal(new URLSearchParams(heroRequests().at(-1).query).has('ParentId'), false);
        note('Home may feature the current user permitted movies and series across libraries', base);
        await navigate('moviesPage', '/movies?topParentId=https://outside.invalid/wrong'); assert.equal(await hero.count(), 0);
        const invalidCount = heroRequests().length; await advance(2000); assert.equal(heroRequests().length, invalidCount);
        await navigate('moviesPage', '/movies?topParentId=' + moviesA + '&tab=2'); assert.equal(await hero.count(), 0);
        assert.equal(heroRequests().length, invalidCount);
        note('Malformed library IDs and non-catalogue tabs never fall back to another library', base);
        pools[moviesB] = [title(50, 'Movie', { CommunityRating: 7 }), title(51, 'Movie', { CommunityRating: null })];
        await advance(61000); await navigate('moviesPage', '/movies?topParentId=' + moviesB);
        await page.waitForFunction(() => document.querySelector('.mainAnimatedPage')?.dataset.nativeCinemaInitialized === 'true');
        assert.equal(await hero.count(), 0); assert(await page.getByText('Unrated first card').isVisible());
        note('No qualifying title leaves the native catalogue available without silently promoting an unrated film', base);
        await navigate('moviesPage', '/movies?topParentId=' + moviesA); await hero.waitFor();
        await page.evaluate(() => { fixture.hidden = true; }); const hiddenCount = heroRequests().length;
        await advance(120000); assert.equal(heroRequests().length, hiddenCount);
        await page.evaluate(() => { fixture.hidden = false; document.dispatchEvent(new Event('visibilitychange')); }); await page.clock.runFor(300); await hero.waitFor();
        note('Background tabs pause candidate polling and visibility resumes it', base);
        hold = true; await advance(61000);
        for (let i = 0; i < 50 && pending.length < 2; i++) await new Promise(resolve => setTimeout(resolve, 10));
        assert(pending.length >= 2);
        const beforeAbort = aborted;
        await page.evaluate(() => { fixture.user = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'; fixture.token = 'fixture-b'; document.dispatchEvent(new Event('visibilitychange')); });
        for (let i = 0; i < 50 && aborted === beforeAbort; i++) await new Promise(resolve => setTimeout(resolve, 10));
        hold = false; for (const reply of pending.splice(0)) reply();
        await page.clock.runFor(350); await page.waitForFunction(ids => ids.includes(document.querySelector('.native-cinema-hero')?.dataset.nativeCinemaFeaturedId), [id(80), id(81)]);
        assert(heroRequests().slice(-2).every(r => new URLSearchParams(r.query).get('UserId') === userB));
        assert(aborted > beforeAbort);
        note('Account changes abort old queries, discard prior pools and validate a separate daily selection', base);
        denied = true; await advance(61000); await page.waitForFunction(() => !document.querySelector('.native-cinema-hero'));
        note('Denied or revoked candidate access removes an already visible hero', base);
        denied = false; await page.evaluate(() => { fixture.token = ''; document.dispatchEvent(new Event('visibilitychange')); }); assert.equal(await hero.count(), 0);
        const noTokenCount = heroRequests().length; await advance(61000); assert.equal(heroRequests().length, noTokenCount);
        await page.evaluate(() => { fixture.token = 'fixture-a'; fixture.user = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; fixture.outside = true; document.dispatchEvent(new Event('visibilitychange')); });
        await page.clock.runFor(300); assert.equal(await hero.count(), 0); assert.deepEqual(external, []);
        assert(heroRequests().every(r => !/api_?key|token=/i.test(r.query)));
        const history = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('native-cinema-featured:')).map(k => JSON.parse(localStorage.getItem(k))));
        assert(history.every(r => Object.keys(r).sort().join(',') === 'day,id,newestAt'));
        note('Logout and foreign API origins prevent hero requests; local history contains only day, title ID and newest-added timestamp', base);
        await page.goto(address + '?cinema=off#/movies?topParentId=' + moviesA); assert.equal(await hero.count(), 0);
        assert.deepEqual(errors, []); note('Original-mode opt-out disables daily selection', base);
        await context.close();
    }
    const folder = process.env.CINEMA_REPORT_DIR || path.join(__dirname, '../test-results'); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'cinema-featured.json'), JSON.stringify({ completed: true, checks, scope: 'Isolated Chromium; daily four-star library selection, new arrivals, native actions and account boundaries; root and /media, no real media' }, null, 2) + '\n');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; }).finally(async () => {
    hold = false; for (const reply of pending.splice(0)) reply();
    if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
});
