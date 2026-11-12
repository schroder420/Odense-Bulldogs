import type {Metadata} from 'next';
import styles from './kampguide.module.css';

// Kampguide til nye tilskuere (link i billetmailen). Slides og PDF genereres i projektmaterialet
// (Claude arbejdsfiler/2026-10-04 Kampguide-regler) og ligger i public/kampguide.
const DIR='/kampguide';
const PDF=`${DIR}/Kampguide-Odense-Bulldogs.pdf`;
const slides:{file:string;alt:string}[]=[
 {file:'kampguide_01_Forside.jpg',alt:'Kampguide fra Odense Bulldogs: Få mere ud af kampen. 6 ting, der gør ishockey lettere at følge.'},
 {file:'kampguide_02_Spilletid.jpg',alt:'01 Spilletid – Uret står stille. Tre perioder på 20:00 med pause imellem. Fløjt: uret stopper. Faceoff: uret kører. Kampen har tre perioder på 20 minutters effektiv spilletid med en pause imellem. Uret stopper ved hvert fløjt, så en kamp varer meget længere end en time. Se efter: Faceoff: Dommeren slipper pucken mellem to spillere, og spillet starter igen. Så kører kampuret.'},
 {file:'kampguide_03_Udvisning.jpg',alt:'02 Udvisning – 2 min. i boksen. 5 mod 5: lige mange markspillere. 5 mod 4: én markspiller mere. En mindre straf giver 2 min. udvisning, og holdet spiller med én mindre. Scorer modstanderen i overtallet, slutter straffen normalt. Se efter: Overtal hedder powerplay. 5 mod 4 tæller kun markspillere, ikke målmænd.'},
 {file:'kampguide_04_Offside.jpg',alt:'03 Offside – Pucken først. OK: pucken er inde først. Offside: angriber inde før pucken. Pucken skal som hovedregel ind over den blå linje før angriberne. Kommer en angriber ind i zonen for tidligt, kan der dømmes offside. Se efter: Ved forsinket offside løfter linjedommeren armen. Angriberne skal ud af zonen igen.'},
 {file:'kampguide_05_Icing.jpg',alt:'04 Icing – Skudt helt ned. OK: skudt fra anden halvdel. Icing: skudt fra egen halvdel. Skydes pucken fra egen halvdel over modstanderens mållinje, uden at nogen rører den, kan der dømmes icing. Hold i undertal må normalt godt. Se efter: Linjedommeren vurderer, hvem der når pucken først. Vinder angriberen, kan icing vinkes af.'},
 {file:'kampguide_06_TomKasse.jpg',alt:'05 Tom kasse – Målmanden ud. Gevinst: 6 mod 5, én angriber mere. Risiko: eget mål er tomt. Er Bulldogs bagud til sidst, kan træneren tage målmanden ud og sende en ekstra markspiller på isen. Flere angribere, men et tomt mål. Se efter: Kører målmanden mod bænken i de sidste minutter, skal der udlignes nu.'},
 {file:'kampguide_07_Uafgjort.jpg',alt:'06 Uafgjort – Lige? Overtid. I Metal Ligaens grundspil: uafgjort efter 60 min., derefter op til 5 minutters overtid 3 mod 3 plus målmænd, hvor første mål vinder, og er det stadig lige, straffeslag, hvor holdene skyder på skift. Se efter: Først 3 straffeslag til hvert hold. Er det stadig lige, får holdene ét forsøg ad gangen, til det er afgjort.'},
 {file:'kampguide_08_Slut.jpg',alt:'Klar til næste periode? Gem guiden til næste kamp, og del den med din kampmakker. #LetsGoBulldogs. Metal Ligaens grundspil, opdateret nov. 2026. Regler: IIHF og DIU.'},
];

// Delingsbilledet (og:image) skal have en fuld adresse; Vercel sætter produktionsdomænet ved build.
const SITE=process.env.VERCEL_PROJECT_PRODUCTION_URL?`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`:'https://odense-bulldogs.vercel.app';

export const metadata:Metadata={
 metadataBase:new URL(SITE),
 title:'Kampguide · Odense Bulldogs',
 description:'Få mere ud af kampen: 6 ting, der gør ishockey lettere at følge.',
 robots:{index:true,follow:true},
 openGraph:{title:'Kampguide · Odense Bulldogs',description:'Få mere ud af kampen: 6 ting, der gør ishockey lettere at følge.',images:[{url:`${DIR}/${slides[0].file}`,width:1080,height:1350}],type:'website',locale:'da_DK'},
};

export default function Kampguide(){
 return <main className={styles.page}>
  <div className={styles.slides}>
   {slides.map((s,i)=><img key={s.file} src={`${DIR}/${s.file}`} alt={s.alt} width={1080} height={1350} loading={i===0?'eager':'lazy'} decoding="async"/>)}
   <a className={styles.pdf} href={PDF} download>Hent som PDF</a>
  </div>
 </main>;
}
