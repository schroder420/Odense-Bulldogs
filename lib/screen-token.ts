import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
export const roundIdValid=(id:unknown):id is string=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function screenToken(roundId:string,expires:number,secret:string){
 if(!roundIdValid(roundId)||secret.length<32)throw new Error('Invalid screen configuration');
 const body=Buffer.from(JSON.stringify({roundId,expires,kind:'round-screen',nonce:randomBytes(12).toString('hex')})).toString('base64url');
 return `${body}.${createHmac('sha256',secret).update(body).digest('base64url')}`;
}
export function verifyScreenToken(token:string,roundId:string,secret:string,now=Date.now()){
 try{if(secret.length<32||token.length>1024||!roundIdValid(roundId))return false;
 const parts=token.split('.');if(parts.length!==2)return false;
 const expected=createHmac('sha256',secret).update(parts[0]).digest('base64url');
 if(parts[1].length!==expected.length||!timingSafeEqual(Buffer.from(parts[1]),Buffer.from(expected)))return false;
 const value=JSON.parse(Buffer.from(parts[0],'base64url').toString());
 return value.kind==='round-screen'&&value.roundId===roundId&&Number.isFinite(value.expires)&&value.expires>now;
 }catch{return false;}
}
