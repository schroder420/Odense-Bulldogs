import type {Round} from './types';
export function screenView(round:Round|null|undefined,now:number){
 const remaining=round?Math.ceil((Date.parse(round.ends_at)-now)/1000):0;
 if(round?.status!=='final'&&round?.timing_version===2&&remaining<=0)return 'collecting';
 if(round?.status!=='final'&&remaining>0&&remaining<=10&&(round?.status==='open'||round?.timing_version===2))return 'countdown';
 const mode=round?.screen_mode||'leaderboard';
 if(round?.screen_rotation&&round.status!=='final'){
  const elapsed=((now-Date.parse(round.starts_at))%60000+60000)%60000;
  return elapsed<36000?'leaderboard':elapsed<51000?'rules':'qr';
 }
 if(mode==='winners'&&round?.status!=='final')return 'leaderboard';
 if(mode==='leaderboard'&&round?.status==='final')return 'winners';
 return mode;
}
