/* Source-derived native toolbar hierarchy, including the app-only Back button.
 * Loopback fixture, production stylesheet, no real server or account data. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.NATIVE_CINEMA_PLAYWRIGHT || 'playwright-core');
const checks = [], folder = path.join(__dirname, '../test-results');
let browser, server, page;
const note = (name, base, width) => { checks.push({ name: `${name} at ${base || '/'} ${width}px`, passed:true }); console.log('PASS ' + checks.at(-1).name); };
const svg = name => `<svg viewBox="0 0 24 24" data-testid="${name}" aria-hidden="true"><path d="${name === 'ArrowBackIcon' || name === 'NavigateBeforeIcon' ? 'm14 6-6 6 6 6' : name === 'NavigateNextIcon' ? 'm10 6 6 6-6 6' : 'M5 7h14M5 12h14M5 17h14'}"/></svg>`;
const icon = (id, image) => `<button id="${id}" class="MuiButtonBase-root MuiIconButton-root MuiIconButton-sizeLarge" aria-label="${id}">${svg(image)}</button>`;
const tool = (id, image, variant) => `<button id="${id}" class="MuiButtonBase-root MuiButton-root MuiButtonGroup-grouped MuiButton-sizeSmall MuiButton-${variant}" aria-label="${id}">${svg(image)}</button>`;
(async () => {
    fs.mkdirSync(folder, { recursive:true });
    server = http.createServer((req, res) => {
        if (req.url.split('?')[0].endsWith('/web/cinema-native.css')) {
            res.writeHead(200, {'Content-Type':'text/css'}); res.end(fs.readFileSync(path.join(__dirname, '../web/cinema-native.css'))); return;
        }
        res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
        res.end(`<!doctype html><html class="native-cinema-enabled" lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
            *{box-sizing:border-box}body{margin:0;background:#141414;color:white;font:16px Arial}button{font:inherit;color:inherit;cursor:pointer}svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2}
            header{position:fixed;inset:0 0 auto;z-index:1100}.MuiToolbar-root{display:flex;align-items:center;flex-wrap:wrap;min-height:48px;padding:0 16px}.MuiIconButton-root{display:inline-flex;justify-content:center;align-items:center;flex-shrink:0;padding:12px;border:0;border-radius:50%;background:transparent}.MuiAvatar-root{display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:red;border-radius:50%}
            .actions-box{display:flex;flex-grow:1;justify-content:flex-end}.user-box{flex-grow:0}.MuiStack-root{display:flex;flex-direction:row;flex-basis:100%;flex-grow:1;margin:8px 0 4px}.MuiStack-root>:not(style)~:not(style){margin-left:8px}.play-box{display:flex;align-items:center;flex-grow:1}.MuiButtonGroup-root{display:inline-flex}.MuiButton-root{display:inline-flex;align-items:center;justify-content:center;min-width:32px;padding:5px 8px;border:0;background:transparent}.MuiChip-root{border-radius:16px;background:#333;padding:9px 12px;font-size:12px;white-space:nowrap}.count-box{display:flex;flex-direction:row-reverse;flex-grow:1;margin-left:8px}.library-title{font-size:22px}.library{padding-bottom:2px}main{padding:240px 16px 40px}.sample-art{height:300px;background:linear-gradient(145deg,#645740,#151515);border-radius:18px}
            @media(min-width:600px){.MuiStack-root{flex-basis:auto;margin-top:4px;justify-content:flex-end}.play-box{flex-grow:0}.count-box{flex-grow:0}}@media(min-width:1200px){.MuiToolbar-root{flex-wrap:nowrap}}
        </style><link rel="stylesheet" href="cinema-native.css"></head><body>
        <header class="MuiAppBar-root"><div class="MuiToolbar-root" id="topbar">
          ${icon('drawer','MenuIcon')}${icon('back','ArrowBackIcon')}
          <div class="MuiBox-root actions-box"><span class="native-cinema-news"><button id="bell" class="native-cinema-news-button" aria-label="bell">${svg('NotificationsIcon')}</button></span>${icon('sync','GroupsIcon')}${icon('cast','CastIcon')}${icon('search','SearchIcon')}</div>
          <div class="MuiBox-root user-box"><button id="profile" style="padding:0" class="MuiButtonBase-root MuiIconButton-root MuiIconButton-sizeLarge" aria-label="profile" aria-controls="app-user-menu"><span class="MuiAvatar-root">P</span></button></div>
        </div><div class="MuiToolbar-root library" id="librarybar">
          <button class="MuiButton-root library-title" aria-label="Library">Movies â–¾</button><div class="MuiBox-root count-box"><span class="MuiChip-root">1-100 of 300</span></div>
          <div class="MuiStack-root" id="library-actions"><div class="MuiBox-root play-box"><div class="MuiButtonGroup-root MuiButtonGroup-horizontal MuiButtonGroup-contained">${tool('play','PlayArrowIcon','contained')}${tool('shuffle','ShuffleIcon','contained')}</div></div>
          <div class="MuiButtonGroup-root MuiButtonGroup-horizontal MuiButtonGroup-text">${tool('filter','FilterAltIcon','text')}${tool('sort','SortByAlphaIcon','text')}${tool('view','ViewModuleIcon','text')}</div>
          <div class="MuiButtonGroup-root MuiButtonGroup-horizontal MuiButtonGroup-text">${tool('previous','NavigateBeforeIcon','text')}${tool('next','NavigateNextIcon','text')}</div></div>
        </div></header><main><div class="sample-art"></div></main>
        <script>window.clicked=[];for(const button of document.querySelectorAll('button'))button.addEventListener('click',()=>clicked.push(button.id||button.getAttribute('aria-label')));</script></body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-background-networking']});
    for (const base of ['', '/media']) {
        const context = await browser.newContext({viewport:{width:360,height:780},isMobile:true,hasTouch:true});
        await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        page = await context.newPage();
        for (const width of [320,360,390]) {
            await page.setViewportSize({width,height:780}); await page.goto(origin + base + '/web/index.html', {waitUntil:'networkidle'});
            const boxes = await page.locator('#topbar button').evaluateAll(nodes => nodes.map(node => {const r=node.getBoundingClientRect();return {id:node.id,x:r.x,y:r.y,right:r.right,height:r.height};}));
            assert.equal(boxes.length,7);
            assert.ok(boxes.every(b=>b.x>=0&&b.right<=width&&Math.abs(b.y-boxes[0].y)<2), 'App Back + bell + profile must fit on one line');
            assert.ok(boxes.every((b,i)=>!i||b.x>=boxes[i-1].right-1), 'Topbar buttons cannot overlap');
            note('app-only Back, bell and all original topbar actions stay on one line',base,width);
            const tools = await page.locator('#library-actions button').evaluateAll(nodes => nodes.map(node=>{const r=node.getBoundingClientRect();return {id:node.id,x:r.x,y:r.y,right:r.right,height:r.height};}));
            assert.equal(tools.length,7);
            assert.ok(tools.every(b=>b.x>=0&&b.right<=width&&Math.abs(b.y-tools[0].y)<2), 'All seven library controls must fit on one line');
            assert.ok((await page.locator('header').boundingBox()).height<=160,'Header must not occupy multiple broken control rows');
            note('library title/count and seven native controls occupy two compact rows',base,width);
            for (const id of ['drawer','back','bell','sync','cast','search','profile','play','shuffle','filter','sort','view','previous','next']) await page.tap('#'+id);
            assert.deepEqual(await page.evaluate(()=>clicked),['drawer','back','bell','sync','cast','search','profile','play','shuffle','filter','sort','view','previous','next']);
            note('visible controls retain separate usable native click targets',base,width);
            if(width===360&&!base)await page.screenshot({path:path.join(folder,'cinema-header-mobile.png')});
            await page.locator('#back').evaluate(node=>{node.hidden=true;node.style.display='none';});await page.locator('#librarybar').evaluate(node=>{node.hidden=true;node.style.display='none';});
            const home = await page.locator('#topbar button:not([hidden])').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().y));
            assert.ok(home.every(y=>Math.abs(y-home[0])<2));
            note('Home without the Back button keeps all header actions on one line',base,width);
        }
        for(const width of [780,1440]) {
            await page.setViewportSize({width,height:900});await page.goto(origin+base+'/web/index.html',{waitUntil:'networkidle'});
            const buttons=await page.locator('#topbar button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return r.y+r.height/2;}));
            assert.ok(buttons.every(y=>Math.abs(y-buttons[0])<2));
            const height=await page.locator('#filter').evaluate(node=>node.getBoundingClientRect().height);assert.equal(height,44);
            note('larger screens keep their existing native icon and tool sizes',base,width);
        }
        await context.close();
    }
    fs.writeFileSync(path.join(folder,'cinema-header.json'),JSON.stringify({passed:true,checks,scope:'Source-derived original MUI toolbar hierarchy; native-app Back button, original button sizes, wrappers and Stack spacing; production CSS in isolated touch Chromium; physical phone not tested'},null,2)+'\n');
})().catch(async error=>{if(page&&!page.isClosed())await page.screenshot({path:path.join(folder,'cinema-header-failure.png')}).catch(()=>{});console.error(error.stack||error);process.exitCode=1;}).finally(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
