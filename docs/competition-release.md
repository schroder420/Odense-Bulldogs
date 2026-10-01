# Udgivelse: automatisk afvikling og rundens storskærm

## Aktivering

1. Afslut en eventuel gammel konkurrence først. Tag normal databasebackup.
2. Kør `supabase/009_scheduled_competitions.sql` i Supabase SQL-editoren.
3. Kør `supabase/010_competition_clock.sql`. Supabase Cron skal være tilgængelig med sekundintervaller (pg_cron >= 1.6). Jobbet hedder `bulldogs-competition-clock`; det andet job begrænser kun dette jobs historik til ét døgn.
4. Deploy koden til Vercel. Bevar SESSION_SECRET, så eksisterende deltagercookies og gamle vouchers fortsat virker. LEADERBOARD_ACCESS_CODE bruges ikke længere.
5. Log ind i personalevisningen. Der må ikke være en advarsel om manglende automatisk afslutning.

## Kontrol i det rigtige miljø

- Planlæg én kort konkurrence lidt frem i tiden. Åbn og kopiér storskærmslinket med det samme. Før start skal den vise starttid, og nye konkurrenceforsøg skal være afvist.
- Kontrollér alle tre automatiske slides og manuelle valg. Sidste ti sekunder skal overtage, uanset valgt slide.
- Lad et forsøg løbe til slutfløjt. Det skal stoppe ved nul og indsendes efter fem sekunder. Efter yderligere fem sekunder skal top 5 fastlåses uden klik. Luk også personalefanen for at bevise uafhængig afvikling.
- Kontrollér mindst seks deltagere: kun de fem højest rangerede får voucher. En voucher kan swipes én gang, og indløst status overlever genindlæsning.
- Åbn en ny runde; den gamle skærm må fortsat vise den gamle rundes vindere. Den gamle QR skal fortsat gå til den gamle runde.
- På den faktiske 672 × 336-skærm: kontrollér 8 % fri bund og scan QR-koden fra tilskuerafstand. Den dæmpede baggrund er ikke fysisk scanningsgodkendt, før dette er prøvet.

## Lokale kontroller

`npm test`, `npm run typecheck`, `npm run build`.
`BASE_URL=http://localhost:3010 node scripts/arena-smoke.mjs` mod en lokal server tester syv skærmtilstande med simulerede API-svar og fire viewportstørrelser. `BASE_URL=http://localhost:3010 node scripts/player-finish-smoke.mjs` tester slutfløjt, fem sekunders forsinkelse, tak-besked og fravær af voucher uden for top 5 med simuleret API. Det er ikke en Supabase-/Vercel-belastningstest. Brug Chrome eller tilpas Playwrights browserinstallation.

Den nye samtidige slutfløjtsbølge er ikke belastningstestet i produktion. Fem sekunder til indsendelse kan ikke garantere mod udfald på telefonens mobilforbindelse. Pending-resultatet gemmes lokalt og genindsendes idempotent; efter fastlåsning ændres vinderne ikke.

Supabase Cron: https://supabase.com/docs/guides/cron/quickstart

## Start en planlagt kamp straks

Kør `supabase/011_start_round_now.sql` før deploy af knappen **Start kamp nu**. Den flytter start, slutfløjt og fastlåsning samlet, så varighed og indsendelsesbuffer bevares. Rundens link og QR ændres ikke. Gentagne klik nulstiller ikke en kamp, der er i gang.
