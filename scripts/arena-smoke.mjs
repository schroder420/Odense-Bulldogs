import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:672,height:336}});
const id='11111111-1111-4111-8111-111111111111';
let mode='leaderboard',status='open',remaining=120;
const errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
await page.route('**/api/screen-board?*',async route=>{assert.equal(route.request().headers().authorization,'Bearer test-only');await route.fulfill({json:{configured:true,round:{id,title:'Kampens pause',status,starts_at:new Date(Date.now()-10000).toISOString(),ends_at:new Date(Date.now()+remaining*1000).toISOString(),cutoff_at:new Date(Date.now()+(remaining+10)*1000).toISOString(),timing_version:2,screen_mode:mode,screen_rotation:false,screen_title:'Velkommen i arenaen',screen_body:'En besked fra speakeren. Tak for støtten til Odense Bulldogs!',prize:'1 alm. fadøl eller sodavand pr. vinder · Viggos Bar',pickup_instructions:'Indløses i Viggos Bar. Kun barpersonalet må swipe din voucher.'},entries:Array.from({length:5},(_,i)=>({participant_id:String(i),nickname:['BulldogsFan78','Christoffer','Ingrid','Mikkel','Anders'][i],rank:i+1,score_points:98670-i*8000,time_ms:45000,passes:40})),participants:1500,serverTime:new Date().toISOString()}});});
await mkdir('output/arena-qa',{recursive:true});
await page.goto(`${process.env.BASE_URL||'http://localhost:3010'}/leaderboard?round=${id}#token=test-only`);
for(const view of ['leaderboard','rules','info','qr','countdown','collecting','winners']){
 mode=view==='countdown'||view==='collecting'?'leaderboard':view;remaining=view==='countdown'?8:view==='collecting'?-2:120;status=view==='winners'?'final':'open';
 await page.waitForSelector(view==='qr'?'.arena-qr-only':`.view-${view}`);await page.waitForTimeout(800);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth),false,view+' page overflow');
 await page.screenshot({path:`output/arena-qa/${view}-672.png`});
}
for(const size of [{width:1920,height:1080},{width:390,height:844},{width:320,height:160}]){
 await page.setViewportSize(size);await page.waitForTimeout(200);
 const region=await page.locator('.arena-v2').boundingBox();assert.ok(region.y+region.height<=size.height*.92+1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth),false);
}
assert.deepEqual(errors,[]);await browser.close();console.log('Arena smoke passed: seven views, four viewport sizes, round bearer auth.');
