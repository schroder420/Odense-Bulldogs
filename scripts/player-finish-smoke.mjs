import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const id='11111111-1111-4111-8111-111111111111';let started=0,submitted=0,score=null;const errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
const ends=()=>started?started+1500:Date.now()+60000;
const status=()=>started&&Date.now()>=ends()+10000?'final':'open';
await page.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname;let json;
 if(path.endsWith('/board'))json={configured:true,round:{id,title:'Test',status:status(),starts_at:new Date(Date.now()-60000).toISOString(),ends_at:new Date(ends()).toISOString(),cutoff_at:new Date(ends()+10000).toISOString(),timing_version:2,prize:'1 alm. fadøl eller sodavand'},entries:[],participants:6,serverTime:new Date().toISOString()};
 else if(path.endsWith('/me'))json={id:'player',nickname:'Testfan',roundId:id,roundStatus:status(),best:score?2500:0,bestTime:score?1500:0,bestPasses:score?1:0,rank:null,claim:null};
 else if(path.endsWith('/join'))json={id:'player',nickname:'Testfan'};
 else if(path.endsWith('/run/start')){started=Date.now();json={id:'run',roundId:id,seed:99,limit:1500,elapsedMs:0,serverTime:started,submitAt:started+6500};}
 else if(path.endsWith('/run/finish')){submitted=Date.now();score=route.request().postDataJSON();json={ok:true};}
 else throw new Error('Unexpected API '+path);
 await route.fulfill({json});
});
await page.goto(`${process.env.BASE_URL||'http://localhost:3010'}/?round=${id}`);
await page.getByRole('button',{name:'SPIL MED',exact:true}).click();
await page.getByText('Tag dig god tid – uret er ikke startet').waitFor();
const canvas=await page.locator('canvas').boundingBox();await page.mouse.click(canvas.x+canvas.width*.5,canvas.y+canvas.height*180/680);
await page.getByRole('heading',{name:'Tak for spillet!',exact:true}).waitFor();
assert.equal(submitted,0,'must not submit immediately at the whistle');
await page.getByText('Dit resultat er godkendt og gemt',{exact:false}).waitFor();
assert.ok(submitted-started>=6300&&submitted-started<8000,`submit happened ${submitted-started}ms after start`);
assert.equal(score.end,1500,'no score after countdown zero');
await page.getByText('Du kom desværre ikke i top 5 denne gang.',{exact:false}).waitFor({timeout:20000});
assert.equal(await page.locator('.voucher').count(),0);
assert.deepEqual(errors,[]);console.log(`Player smoke passed: whistle at 1.5s, submission at ${(submitted-started)/1000}s, final loser message, no voucher.`);
await browser.close();
