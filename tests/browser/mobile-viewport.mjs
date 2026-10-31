import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:process.env.CHROMIUM_NO_SANDBOX==='1'?['--no-sandbox']:[]});
const base=process.env.QA_BASE??'http://localhost:3000';
const modes=['amountle','fermi','word_puzzle','draw','size_it_up','claw','drop','sling','fish','stack','crack'];
try {
 const context=await browser.newContext({isMobile:true,hasTouch:true});
 const page=await context.newPage();let count=0;
 for(const width of [320,360,375,390,393,430,768]){
  await page.setViewportSize({width,height:width===320?568:width===360?640:844});
  for(const mode of modes){
   await page.goto(`${base}/demo?mode=${mode}`);
   await page.getByRole('button',{name:'Start round'}).click();
   await page.locator('.game-focus').waitFor();
   await page.getByText('Opening the arcade…',{exact:true}).waitFor({state:'hidden'});
   await page.locator('.mode-player button').first().waitFor();
   await page.waitForTimeout(120);
   const geometry=await page.locator('.mode-player').evaluate(el=>{
    const rules=document.querySelector('.game-focus .game-rules')?.getBoundingClientRect();
    const controls=[...el.querySelectorAll('button,input,canvas,summary')].filter(node=>{
     const r=node.getBoundingClientRect(),style=getComputedStyle(node);
     return r.width>2&&r.height>2&&style.visibility!=='hidden'&&style.display!=='none';
    });
    const outside=controls.filter(node=>{const r=node.getBoundingClientRect();return r.bottom>innerHeight+1||r.right>innerWidth+1||r.left< -1||r.top< -1;}).map(node=>node.getAttribute('aria-label')||node.textContent?.trim());
    const covered=controls.filter(node=>{const r=node.getBoundingClientRect();return !node.closest('.game-rules')&&rules&&r.left<rules.right&&r.right>rules.left&&r.top<rules.bottom&&r.bottom>rules.top;}).map(node=>node.getAttribute('aria-label')||node.textContent?.trim());
    return {outside,covered,horizontalScroll:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert.deepEqual(geometry.outside,[],`${mode} ${width}: control outside viewport`);
   assert.deepEqual(geometry.covered,[],`${mode} ${width}: control behind rules`);
   assert.equal(geometry.horizontalScroll,false,`${mode} ${width}: horizontal scroll`);
   if(width===320||width===390)await page.screenshot({path:`${process.env.QA_SCREENSHOTS??'.sites-runtime'}/${mode}-${width}.png`});
   if(mode==='stack'&&width===320){
    await page.getByRole('button',{name:'25',exact:true}).tap();
    await page.getByRole('button',{name:'Drop +25',exact:true}).tap();
    await page.getByRole('button',{name:'Drop +25',exact:true}).tap();
    await page.getByRole('button',{name:'1',exact:true}).tap();
    await page.getByRole('button',{name:'Drop +1',exact:true}).tap();
    await page.getByRole('button',{name:'Seal · 51',exact:true}).tap();
    await page.locator('.mode-locked').waitFor();
    await page.getByRole('status',{name:'Stack sealed!'}).waitFor();
    console.log('PASS Stack committed valid 51');
   }
   count++;
  }
  console.log('PASS viewport',width);
 }
 console.log('PASS',count,'game/viewport control-bound checks');
} finally {await browser.close();}
