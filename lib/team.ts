export type OpponentKit={name:string;primary:string;stripe:string};
export const DEFAULT_OPPONENT:OpponentKit={name:'Modstanderne',primary:'#24364B',stripe:'#E48331'};
export const HEX_COLOR=/^#[0-9a-fA-F]{6}$/;
export function validKit(value:unknown):value is OpponentKit{
 if(!value||typeof value!=='object')return false;
 const kit=value as OpponentKit;
 return typeof kit.name==='string'&&kit.name.trim().length>=2&&kit.name.trim().length<=40&&HEX_COLOR.test(kit.primary)&&HEX_COLOR.test(kit.stripe)&&kitLuminance(kit.primary)<.65;
}
export function kitLuminance(hex:string){
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
export function roundKit(round?:{opponent_name?:string;opponent_primary?:string;opponent_stripe?:string}|null):OpponentKit{
 return {name:round?.opponent_name||DEFAULT_OPPONENT.name,primary:round?.opponent_primary||DEFAULT_OPPONENT.primary,stripe:round?.opponent_stripe||DEFAULT_OPPONENT.stripe};
}
