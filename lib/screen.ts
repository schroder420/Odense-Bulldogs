import type {Round} from './types';
export function screenView(round:Round|null|undefined,now:number){
 const remaining=round?Math.ceil((Date.parse(round.ends_at)-now)/1000):0;
 if(round?.status==='open'&&remaining>0&&remaining<=10)return 'countdown';
 const mode=round?.screen_mode||'leaderboard';
 if(mode==='winners'&&round?.status!=='final')return 'leaderboard';
 if(mode==='leaderboard'&&round?.status==='final')return 'winners';
 return mode;
}
