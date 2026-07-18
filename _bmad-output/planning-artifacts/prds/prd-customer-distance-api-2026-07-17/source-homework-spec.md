# Eredeti házifeladat-specifikáció (verbatim, felhasználó által beillesztve)

Építs egy kicsi, önálló REST szolgáltatást Postgres fölött. Offline kell futnia: nincs külső geokódoló API, nincs LLM-hívás futásidőben.

## ADAT

A seed adat a repóban lévő seed-customers.json fájlban van (15 ügyfél: name, budget, location.city, location.countryCode, note). A location.city a település.

## ADATMODELL (minimum)

customers: id, name, telepules, lat (nullable), lon (nullable). A budget és a note eltárolható, de nem kötelező.

## BETÖLTÉS (idempotens seed + geokódolás)

- Töltsd be a seed-customers.json-t. Kétszer lefuttatva ne duplázzon.
- Minden ügyfél településéhez rendelj lat/lon-t egy lokális, a repóba bundle-olt település -> lat/lon referenciából.
- Nincs külső geokódoló API-hívás.
- A település-egyeztetés legyen ékezet-, kis/nagybetű- és whitespace-független.
- A Budapest érték és opcionálisan a kerületei a fővárosra essenek.
- Ismeretlen település esetén lat/lon = null, warning log, de a folyamat ne álljon le.

## VÉGPONTOK

- GET /customers/count -> { "count": <egész> }
- GET /customers/by-distance -> ügyféllista növekvő Budapest-távolság szerint
- Minden elem tartalmazza a distanceKm mezőt, 1 tizedesre kerekítve
- Budapesti ügyfelek elöl, 0 km-rel
- Ismeretlen koordinátájú ügyfelek a lista végén, distanceKm: null
- Holtverseny esetén name szerinti rendezés

## TESZT

- Haversine unit teszt:
  - Budapest–Bécs körülbelül 214 km
  - Budapest–Budapest = 0 km
  - null koordináta kezelése

## MINŐSÉG

- Kis, fókuszált commitok
- README: Postgres indítás, migráció, seed, szerver, tesztek
- PostgreSQL MCP bekötése és használata séma- és adatellenőrzésre

## LEADANDÓ

- A megoldás külön harness/bmad branchen készüljön
- A teljes BMAD tervezési és implementációs folyamat legyen megőrizve
- Egyelőre csak a PRD workflow-t futtasd le
- Ne kezdj implementációs kódot írni

---

# Kiegészítő döntések a beszélgetés során (a Coaching path alatt, a felhasználótól)

- A termékcél (Vision) és a házifeladat/harness-összehasonlítás célja (Evaluation Context) külön szakaszban szerepeljen.
- Az ismeretlen település kezelése kötelező robusztussági követelmény, de a 15 valós seed-városhoz várhatóan minden bejegyzés meglesz — ezt dedikált teszttel/teszt-fixture-rel kell bizonyítani, nem a normál seed eredményében.
- JTBD prioritási sorrend: (1) kiértékelő reprodukálhatóan indítja/ellenőrzi a szolgáltatást, (2) fejlesztő idempotensen tölti be a seedet, (3) kiértékelő ellenőrzi a count és rendezés helyességét, (4) fejlesztő ellenőrzi az edge case-eket, (5) kiértékelő nyomon követi a BMAD láncot vs. Superpowers.
- Glossary +2 fogalom: Budapest referencia-koordináta (rögzített app-szintű konstans, nem customer rekordból származik); Valós adatbázis-rekordszám (a count valódi DB-lekérdezésből származik, nem hardcode és nem a seed fájl elemszáma).
- Település-koordináta referencia: kizárólag a seed-folyamat használja offline geokódolásra; a lekérdezési végpontok a már eltárolt lat/lon-t olvassák, nem geokódolnak újra.
- Features 5 klaszterre bontva (F1 adatmodell/migráció, F2 idempotens seed+offline geokódolás, F3 Distance API végpontok, F4 tesztelés, F5 fejlesztői futtatás/ellenőrizhetőség) a jövőbeli epic/story-bontás és fókuszált commitok támogatására.
- FR-2 természetes kulcs: UNIQUE(name, telepules) összetett kulcs; countryCode eltárolható, de nem része a kulcsnak, nem kötelező.
- FR-7 rendezés: nem-null distanceKm növekvő elöl, utána null distanceKm a végén, mindkét csoporton belül name szerinti növekvő holtverseny-feloldás; a rendezés app- vagy SQL-oldali lehet, de determinisztikus.
- FR-7 válasz mezői: teljes tárolt customer rekord (id, name, telepules, lat, lon) + distanceKm; budget/note/countryCode is szerepelhet, ha tárolva van, de nem kötelező elfogadási feltétel.
- FR-12/FR-14: Docker Compose a hivatalos lokális Postgres-indítási mechanizmus; README fedje le: docker compose up -d, migráció, seed, szerver, tesztek, leállítás/volume törlés.
- Haversine tolerancia: Budapest–Bécs ≈ 214 km, ±1 km, rögzítve.
- Budapest kerületei: a normál seedhez elég a sima "Budapest" érték; a normalizálás opcionálisan kezelheti a kerület-jelöléseket (pl. "Budapest XIII.", "Budapest 13", "Budapest, XI. kerület") a központi Budapest referencia-koordinátára foldolva, de ez nem kötelező, külön referencia-bejegyzés kerületenként nem szükséges.
- Település-referencia mérete: MVP-ben kizárólag a 15 seed-város + a Budapest referencia-koordináta; nem cél általános városadatbázis.
- SM-1 pontosítás: nem "egy teszt per FR", hanem "minden kritikus elfogadási feltétel automatikus teszttel vagy reprodukálható verifikációs lépéssel bizonyított"; az MCP-használat nem igényel automatizált tesztet, elég a dokumentált konfiguráció + egy dokumentált séma-/adatellenőrzési lépés.
- SM-2 "tiszta gépen" reprodukálhatóság: README alapján, Node.js, Docker és npm megléte esetén, külső szolgáltatás nélkül elindítható.
