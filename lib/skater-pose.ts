export type Pose={front:number;mirror:boolean;angle:number;stride:boolean};
export function waitingPose(id:string,x:number,towards:number):Pose{
 const hash=Array.from(id).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
 return {front:hash%3===0?0:1,mirror:hash%2===0,stride:hash%3===0&&hash%2===1,
  angle:Math.max(-.22,Math.min(.22,(towards-x)/1000))+((hash%5)-2)*.035};
}
// Blade contact points measured on the body-centred 384px home sprites.
export function puckOffset(pose:Pose,scale:number){
 const back=pose.stride?{x:-31,y:-46}:{x:33,y:-47};
 const x=(back.x*(1-pose.front)+38*pose.front)*(pose.mirror?-1:1);
 const y=(back.y*(1-pose.front)+55*pose.front)*scale;
 return {x:x*Math.cos(pose.angle)-y*Math.sin(pose.angle),y:x*Math.sin(pose.angle)+y*Math.cos(pose.angle)};
}
export function endpointWeight(progress:number){const t=Math.max(0,Math.min(1,progress/.22));return 1-t*t*(3-2*t);}
