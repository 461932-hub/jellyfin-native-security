/* Native catalogue paging must not reveal the hero again. No real media. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.NATIVE_CINEMA_PLAYWRIGHT || 'playwright-core');
const assets = path.join(__dirname, '../web'), checks = [];
const parent = 'cccccccccccccccccccccccccccccccc', user = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const id = n => n.toString(16).padStart(32, '0');
const item = n => ({ Id: id(n), Name: 'Movie ' + n, Type: 'Movie', CommunityRating: 9, DateCreated: '2020-01-01T00:00:00Z', ImageTags: { Thumb: 'fixture' } });
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');
let server, browser;
const note = (name, base) => { checks.push({ name: name + ' at ' + (base || '/'), passed: true }); console.log('PASS ' + name + ' at ' + (base || '/')); };

(async () => {
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://fixture.invalid'), base = url.pathname.startsWith('/media/') ? '/media' : '';
        if (/\/web\/cinema-(native\.(js|css)|boot\.js)$/.test(url.pathname)) {
            const file = path.basename(url.pathname); res.writeHead(200, { 'Content-Type': file.endsWith('.css') ? 'text/css' : 'application/javascript' }); res.end(fs.readFileSync(path.join(assets, file))); return;
        }
        if (url.pathname === base + '/Items' || url.pathname.endsWith('/Items') && url.pathname.includes('/Users/')) {
            const ids = url.searchParams.get('Ids');
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ Items: ids ? ids.split(',').map(value => item(parseInt(value, 16))) : [item(42)] })); return;
        }
        if (url.pathname.includes('/Images/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(pixel); return; }
        if (url.pathname.endsWith('/web/index.html')) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!doctype html><html><head><script>window.fixture={token:'fixture-a',page:0,calls:0,delay:360,resets:0};
              window.ApiClient={accessToken:()=>fixture.token,getCurrentUserId:()=>'${user}',serverId:()=>'dddddddddddddddddddddddddddddddd',serverAddress:()=>location.origin+'${base}'};</script>
              <script src="cinema-boot.js"></script><link rel="stylesheet" href="cinema-native.css"><script defer src="cinema-native.js"></script>
              <style>body{margin:0}header{height:64px;position:fixed;inset:0 0 auto;z-index:1100}.MuiToolbar-root{height:64px;display:flex;justify-content:flex-end}.mainAnimatedPage{position:relative;padding-top:64px;min-height:600px}.itemsContainer{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.card{height:130px}.cardImageContainer{height:110px}</style>
              </head><body><header class="MuiAppBar-root"><div class="MuiToolbar-root"><button id="prev" title="Previous" disabled><svg data-testid="NavigateBeforeIcon"></svg>Previous</button><button id="next" title="Next"><svg data-testid="NavigateNextIcon"></svg>Next</button></div></header>
              <main id="moviesPage" class="mainAnimatedPage"></main><script>
              window.scrollNode=()=>document.querySelector('#nested-scroll')||document.scrollingElement;
              window.nativeReset=()=>{fixture.resets++;scrollNode().scrollTo({top:0,behavior:'instant'});};
              window.renderCards=()=>{const grid=document.querySelector('.itemsContainer');if(!grid)return;grid.replaceChildren();
                for(let n=1;n<=(fixture.page===2?1:40);n++){const card=document.createElement('article');card.className='card';card.dataset.id=(fixture.page*100+n).toString(16).padStart(32,'0');card.dataset.type='Movie';card.textContent='Movie '+(fixture.page*100+n);grid.append(card);}
                document.querySelector('#prev').disabled=fixture.page===0;document.querySelector('#next').disabled=fixture.page===2;};
              window.mountCatalogue=()=>{const main=document.querySelector('.mainAnimatedPage'),catalog=document.createElement('div');catalog.className='padded-bottom-page';catalog.innerHTML='<div class="itemsContainer"></div>';main.append(catalog);renderCards();};
              window.nativePaging=direction=>{fixture.calls++;fixture.page+=direction;nativeReset();setTimeout(nativeReset,80);
                setTimeout(()=>{renderCards();nativeReset();requestAnimationFrame(nativeReset);},fixture.delay);};
              document.querySelector('#prev').onclick=()=>nativePaging(-1);document.querySelector('#next').onclick=()=>nativePaging(1);
              if(new URL(location.href).searchParams.has('nested')){const box=document.createElement('div');box.id='nested-scroll';Object.assign(box.style,{position:'fixed',inset:'0',overflowY:'auto'});document.body.append(box);box.append(document.querySelector('main'));}
              if(!new URL(location.href).searchParams.has('late'))mountCatalogue();
              </script></body></html>`); return;
        }
        res.writeHead(404); res.end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-background-networking'] });
    for (const base of ['', '/media']) {
        const context = await browser.newContext({ viewport: { width: 1400, height: 900 } }), page = await context.newPage(), errors = [], external = [];
        page.on('pageerror', error => errors.push(error.name));
        await context.route('**/*', route => { if (new URL(route.request().url()).origin !== origin) { external.push(true); return route.abort(); } return route.continue(); });
        const address = origin + base + '/web/index.html', route = '#/movies?topParentId=' + parent;
        const target = () => page.evaluate(() => {
            const scroller=scrollNode(),section=document.querySelector('[data-native-cinema-catalog]'),header=document.querySelector('header');
            return scroller.scrollTop+section.getBoundingClientRect().top-(scroller===document.scrollingElement?0:scroller.getBoundingClientRect().top)-header.getBoundingClientRect().height;
        });
        const at = async value => page.waitForFunction(y => Math.abs(scrollNode().scrollTop-y)<2, value);
        const grid = async (offset=0) => { const y=await target();await page.evaluate(y=>scrollNode().scrollTo({top:y,behavior:'instant'}),y+offset);await at(y+offset); };
        const samples = async () => page.evaluate(() => {
            window.pagingSamples=[];window.stopPagingSamples=false;
            const sample=()=>{const h=document.querySelector('.native-cinema-hero'),header=document.querySelector('header');
                if(h)pagingSamples.push(h.getBoundingClientRect().bottom-header.getBoundingClientRect().bottom);if(!stopPagingSamples)requestAnimationFrame(sample);};requestAnimationFrame(sample);
        });
        const assertPaging = async (button, expected, keyboard=false) => {
            await samples();
            if(keyboard){await page.locator(button).focus();await page.keyboard.press('Enter');}else await page.locator(button).click();
            await page.waitForFunction(expected=>document.querySelector('.card')?.dataset.id===expected,id(expected));
            await page.waitForTimeout(250);
            const positions=await page.evaluate(()=>{stopPagingSamples=true;return pagingSamples;});
            assert(positions.length>4 && Math.max(...positions)<=2,'No painted frame should show the hero again');
            await at(await target());
        };
        await page.goto(address + '?late=1' + route); await page.locator('.native-cinema-hero').waitFor();
        assert.equal(await page.locator('[data-native-cinema-catalog]').count(),0);
        await page.evaluate(()=>mountCatalogue());await page.locator('[data-native-cinema-catalog]').waitFor();
        assert.equal(await page.locator('.native-cinema-hero').evaluate(n=>n.getBoundingClientRect().height),816);
        note('A catalogue mounted after the independently loaded hero still receives responsive sizing and scroll controls',base);
        await grid();await assertPaging('#next',101);
        assert.equal(await page.evaluate(()=>fixture.calls),1);assert(await page.locator('#prev').isEnabled());
        note('Forward paging keeps the first new row visible through synchronous, delayed and post-render native scroll resets without replacing the handler',base);
        await assertPaging('#prev',1,true);assert.equal(await page.evaluate(()=>fixture.calls),2);assert(await page.locator('#prev').isDisabled());
        note('Keyboard activation of Previous keeps the catalogue and original first-page disabled state',base);
        await grid(180);await assertPaging('#next',101);await assertPaging('#next',201);
        assert.equal(await page.locator('.card').count(),1);assert(await page.locator('#next').isDisabled());
        note('Paging from deeper rows returns to the new first row; a short final page also keeps the hero above the viewport',base);
        await page.evaluate(()=>scrollNode().scrollTo({top:0,behavior:'instant'}));await page.locator('#prev').click();
        await page.waitForFunction(()=>document.querySelector('.card')?.dataset.id===(101).toString(16).padStart(32,'0'));await page.waitForTimeout(180);await at(0);
        note('Paging while the hero is visible keeps normal native top-of-page behaviour',base);
        await grid();await page.evaluate(()=>fixture.delay=1200);await page.locator('#prev').click();await page.waitForTimeout(220);
        await page.mouse.move(700,300);await page.mouse.wheel(0,-120);await at(0);await page.waitForTimeout(1400);await at(0);
        note('An explicit upward wheel gesture immediately cancels pending anchoring and can return to the hero',base);
        await grid();await page.locator('#next').click();await page.evaluate(()=>{document.querySelector('main').id='settingsPage';location.hash='/settings';scrollNode().scrollTo({top:0,behavior:'instant'});});
        await page.locator('.native-cinema-hero').waitFor({state:'detached'});await page.waitForTimeout(1400);await at(0);
        note('Leaving the library cancels its pending scroll anchor',base);
        await page.goto(address + '?nested=1' + route);await page.locator('[data-native-cinema-catalog]').waitFor();await grid();await assertPaging('#next',101);
        assert.equal(await page.evaluate(()=>document.scrollingElement.scrollTop),0);
        note('The same paging behaviour works in a nested page scroller without moving the document',base);
        await page.evaluate(()=>fixture.delay=1200);await page.locator('#prev').click();
        await page.evaluate(()=>{fixture.token='';document.dispatchEvent(new Event('visibilitychange'));scrollNode().scrollTo({top:0,behavior:'instant'});});
        await page.locator('.native-cinema-hero').waitFor({state:'detached'});await page.waitForTimeout(1400);await at(0);
        note('Logout destroys the pending anchor along with authenticated artwork',base);
        await page.goto(address + '?cinema=off' + route);await page.locator('.card').first().waitFor();
        assert.equal(await page.locator('[data-native-cinema-catalog]').count(),0);
        await page.evaluate(()=>scrollNode().scrollTo({top:180,behavior:'instant'}));await page.locator('#next').click();await page.waitForTimeout(600);await at(0);
        assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
        note('Opt-out leaves original native paging untouched, with no script errors or foreign requests',base);
        await context.close();
    }
    const folder=process.env.CINEMA_REPORT_DIR||path.join(__dirname,'../test-results');fs.mkdirSync(folder,{recursive:true});
    fs.writeFileSync(path.join(folder,'cinema-pagination.json'),JSON.stringify({completed:true,checks,scope:'Isolated Chromium; original paging handlers, delayed native resets, keyboard, late catalogues, short pages, nested scrolling, user cancellation, navigation, logout and opt-out; root and /media, no real media'},null,2)+'\n');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));});
