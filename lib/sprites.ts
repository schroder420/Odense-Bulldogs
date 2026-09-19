import type {OpponentKit} from './team';
// The source encodes jersey/socks in blue and trim in magenta. Keep equipment untouched.
// Bake once per kit, never per animation frame. Value preserves the generated fabric shading.
export function tintOpponent(image:HTMLImageElement,kit:OpponentKit):HTMLCanvasElement{
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
 const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const primary=rgb(kit.primary),stripe=rgb(kit.stripe);
 for(let i=0;i<data.length;i+=4){
  if(!data[i+3])continue;
  const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  if(delta<.12||max===0)continue;
  const hue=((max===r?(g-b)/delta: max===g?(b-r)/delta+2:(r-g)/delta+4)*60+360)%360;
  const color=hue>=185&&hue<=250?primary:hue>=285&&hue<=335?stripe:null;
  if(!color)continue;
  const weight=Math.min(1,delta/.35);
  for(let c=0;c<3;c++)data[i+c]=Math.round(data[i+c]*(1-weight)+color[c]*max*weight);
 }
 ctx.putImageData(pixels,0,0);return canvas;
}
