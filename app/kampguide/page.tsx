import type {Metadata} from 'next';
import styles from './kampguide.module.css';

// Kampguide til nye tilskuere (link i billetmailen). Slides og PDF genereres i projektmaterialet
// (Figma: Klientrapport-filen, sektionen "Kampguide v3") og ligger i public/kampguide.
const DIR='/kampguide';
const PDF=`${DIR}/Kampguide-Odense-Bulldogs.pdf`;
const slides:{file:string;alt:string}[]=[
 {file:'kampguide_01_Forside.jpg',alt:'Kampguide fra Odense Bulldogs: Få mere ud af kampen. 5 ting, der gør ishockey lettere at følge.'},
 {file:'kampguide_02_Kampforloeb.jpg',alt:'01 Kampens forløb – 3 × 20 minutter. Tre perioder på 20:00 med pause imellem. Fløjt: uret stopper. Faceoff: uret kører. Står det lige efter 60 minutter i Metal Ligaens grundspil, spilles op til 5 minutters overtid med 3 mod 3 plus målmænd, og første mål vinder. Er det stadig lige, afgøres kampen på straffeslag, hvor holdene skyder på skift. Se efter: Ved faceoff slipper dommeren pucken mellem to spillere, og uret kører igen.'},
 {file:'kampguide_03_Powerplay.jpg',alt:'02 Udvisning – Powerplay og boxplay. Powerplay, 5 mod 4: Bulldogs har én markspiller mere. Boxplay, 4 mod 5: Bulldogs har én markspiller mindre. En mindre straf giver 2 minutter i boksen. Holdet med en spiller mere er i powerplay, det andet hold i boxplay. Scorer powerplay-holdet, slutter straffen. Se efter: Holdet i boxplay stiller sig i en firkant – boksen – og må sende pucken helt ned uden icing.'},
 {file:'kampguide_04_Offside.jpg',alt:'03 Offside – Pucken først. OK: Pucken er inde først. Offside: Angriber inde før pucken. Pucken skal som hovedregel ind over den blå linje før angriberne. Kommer en angriber ind i zonen for tidligt, kan der dømmes offside. Se efter: Ved forsinket offside løfter linjedommeren armen. Angriberne skal ud af zonen igen.'},
 {file:'kampguide_05_Icing.jpg',alt:'04 Icing – Skudt helt ned. OK: Skudt fra anden halvdel. Icing: Skudt fra egen halvdel. Skydes pucken fra egen halvdel over modstanderens mållinje, uden at nogen rører den, kan der dømmes icing. Hold i boxplay må gerne. Se efter: Linjedommeren vurderer, hvem der når pucken først. Vinder angriberen, kan icing vinkes af.'},
 {file:'kampguide_06_TomKasse.jpg',alt:'05 Tom kasse – Målmanden ud. Gevinst: 6 mod 5, én angriber mere. Risiko: Eget mål er tomt. Er Bulldogs bagud til sidst, kan træneren tage målmanden ud og sende en ekstra markspiller på isen. Flere angribere, men et tomt mål. Se efter: Kører målmanden mod bænken i de sidste minutter, skal der udlignes nu.'},
 {file:'kampguide_07_Slut.jpg',alt:'Klar til næste periode? Gem guiden til næste kamp, og del den med din kampmakker. #LetsGoBulldogs. Metal Ligaens grundspil, opdateret nov. 2026. Regler: IIHF og DIU.'},
];

// Delingsbilledet (og:image) skal have en fuld adresse; Vercel sætter produktionsdomænet ved build.
const SITE=process.env.VERCEL_PROJECT_PRODUCTION_URL?`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`:'https://odense-bulldogs.vercel.app';

export const metadata:Metadata={
 metadataBase:new URL(SITE),
 title:'Kampguide · Odense Bulldogs',
 description:'Få mere ud af kampen: 5 ting, der gør ishockey lettere at følge.',
 robots:{index:true,follow:true},
 openGraph:{title:'Kampguide · Odense Bulldogs',description:'Få mere ud af kampen: 5 ting, der gør ishockey lettere at følge.',images:[{url:`${DIR}/${slides[0].file}`,width:1080,height:1350}],type:'website',locale:'da_DK'},
};

export default function Kampguide(){
 return <main className={styles.page}>
  <div className={styles.slides}>
   {slides.map((s,i)=><img key={s.file} src={`${DIR}/${s.file}`} alt={s.alt} width={1080} height={1350} loading={i===0?'eager':'lazy'} decoding="async"/>)}
   <a className={styles.pdf} href={PDF} download>Hent som PDF</a>
  </div>
 </main>;
}
