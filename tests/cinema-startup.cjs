/* An unauthenticated native standalone page must not stay behind the boot UI. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.NATIVE_CINEMA_PLAYWRIGHT||'playwright-core');
const checks=[];let server,browser;
(async()=>{
 server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://fixture.invalid'),base=url.pathname.startsWith('/media/')?'/media':'';
  if(/\/web\/cinema-(native\.(js|css)|boot\.js)$/.test(url.pathname)){
   const name=path.basename(url.pathname);res.writeHead(200,{'Content-Type':name.endsWith('.js')?'application/javascript':'text/css'});res.end(fs.readFileSync(path.join(__dirname,'../web',name)));return;
  }
  if(url.pathname.endsWith('/web/index.html')){
   const wizard=url.searchParams.get('page')!=='login';
   res.writeHead(200,{'Content-Type':'text/html'});res.end(`<!doctype html><html><head><script src="cinema-boot.js"></script><link rel="stylesheet" href="cinema-native.css"><script defer src="cinema-native.js"></script></head><body>
    <main id="${wizard?'wizardStartPage':'loginPage'}" class="page standalonePage ${wizard?'wizardPage':''}" style="min-height:500px"><h1>${wizard?'Welcome to Jellyfin':'Please sign in'}</h1><form><input required id="native-input"><button type="submit">Next</button></form></main>
    <script>window.nativeSubmits=0;document.querySelector('form').onsubmit=e=>{e.preventDefault();nativeSubmits++;};</script></body></html>`);return;
  }
  res.writeHead(404);res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const base of ['', '/media'])for(const mode of ['wizard','login']){
  const context=await browser.newContext(),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.name));
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin+base+'/web/index.html?page='+mode+'#/'+(mode==='wizard'?'wizard/start':'login'));
  await page.waitForFunction(()=>!document.documentElement.classList.contains('native-cinema-boot')&&!document.querySelector('.native-cinema-loading'));
  assert.equal(await page.locator('.mainAnimatedPage').count(),0);
  await page.locator('#native-input').fill('Native form');await page.getByRole('button',{name:'Next'}).click();
  assert.equal(await page.evaluate(()=>nativeSubmits),1);assert.deepEqual(errors,[]);
  const name='Unauthenticated standalone '+mode+' stays visible and its native form remains usable at '+(base||'/');
  checks.push({name,passed:true});console.log('PASS '+name);await context.close();
 }
 const folder=process.env.CINEMA_REPORT_DIR||path.join(__dirname,'../test-results');fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(path.join(folder,'cinema-startup.json'),JSON.stringify({passed:true,checks,scope:'Isolated Chromium; unauthenticated standalone native wizard/login class structures with real Cinema assets; root and /media'},null,2)+'\n');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));});
