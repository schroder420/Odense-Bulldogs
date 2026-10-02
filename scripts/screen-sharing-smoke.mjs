import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const base=process.env.BASE_URL||'http://localhost:3010';
const round={id:'11111111-1111-4111-8111-111111111111',title:'Bulldogs mod Herning',status:'open',starts_at:new Date(Date.now()+60000).toISOString(),ends_at:new Date(Date.now()+240000).toISOString(),cutoff_at:new Date(Date.now()+250000).toISOString(),timing_version:2,screen_mode:'leaderboard',screen_rotation:false,prize:'1 alm. fadøl eller sodavand'};
const link=`${base}/leaderboard?round=${round.id}#token=sharing-test-only`;
const board={configured:true,round,entries:[],participants:0,serverTime:new Date().toISOString()};
const staff=await browser.newContext({viewport:{width:390,height:844}});
await staff.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedScreenLink=text;}}}));
await staff.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname;
 if(path==='/api/admin')return route.fulfill({json:{configured:true,authenticated:true,clockReady:true,board,participants:[]}});
 if(path==='/api/admin/screen-link')return route.fulfill({json:{url:link}});
 if(path==='/api/admin/analytics')return route.fulfill({json:{rounds:[],roundId:null,metrics:null}});
 throw new Error(`Unexpected staff request: ${path}`);
});
const admin=await staff.newPage();await admin.goto(`${base}/admin`);
const card=admin.getByRole('region',{name:`Storskærm til ${round.title}`});await card.waitFor();
assert.equal(await card.getByRole('heading',{name:round.title}).count(),1);
await card.getByRole('button',{name:'Kopiér link',exact:true}).click();
await admin.getByText('Link kopieret – send det til den, der skal vise skærmen.').waitFor();
assert.equal(await admin.evaluate(()=>window.copiedScreenLink),link);
assert.equal(await card.getByRole('textbox',{name:'Delbart storskærmslink'}).inputValue(),link);
// Recipient has no staff cookies or storage. Disabling storage must not break the link.
const recipient=await browser.newContext();
await recipient.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('Storage disabled');};Storage.prototype.setItem=()=>{throw new Error('Storage disabled');};});
await recipient.route('**/api/screen-board?*',async route=>{
 assert.equal(route.request().headers().authorization,'Bearer sharing-test-only');assert.equal(route.request().headers().cookie,undefined);
 await route.fulfill({json:board});
});
const screen=await recipient.newPage();await screen.goto(link);await screen.locator('.arena-v2').waitFor();
assert.equal(screen.url(),link);assert.equal(await screen.getByText(round.title,{exact:true}).count(),0);
await screen.reload();await screen.locator('.arena-v2').waitFor();assert.equal(screen.url(),link);
assert.deepEqual(await recipient.cookies(),[]);
await browser.close();console.log('Sharing passed: named staff card, copy without opening, URL retained, fresh recipient/reload without login or storage; no round title on screen.');
