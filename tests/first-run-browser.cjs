/* Drive the unchanged native wizard against fresh loopback CI servers only. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.NATIVE_CINEMA_PLAYWRIGHT||'playwright-core');
const a='http://127.0.0.1:18098',b='http://127.0.0.1:18097',checks=[];
let browser,context;
const note=name=>{checks.push({name,passed:true});console.log('PASS '+name);};
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-background-networking']});
 context=await browser.newContext({locale:'en-US',viewport:{width:1400,height:900}});
 await context.route('**/*',r=>[a,b].includes(new URL(r.request().url()).origin)?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.name));
 const infoA=await(await context.request.get(a+'/System/Info/Public')).json(),infoB=await(await context.request.get(b+'/System/Info/Public')).json();
 assert.equal(infoA.StartupWizardCompleted,false);assert.equal(infoB.StartupWizardCompleted,false);assert.notEqual(infoA.Id,infoB.Id);
 note('Two fresh containers have different server IDs and unfinished native setup');
 await page.goto(a+'/web/');await page.locator('#wizardStartPage').waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.documentElement.classList.contains('native-cinema-boot')&&!document.querySelector('.native-cinema-loading'));
 assert.equal(await page.locator('#wizardStartPage #txtServerName').isEditable(),true);
 fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});
 await page.screenshot({path:path.join(__dirname,'../test-results/wizard-start.png'),fullPage:true});
 note('Opening /web/ automatically displays the original first-run wizard with no blocking Cinema overlay');
 await page.locator('#selectLocalizationLanguage').selectOption('en-US');await page.locator('#txtServerName').fill('Independent CI server');
 const userLoaded=page.waitForResponse(r=>new URL(r.url()).pathname==='/Startup/User'&&r.request().method()==='GET');
 await page.locator('#wizardStartPage .button-submit').click();await page.locator('#wizardUserPage').waitFor({state:'visible'});
 assert.equal((await userLoaded).status(),200);
 await page.waitForFunction(()=>document.querySelector('#txtUsername')?.value.length>0);
 const username='Fresh CI admin',password='Wizard-'+crypto.randomBytes(24).toString('hex');
 await page.locator('#txtUsername').fill(username);await page.locator('#txtManualPassword').fill(password);await page.locator('#txtPasswordConfirm').fill(password);
 assert(await page.locator('.wizardUserForm').evaluate(form=>form.checkValidity()),'Original user form is valid after its initial data has loaded');
 const userSaved=page.waitForResponse(r=>new URL(r.url()).pathname==='/Startup/User'&&r.request().method()==='POST');
 await page.locator('#wizardUserPage .button-submit').click();assert.equal((await userSaved).status(),204,'Original Startup/User accepts the administrator');
 await page.locator('#wizardLibraryPage').waitFor({state:'visible'});
 assert(await page.locator('#wizardLibraryPage h1').isVisible());
 note('The native user and library steps accept a new administrator and start without preset libraries');
 await page.locator('#wizardLibraryPage .button-submit').click();await page.locator('#selectLanguage').waitFor({state:'visible'});
 await page.locator('#selectLanguage').selectOption('en');await page.locator('#selectCountry').selectOption('US');
 await page.locator('form').filter({has:page.locator('#selectCountry')}).locator('.button-submit').click();await page.locator('#chkRemoteAccess').waitFor({state:'visible'});
 await page.locator('label').filter({has:page.locator('#chkRemoteAccess')}).click();assert.equal(await page.locator('#chkRemoteAccess').isChecked(),false);
 await page.locator('form').filter({has:page.locator('#chkRemoteAccess')}).locator('.button-submit').click();
 await page.locator('#wizardFinishPage').waitFor({state:'visible'});await page.locator('#wizardFinishPage .btnWizardNext').click();
 await page.waitForFunction(()=>!location.hash.includes('/wizard/'));
 const configured=await(await context.request.get(a+'/System/Info/Public')).json();assert.equal(configured.StartupWizardCompleted,true);assert.equal(configured.ServerName,'Independent CI server');
 assert.equal((await(await context.request.get(b+'/System/Info/Public')).json()).StartupWizardCompleted,false);
 note('Language, country, remote access and Finish save through the original wizard; the second server stays unconfigured');
 const login=await context.request.post(a+'/Users/AuthenticateByName',{data:{Username:username,Pw:password},headers:{Authorization:'MediaBrowser Client="CI setup", Device="Fixture", DeviceId="first-run-browser", Version="1.0"'}});
 assert.equal(login.status(),200);const data=await login.json();
 const auth={Authorization:'MediaBrowser Token="'+data.AccessToken+'"'};
 try{
  const libraries=await(await context.request.get(a+'/Library/VirtualFolders',{headers:auth})).json();assert.deepEqual(libraries,[]);
  const users=await(await context.request.get(a+'/Users',{headers:auth})).json();assert.equal(users.length,1);assert.equal(users[0].Name,username);
  const config=await(await context.request.get(a+'/System/Configuration',{headers:auth})).json();assert.equal(config.PreferredMetadataLanguage,'en');assert.equal(config.MetadataCountryCode,'US');
  const network=await(await context.request.get(a+'/System/Configuration/network',{headers:auth})).json();assert.equal(network.EnableRemoteAccess,false);
  assert.equal((await context.request.get(a+'/Startup/User')).status(),401);
  assert.equal((await context.request.get(b+'/Startup/User')).status(),200);
  const denied=await context.request.post(b+'/Users/AuthenticateByName',{data:{Username:username,Pw:password},headers:{Authorization:'MediaBrowser Client="CI setup", Device="Fixture", DeviceId="separate-instance", Version="1.0"'}});assert(denied.status()>=400);
  note('The chosen administrator exists only in its own installation; original first-time setup closes after completion');
  // Exercise the image's actual React/MUI header after ordinary login. Add
  // only a source-shaped app Back button, using the real Menu button classes;
  // do not impersonate the complete Android NativeShell bridge.
  const mobile=await browser.newContext({locale:'en-US',viewport:{width:360,height:780},isMobile:true,hasTouch:true});
  await mobile.route('**/*',r=>new URL(r.request().url()).origin===a?r.continue():r.abort());
  const phone=await mobile.newPage(),phoneErrors=[];phone.on('pageerror',e=>phoneErrors.push(e.name));let phoneToken;
  try{
   await phone.goto(a+'/web/index.html#/login');
   const manual=phone.getByText(/^(Manual Login|Sign in manually)$/i).first();
   const name=phone.locator('input[autocomplete="username"],#txtManualName,input[name="Username"]').first();
   await Promise.race([manual.waitFor({state:'visible'}),name.waitFor({state:'visible'})]);
   if(await manual.isVisible().catch(()=>false))await manual.click();
   await name.fill(username);const pw=phone.locator('input[type="password"]').first();await pw.fill(password);await pw.press('Enter');
   await phone.locator('button[aria-controls="app-user-menu"]').waitFor({state:'visible'});
   await phone.waitForFunction(()=>location.hash.split('?')[0]==='#/home');
   phoneToken=await phone.evaluate(()=>window.ApiClient.accessToken());
   await phone.evaluate(()=>{location.hash='/movies?collectionType=movies';});
   await phone.locator('header .MuiStack-root .MuiButtonGroup-contained').waitFor({state:'visible'});
   await phone.evaluate(()=>{
    const bar=document.querySelector('header.MuiAppBar-root > .MuiToolbar-root:first-child');
    const menu=bar.querySelector('button.MuiIconButton-root');
    const back=menu.cloneNode(true);back.setAttribute('aria-label','Back');back.dataset.appBackFixture='true';
    back.querySelector('svg path')?.setAttribute('d','M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20z');
    menu.after(back);
   });
   await phone.getByRole('button',{name:'Back',exact:true}).waitFor({state:'visible'});
   await phone.locator('header .native-cinema-news-button').waitFor({state:'visible'});
   await phone.locator('header .MuiStack-root .MuiButtonGroup-contained').waitFor({state:'visible'});
   for(const width of [320,360,390]){
    await phone.setViewportSize({width,height:780});await phone.waitForTimeout(150);
    const top=await phone.locator('header.MuiAppBar-root > .MuiToolbar-root:first-child button').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width>0).map(n=>{const r=n.getBoundingClientRect();return{x:r.x,right:r.right,y:r.y+r.height/2};}));
    assert.equal(top.length,7,'Actual app header includes Menu, Back, bell, SyncPlay, cast, search and profile');
    assert.ok(top.every(r=>r.x>=0&&r.right<=width+1&&Math.abs(r.y-top[0].y)<2),'Actual React topbar must keep every action in one line');
    const tools=await phone.locator('header .MuiStack-root .MuiButtonGroup-root > button').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width>0).map(n=>{const r=n.getBoundingClientRect();return{x:r.x,right:r.right,y:r.y+r.height/2};}));
    assert.equal(tools.length,7,'Actual native library renders play/shuffle, filter/sort/view and both page buttons');
    assert.ok(tools.every(r=>r.x>=0&&r.right<=width+1&&Math.abs(r.y-tools[0].y)<2),'Actual native library controls must fit one complete row');
   }
   note('Actual image React/MUI header with source-shaped app Back button fits all actions at 320/360/390px');
   await phone.setViewportSize({width:360,height:780});
   await phone.screenshot({path:path.join(__dirname,'../test-results/native-header-mobile.png')});
   await phone.locator('button[aria-controls="app-user-menu"]').click();
   await phone.locator('#app-user-menu [role="menu"]').waitFor({state:'visible'});
   await phone.keyboard.press('Escape');
   assert.deepEqual(phoneErrors,[]);
   note('Actual native profile menu still opens from the compact mobile header');
  }catch(error){
   const diagnostic=await phone.evaluate(()=>({route:location.hash.split('?')[0],nativeShell:!!window.NativeShell,historyLength:history.length,buttons:[...document.querySelectorAll('header button')].map(n=>({label:n.getAttribute('aria-label'),width:n.getBoundingClientRect().width,top:n.getBoundingClientRect().top}))})).catch(()=>({unavailable:true}));
   console.error('Mobile header diagnostic: '+JSON.stringify(diagnostic));
   throw error;
  }finally{if(phoneToken)await mobile.request.post(a+'/Sessions/Logout',{headers:{Authorization:'MediaBrowser Token="'+phoneToken+'"'}});await mobile.close();}
 }finally{await context.request.post(a+'/Sessions/Logout',{headers:auth});}
 const other=await browser.newContext();await other.route('**/*',r=>new URL(r.request().url()).origin===b?r.continue():r.abort());
 const otherPage=await other.newPage();await otherPage.goto(b+'/web/index.html#/wizard/start');await otherPage.locator('#wizardStartPage').waitFor({state:'visible'});
 await otherPage.waitForFunction(()=>!document.documentElement.classList.contains('native-cinema-boot'));
 await other.close();assert.deepEqual(errors,[]);
 note('A direct wizard link also works in a fresh browser without an existing login');
 const folder=process.env.CINEMA_REPORT_DIR||path.join(__dirname,'../test-results');fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(path.join(folder,'first-run-browser.json'),JSON.stringify({passed:true,checks,scope:'Original Jellyfin wizard in Chromium against two fresh CI containers; real user creation, finish, login, isolated database and denied setup after completion; no real credentials or media'},null,2)+'\n');
})().catch(error=>{console.error(error.name+': '+String(error.message).replace(/Wizard-[a-f0-9]+/g,'[redacted]'));process.exitCode=1;}).finally(async()=>{if(context)await context.close();if(browser)await browser.close();});
