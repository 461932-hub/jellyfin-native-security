/* Native mobile navigation: cached page visibility and lifecycle events.
 * Loopback-only fixture; no real media, accounts or external requests.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.NATIVE_CINEMA_PLAYWRIGHT || 'playwright-core');
const assets = path.join(__dirname, '../web');
const checks = [], requests = [];
const user = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const movies = '11111111111111111111111111111111';
const series = '22222222222222222222222222222222';
const film = { Id: '33333333333333333333333333333333', Name: 'Mobile movie', Type: 'Movie', CommunityRating: 8.8, DateCreated: '2020-01-01T00:00:00Z', ImageTags: { Thumb: 'fixture' }, Overview: 'Movie information' };
const show = { Id: '44444444444444444444444444444444', Name: 'Mobile series', Type: 'Series', IsFolder: true, CommunityRating: 8.6, DateCreated: '2020-01-01T00:00:00Z', ImageTags: { Thumb: 'fixture' }, Overview: 'Series information' };
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');
let server, browser;
const note = (name, base) => { checks.push({ name: name + ' at ' + (base || '/'), passed: true }); console.log('PASS ' + name + ' at ' + (base || '/')); };

(async () => {
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://fixture.invalid');
        const base = url.pathname.startsWith('/media/') ? '/media' : '';
        requests.push({ method: req.method, path: url.pathname, query: url.search, auth: req.headers.authorization || '' });
        if (/\/web\/cinema-(native\.(js|css)|boot\.js)$/.test(url.pathname)) {
            const file = path.basename(url.pathname);
            res.writeHead(200, { 'Content-Type': file.endsWith('.css') ? 'text/css' : 'application/javascript' });
            res.end(fs.readFileSync(path.join(assets, file))); return;
        }
        if (url.pathname === base + '/Items') {
            const parent = url.searchParams.get('ParentId');
            const items = parent === movies ? [film] : parent === series ? [show] : [film, show];
            const permitted = req.headers.authorization === 'MediaBrowser Token="mobile-fixture"';
            res.writeHead(permitted ? 200 : 401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ Items: permitted ? items : [] })); return;
        }
        if (url.pathname.includes('/Users/') && url.pathname.endsWith('/Items')) {
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ Items: [film, show] })); return;
        }
        if (/\/Users\/[a-f0-9]{32}\/Items\/[a-f0-9]{32}$/.test(url.pathname)) {
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(url.pathname.endsWith(film.Id) ? film : show)); return;
        }
        if (url.pathname.includes('/Images/')) {
            res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(pixel); return;
        }
        if (url.pathname.endsWith('/web/index.html')) {
            const card = item => `<article class="card backdropCard" data-id="${item.Id}" data-type="${item.Type}"><div class="cardPadder"></div><div class="cardImageContainer"></div><a href="#/details?id=${item.Id}">${item.Name}</a></article>`;
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script src="cinema-boot.js"></script><link rel="stylesheet" href="cinema-native.css">
              <style>body{margin:0}.hide{display:none!important}header{height:56px;position:fixed;inset:0 0 auto;z-index:1100}.MuiToolbar-root{height:56px;display:flex}.mainAnimatedPage{position:relative;padding-top:56px}.itemsContainer{display:flex;flex-wrap:wrap;min-height:1800px;align-content:flex-start}.card{box-sizing:border-box;width:50%;height:150px;padding:6px}.cardImageContainer{height:100px}.homeSectionsContainer{min-height:1800px}#homeTab .itemsContainer{flex-wrap:nowrap}.native-cinema-hero-image{object-fit:cover}</style>
              <script>window.fixture={token:'mobile-fixture',user:'${user}',plays:0,events:[]};window.ApiClient={accessToken:()=>fixture.token,getCurrentUserId:()=>fixture.user,serverId:()=>'ffffffffffffffffffffffffffffffff',serverAddress:()=>location.origin+'${base}'};</script>
              <script defer src="cinema-native.js"></script></head><body>
              <header class="MuiAppBar-root"><nav class="MuiToolbar-root"><a id="home" href="#/home">Home</a><a id="movies" href="#/movies?topParentId=${movies}">Movies</a><a id="series" href="#/tv?topParentId=${series}">Series</a></nav></header>
              <main id="indexPage" class="mainAnimatedPage"><section id="homeTab" class="is-active"><div class="homeSectionsContainer"><h2>Continue watching</h2><div class="itemsContainer">${card(film)}${card(show)}</div></div></section></main>
              <main id="moviesPage" class="mainAnimatedPage hide"><div class="itemsContainer">${card(film).repeat(4)}</div></main>
              <main id="tvshowsPage" class="mainAnimatedPage hide"><div class="itemsContainer">${card(show).repeat(4)}</div></main>
              <script>
                fixture.navigate=(route,pageId,events=true)=>{
                  history.pushState({},'',route);
                  document.querySelectorAll('.mainAnimatedPage').forEach(page=>page.classList.toggle('hide',page.id!==pageId));
                  if(events)for(const type of ['viewbeforeshow','pagebeforeshow','viewshow','pageshow'])document.getElementById(pageId).dispatchEvent(new CustomEvent(type,{bubbles:true,detail:{isRestored:true}}));
                };
                for(const [button,id]of [['home','indexPage'],['movies','moviesPage'],['series','tvshowsPage']])document.getElementById(button).addEventListener('click',e=>{e.preventDefault();fixture.navigate(e.currentTarget.getAttribute('href'),id);});
                document.addEventListener('command',e=>{if(e.detail?.command==='play'){fixture.plays++;e.preventDefault();}});
              </script></body></html>`); return;
        }
        res.writeHead(404); res.end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-background-networking'] });
    for (const base of ['', '/media']) {
        const context = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: 'Europe/Berlin' });
        const page = await context.newPage(), errors = [], external = [];
        page.on('pageerror', error => errors.push(error.name));
        await context.route('**/*', route => {
            if (new URL(route.request().url()).origin !== origin) { external.push(route.request().url()); return route.abort(); }
            return route.continue();
        });
        await page.goto(origin + base + '/web/index.html#/home');
        await page.locator('#indexPage .native-cinema-hero').waitFor({ state: 'visible' });
        note('phone home keeps its full-height hero', base);
        const homeCards = await page.locator('#homeTab .card').evaluateAll(nodes => nodes.map(node => {
            const box = node.getBoundingClientRect(); return { x: box.x, y: box.y };
        }));
        assert.ok(Math.abs(homeCards[0].y - homeCards[1].y) < 2 && homeCards[1].x > homeCards[0].x, 'Home must keep its horizontal rails');
        note('the Home layout keeps its horizontal rows', base);
        await page.tap('#movies');
        await page.locator('#moviesPage .native-cinema-hero').waitFor({ state: 'visible', timeout: 4500 });
        assert.equal(await page.locator('#moviesPage .native-cinema-hero').getAttribute('data-native-cinema-featured-id'), film.Id);
        assert.equal(await page.locator('#indexPage .native-cinema-hero').count(), 0);
        note('native cached movie-page lifecycle refreshes the correct library hero', base);
        await page.tap('#series');
        await page.locator('#tvshowsPage .native-cinema-hero').waitFor({ state: 'visible', timeout: 4500 });
        assert.equal(await page.locator('#tvshowsPage .native-cinema-hero').getAttribute('data-native-cinema-featured-id'), show.Id);
        note('native cached series-page lifecycle refreshes its own hero', base);
        const box = await page.locator('#tvshowsPage .native-cinema-hero').boundingBox();
        assert.ok(box.height > 600 && box.width <= 360 && box.x >= 0, 'mobile hero must retain its viewport-sized layout');
        note('library hero fits phone viewport without horizontal overflow', base);
        await page.tap('#home');
        await page.locator('#indexPage .native-cinema-hero').waitFor({ state: 'visible', timeout: 4500 });
        note('return to cached home restores its hero and original rows', base);
        await page.evaluate(({ movies }) => fixture.navigate('#/movies?topParentId=' + movies, 'moviesPage', false), { movies });
        await page.locator('#moviesPage .native-cinema-hero').waitFor({ state: 'visible', timeout: 4500 });
        note('visibility-only cached page restoration also refreshes', base);
        const cards = await page.locator('#moviesPage .card').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width }; }));
        assert.equal(cards.length, 4);
        assert.ok(Math.abs(cards[0].y - cards[1].y) < 2 && cards[1].x > cards[0].x
            && cards[2].y > cards[0].y && Math.abs(cards[2].y - cards[3].y) < 2
            && Math.abs(cards[2].x - cards[0].x) < 2,
            'phone library cards must form two columns and wrap further cards below');
        note('phone movie library shows two cards per row and further cards below', base);
        for (const width of [320, 390]) {
            await page.setViewportSize({ width, height: 780 });
            const layout = await page.locator('#moviesPage > .itemsContainer > .card').evaluateAll(nodes => nodes.map(node => {
                const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, right: rect.right, width: rect.width };
            }));
            assert.ok(Math.abs(layout[0].y - layout[1].y) < 2 && layout[2].y > layout[0].y
                && layout.every(box => box.x >= 0 && box.right <= width + 1 && box.width >= width / 2 - 20 && box.width <= width / 2 + 1));
        }
        await page.setViewportSize({ width: 360, height: 780 });
        note('narrow and wider phone libraries fit without clipped neighbouring cards', base);
        const otherLayouts = await page.evaluate(({ id }) => {
            const library = document.getElementById('moviesPage');
            const rail = document.createElement('section');
            const card = `<article class="card overflowBackdropCard" data-type="Movie" data-id="${id}" style="min-width:200px;margin-right:12px">Movie</article>`;
            rail.innerHTML = `<div class="emby-scroller"><div class="itemsContainer" style="white-space:nowrap;flex-wrap:nowrap">${card.repeat(4)}</div></div>`;
            library.append(rail);
            const cards = [...rail.querySelectorAll('.card')].map(node => node.getBoundingClientRect());
            const twoColumns = Math.abs(cards[0].y - cards[1].y) < 2 && cards[1].x > cards[0].x
                && cards[2].y > cards[0].y && Math.abs(cards[2].y - cards[3].y) < 2
                && cards.every(box => box.right <= innerWidth + 1);
            const list = document.createElement('div'); list.className = 'itemsContainer vertical-list';
            list.innerHTML = '<article class="card" data-type="Movie">List entry</article>';
            library.append(list);
            const listDirection = getComputedStyle(list).flexDirection;
            const people = document.createElement('div'); people.className = 'itemsContainer';
            people.innerHTML = '<article class="card" data-type="Person">Person</article><article class="card" data-type="Person">Person</article>';
            library.append(people);
            const peopleDirection = getComputedStyle(people).flexDirection;
            rail.remove(); list.remove(); people.remove();
            return { twoColumns, listDirection, peopleDirection };
        }, { id: film.Id });
        assert.deepEqual(otherLayouts, { twoColumns: true, listDirection: 'row', peopleDirection: 'row' });
        note('library media rails wrap into two columns while explicit list and people layouts stay native', base);
        await page.evaluate(() => {
            for (const node of document.querySelectorAll('.mainAnimatedPage')) {
                node.style.display = node.id === 'moviesPage' ? 'block' : 'none';
                node.classList.remove('hide');
            }
        });
        await page.waitForTimeout(250);
        await page.evaluate(({ series }) => {
            history.pushState({}, '', '#/tv?topParentId=' + series);
            for (const node of document.querySelectorAll('.mainAnimatedPage')) node.style.display = node.id === 'tvshowsPage' ? 'block' : 'none';
        }, { series });
        await page.locator('#tvshowsPage .native-cinema-hero').waitFor({ state: 'visible', timeout: 4500 });
        const seriesRows = await page.locator('#tvshowsPage > .itemsContainer > .card').evaluateAll(nodes => nodes.map(node => node.offsetTop));
        assert.ok(seriesRows[0] === seriesRows[1] && seriesRows[2] > seriesRows[0] && seriesRows[2] === seriesRows[3]);
        note('inline display restoration refreshes without replacing page children', base);
        await page.evaluate(() => {
            for (const node of document.querySelectorAll('.mainAnimatedPage')) {
                node.hidden = node.id !== 'tvshowsPage'; node.style.display = '';
            }
        });
        await page.waitForTimeout(250);
        await page.evaluate(() => {
            history.pushState({}, '', '#/home');
            for (const node of document.querySelectorAll('.mainAnimatedPage')) node.hidden = node.id !== 'indexPage';
        });
        await page.locator('#indexPage .native-cinema-hero').waitFor({ state: 'visible', timeout: 4500 });
        note('hidden-attribute restoration also rebuilds the home hero', base);
        await page.evaluate(() => { history.pushState({}, '', '#/home?tab=1'); document.getElementById('homeTab').classList.remove('is-active'); });
        await page.waitForFunction(() => !document.querySelector('.native-cinema-hero'));
        await page.evaluate(() => { history.pushState({}, '', '#/home?tab=0'); document.getElementById('homeTab').classList.add('is-active'); });
        await page.locator('#indexPage .native-cinema-hero').waitFor({ state: 'visible', timeout: 4500 });
        note('cached Home/Favorites tab changes restore only the appropriate hero', base);
        await page.evaluate(({ movies }) => {
            history.pushState({}, '', '#/movies?topParentId=' + movies);
            const node = document.getElementById('moviesPage'); node.hidden = false;
            node.dispatchEvent(new CustomEvent('pageshow', { bubbles: true }));
        }, { movies });
        await page.locator('#moviesPage .native-cinema-hero').waitFor({ state: 'visible', timeout: 4500 });
        assert.equal(await page.locator('#indexPage').evaluate(node => !node.hidden && getComputedStyle(node).display !== 'none'), true);
        assert.equal(await page.locator('#indexPage .native-cinema-hero').count(), 0);
        await page.evaluate(() => { document.getElementById('indexPage').hidden = true; });
        note('the newly shown native library takes priority during overlapping transitions', base);
        await page.setViewportSize({ width: 780, height: 360 });
        await page.waitForTimeout(250);
        const landscape = await page.locator('#moviesPage .native-cinema-hero').boundingBox();
        assert.ok(landscape.width <= 780 && landscape.height < 360, 'landscape hero must resize to the available viewport');
        note('phone rotation preserves the same library and responsive hero', base);
        await page.setViewportSize({ width: 1440, height: 900 });
        const desktop = await page.locator('#moviesPage > .itemsContainer > .card').evaluateAll(nodes => nodes.map(node => {
            const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width };
        }));
        assert.ok(Math.abs(desktop[1].y - desktop[0].y) < 2 && desktop[1].x > desktop[0].x && desktop[0].width < 300);
        note('desktop returns to the original multi-column library grid', base);
        assert.ok(requests.filter(request => request.path === base + '/Items' && new URLSearchParams(request.query).has('MinCommunityRating')).every(request => request.auth === 'MediaBrowser Token="mobile-fixture"'));
        assert.ok(requests.every(request => !/[?&](api_key|apikey|token)=/i.test(request.query)));
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        note('mobile navigation keeps header authentication and no external requests', base);
        await context.close();
    }
})().then(() => {
    fs.mkdirSync(path.join(__dirname, '../test-results'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../test-results/cinema-mobile.json'), JSON.stringify({ checks, passed: checks.length, fixture: 'isolated mobile Chromium; native lifecycle and cached visibility modeled; no physical phone tested' }, null, 2));
}).catch(error => { console.error(error.stack || error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });
