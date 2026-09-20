import type {OpponentKit} from './team';

// Modstandersprite'en er tegnet som farvemester: kraftigt mættet blå trøje og magenta kanter.
// De to farvetoner ligger langt fra hinanden og langt fra det sorte udstyr, så koden kan bytte
// dem præcist. Hjelm, handsker, skøjter og stav er neutralt mørke og bliver aldrig ramt.
// Målt på public/assets/opponent-*.webp: blå ligger i hue 210-240, magenta i hue 315-345.
const JERSEY=1, TRIM=2;
const JERSEY_HUE=[195,260] as const, TRIM_HUE=[292,352] as const;
const MIN_SATURATION=.15;
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));

// Bages én gang per dragt, aldrig per animationsbillede.
export function tintOpponent(image:CanvasImageSource,kit:OpponentKit):HTMLCanvasElement{
 const width=(image as HTMLImageElement).naturalWidth||(image as HTMLCanvasElement).width;
 const height=(image as HTMLImageElement).naturalHeight||(image as HTMLCanvasElement).height;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,width,height),data=pixels.data;
 const kind=new Uint8Array(width*height);
 let jerseySum=0,jerseyCount=0,trimSum=0,trimCount=0;
 for(let i=0,p=0;i<data.length;i+=4,p++){
  if(data[i+3]<40)continue;
  const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  if(delta<MIN_SATURATION||max===0)continue;
  const hue=((max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4)*60+360)%360;
  if(hue>=JERSEY_HUE[0]&&hue<=JERSEY_HUE[1]){kind[p]=JERSEY;jerseySum+=max;jerseyCount++;}
  else if(hue>=TRIM_HUE[0]&&hue<=TRIM_HUE[1]){kind[p]=TRIM;trimSum+=max;trimCount++;}
 }
 if(!jerseyCount&&!trimCount)return canvas;
 // Sprite'ens egen gennemsnitslysstyrke bliver referencen, så stoffets folder overlever farveskiftet.
 const jerseyRef=jerseyCount?jerseySum/jerseyCount:1,trimRef=trimCount?trimSum/trimCount:1;
 const primary=rgb(kit.primary),stripe=rgb(kit.stripe);
 for(let i=0,p=0;i<data.length;i+=4,p++){
  const kindAt=kind[p];if(!kindAt)continue;
  const target=kindAt===JERSEY?primary:stripe,reference=kindAt===JERSEY?jerseyRef:trimRef;
  const max=Math.max(data[i],data[i+1],data[i+2])/255;
  const shade=Math.max(.35,Math.min(2.2,max/reference));
  // Under referencen mørkner vi farven; over den lysner vi mod hvid, så lyse steder ikke klipper skævt.
  for(let c=0;c<3;c++)data[i+c]=Math.round(shade<=1?target[c]*shade:target[c]+(255-target[c])*Math.min(1,(shade-1)/1.2));
 }
 ctx.putImageData(pixels,0,0);return canvas;
}
