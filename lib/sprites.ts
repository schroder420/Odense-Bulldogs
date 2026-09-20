import type {OpponentKit} from './team';

// Personalets farvevalg skal ses på isen, ikke kun i previewet.
// Spillersprite'en har en afdaempet marineblaa troeje og kraftige orange kanter. Troejen er for
// lidt maettet til at kunne skilles ud paa farvetone alene, saa den findes paa blaalighed + lysstyrke,
// mens kanterne findes paa maetning. Hjelm, handsker, skoejter og stav er neutralt moerke og roeres ikke.
const JERSEY=1, TRIM=2;
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));

// Bages en gang per draegt, aldrig per animationsbillede.
export function tintOpponent(image:HTMLImageElement,kit:OpponentKit):HTMLCanvasElement{
 const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,width,height),data=pixels.data;
 const kind=new Uint8Array(width*height);
 let jerseySum=0,jerseyCount=0,trimSum=0,trimCount=0;
 for(let i=0,p=0;i<data.length;i+=4,p++){
  if(data[i+3]<40)continue;
  const r=data[i],g=data[i+1],b=data[i+2];
  const max=Math.max(r,g,b),delta=max-Math.min(r,g,b);
  if(delta>=40&&r>b){kind[p]=TRIM;trimSum+=max;trimCount++;}
  else if(delta<40&&b-r>=10&&max>=28&&max<=120){kind[p]=JERSEY;jerseySum+=max;jerseyCount++;}
 }
 if(!jerseyCount&&!trimCount)return canvas;
 // Sprite'ens egen gennemsnitslysstyrke bliver referencen, saa stoffets skygger overlever farveskiftet.
 const jerseyRef=jerseyCount?jerseySum/jerseyCount:1,trimRef=trimCount?trimSum/trimCount:1;
 const primary=rgb(kit.primary),stripe=rgb(kit.stripe);
 for(let i=0,p=0;i<data.length;i+=4,p++){
  const kindAt=kind[p];if(!kindAt)continue;
  const target=kindAt===JERSEY?primary:stripe,reference=kindAt===JERSEY?jerseyRef:trimRef;
  const max=Math.max(data[i],data[i+1],data[i+2]);
  const shade=Math.max(.35,Math.min(2.2,max/reference));
  // Under referencen moerkner vi farven; over den lysner vi mod hvid, saa lyse steder ikke klipper skaevt.
  for(let c=0;c<3;c++)data[i+c]=Math.round(shade<=1?target[c]*shade:target[c]+(255-target[c])*Math.min(1,(shade-1)/1.2));
 }
 ctx.putImageData(pixels,0,0);return canvas;
}
