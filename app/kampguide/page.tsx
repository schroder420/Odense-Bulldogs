import type {Metadata} from 'next';
import styles from './kampguide.module.css';

// Kampguide til nye tilskuere (link i billetmailen). Slides og PDF genereres i projektmaterialet
// (Claude arbejdsfiler/2026-10-04 Kampguide-regler) og ligger i public/kampguide.
const DIR='/kampguide';
const PDF=`${DIR}/Kampguide-Odense-Bulldogs.pdf`;
const slides:{file:string;alt:string}[]=[
 {file:'kampguide_01_Forside.jpg',alt:'Kampguide fra Odense Bulldogs: Ny til ishockey? Reglerne, der gør kampen spændende.'},
 {file:'kampguide_02_Offside.jpg',alt:'01 Offside – Pucken først. Den blå linje er grænsen til zonen foran målet. Angriberne må ikke køre over den før pucken. Ellers fløjter dommeren, og der bliver faceoff. Se efter: Linjedommeren løfter armen, når et angreb er lige ved at blive offside.'},
 {file:'kampguide_03_Udvisning.jpg',alt:'02 Udvisning – 2 min. i boksen. Ved en forseelse skal spilleren sidde 2 minutter i udvisningsboksen, og holdet spiller med én mindre. Scorer det andet hold, er udvisningen slut. Se efter: Bulldogs i overtal hedder powerplay. Det er den store chance for mål.'},
 {file:'kampguide_04_Icing.jpg',alt:'03 Icing – Skudt helt ned. Skyder et hold pucken fra egen halvdel helt ned over modstanderens mållinje, uden at nogen rører den, er det icing. Så bliver der faceoff ved holdets eget mål. Se efter: Er holdet, der skød, først ved pucken, bliver icing annulleret.'},
 {file:'kampguide_05_TomKasse.jpg',alt:'04 Tom kasse – Målmanden ud. Er Bulldogs bagud til sidst i kampen, kan træneren tage målmanden ud og sende en ekstra markspiller på isen. Det giver flere angribere, men et tomt mål.'},
 {file:'kampguide_06_Spilletid.jpg',alt:'05 Spilletid – Uret står stille. Tre perioder på 20:00 med 18 minutters pause imellem. Fløjt: uret stopper. Faceoff: uret kører. En kamp er 3 × 20 minutters spilletid. Uret stopper, hver gang dommeren fløjter, så en kamp varer meget længere end en time. Se efter: Uret på storskærmen tæller ned. Står det stille, er spillet stoppet.'},
 {file:'kampguide_07_Uafgjort.jpg',alt:'06 Uafgjort – Lige? Overtid. Står det lige efter 60 minutter i grundspillet, spilles der op til 5 minutters overtid med 3 mod 3. Første mål vinder. Bliver der ikke scoret, afgøres kampen på straffeslag: én spiller mod målmanden. Se efter: Ved straffeslag skyder 3 fra hvert hold. Er det stadig lige, går det én ad gangen.'},
 {file:'kampguide_08_Slut.jpg',alt:'Vi ses i hallen. Tag én med, der aldrig har set ishockey. #LetsGoBulldogs'},
];

// Delingsbilledet (og:image) skal have en fuld adresse; Vercel sætter produktionsdomænet ved build.
const SITE=process.env.VERCEL_PROJECT_PRODUCTION_URL?`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`:'https://odense-bulldogs.vercel.app';

export const metadata:Metadata={
 metadataBase:new URL(SITE),
 title:'Kampguide · Odense Bulldogs',
 description:'Ny til ishockey? De regler, der gør kampen spændende.',
 robots:{index:true,follow:true},
 openGraph:{title:'Kampguide · Odense Bulldogs',description:'Ny til ishockey? De regler, der gør kampen spændende.',images:[{url:`${DIR}/${slides[0].file}`,width:1080,height:1350}],type:'website',locale:'da_DK'},
};

export default function Kampguide(){
 return <main className={styles.page}>
  <div className={styles.slides}>
   {slides.map((s,i)=><img key={s.file} src={`${DIR}/${s.file}`} alt={s.alt} width={1080} height={1350} loading={i===0?'eager':'lazy'} decoding="async"/>)}
   <a className={styles.pdf} href={PDF} download>Hent som PDF</a>
  </div>
 </main>;
}
