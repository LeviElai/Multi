import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.QA_BASE??'http://localhost:3000';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Disposable account test is restricted to an isolated local database.');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:process.env.CHROMIUM_NO_SANDBOX==='1'?['--no-sandbox']:[]});
const options={viewport:{width:320,height:568},isMobile:true,hasTouch:true};
try{
 let context=await browser.newContext(options),page=await context.newPage();
 await page.goto(base+'/login?return_to=/daily');
 await page.getByRole('button',{name:'Create account',exact:true}).click();
 await page.getByLabel('Your name').fill('Session QA');
 await page.getByLabel('Email',{exact:true}).fill('qa-'+crypto.randomUUID()+'@example.test');
 await page.getByLabel(/^Password/).fill(crypto.randomUUID()+'-test');
 await page.locator('form').getByRole('button',{name:/Create account/}).click();
 await page.waitForURL(base+'/daily');
 const state=await context.storageState();assert.ok(state.cookies.some(c=>c.httpOnly));
 await context.close();context=await browser.newContext({...options,storageState:state});page=await context.newPage();
 let failures=0;
 await context.route('**/api/auth/me',async route=>{if(failures++<2)await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'Test cold start'}})});else await route.continue();});
 await page.goto(base+'/create');await page.locator('.auth-check').waitFor({state:'hidden'});
 assert.ok(failures>=3);assert.deepEqual((await context.cookies()).filter(c=>c.httpOnly),state.cookies.filter(c=>c.httpOnly));
 console.log('PASS persisted identity survives two 503 responses and returns automatically');
 await context.unroute('**/api/auth/me');
 const tab=await context.newPage();await tab.goto(base+'/create');await tab.locator('.auth-check').waitFor({state:'hidden'});await tab.reload();await tab.locator('.auth-check').waitFor({state:'hidden'});await tab.close();
 console.log('PASS second tab and refresh retain authentication');
 await page.goto(base+'/daily');await page.getByRole('button',{name:/Let’s play/}).click();
 await page.getByRole('main',{name:'Daily challenge',exact:true}).waitFor();
 for(let index=0;index<10;index++){
  const main=page.getByRole('main',{name:'Daily challenge',exact:true});
  await main.getByText(`${index+1} / 10`,{exact:true}).waitFor();
  const answer=main.locator('button').first();await answer.waitFor();
  await page.waitForFunction(()=>{const b=document.querySelector('main[aria-label="Daily challenge"] button');return b&&!b.disabled;});
  const outside=await main.evaluate(el=>[...el.querySelectorAll('button,h1')].filter(n=>{const r=n.getBoundingClientRect();return r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth;}).map(n=>n.textContent));assert.deepEqual(outside,[]);
  if(index===0)await page.screenshot({path:(process.env.QA_SCREENSHOTS??'.sites-runtime')+'/daily-active-320.png'});
  await answer.tap();
  if(index===3){await page.getByText('5 / 10',{exact:true}).waitFor();await page.reload();}
 }
 await page.getByText('Daily quest complete',{exact:true}).waitFor();
 await page.getByText('Your rank',{exact:false}).waitFor();console.log('PASS ten-question touch completion, mid-run reload and rank reveal');
 await page.screenshot({path:(process.env.QA_SCREENSHOTS??'.sites-runtime')+'/daily-result-320.png'});
 await page.getByRole('link',{name:'Open quest book',exact:true}).click();await page.getByRole('heading',{name:'Past adventures'}).waitFor();
 await page.screenshot({path:(process.env.QA_SCREENSHOTS??'.sites-runtime')+'/daily-archive-320.png'});
 await context.route('**/api/auth/me',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{code:'SESSION_EXPIRED',message:'Expired test session'}})}));
 await page.goto(base+'/create');await page.getByRole('heading',{name:'Session expired'}).waitFor();await page.getByRole('link',{name:'Sign in',exact:true}).waitFor();console.log('PASS expired session offers direct sign-in');
}finally{await browser.close();}
