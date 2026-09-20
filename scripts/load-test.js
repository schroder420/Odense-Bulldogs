// k6: run only against an isolated staging project with a 15-minute open round.
// k6 run -e BASE_URL=https://your-staging.example -e STAGING_ACK=yes scripts/load-test.js
import http from 'k6/http';
import {check,sleep} from 'k6';
import {Rate} from 'k6/metrics';
const base=__ENV.BASE_URL;
if(!base||__ENV.STAGING_ACK!=='yes')throw new Error('Set BASE_URL and STAGING_ACK=yes for an isolated staging deployment.');
// Skal matche GAME_VERSION i lib/game.ts, ellers afviser serveren hvert forsøg med 409.
const version=Number(__ENV.GAME_VERSION||3);
const accepted=new Rate('results_accepted');
export const options={
 noCookiesReset:true,
 scenarios:{
  audience:{executor:'ramping-vus',exec:'play',startVUs:0,stages:[{duration:'30s',target:500},{duration:'1m',target:500},{duration:'30s',target:1500},{duration:'2m',target:1500},{duration:'30s',target:3000},{duration:'2m',target:3000},{duration:'30s',target:0}],gracefulRampDown:'15s'},
  screen:{executor:'constant-vus',exec:'screen',vus:1,duration:'7m'},
 },
 thresholds:{http_req_failed:['rate<0.01'],http_req_duration:['p(95)<1500','p(99)<3000'],results_accepted:['rate>0.995']},
};
let joined=false;
const headers={'Content-Type':'application/json',Origin:base};
export function play(){
 if(!joined){http.get(base);http.get(`${base}/assets/home-skater.webp`);http.get(`${base}/assets/opponent-skater.webp`);const r=http.post(`${base}/api/join`,JSON.stringify({nickname:`Load-${__VU}`}),{headers,tags:{name:'join'}});if(!check(r,{'joined':r.status===200})){sleep(2);return;}joined=true;}
 const start=http.post(`${base}/api/run/start`,JSON.stringify({version}),{headers,tags:{name:'start'}});
 if(!check(start,{'run started':start.status===200})){sleep(4);return;}
 const run=start.json();sleep(3.6); // Catch-only trace: 0 afleveringer, så scoren er ren overlevelsestid.
 const finish=http.post(`${base}/api/run/finish`,JSON.stringify({id:run.id,events:[],end:3500,abandoned:false}),{headers,tags:{name:'finish'}});
 accepted.add(finish.status===200);check(finish,{'score accepted':finish.status===200});
 http.get(`${base}/api/board`,{tags:{name:'board'}});http.get(`${base}/api/me`,{tags:{name:'me'}});sleep(1+Math.random()*2);
}
export function screen(){const r=http.get(`${base}/api/board`,{tags:{name:'screen'}});check(r,{'board available':r.status===200});sleep(2.5);}
