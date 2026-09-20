# Odense Bulldogs · Hold pucken i live

Spilbar første version af pausespillet, bygget til Next.js på Vercel med Supabase PostgreSQL. Dansk mobilspil, storskærm og personalekontrol. Træning virker uden cloudkonti. Konkurrencen åbner først, når serverens miljøvariabler og databasen er sat op.

## Åbn lokalt

```sh
npm ci
npm run dev
```

- Spil: http://localhost:3000
- Storskærm: http://localhost:3000/leaderboard
- Personale: http://localhost:3000/admin

En QR-kode med `localhost` virker kun på samme computer. Efter publicering bruger QR-koden automatisk sitets offentlige adresse. Lokalt kan samme netværksadresse bruges på computer og telefon til træning.

## Det, der er bygget

- Automatisk bevægelse, fremadrettede afleveringer, modstandere, afskæringer, synligt bandespil og korte undertalssekvenser.
- Tre rolige første modtagere; de første to afleveringer har ingen forsvarere i afleveringsbanen. Modstandere har altid en anden dragt.
- Tidsfrist: `max(1000, 3500 × 0.8 ^ floor(tid_i_sekunder / 10))` millisekunder. Tidsfristen bestemmes ved modtagelse af pucken. Minimum 1 sekund fra 60 sekunder og frem.
- Tryk på en hvid spiller eller en orange bandemarkering. Ingen tastaturgenveje; spillet styres kun med fingeren. Skift væk fra fanen afslutter forsøget. Afleveringen er undervejs 450 ms direkte og 600 ms via banden.
- Serveren udsteder tilfældig bane og forsøgs-ID, genspiller input og beregner resultatet. Klienten sender ikke en vilkårlig highscore. Ét aktivt forsøg pr. deltager, og afsluttede forsøg kan ikke indsendes flere gange med nye resultater.
- Live top 10, top 5 fremhævet, permanent QR-kode, nedtælling og tilstand ved tabt forbindelse. Storskærmen opdateres hvert 2,5 sekund; fælles data har kort CDN-cache.
- **Samlet score = overlevelsestid i sekunder + 1 point per gennemført aflevering.** 24,82 sekunder og 11 afleveringer giver 35,82 point. Ingen presbonus.
- Flere forsøg, kun bedste score tæller. Ved lighed vinder først opnåede score, derefter stabil sortering efter deltager-ID.
- Undertal tager en medspiller ud af opstillingen, men fjerner ikke modstandere. Der er altid mindst én fri afleveringsmulighed.
- Modstanderens trøje- og stribefarve vælges af personalet før runden og farves ind på selve spillersprite'en, så holdene kan kendes fra hinanden på isen.
- Personalet åbner runder, lukker for nye forsøg, skjuler navne og fastlåser top 5. Vindere får et personligt præmiebevis med QR-kode. Indløsning er atomisk i databasen og tillades kun én gang.
- Hvid dragt uden sponsorer, leveret Bulldogs-logo og farverne #18492E, #B4232A og #E48331. Fire spillersprites, to skridtfaser per hold, med gennemsigtig baggrund på cirka 12 KB hver. Skrifttyper hostes lokalt.
- Modstandersprite'en er en **farvemester**: kraftigt mættet blå trøje og magenta kanter. De to farvetoner ligger langt fra hinanden og langt fra det sorte udstyr, så `lib/sprites.ts` kan bytte dem præcist til personalets valgte farver, mens hjelm, handsker, skøjter og stav aldrig bliver ramt.

## Opret klubbens konti og publicér

