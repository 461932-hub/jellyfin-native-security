/* Isolated browser regressions for native navigation and session isolation. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.NATIVE_CINEMA_PLAYWRIGHT || 'playwright-core');
const assets = path.join(__dirname, '../web');
const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', user = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const neighborId = '99999999999999999999999999999999';
const mixedRowItems = [
    {Id:'11111111111111111111111111111111',Type:'Series',ImageTags:{Thumb:'fixture'}},
    {Id:'22222222222222222222222222222222',Type:'Episode',ImageTags:{Primary:'fixture'},ParentThumbItemId:'11111111111111111111111111111111'},
    {Id:'33333333333333333333333333333333',Type:'Season',ImageTags:{Thumb:'fixture',Primary:'fixture'}},
    {Id:'44444444444444444444444444444444',Type:'Season',ImageTags:{Primary:'fixture'},ParentThumbItemId:'11111111111111111111111111111111'},
    {Id:'55555555555555555555555555555555',Type:'Season',ImageTags:{Primary:'fixture'},ParentBackdropItemId:'11111111111111111111111111111111'},
    {Id:'66666666666666666666666666666666',Type:'Season',ImageTags:{Primary:'fixture'},ParentThumbItemId:'https://outside.invalid/not-an-item'},
    {Id:'77777777777777777777777777777777',Type:'MusicAlbum',ImageTags:{Primary:'fixture'}}
].map(item=>({Name:'Mixed '+item.Type,...item}));
const batchMovieItems=Array.from({length:42},(_,i)=>({Id:(0x10000+i).toString(16).padStart(32,'0'),
    Type:'Movie',Name:'Batch movie '+i,ImageTags:{Primary:'poster',Thumb:'thumbnail'}}));
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');
const requests = [], checks = [];
let fixtureMode = 'allowed', seriesInformation = false, server, browser, diagnosticPage;
let holdInitialMetadata = false;
const pendingMetadata = [];
let holdSeasonCounts=false,activeSeasonCounts=0,maxSeasonCounts=0;
const pendingSeasonCounts=[];
const note = name => { checks.push({ name, passed: true }); console.log('PASS ' + name); };

(async () => {
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://fixture.invalid');
        requests.push({ path: url.pathname, query: url.search, auth: req.headers.authorization || '' });
        const base = url.pathname.startsWith('/media/') ? '/media' : '';
        if (url.pathname.endsWith('/web/cinema-logo.png')) {
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(fs.readFileSync(path.join(assets, 'cinema-logo.png'))); return;
        }
        if (/\/web\/cinema-(native\.(js|css)|boot\.js)$/.test(url.pathname)) {
            const file = path.basename(url.pathname);
            res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'text/css; charset=utf-8' });
            res.end(fs.readFileSync(path.join(assets, file))); return;
        }
        if (url.pathname === base + '/Items' && url.searchParams.has('MinCommunityRating')) {
            const permitted = fixtureMode === 'allowed' && req.headers.authorization === 'MediaBrowser Token="fixture-token"';
            res.writeHead(permitted ? 200 : 403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ Items: permitted ? [{ Id: id, Name: 'Native fixture title',
                Type: url.searchParams.get('IncludeItemTypes') === 'Series' ? 'Series' : 'Movie',
                CommunityRating: 9, DateCreated: '2020-01-01T00:00:00Z',
                Overview: '<img src="https://outside.invalid/leak" onerror="window.injected=1">Safe description',
                ProductionYear: 2026, Genres: ['Drama'], ImageTags: { Thumb: 'fixture' }, BackdropImageTags: ['fixture'] }] : [] })); return;
        }
        if (url.pathname.includes('/Users/') && url.pathname.endsWith('/Items')) {
            const permitted = fixtureMode === 'allowed' && req.headers.authorization === 'MediaBrowser Token="fixture-token"';
            res.writeHead(permitted ? 200 : 403, { 'Content-Type': 'application/json' });
            const knownIds=[id,neighborId,...mixedRowItems.map(item=>item.Id),...batchMovieItems.map(item=>item.Id)];
            const selected = (url.searchParams.get('Ids') || id).split(',').filter(value => knownIds.includes(value));
            const send = () => res.end(JSON.stringify({ Items: permitted ? selected.map(value => mixedRowItems.find(item=>item.Id===value) || batchMovieItems.find(item=>item.Id===value) || ({ Id: value,
                Name: value === id ? 'Native fixture title' : 'Neighbor fixture title', Type: 'Movie',
                Overview: '<img src="https://outside.invalid/leak" onerror="window.injected=1">Safe description',
                ProductionYear: 2026, Genres: ['Drama'], ImageTags: { Thumb: 'fixture' }, BackdropImageTags: ['fixture'] })) : [] }));
            if (holdInitialMetadata) pendingMetadata.push(send);
            else setTimeout(send, 250);
            return;
        }
        if (url.pathname.endsWith('/Items/' + id)) {
            const permitted = fixtureMode === 'allowed' && req.headers.authorization === 'MediaBrowser Token="fixture-token"';
            res.writeHead(permitted ? 200 : 403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(permitted ? { Id: id, Name: 'Native fixture title', Type: seriesInformation ? 'Series' : 'Movie', Overview: 'Full movie information', Genres: ['Drama'], People: [{Name:'Fixture Actor',Type:'Actor'}], ProductionYear: 2026, BackdropImageTags: ['fixture'] } : {})); return;
        }
        if (url.pathname.endsWith('/Shows/' + id + '/Seasons')) {
            res.writeHead(200, {'Content-Type':'application/json'});res.end(JSON.stringify({Items:[
                {Id:'dddddddddddddddddddddddddddddddd',Name:'Staffel 1',ChildCount:999},
                {Id:'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',Name:'Staffel 2'},
                {Id:'00000000000000000000000000000001',Name:'Extras'},
                {Id:'88888888888888888888888888888888',Name:'Staffel 3'}]}));return;
        }
        if (url.pathname.endsWith('/Shows/' + id + '/Episodes')) {
            const season=url.searchParams.get('seasonId')||'';
            const totals={'':50,'dddddddddddddddddddddddddddddddd':47,'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee':1,
                '00000000000000000000000000000001':0,'88888888888888888888888888888888':2};
            if(url.searchParams.get('limit')==='0'){
                activeSeasonCounts++;maxSeasonCounts=Math.max(maxSeasonCounts,activeSeasonCounts);let ended=false;
                const done=()=>{if(!ended){ended=true;activeSeasonCounts--;}};res.once('close',done);
                const reply=()=>{if(!res.destroyed){res.writeHead(season==='88888888888888888888888888888888'?503:200,{'Content-Type':'application/json'});res.end(JSON.stringify({Items:[],TotalRecordCount:totals[season]}));}done();};
                if(holdSeasonCounts)pendingSeasonCounts.push(reply);else setTimeout(reply,120);return;
            }
            res.writeHead(200, {'Content-Type':'application/json'});res.end(JSON.stringify({Items:totals[season]?[{Id:'ffffffffffffffffffffffffffffffff',Name:season==='eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'?'Second season episode':'First season episode',Type:'Episode',IndexNumber:1}]:[],TotalRecordCount:totals[season]}));return;
        }
        if (url.pathname.includes('/Images/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(pixel); return; }
        if (url.pathname.endsWith('/web/index.html')) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!doctype html><html><head><script src="cinema-boot.js"></script><link rel="stylesheet" href="cinema-native.css">
              <style>body{margin:0}header{background:#444;position:fixed;inset:0 0 auto;z-index:1100}.MuiToolbar-root{display:flex;align-items:center}.mainAnimatedPage{position:absolute;top:64px;left:0;right:0}.card{position:relative;width:200px;height:120px}.cardImageContainer{position:absolute;inset:0}.cardPadder{height:0;padding-bottom:56.25%}</style>
              <script>window.fixture={token:'fixture-token',user:'${user}',outside:false,plays:0};window.ApiClient={accessToken:()=>fixture.token,getCurrentUserId:()=>fixture.user,serverId:()=> 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',serverAddress:()=>fixture.outside?'https://outside.invalid':'${'http://127.0.0.1:' + server.address().port + base}'};</script>
              <script defer src="cinema-native.js"></script></head><body>
              <div class="skinHeader" hidden></div><header class="MuiAppBar-root"><div class="MuiToolbar-root"><a class="MuiButton-root MuiButton-sizeLarge" href="#/">Native Home</a><button id="original-menu">Native menu</button></div></header>
              <div id="indexPage" class="mainAnimatedPage"><div id="homeTab" class="is-active"><div class="itemsContainer">
              <div class="card" data-id="${id}" data-type="Movie"><div class="cardPadder"></div><div class="cardImageContainer"></div><a id="original-details" href="#/details?id=${id}">Details</a><button id="original-play" data-action="play" onclick="fixture.plays++">Native play</button></div>
              </div></div></div><script>if(location.hash.startsWith('#/tv')||location.hash.startsWith('#/movies')){document.querySelector('.mainAnimatedPage').id=location.hash.startsWith('#/tv')?'tvshowsPage':'moviesPage';document.querySelector('.card').classList.add('backdropCard');window.initialNativeGridRatio=document.querySelector('.card').getBoundingClientRect().width/document.querySelector('.mainAnimatedPage').getBoundingClientRect().width;}</script></body></html>`); return;
        }
        res.writeHead(404); res.end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-background-networking'] });
    for (const base of ['', '/media']) {
        const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
        const page = await context.newPage(), external = [], errors = [];
        diagnosticPage = page;
        page.on('pageerror', error => errors.push(error.name));
        await context.route('**/*', route => {
            if (new URL(route.request().url()).origin !== origin) { external.push(new URL(route.request().url()).origin); return route.abort(); }
            return route.continue();
        });
        fixtureMode = 'allowed'; holdInitialMetadata = true;
        await page.goto(origin + base + '/web/index.html', {waitUntil:'domcontentloaded'});
        assert.equal(await page.locator('html').evaluate(node=>node.classList.contains('native-cinema-boot')), true);
        assert.equal(await page.locator('#indexPage').evaluate(node=>getComputedStyle(node).visibility), 'hidden');
        holdInitialMetadata = false;
        for (const send of pendingMetadata.splice(0)) send();
        await page.locator('.native-cinema-hero').waitFor();
        await page.waitForFunction(()=>!document.documentElement.classList.contains('native-cinema-boot'));
        note('Cinema entry reserves the view and never exposes an unprepared original page at ' + (base || '/'));
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
        const sourceRect = await page.locator('.card').boundingBox();
        await page.locator('.card').hover(); await page.locator('.native-cinema-hover').waitFor({state:'visible'});
        await page.locator('.native-cinema-hover').evaluate(node=>Promise.all(node.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))));
        const expanded = await page.locator('.native-cinema-hover').boundingBox();
        assert(expanded.width > sourceRect.width * 1.3);
        assert.equal(await page.locator('.native-cinema-hover').evaluate(node=>node.parentElement===document.body),true);
        assert.equal((await page.locator('.card').boundingBox()).width,sourceRect.width);
        note('Floating hover expands without resizing or clipping the native row at ' + (base || '/'));
        await page.mouse.move(5, 5);
        await page.locator('.native-cinema-hover.is-closing').waitFor({state:'visible'});
        assert.equal(await page.locator('.native-cinema-hover.is-closing').evaluate(node=>node.inert),true);
        await page.locator('.native-cinema-hover').waitFor({state:'detached'});
        await page.locator('.card').hover(); await page.locator('.native-cinema-hover:not(.is-closing)').waitFor({state:'visible'});
        assert.equal(await page.locator('.native-cinema-hover:not(.is-closing)').count(),1);
        note('Small preview shrinks before removal and reopens with a single active card at ' + (base || '/'));
        await page.locator('.native-cinema-hover').getByRole('button',{name:'Mehr Infos',exact:true}).click();
        await page.getByRole('dialog',{name:'Native fixture title',exact:true}).waitFor();
        assert.equal(await page.locator('.native-cinema-info-overview').textContent(),'Full movie information');
        assert.equal(await page.locator('.native-cinema-info video,.native-cinema-info audio').count(),0);
        assert.equal(await page.locator('.native-cinema-original-details').getAttribute('href'),'#/details?id='+id);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.native-cinema-info').evaluate(node=>node.open&&node.inert&&node.classList.contains('is-closing')),true);
        await page.locator('.native-cinema-info').waitFor({state:'detached'});
        note('Large preview remains visible and inert until its return animation completes at ' + (base || '/'));
        note('Cinema information window loads authorized details and closes with Escape at ' + (base || '/'));
        await page.locator('#original-details').dispatchEvent('click');
        await page.getByRole('dialog',{name:'Native fixture title',exact:true}).waitFor();
        assert.equal(new URL(page.url()).hash,'');
        await page.getByRole('button',{name:'Schließen',exact:true}).click();
        note('Normal card clicks open information while the original detail link remains available at ' + (base || '/'));
        seriesInformation = true;maxSeasonCounts=0;
        await page.locator('#original-details').dispatchEvent('click');
        const seasonSelect=page.getByLabel('Staffel',{exact:true});await seasonSelect.waitFor({state:'visible'});
        await page.waitForFunction(()=>document.querySelector('.native-cinema-season option[value="dddddddddddddddddddddddddddddddd"]')?.textContent.includes('47 Folgen'));
        const countSuffix=(name,count)=>name+' '+String.fromCharCode(183)+' '+count+(count===1?' Folge':' Folgen');
        assert.equal(await seasonSelect.locator('option[value=""]').textContent(),countSuffix('Alle Staffeln',50));
        assert.equal(await seasonSelect.locator('option[value="eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"]').textContent(),countSuffix('Staffel 2',1));
        assert.equal(await seasonSelect.locator('option[value="00000000000000000000000000000001"]').textContent(),countSuffix('Extras',0));
        await seasonSelect.selectOption('00000000000000000000000000000001');
        await page.waitForFunction(()=>document.querySelectorAll('.native-cinema-episode').length===0);
        assert.equal(await seasonSelect.locator('option[value="88888888888888888888888888888888"]').textContent(),'Staffel 3');
        await seasonSelect.selectOption('88888888888888888888888888888888');
        await page.waitForFunction(()=>document.querySelector('.native-cinema-season option[value="88888888888888888888888888888888"]')?.textContent.includes('2 Folgen'));
        assert(maxSeasonCounts<=3);
        note('Season labels use full user-visible totals, singular and zero forms, and recover a failed count from the selected episode page at ' + (base || '/'));
        await seasonSelect.selectOption('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
        const episode=page.getByRole('button',{name:/Second season episode/});await episode.waitFor();
        await page.evaluate(()=>document.querySelector('.itemsContainer').addEventListener('command',event=>{if(event.detail?.command==='play'){fixture.plays++;event.preventDefault();}}));
        await episode.click();await page.locator('.native-cinema-info').waitFor({state:'detached'});
        assert.equal(await page.evaluate(()=>fixture.plays),2);
        note('Series information loads seasons and episodes and delegates episode play to native commands at ' + (base || '/'));
        const heldStart=requests.length;holdSeasonCounts=true;
        await page.locator('#original-details').dispatchEvent('click');await seasonSelect.waitFor({state:'visible'});
        for(let i=0;i<50&&pendingSeasonCounts.length<3;i++)await page.waitForTimeout(20);
        assert.equal(pendingSeasonCounts.length,3);
        await page.keyboard.press('Escape');await page.locator('.native-cinema-info').waitFor({state:'detached'});
        seriesInformation=false;await page.locator('#original-details').dispatchEvent('click');await page.locator('.native-cinema-info-overview').waitFor({state:'visible'});
        holdSeasonCounts=false;for(const reply of pendingSeasonCounts.splice(0))reply();await page.waitForTimeout(150);
        assert.equal(await page.locator('.native-cinema-season').count(),0);
        assert.equal(requests.slice(heldStart).filter(request=>request.path.endsWith('/Shows/'+id+'/Episodes')&&new URLSearchParams(request.query).get('limit')==='0').length,3);
        await page.keyboard.press('Escape');await page.locator('.native-cinema-info').waitFor({state:'detached'});
        note('Closing the series dialog aborts its bounded count workers and prevents late results entering a different title at ' + (base || '/'));
        await page.setViewportSize({ width: 390, height: 844 });
        const rect = await page.locator('.native-cinema-hero').boundingBox();
        assert(rect.x >= 0 && rect.x + rect.width <= 390);
        const action = await page.locator('.native-cinema-primary').boundingBox(); assert(action.x >= 0 && action.x + action.width <= 390);
        note('Hero and native-play action fit a 390 px viewport at ' + (base || '/'));
        await page.locator('#original-details').dispatchEvent('click');await page.locator('.native-cinema-info').waitFor({state:'visible'});
        await page.keyboard.press('Escape');
        await page.evaluate(() => { fixture.token = ''; document.querySelector('.native-cinema-hero').dispatchEvent(new Event('scroll', { bubbles: true })); });
        await page.locator('.native-cinema-hero').waitFor({ state: 'detached' });
        assert.equal(await page.locator('.native-cinema-art').count(), 0);
        await page.locator('#original-play').click({ force: true }); assert.equal(await page.evaluate(() => fixture.plays), 3);
        assert.equal(await page.locator('.native-cinema-info,.native-cinema-hover').count(),0);
        note('Logout immediately clears closing previews and artwork while preserving original controls at ' + (base || '/'));
        fixtureMode = 'denied';
        await page.evaluate(() => { fixture.token = 'different-fixture-token'; fixture.user = 'cccccccccccccccccccccccccccccccc'; });
        await page.waitForTimeout(1600); assert.equal(await page.locator('.native-cinema-hero').count(), 0);
        assert.equal(await page.locator('#original-details').getAttribute('href'), '#/details?id=' + id);
        note('Denied metadata after an account change falls back to native controls at ' + (base || '/'));
        await page.evaluate(() => { fixture.outside = true; });
        await page.waitForTimeout(1500); assert.deepEqual(external, []); assert.equal(await page.locator('.native-cinema-hero').count(), 0);
        note('A foreign API-server origin cannot receive the session token at ' + (base || '/'));
        await page.evaluate(() => {
            const key='series - dddddddddddddddddddddddddddddddd';
            localStorage.setItem(key,JSON.stringify({ImageType:'Primary',SortBy:['DateCreated'],ShowTitle:false}));
            localStorage.setItem('native-cinema-thumb-default-v1:'+key,'1');
        });
        await page.goto(origin + base + '/web/index.html?layout-check=1#/tv?topParentId=dddddddddddddddddddddddddddddddd');
        const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('series - dddddddddddddddddddddddddddddddd')));
        assert.equal(saved.ImageType,'Thumb');assert.equal(saved.ViewMode,'grid');assert.deepEqual(saved.SortBy,['DateCreated']);assert.equal(saved.ShowTitle,false);
        await page.evaluate(()=>{const key='series - dddddddddddddddddddddddddddddddd';const saved=JSON.parse(localStorage.getItem(key));saved.ImageType='Banner';localStorage.setItem(key,JSON.stringify(saved));});
        await page.reload();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('series - dddddddddddddddddddddddddddddddd')).ImageType),'Banner');
        note('Existing v1 Primary settings migrate once while sorting and later Banner choices remain intact at ' + (base || '/'));
        await page.evaluate(()=>{const key='series - dddddddddddddddddddddddddddddddd';const saved=JSON.parse(localStorage.getItem(key));saved.ImageType='Primary';localStorage.setItem(key,JSON.stringify(saved));});
        await page.reload();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('series - dddddddddddddddddddddddddddddddd')).ImageType),'Primary');
        note('A later deliberate Primary selection survives reload instead of being locked to thumbnails at ' + (base || '/'));
        await page.evaluate(()=>{
            localStorage.setItem('collections - 11111111111111111111111111111111',JSON.stringify({ImageType:'Primary',ViewMode:'list',SortBy:['DateCreated'],SortOrder:'Descending',ShowTitle:false,ShowYear:false,Filters:{IsPlayed:true}}));
            localStorage.setItem('musicvideos - 22222222222222222222222222222222',JSON.stringify({ImageType:'Banner',SortBy:['SortName']}));
            localStorage.setItem('movies - 33333333333333333333333333333333','{broken');
            localStorage.setItem('photos - 44444444444444444444444444444444',' '.repeat(16385));
            localStorage.setItem('unrelated-user-preference','keep-this-value');
        });
        await page.goto(origin + base + '/web/index.html?preferences-migration=1#/home');
        const migrated=await page.evaluate(()=>({
            collection:JSON.parse(localStorage.getItem('collections - 11111111111111111111111111111111')),
            musicvideos:JSON.parse(localStorage.getItem('musicvideos - 22222222222222222222222222222222')),
            broken:localStorage.getItem('movies - 33333333333333333333333333333333'),
            oversized:localStorage.getItem('photos - 44444444444444444444444444444444').length,
            unrelated:localStorage.getItem('unrelated-user-preference')
        }));
        assert.equal(migrated.collection.ImageType,'Thumb');assert.equal(migrated.collection.ViewMode,'list');
        assert.deepEqual(migrated.collection.SortBy,['DateCreated']);assert.equal(migrated.collection.SortOrder,'Descending');
        assert.equal(migrated.collection.ShowTitle,false);assert.equal(migrated.collection.ShowYear,false);assert.deepEqual(migrated.collection.Filters,{IsPlayed:true});
        assert.equal(migrated.musicvideos.ImageType,'Banner');
        assert.equal(migrated.broken,'{broken');assert.equal(migrated.oversized,16385);assert.equal(migrated.unrelated,'keep-this-value');
        note('Home entry migrates existing library defaults without losing filters, custom layouts or unrelated preferences at ' + (base || '/'));
        const routeContexts=await page.evaluate(()=>{
            const routes=['books','boxsets','movies','music','tv','homevideos','musicvideos','playlists','mixed','livetv'];
            return routes.map((route,i)=>{
                const library=(i+10).toString(16).padStart(32,'0'),context=route==='livetv'?'livetv':library;
                const link=document.createElement('a');link.href='#/'+route+'?topParentId='+library+'&tab=6'+(route==='livetv'?'&collectionType=livetv':'');
                link.addEventListener('click',event=>event.preventDefault());document.body.append(link);link.click();link.remove();
                return {route,collection:JSON.parse(localStorage.getItem('collections - '+context)),
                    favorites:JSON.parse(localStorage.getItem('favorites - '+context)),
                    episodes:JSON.parse(localStorage.getItem('episodes - '+context)),
                    songs:JSON.parse(localStorage.getItem('songs - '+context))};
            });
        });
        for(const record of routeContexts){
            assert.equal(record.collection.ImageType,'Thumb',record.route);assert.equal(record.favorites.ImageType,'Thumb',record.route);
            assert.equal(record.collection.ViewMode,'grid');assert.deepEqual(record.collection.SortBy,['SortName']);
            assert.deepEqual(record.episodes.SortBy,['SeriesSortName']);assert.equal(record.songs.ViewMode,'list');
        }
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('favorites - null')).ImageType),'Thumb');
        note('All native library routes prepare thumbnail tabs before navigation, retaining native episode sorting and song lists at ' + (base || '/'));
        const ignored=await page.evaluate(()=>{
            const target='66666666666666666666666666666666';
            for(const href of ['https://outside.invalid/web/index.html#/tv?topParentId='+target,'#/details?id='+target,'#/movies?topParentId=bad-library-id']){
                const link=document.createElement('a');link.href=href;link.addEventListener('click',event=>event.preventDefault());document.body.append(link);link.click();link.remove();
            }
            return {foreign:localStorage.getItem('series - '+target),invalid:localStorage.getItem('movies - bad-library-id')};
        });
        assert.deepEqual(ignored,{foreign:null,invalid:null});assert.deepEqual(external,[]);
        note('Foreign links, media details and malformed library IDs cannot create library view defaults at ' + (base || '/'));
        await page.goto(origin + base + '/web/index.html#/movies?topParentId=dddddddddddddddddddddddddddddddd');
        const initial=await page.evaluate(()=>JSON.parse(localStorage.getItem('movies - dddddddddddddddddddddddddddddddd')));
        assert(initial.SortBy.includes('SortName'));assert.equal(initial.SortOrder,'Ascending');assert.equal(initial.StartIndex,0);assert.equal(initial.ShowTitle,true);assert.equal(initial.ShowYear,true);assert.equal(initial.CardLayout,false);assert.equal(initial.ImageType,'Thumb');
        note('A fresh native movie-view record contains the complete renderer configuration at ' + (base || '/'));
        fixtureMode='allowed';await page.setViewportSize({width:1600,height:900});
        await page.goto(origin + base + '/web/index.html?layout-check=2#/tv?topParentId=dddddddddddddddddddddddddddddddd');
        await page.locator('.native-cinema-hero').waitFor({state:'visible'});
        assert(Math.abs(await page.evaluate(()=>document.querySelector('.card').getBoundingClientRect().width/document.querySelector('.mainAnimatedPage').getBoundingClientRect().width-initialNativeGridRatio))<.001);
        assert.equal(await page.locator('.card .native-cinema-art').count(),0);
        note('Fixed library thumbnail dimensions and native artwork remain unchanged after metadata arrives at ' + (base || '/'));
        await page.locator('#original-details').dispatchEvent('click');
        await page.locator('.native-cinema-info').waitFor({state:'visible'});
        const interrupted=await page.locator('.native-cinema-info').evaluate(dialog=>{
            const motion=dialog.getAnimations().find(animation=>animation.effect.target===dialog&&!animation.effect.pseudoElement);
            if(!motion)throw new Error('Opening motion missing');
            motion.pause();motion.currentTime=200;
            const before=dialog.getBoundingClientRect();
            dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
            const closing=dialog.getAnimations().find(animation=>animation.effect.target===dialog&&!animation.effect.pseudoElement);
            if(!closing)throw new Error('Return motion missing');
            closing.pause();closing.currentTime=0;
            const after=dialog.getBoundingClientRect();
            const delta=Math.max(Math.abs(before.width-after.width),Math.abs(before.x-after.x),Math.abs(before.y-after.y));
            closing.finish();return delta;
        });
        assert(interrupted<1,'Interrupted opening must close from the visible frame');
        await page.locator('.native-cinema-info').waitFor({state:'detached'});
        note('Closing during opening starts at the visible frame without jumping at ' + (base || '/'));
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.locator('#original-details').dispatchEvent('click');await page.locator('.native-cinema-info').waitFor({state:'visible'});
        assert.equal(await page.locator('.native-cinema-info').evaluate(node=>node.getAnimations({subtree:true}).length),0);
        await page.keyboard.press('Escape');await page.locator('.native-cinema-info').waitFor({state:'detached'});
        await page.emulateMedia({reducedMotion:'no-preference'});
        note('Reduced motion skips both dialog directions including the backdrop at ' + (base || '/'));

        await page.goto(origin + base + '/web/index.html?hero-snap=1#/home');
        await page.locator('.native-cinema-hero').waitFor({state:'visible'});
        await page.waitForFunction(()=>document.querySelector('[data-native-cinema-catalog]'));
        await page.locator('[data-native-cinema-catalog]').evaluate(node=>node.style.minHeight='2600px');
        const snapTarget=()=>page.evaluate(()=>{
            const section=document.querySelector('[data-native-cinema-catalog]'),header=document.querySelector('header');
            return scrollY+section.getBoundingClientRect().top-header.getBoundingClientRect().height;
        });
        const at=async value=>page.waitForFunction(y=>Math.abs(scrollY-y)<2,value);
        const target=await snapTarget();
        await page.mouse.move(700,300);await page.mouse.wheel(0,120);await at(target);
        assert(Math.abs(await page.locator('[data-native-cinema-catalog]').evaluate(n=>n.getBoundingClientRect().top)-await page.locator('header').evaluate(n=>n.getBoundingClientRect().bottom))<2);
        note('Wheel snaps from the hero to the catalogue below the native header at ' + (base || '/'));
        await page.waitForTimeout(220);await page.mouse.wheel(0,250);await at(target+250);
        await page.mouse.wheel(0,-400);await at(target);
        await page.mouse.wheel(0,-120);await page.waitForTimeout(60);await at(target);
        await page.waitForTimeout(220);await page.mouse.wheel(0,-120);await at(0);
        note('Catalogue scroll stays free, upward momentum stops at its boundary, and a new gesture returns to the hero at ' + (base || '/'));
        await page.mouse.wheel(180,0);await page.waitForTimeout(80);assert(Math.abs(await page.evaluate(()=>scrollY))<2);
        note('Horizontal wheel gestures remain available to original rails at ' + (base || '/'));
        for(const [width,height] of [[1920,1080],[1280,720],[390,844],[1024,360],[3840,2160]]){
            await page.setViewportSize({width,height});
            await page.waitForFunction(()=>Math.abs(document.querySelector('.native-cinema-hero').getBoundingClientRect().height-(innerHeight-document.querySelector('header').getBoundingClientRect().height-20))<2);
            const bounds=await page.locator('.native-cinema-hero').boundingBox(),playBounds=await page.locator('.native-cinema-primary').first().boundingBox();
            assert(bounds.x>=0&&bounds.x+bounds.width<=width);
            assert(playBounds.y>=bounds.y&&playBounds.y+playBounds.height<=bounds.y+bounds.height+1);
        }
        assert.equal(await page.locator('.native-cinema-hero-image').evaluate(node=>new URL(node.src).searchParams.get('maxWidth')),'3840');
        note('Hero fits desktop, mobile, short landscape and 4K viewports while artwork follows resolution at ' + (base || '/'));
        await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(100);
        const beforeResizeTarget=await snapTarget();
        await page.evaluate(y=>scrollTo(0,y+200),beforeResizeTarget);await page.waitForTimeout(100);
        await page.setViewportSize({width:1920,height:1080});await page.waitForTimeout(150);
        const resizedTarget=await snapTarget();assert(Math.abs(await page.evaluate(()=>scrollY)-resizedTarget-200)<2);
        note('Resizing while browsing preserves the catalogue offset at ' + (base || '/'));
        await page.setViewportSize({width:1400,height:900});
        await page.goto(origin + base + '/web/index.html?hover-neighbors=1#/home');
        await page.locator('.native-cinema-hero').waitFor({state:'visible'});
        await page.addStyleTag({content:'.native-cinema-hero{display:none!important}#indexPage{min-height:800px}'});
        await page.evaluate(neighbor=>{
            const original=document.querySelector('.card');original.id='hover-source';
            Object.assign(original.style,{position:'fixed',left:'80px',top:'100px'});
            for(const [name,left,top] of [['hover-right','450px','100px'],['hover-below','80px','550px']]){
                const card=original.cloneNode(true);for(const child of card.querySelectorAll('[id]'))child.removeAttribute('id');
                card.id=name;card.dataset.id=neighbor;card.querySelector('a').href='#/details?id='+neighbor;
                Object.assign(card.style,{left,top});original.parentElement.append(card);
            }
            scrollTo(0,0);
        },neighborId);
        const waitForHover=async name=>{
            const panel=page.locator('.native-cinema-hover:not(.is-closing)').filter({has:page.locator('.native-cinema-hover-name',{hasText:name})});
            await panel.waitFor({state:'visible'});
            await panel.evaluate(node=>Promise.all(node.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))));
            return panel;
        };
        await page.locator('#hover-source').hover();await waitForHover('Native fixture title');
        await page.locator('#hover-right').hover();
        assert.equal(await page.locator('.native-cinema-hover.is-closing').count(),1,'The old preview must start shrinking on neighbor entry, before the next opens');
        assert.equal(await page.locator('.native-cinema-hover:not(.is-closing)').count(),0);
        await page.mouse.move(20,20);await page.locator('.native-cinema-hover').waitFor({state:'detached'});
        await page.waitForTimeout(600);assert.equal(await page.locator('.native-cinema-hover').count(),0);
        note('Entering a horizontal neighbor immediately shrinks the old preview; leaving cancels the next opening at ' + (base || '/'));
        await page.locator('#hover-source').hover();await waitForHover('Native fixture title');
        await page.locator('#hover-below').hover();
        assert.equal(await page.locator('.native-cinema-hover.is-closing').count(),1,'A lower-row neighbor must also close the previous preview immediately');
        const nextHover=await waitForHover('Neighbor fixture title');
        assert.equal(await page.locator('.native-cinema-hover:not(.is-closing)').count(),1);
        assert.equal(await page.locator('.native-cinema-hover.is-closing').count(),0);
        note('Moving down to a neighboring film closes the old card and opens exactly one new preview at ' + (base || '/'));
        await nextHover.getByRole('button',{name:'Mehr Infos',exact:true}).hover();
        await page.waitForTimeout(180);assert.equal(await nextHover.count(),1);
        await page.mouse.move(20,20);await page.locator('.native-cinema-hover').waitFor({state:'detached'});
        note('Moving onto preview controls keeps them usable, then leaving closes with the original animation at ' + (base || '/'));
        await page.goto(origin + base + '/web/index.html?mixed-row-format=1#/home');
        await page.locator('.native-cinema-hero').waitFor({state:'visible'});
        await page.addStyleTag({content:'.native-cinema-hero{display:none!important}'});
        holdInitialMetadata=true;
        await page.evaluate(items=>{
            const row=document.createElement('div');row.id='mixed-fixture-row';
            Object.assign(row.style,{display:'flex',flexWrap:'wrap',gap:'12px'});
            for(const item of items){
                const card=document.createElement('div');card.className='card overflowPortraitCard';card.dataset.id=item.Id;card.dataset.type=item.Type;
                Object.assign(card.style,{width:'190px',height:'auto'});
                const scalable=document.createElement('div');scalable.className='cardScalable';scalable.style.position='relative';
                const padder=document.createElement('div');padder.className='cardPadder';padder.style.paddingBottom=item.Type==='MusicAlbum'?'100%':'150%';
                const image=document.createElement('div');image.className='cardImageContainer';
                const badge=document.createElement('span');badge.className='countIndicator';badge.textContent='12';image.append(badge);
                const link=document.createElement('a');link.href='#/details?id='+item.Id;link.textContent=item.Name;
                link.addEventListener('click',event=>{event.preventDefault();window.nativeMixedSeasonClicks=(window.nativeMixedSeasonClicks||0)+1;});
                scalable.append(padder,image);card.append(scalable,link);row.append(card);
            }
            document.querySelector('#homeTab .itemsContainer').append(row);
        },mixedRowItems);
        const mixedRatios=()=>page.locator('#mixed-fixture-row .card').evaluateAll(nodes=>nodes.map(card=>{
            const r=card.querySelector('.cardPadder').getBoundingClientRect();return{type:card.dataset.type,ratio:r.width/r.height};
        }));
        const beforeImages=await mixedRatios();
        for(const card of beforeImages)assert(Math.abs(card.ratio-(card.type==='MusicAlbum'?1:16/9))<.002,card.type);
        note('Mixed home rows reserve 16:9 for series, episodes and seasons before metadata while music stays square at ' + (base || '/'));
        holdInitialMetadata=false;for(const send of pendingMetadata.splice(0))send();
        await page.waitForFunction(()=>[...document.querySelectorAll('#mixed-fixture-row .card:not([data-type="MusicAlbum"])')].every(card=>card.hasAttribute('data-native-cinema-ready')));
        const art=await page.locator('#mixed-fixture-row .native-cinema-art').evaluateAll(nodes=>Object.fromEntries(nodes.map(img=>[img.closest('.card').dataset.id,new URL(img.src).pathname])));
        assert.equal(art[mixedRowItems[1].Id],base+'/Items/'+mixedRowItems[1].Id+'/Images/Primary');
        assert.equal(art[mixedRowItems[2].Id],base+'/Items/'+mixedRowItems[2].Id+'/Images/Thumb');
        assert.equal(art[mixedRowItems[3].Id],base+'/Items/'+mixedRowItems[0].Id+'/Images/Thumb');
        assert.equal(art[mixedRowItems[4].Id],base+'/Items/'+mixedRowItems[0].Id+'/Images/Backdrop/0');
        assert.equal(art[mixedRowItems[5].Id],base+'/Items/'+mixedRowItems[5].Id+'/Images/Primary');
        assert.deepEqual(external,[]);
        note('Season artwork prefers its own thumbnail then valid parent artwork, retaining episode stills and safe poster fallback at ' + (base || '/'));
        const afterImages=await mixedRatios();assert.deepEqual(afterImages,beforeImages);
        assert.equal(await page.locator('#mixed-fixture-row [data-type="MusicAlbum"] .native-cinema-art').count(),0);
        note('Mixed-row image loading keeps every reserved card dimension stable and leaves music artwork native at ' + (base || '/'));
        const seasonLink=page.locator('#mixed-fixture-row [data-type="Season"] a').first();
        assert.equal(await seasonLink.getAttribute('href'),'#/details?id='+mixedRowItems[2].Id);
        await seasonLink.dispatchEvent('click');assert.equal(await page.evaluate(()=>window.nativeMixedSeasonClicks),1);
        assert.equal(await page.locator('#mixed-fixture-row .countIndicator').count(),mixedRowItems.length);
        assert.equal(await page.locator('.native-cinema-info').count(),0);
        note('Season links and native badges survive the format correction without replacing their original action at ' + (base || '/'));
        await page.goto(origin + base + '/web/index.html?movie-thumbnail-batches=1#/home');
        await page.locator('.native-cinema-hero').waitFor({state:'visible'});
        await page.addStyleTag({content:'.native-cinema-hero{display:none!important}'});
        const requestStart=requests.length;
        await page.evaluate(items=>{
            const makeCard=item=>{
                const card=document.createElement('div');card.className='card overflowPortraitCard';card.dataset.id=item.Id;card.dataset.type='Movie';
                Object.assign(card.style,{width:'100px',height:'auto',flex:'0 0 100px'});
                const scalable=document.createElement('div');scalable.className='cardScalable';scalable.style.position='relative';
                const padder=document.createElement('div');padder.className='cardPadder';padder.style.paddingBottom='150%';
                const art=document.createElement('div');art.className='cardImageContainer';scalable.append(padder,art);card.append(scalable);return card;
            };
            const row=document.createElement('div');row.id='batch-movie-fixture';Object.assign(row.style,{display:'grid',gridTemplateColumns:'repeat(8,100px)',gap:'8px'});
            for(const item of items.slice(0,40))row.append(makeCard(item));
            const rail=document.createElement('div');rail.id='batch-movie-rail';Object.assign(rail.style,{width:'220px',overflowX:'auto'});
            const track=document.createElement('div');Object.assign(track.style,{display:'flex',width:'max-content',paddingLeft:'2200px'});
            for(const item of items.slice(40))track.append(makeCard(item));rail.append(track);
            document.querySelector('#homeTab .itemsContainer').append(row,rail);
        },batchMovieItems);
        await page.waitForFunction(()=>[...document.querySelectorAll('#batch-movie-fixture .card')].every(card=>card.hasAttribute('data-native-cinema-ready')));
        const batchIds=new Set(batchMovieItems.slice(0,40).map(item=>item.Id));
        const batchRequests=requests.slice(requestStart).filter(request=>request.path.endsWith('/Users/'+user+'/Items'))
            .map(request=>(new URLSearchParams(request.query).get('Ids')||'').split(',')).filter(ids=>ids.some(id=>batchIds.has(id)));
        assert(batchRequests.length>=2);assert(batchRequests.every(ids=>ids.length<=24));
        const fetchedIds=batchRequests.flat().filter(id=>batchIds.has(id));assert.equal(new Set(fetchedIds).size,40);assert.equal(fetchedIds.length,40);
        assert.equal(await page.locator('#batch-movie-fixture .native-cinema-art').count(),40);
        for(const source of await page.locator('#batch-movie-fixture .native-cinema-art').evaluateAll(nodes=>nodes.map(node=>new URL(node.src).pathname)))assert(source.endsWith('/Images/Thumb'));
        note('All 40 recent movies receive thumbnails across bounded metadata batches without cached cards starving later titles at ' + (base || '/'));
        await page.locator('#batch-movie-rail').evaluate(rail=>rail.scrollLeft=2200);
        await page.waitForFunction(()=>[...document.querySelectorAll('#batch-movie-rail .card')].every(card=>card.hasAttribute('data-native-cinema-ready')));
        for(const source of await page.locator('#batch-movie-rail .native-cinema-art').evaluateAll(nodes=>nodes.map(node=>new URL(node.src).pathname)))assert(source.endsWith('/Images/Thumb'));
        assert.deepEqual(external,[]);
        note('Horizontal rail navigation reveals complete movie thumbnails after the bounded row-loading passes at ' + (base || '/'));
        const alphaLibrary='dddddddddddddddddddddddddddddddd',alphaMovieLibrary='eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const seriesViewKey='series - '+alphaLibrary,movieViewKey='movies - '+alphaMovieLibrary;
        await page.goto(origin + base + '/web/index.html?alpha-route-reset=1#/tv?topParentId='+alphaLibrary);
        await page.addStyleTag({content:'#alpha-same-route,#alpha-home-route,#alpha-series-route,#alpha-movie-route{position:fixed;left:40px;z-index:1200}#alpha-same-route{top:400px}#alpha-home-route{top:450px}#alpha-series-route{top:500px}#alpha-movie-route{top:550px}'});
        await page.evaluate(key=>{
            const settings=JSON.parse(localStorage.getItem(key));
            Object.assign(settings,{Alphabet:'A',StartIndex:80,SortBy:['DateCreated'],SortOrder:'Descending',ImageType:'Banner',ShowTitle:false,Filters:{IsPlayed:true}});
            localStorage.setItem(key,JSON.stringify(settings));
            const picker=document.createElement('div');picker.className='alphaPicker-fixed-right';picker.id='alpha-style-probe';
            const selected=document.createElement('button');selected.className='MuiToggleButton-root Mui-selected';selected.textContent='A';picker.append(selected);document.body.append(picker);
        },seriesViewKey);
        assert.equal(await page.locator('#alpha-style-probe button').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(229, 9, 20)');
        note('Selected alphabet controls use the Cinema red highlight at ' + (base || '/'));
        await page.locator('#original-details').dispatchEvent('click');await page.locator('.native-cinema-info').waitFor({state:'visible'});
        assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).Alphabet,seriesViewKey),'A');
        await page.keyboard.press('Escape');await page.locator('.native-cinema-info').waitFor({state:'detached'});
        await page.evaluate(()=>{
            const button=document.createElement('button');button.id='alpha-same-route';button.textContent='Same library';
            button.onclick=()=>history.replaceState(null,'',location.pathname+location.search+'#/tv?topParentId=dddddddddddddddddddddddddddddddd&tab=0&presentation=grid');document.body.append(button);
        });
        await page.locator('#alpha-same-route').click();
        assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).Alphabet,seriesViewKey),'A');
        note('Same-library changes and prevented detail links keep the active alphabet filter at ' + (base || '/'));
        await page.evaluate(()=>{
            const button=document.createElement('button');button.id='alpha-home-route';button.textContent='Home';
            button.onclick=()=>history.pushState(null,'',location.pathname+location.search+'#/home');document.body.append(button);
        });
        await page.locator('#alpha-home-route').click();
        await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).Alphabet===null,seriesViewKey);
        const cleared=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),seriesViewKey);
        assert.equal(cleared.Alphabet,null);assert.equal(cleared.StartIndex,0);assert.deepEqual(cleared.SortBy,['DateCreated']);
        assert.equal(cleared.SortOrder,'Descending');assert.equal(cleared.ImageType,'Banner');assert.equal(cleared.ShowTitle,false);assert.deepEqual(cleared.Filters,{IsPlayed:true});
        note('Committed Home navigation resets alphabet and pagination while preserving other native preferences at ' + (base || '/'));
        await page.evaluate(({seriesKey,movieKey})=>{
            const series=JSON.parse(localStorage.getItem(seriesKey));series.Alphabet='O';series.StartIndex=40;localStorage.setItem(seriesKey,JSON.stringify(series));
            localStorage.setItem(movieKey,JSON.stringify({...series,Alphabet:'Z'}));
            const link=document.createElement('a');link.id='alpha-series-route';link.href='#/tv?topParentId=dddddddddddddddddddddddddddddddd';link.textContent='Series';document.body.append(link);
        },{seriesKey:seriesViewKey,movieKey:movieViewKey});
        await page.locator('#alpha-series-route').click();await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).Alphabet===null,seriesViewKey);
        await page.evaluate(key=>{
            const saved=JSON.parse(localStorage.getItem(key));saved.Alphabet='A';localStorage.setItem(key,JSON.stringify(saved));
            const link=document.createElement('a');link.id='alpha-movie-route';link.href='#/movies?topParentId=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';link.textContent='Movies';document.body.append(link);
        },seriesViewKey);
        await page.locator('#alpha-movie-route').click();
        await page.waitForFunction(keys=>keys.every(key=>JSON.parse(localStorage.getItem(key)).Alphabet===null),[seriesViewKey,movieViewKey]);
        note('Switching Series to Movies clears both the outgoing letter and an older saved incoming letter at ' + (base || '/'));
        await page.evaluate(key=>{const saved=JSON.parse(localStorage.getItem(key));saved.Alphabet='#';saved.StartIndex=60;localStorage.setItem(key,JSON.stringify(saved));},movieViewKey);
        await page.goBack();
        await page.waitForFunction(keys=>keys.every(key=>JSON.parse(localStorage.getItem(key)).Alphabet===null),[seriesViewKey,movieViewKey]);
        assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).StartIndex,movieViewKey),0);
        note('Browser Back clears the non-letter selection instead of restoring a stale alphabet filter at ' + (base || '/'));
        await page.goto(origin + base + '/web/index.html?cinema=off');
        assert.equal(await page.locator('.native-cinema-hero').count(), 0);
        assert.equal(await page.locator('html').getAttribute('class'), 'native-cinema-disabled');
        assert.equal(await page.locator('header').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(68, 68, 68)');
        assert.deepEqual(errors, []); note('Original-mode opt-out restores native styling at ' + (base || '/'));
        await context.close();
    }
    const folder = process.env.CINEMA_REPORT_DIR || path.join(__dirname, '../test-results'); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'cinema-browser.json'), JSON.stringify({ completed: true, checks, scope: 'Isolated browser fixtures; root and /media paths, no NAS credentials or media' }, null, 2) + '\n');
})().catch(async error => {
    console.error(error.stack || error.name + ': ' + error.message); process.exitCode = 1;
    if (diagnosticPage) console.error(JSON.stringify(await diagnosticPage.locator('dialog button').evaluateAll(nodes=>nodes.map(node=>({label:node.getAttribute('aria-label'),cls:node.className,rect:{x:node.getBoundingClientRect().x,y:node.getBoundingClientRect().y,width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height},visibility:getComputedStyle(node).visibility}))).catch(()=>[])));
}).finally(async () => {
    holdInitialMetadata = false; for (const send of pendingMetadata.splice(0)) send();
    holdSeasonCounts=false; for(const reply of pendingSeasonCounts.splice(0))reply();
    if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
});