1. Brug en kontaktmail, klubben kontrollerer. En særskilt Gmail kan bruges; en klubmail er lettere at overdrage. Klubben bør eje gendannelse og tofaktorgodkendelse. Brug individuelle projektadgange frem for delte adgangskoder.
2. Opret klubbens Supabase-organisation og et nyt projekt i EU, helst Frankfurt. Gem databaseadgangskoden i klubbens passwordmanager. Opret et særskilt stagingprojekt til test.
3. Kør migrationerne i rækkefølge i projektets SQL-editor. RLS er slået til, og `anon`/`authenticated` har ingen adgang til spildata eller serverfunktionerne.

   | Fil | Hvad den gør |
   | --- | --- |
   | `supabase/001_initial.sql` | Tabeller, indekser, transaktioner og adgangskontrol |
   | `supabase/002_opponent_kit.sql` | Modstanderens navn og farver samt spilversion på forsøg |
   | `supabase/003_screen_control.sql` | Fjernstyring af storskærmens indhold |
   | `supabase/004_total_score.sql` | Samlet score: `score_points`, `time_ms` og `passes` |

   **Rækkefølgen ved udgivelse betyder noget.** Kør SQL'en først, deploy bagefter. Koden kalder `finish_run` med fem argumenter og læser `score_points`; uden 004 kan resultater ikke gemmes. Mangler en migration, svarer API'et med præcis hvilken fil der skal køres.
4. Opret et Vercel-team ejet af klubben. Brug Pro til den kommercielle klubinstallation. Importér denne mappe via klubbens GitHub-repository, eller deploy med Vercel CLI. Framework: Next.js. Build: `npm run build`. Installer fra den medfølgende lockfil.
5. Indstil disse **servermiljøvariabler** i Vercel. Ingen må begynde med `NEXT_PUBLIC_`:

| Navn | Værdi |
| --- | --- |
| `SUPABASE_URL` | Projektets URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Projektets service-role-nøgle, kun på serveren |
| `SESSION_SECRET` | Tilfældigt genereret hemmelighed på mindst 32 tegn |
| `ADMIN_PASSWORD` | En separat stærk adgangskode på mindst 16 tegn |
| `APP_ORIGIN` | Den præcise offentlige HTTPS-adresse uden afsluttende `/` |

Generér to uafhængige værdier med `openssl rand -hex 32` til session og personale, og gem dem direkte i Vercel/passwordmanager. Del dem ikke i chat eller Git. `SESSION_SECRET` skal bevares mellem deploys: udskiftning ugyldiggør både deltageradgang og afledte præmiekoder.

6. Vælg samme region for Vercel og Supabase; `vercel.json` peger på Frankfurt. Tilknyt klubbens ønskede domæne. Genudgiv efter ændringer i miljøvariabler.
7. Kontrollér alle tre sider via HTTPS. Test to separate deltagerbrowsere og personalets browser i staging. Åbn én runde, indsend tider, luk runden, fastlås og kontrollér dobbeltindløsning. Gentag med tabt forbindelse og genindsendelse.

Der er ikke oprettet konti, brugt eksisterende private projekter, købt abonnementer eller publiceret en produktion fra denne leverance.

## Konkurrencens afslutning

Personalet vælger 1–15 minutter til nye forsøg. Alle forsøg har samme sidste fløjt, 30 sekunder efter denne periode. Herefter er der 20 sekunder til netværksforsinkede resultater. Først derefter kan personalet fastlåse top 5 og udstede præmiebeviser.

Knappen “Luk for nye forsøg” stopper kun nye starter. Eksisterende forsøg beholder den oprindelige slutfrist, så klient og server ikke kommer til at bedømme forskellige tidsgrænser. Vindere skal beholde samme browser og nødvendige cookie. Et deltager-ID er bevis på adgang til resultatet, ikke på en persons borgerlige identitet. Deling af et præmiebevis svarer til at give billetten til en anden. Personalet skal vente på bekræftet indløsning før udlevering.

Præmieteksten er redigerbar. De foreslåede ølbilletter er en standard i personalets formular, ikke en bekræftet præmieordning.

## Kapacitet: 500–3.000 samtidige

Arkitekturen minimerer trafik: spillet kører på telefonen, grafik og fonts kan caches, og resultater går gennem serveren ved start/slut. Ingen websocket pr. spiller, ingen netværkskald pr. aflevering. Storskærmen læser en fælles top 10. Mobilen holder op med at hente data under selve forsøget. Et anonymt deltager-ID undgår Supabase Auth-tilmeldinger ved det store scan-øjeblik.

**3.000 deltagere er ikke kapacitetsgodkendt endnu.** Cloudkonti og en repræsentativ belastningstest mangler. Databasecompute, forbindelsesgrænser, Vercel-concurrency, CDN-hit rate og budgetalarmer skal måles på den valgte opsætning. Undgå en lav IP-grænse for almindelige spillere: mange tilskuere kan dele arenaens offentlige IP.

`scripts/load-test.js` er en k6-test med 500 → 1.500 → 3.000 virtuelle deltagere og en separat storskærm. Den laver rigtige testdeltagere og mange writes. Brug kun isoleret staging med en 15-minutters åben runde, og slet testdata efter aftale. Den korte catch-only-runde giver høj skrivebelastning; suppler med længere inputspor og en samlet scan-bølge før kamp.

```sh
k6 run -e BASE_URL=https://DIT-STAGING-DOMÆNE -e STAGING_ACK=yes scripts/load-test.js
```

Mål: under 1 % HTTP-fejl, over 99,5 % godkendte testresultater, p95 under 1,5 s og p99 under 3 s for API-kald. Det er acceptkriterier, ikke målte resultater. Test også på arenaens mobilnet/Wi-Fi, med storskærmens faktiske browser og skærmopløsning.

## Sikkerhed og praktiske grænser

Resultatgenspilning forhindrer simple falske scores og ulovlige afleveringer; det er **ikke fuld botbeskyttelse**. En teknisk deltager kan automatisere lovlige input eller oprette flere browseridentiteter. Inden præmier i rigtig drift skal klubben beslutte behov for ekstra botbeskyttelse/deltagerkontrol og teste dette. Der loves ikke “snydesikkert”.

Personaleadgang bruger en signeret, HttpOnly-cookie, origin-kontrol og en databasebaseret loginbegrænsning. SQL-funktionerne er utilgængelige fra den offentlige Supabase-nøgle. Service-role-nøglen omgår RLS og skal forblive på serveren. Præmier gemmer kun hash af indløsningskoden. Toplisten viser kun kaldenavne og resultater.

Der gemmes kaldenavn, anonymt deltager-ID, forsøg, tider og udleveringsstatus. Ingen mail/telefon indsamles fra tilskuere. Klubben skal fastlægge slettefrist og sin deltagertekst inden lancering. Delte personaleadgange kan senere erstattes af individuelle personalekonti, hvis der er behov for navngivet udleveringslog.

## Kontrol og vedligehold

```sh
npm test
npm run typecheck
npm run build
```

Tests dækker tidskurven, 500 seeds med hver 180 lovlige afleveringer, bandespil, ulovlige inputs, slutfløjt, resultatgenspilning og databaseforløbet med RLS, bedste tid, fastlåsning og én indløsning. Databasetesten kører rigtig PostgreSQL via PGlite lokalt; den erstatter ikke Supabase/Vercel-integrationstesten.

Grafik: spillerbillederne er genereret ud fra prompterne i `assets-source/generation-prompts-v3.txt`. Originalerne ligger i `assets-source/` og bliver **ikke** deployet; kun de optimerede WebP-filer i `public/assets/` sendes til browseren.

```sh
python3 scripts/prepare-sprites.py   # kræver Pillow
```

Scriptet fjerner løsrevne halvgennemsigtige klatter fra generatoren, centrerer hvert billede på spillerens krop i stedet for på staven, så trykområdet passer med figuren, og skalerer til 384 x 384 WebP.

Hver spiller beholder sin egen skridtfase hele vejen. Faserne må ikke skiftes på den samme spiller, fordi staven ligger i hver sin side af kroppen i de to faser. Logoet er leveret af brugeren. Trøjerne er en spilfortolkning set ovenfra, ikke officielle produktfotos.

Kilder kontrolleret under opbygning: [Odense Bulldogs](https://bulldogs.dk/), [Vercel Hobby-begrænsninger](https://vercel.com/docs/plans/hobby), [Supabase produktionstjek](https://supabase.com/docs/guides/deployment/going-into-prod), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
