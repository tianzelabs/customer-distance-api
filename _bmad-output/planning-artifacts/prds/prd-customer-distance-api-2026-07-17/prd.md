---
title: Customer Distance API
status: final
created: 2026-07-17
updated: 2026-07-18
---

# PRD: Customer Distance API

## 0. Document Purpose

Ez a PRD a Customer Distance API tervezési alapja: a terméket a Glossary-ban rögzített szókészlettel írja le, a funkciókat FR-ekbe csoportosítja (globálisan sorszámozva), a következtetéseket pedig `[ASSUMPTION]` jelöléssel jelöli. A dokumentum két, egymástól tudatosan elválasztott réteget tartalmaz: a termékvíziót (§1) és a házifeladat/harness-összehasonlítás meta-célját (§2, Evaluation Context) — a downstream munka (architektúra, epic/story-k) a termékrétegre épül, a meta-réteg csak kontextust ad.

## 1. Vision

A Customer Distance API egy kicsi, önálló, offline és reprodukálható REST szolgáltatás, amely a seedelt ügyféladatokat PostgreSQL-ben tárolja, a településeket egy lokális koordináta-referencia alapján geokódolja (külső geokódoló API vagy futásidejű LLM-hívás nélkül), és az ügyfeleket Budapesttől mért légvonalbeli távolság szerint lekérdezhetővé teszi.

A szolgáltatás magja két lépésből áll: (1) egy idempotens betöltési folyamat, amely a `seed-customers.json` tartalmát és a hozzá tartozó település-koordinátákat konzisztensen viszi be az adatbázisba, és (2) egy szűk, jól definiált REST felület, amely az ügyfélszámot és a Budapest-távolság szerint rendezett ügyféllistát szolgálja ki.

## 2. Evaluation Context *(meta — nem termékkövetelmény)*

Ez a projekt egy házifeladat része, amelynek célja a BMAD-METHOD teljes tervezési és implementációs folyamatának dokumentált végigvitele, majd összehasonlítása a Superpowers harness-szel ugyanerre a feladatra készült megoldással. Ebből következő elvárások:

- A megoldás a `harness/bmad` branchen készül, elkülönítve az esetleges Superpowers-alapú megoldástól.
- A teljes BMAD tervezési lánc (PRD → architektúra → epic/story-k → fejlesztés) végigvitele és nyomon követhetősége — beleértve a döntések indoklását — ugyanolyan súlyú kimenet, mint a végleges kód.
- Ez a workflow-futtatás jelenleg kizárólag a PRD elkészítésére szól; architektúra, epic/story-bontás és implementációs kód e session-ön belül nem készül.
- Az "offline, külső függőség nélkül" megszorítás egyben reprodukálhatósági elvárás is: a kiértékelőnek ugyanazt az eredményt kell kapnia, függetlenül a hálózati környezettől vagy időponttól.
- **Delivery norma (kötelező):** az implementáció kis, fókuszált, értelmes commitokra legyen bontva; a commit history tegye követhetővé a BMAD tervezési és fejlesztési folyamatát; kerülendő az egyetlen, mindent összefogó végső commit.

## 3. Target User

### 3.1 Jobs To Be Done
*Prioritási sorrendben:*

1. Kiértékelőként reprodukálhatóan el tudjam indítani és ellenőrizni a teljes szolgáltatást (Postgres, migráció, seed, szerver).
2. Fejlesztőként idempotensen be tudjam tölteni a seed-adatot, duplikáció nélkül.
3. Kiértékelőként ellenőrizni tudjam a `count` és a Budapest-távolság szerinti rendezés helyességét.
4. Fejlesztőként ellenőrizni tudjam az edge case-eket: 0 km (Budapest), null koordináta (ismeretlen település), holtverseny névsor szerint.
5. Kiértékelőként nyomon tudjam követni a BMAD tervezési és implementációs láncot, és össze tudjam vetni a Superpowers folyamat eredményével.

### 3.2 Key User Journeys

- **UJ-1. A fejlesztő/kiértékelő végigfuttatja a teljes láncot.** Letölti a repót, elindítja a Postgres-t, lefuttatja a migrációt és a seedet, elindítja a szervert, majd meghívja a `/customers/count` és `/customers/by-distance` végpontokat, hogy ellenőrizze a helyes rendezést, a Budapest=0km esetet és a null-koordinátás eseteket.

## 4. Glossary

- **Customer (ügyfél)** — A `seed-customers.json`-ból betöltött entitás. Tárolt mezők: `id`, `name`, `telepules`, `lat` (nullable), `lon` (nullable); opcionálisan `budget`, `note`, `countryCode`.
- **Település (telepules)** — Az ügyfél városa, a seed `location.city` mezőjéből. Az API és adatmodell szintjén ez az egyetlen lokációs kulcs.
- **Település-koordináta referencia** — A repóba bundle-olt, lokális adatforrás, amely település neveket lat/lon párokra képez le. Kizárólag a seed (betöltési) folyamat használja offline geokódolásra; a lekérdezési végpontok a már eltárolt `lat`/`lon` értékeket olvassák, nem geokódolnak újra.
- **Normalizált településnév** — Az egyeztetéshez használt alak: ékezet-, kis/nagybetű- és whitespace-független összehasonlítás a `telepules` és a referencia kulcsai között.
- **Ismeretlen település** — Olyan `telepules` érték, amelyhez a referencia nem tartalmaz bejegyzést. Ilyenkor `lat`/`lon` = `null`, figyelmeztető log íródik, a betöltés nem áll le.
- **Idempotens betöltés (seed)** — A `seed-customers.json` és a település-referencia alapú betöltési folyamat, amely többszöri lefuttatás esetén sem hoz létre duplikált `customers` sorokat.
- **Budapest referencia-koordináta** — A távolságszámítás rögzített kiindulópontja; alkalmazás-szintű, definiált konstans, nem egy customer rekordból származik.
- **Haversine-távolság** — A gömbi távolságszámítási képlet, amellyel a `distanceKm` értékét számítjuk egy ügyfél koordinátája és a Budapest referencia-koordináta között.
- **distanceKm** — A `/customers/by-distance` válasz minden elemén szereplő mező: Budapest-távolság kilométerben, 1 tizedesjegyre kerekítve; `null`, ha az ügyfél koordinátája ismeretlen.
- **Holtverseny (tie-break)** — Amikor két vagy több ügyfél `distanceKm` értéke megegyezik; ilyenkor `name` szerinti növekvő rendezés dönt.
- **Valós adatbázis-rekordszám** — A `customers` táblában ténylegesen meglévő sorok száma, amelyet a `GET /customers/count` adatbázis-lekérdezéssel ad vissza; nem lehet hardcode-olt érték vagy közvetlenül a seed-fájl elemszáma.

## 5. Features

### 5.1 F1 — PostgreSQL adatmodell és migráció

**Leírás:** A `customers` tábla és a hozzá tartozó migráció, amely a rendszer minden más rétegének alapja.

#### FR-1: Customers tábla migrációval
[Rendszer] rendelkezik egy futtatható migrációval létrehozott `customers` táblával.

**Consequences (testable):**
- Kötelező mezők: `id` (PK), `name`, `telepules`, `lat` (nullable), `lon` (nullable).
- `budget`, `note` és `countryCode` tárolható, de opcionális oszlopok.
- `UNIQUE(name, telepules)` megszorítás — ez az idempotens seed (FR-2) alapja. `countryCode` szándékosan nem része ennek a kulcsnak.
- A migráció ismételt futtatása nem hibázik és nem hoz létre duplikált sémaelemet.

**Out of Scope:** Konkrét oszloptípusok és migrációs eszköz megválasztása — technical-how, `addendum.md`-ben.

### 5.2 F2 — Idempotens seed és offline geokódolás

**Leírás:** A `seed-customers.json` betöltése és a település-koordináta hozzárendelés, kizárólag lokális referenciából. Realizálja UJ-1 seed-lépését.

#### FR-2: seed-customers.json idempotens betöltése
[Rendszer] be tudja tölteni a `seed-customers.json` tartalmát a `customers` táblába úgy, hogy ismételt lefuttatás nem duplikál.

**Consequences (testable):**
- Minden seed-elemhez pontosan egy `customers` sor tartozik, kétszeri futtatás után is.
- `budget`, `note` és `countryCode` átkerül, ha jelen van a forrásban.
- A természetes kulcs a `name` + `telepules` összetett érték (`UNIQUE(name, telepules)`); a betöltés erre épülő upsertet használ. `countryCode` szándékosan nincs a kulcsban — eltárolható, de nem szükséges az idempotenciához.
- A megvalósítás paraméterezett adatbázis-lekérdezést használ — a "hogyan" szintű megkötést lásd `addendum.md` → *Paraméterezett adatbázis-lekérdezések*.

#### FR-3: Offline település-koordináta hozzárendelés
[Rendszer] a seed-folyamat során minden ügyfél `telepules` mezőjéhez `lat`/`lon`-t rendel a lokális település-koordináta referenciából.

**Consequences (testable):**
- Nincs külső geokódoló API-hívás a betöltés során.
- A referencia statikus, verziókezelt adat a repóban, és az MVP-ben kizárólag a `seed-customers.json`-ban szereplő 15 várost, valamint a rögzített Budapest referencia-koordinátát tartalmazza — nem cél egy általános városadatbázis.
- A hozzárendelés kizárólag betöltéskor történik; a lekérdezési végpontok nem geokódolnak újra.

#### FR-4: Településnév-normalizálás
[Rendszer] a `telepules` és a referencia kulcsainak egyeztetésekor ékezet-, kis/nagybetű- és whitespace-független összehasonlítást végez.

**Consequences (testable):**
- Az ékezetes/ékezet nélküli, kis-/nagybetűs és extra whitespace-t tartalmazó változatok ugyanarra a referencia-bejegyzésre illeszkednek.
- A normál seed feldolgozásához elegendő, hogy a sima `"Budapest"` érték illeszkedjen a Budapest referencia-koordinátára.
- *Robusztussági kiegészítés (nem kötelező elfogadási feltétel):* a normalizáló logika opcionálisan a kerület-jelöléseket is a központi Budapest referencia-koordinátára leképezheti (pl. `Budapest XIII.`, `Budapest 13`, `Budapest, XI. kerület`) — külön referencia-bejegyzés kerületenként nem szükséges.

#### FR-5: Ismeretlen település kezelése
[Rendszer] ha egy ügyfél `telepules` mezője nem egyeztethető a referenciával, `lat`/`lon` = `null`-t állít be és figyelmeztető logot ír, a betöltési folyamat pedig nem áll le.

**Consequences (testable):**
- A folyamat a többi rekordot változatlanul feldolgozza és sikeresen befejeződik annak ellenére, hogy van ismeretlen település.
- `[NOTE FOR PM]` A jelenlegi 15 seed-városhoz várhatóan minden bejegyzés meglesz a referenciában; ez az ág a valódi seeden várhatóan nem aktiválódik — lefedettségét dedikált teszt-fixture bizonyítja (lásd FR-10).

### 5.3 F3 — Customer Distance API

**Leírás:** A két lekérdező végpont, amely a betöltött adatra épül. Realizálja UJ-1 lekérdező lépéseit.

#### FR-6: GET /customers/count
[Kliens] lekérdezheti a `customers` táblában ténylegesen meglévő sorok számát.

**Consequences (testable):**
- Válasz formátuma: `{ "count": <egész> }`.
- A `count` valódi adatbázis-lekérdezésből származik (pl. `SELECT COUNT(*)`), nem hardcode-olt érték és nem a seed-fájl elemszáma.
- A lekérdezés paraméterezett — lásd `addendum.md` → *Paraméterezett adatbázis-lekérdezések*.

#### FR-7: GET /customers/by-distance
[Kliens] lekérdezheti az ügyfeleket növekvő Budapest-távolság szerint rendezve.

**Consequences (testable):**
- Minden elem tartalmazza a teljes tárolt customer rekordot (`id`, `name`, `telepules`, `lat`, `lon`, és ha tárolva vannak: `budget`, `note`, `countryCode`) plusz a számított `distanceKm` mezőt, 1 tizedesjegyre kerekítve.
- Rendezés: (1) nem null `distanceKm` értékű ügyfelek elöl, növekvő távolság szerint — Budapest (és opcionálisan kerületei) `distanceKm: 0.0`-val legelöl; (2) null `distanceKm`-ű (ismeretlen település) ügyfelek a lista végén; (3) mindkét csoporton belül holtverseny esetén `name` szerinti növekvő rendezés dönt.
- A rendezés implementálható alkalmazás- vagy SQL-oldalon, a kimenetnek azonban determinisztikusnak kell lennie.
- A lekérdezés paraméterezett — lásd `addendum.md` → *Paraméterezett adatbázis-lekérdezések*.

#### FR-8: Haversine-távolságszámítás
[Rendszer] a `distanceKm` értékét a Haversine-képlettel számítja, az ügyfél koordinátája és a Budapest referencia-koordináta között.

**Consequences (testable):**
- A Budapest referencia-koordináta rögzített, alkalmazás-szintű konstans.
- Az eredmény 1 tizedesjegyre kerekítve jelenik meg a válaszban.

### 5.4 F4 — Tesztelés és verifikáció

**Leírás:** A minőségi elvárás (MINŐSÉG) formális lefedettsége: unit és integrációs tesztek.

#### FR-9: Haversine unit tesztek
[Rendszer] rendelkezik unit tesztekkel a Haversine-számításra.

**Consequences (testable):**
- Budapest–Bécs ≈ 214 km, ±1 km tolerancia (rögzített célérték).
- Budapest–Budapest = 0 km.
- Null koordináta bemenet definiált módon kezelve (nem dob kivételt).

#### FR-10: Normalizálási és edge-case tesztek
[Rendszer] rendelkezik tesztekkel a településnév-normalizálásra és az ismeretlen település ágra.

**Consequences (testable):**
- A dedikált normalizálási és edge-case teszt-fixture legalább az alábbi eseteket lefedi:
  - ékezetes és ékezet nélküli településnév-egyezés (pl. `"Kraków"` ↔ `"krakow"`);
  - kis- és nagybetű eltérés;
  - vezető és záró whitespace;
  - ismeretlen település (FR-5 ág — nem a valódi 15 elemű seeddel bizonyítva);
  - null koordináta kezelése;
  - Budapest kerület-megjelölés, ha az opcionális kerület-normalizálási viselkedés (FR-4) implementálásra kerül.
- Idempotens seed (FR-2): kétszeri futtatás után a rekordszám nem duplázódik, teszttel bizonyítva.
- *Ajánlott, nem kötelező robusztussági teszt:* hiányzó opcionális mezőket (`budget`, `note`, `countryCode`) tartalmazó seed-sor helyes kezelése — nem MVP-elfogadási feltétel, mivel ezek a mezők eleve opcionálisak.

#### FR-11: Végpont-integrációs tesztek valódi PostgreSQL ellen
[Rendszer] rendelkezik integrációs tesztekkel a két végpontra, valódi (nem mockolt) Postgres adatbázis ellen futtatva.

**Consequences (testable):**
- A `by-distance` teszt lefedi: Budapest=0km eset, holtverseny `name` szerint, ismeretlen település a lista végén `null` `distanceKm`-mel.

### 5.5 F5 — Fejlesztői futtatás és ellenőrizhetőség

**Leírás:** A reprodukálhatósági és kiértékelhetőségi elvárások (MINŐSÉG, LEADANDÓ) formális lefedettsége.

#### FR-12: Reprodukálható lokális Postgres indítás
[Kiértékelő] egyetlen dokumentált paranccsal el tudja indítani a szükséges lokális Postgres instance-t.

**Consequences (testable):**
- Docker Compose a hivatalos, dokumentált mechanizmus (`docker compose up -d`).

**Out of Scope:** A konkrét compose-fájl tartalma — technical-how, `addendum.md`-ben.

#### FR-13: PostgreSQL MCP séma- és adatellenőrzés
[Fejlesztő ügynök] a fejlesztés során MCP-n keresztül ellenőrzi a lokális Postgres sémáját és a seedelt adatokat.

**Consequences (testable):**
- A repó tartalmaz működő PostgreSQL MCP konfigurációt.
- A fejlesztő dokumentált módon le tudja kérdezni legalább a `customers` tábla sémáját MCP-n keresztül.
- A fejlesztő dokumentált módon ellenőrizni tudja a seedelt rekordok számát és legalább néhány `name` / `telepules` / `lat` / `lon` értéket MCP-n keresztül.
- Ez fejlesztés-idejű eszközhasználat, nem az API runtime funkciója.
- `[NOTE FOR PM]` Inkább folyamat-/eszközkövetelmény, mint API-viselkedés — konkrét mechanizmusát az architektúra rögzíti.

#### FR-14: README a teljes futtatási folyamathoz
[Kiértékelő] a README alapján, lépésről lépésre el tudja indítani és tesztelni a teljes rendszert.

**Consequences (testable):**
- A README dokumentálja, egyetlen másolható paranccsal (vagy parancssorozattal) lépésenként: `docker compose up -d`, migráció futtatása, seed futtatása, szerver indítása, tesztek futtatása, valamint leállítás/volume törlés szükség esetén.
- A jelenlegi README (egysoros stub) frissítése kötelező deliverable.

## 6. Non-Goals (Explicit)

- Nincs külső geokódoló API-hívás vagy LLM-hívás futásidőben — offline-only garancia (§2 Evaluation Context reprodukálhatósági elvárása).
- Nincs autentikáció/autorizáció — lokális, fejlesztői/kiértékelői használatra szánt API.
- Nincs UI vagy kliens alkalmazás — kizárólag REST API.
- Nincs multi-tenant vagy multi-environment (staging/prod) támogatás — egyetlen lokális Postgres instance a cél.
- Nincs írási/módosítási végpont (POST/PUT/DELETE) az ügyfeleken — a scope kizárólag a seedelést és a két GET lekérdezést fedi le.
- Nincs valós idejű geokódolás vagy dinamikus település-referencia bővítés — a referencia statikus, verziókezelt fájl.
- Production-szintű skálázhatóság, terhelés és SLA nem cél.

## 7. MVP Scope

### 7.1 In Scope
- `customers` tábla + migráció (F1).
- Idempotens seed, offline geokódolás, településnév-normalizálás, ismeretlen település kezelése (F2).
- `GET /customers/count`, `GET /customers/by-distance` + Haversine-számítás (F3).
- Unit és integrációs tesztek (F4).
- Docker Compose Postgres, Postgres MCP dev-time ellenőrzés, README (F5).

### 7.2 Out of Scope for MVP
- Írási végpontok (customer CRUD) — nincs rá igény a specifikációban.
- Külső geokódolás / dinamikus település-lookup — explicit tiltott (offline elvárás).
- Autentikáció, rate limiting, production megfigyelhetőség (logging infra, metrikák) — hobby/homework tier, nem elvárt.
- `[NOTE FOR PM]` `countryCode`-alapú finomabb geokódolási egyértelműsítés (pl. azonos nevű városok különböző országokban) — a jelenlegi 15 elemű seedben nincs ütközés; ha a referencia később bővül, revizitálandó.

## 8. Success Metrics

**Primary**
- **SM-1**: Minden kritikus elfogadási feltétel (FR-1–FR-14 Consequences) automatikus teszttel vagy dokumentált, reprodukálható verifikációs lépéssel bizonyított — nem elvárás, hogy minden FR-hez külön, dedikált teszt tartozzon. A Postgres MCP-ellenőrzés (FR-13) esetén elegendő a dokumentált konfiguráció + egy dokumentált séma-/adatellenőrzési lépés, automatizált teszt nélkül is. Validates FR-1–FR-14.
- **SM-2**: A README alapján, Node.js, Docker és npm megléte esetén, külső szolgáltatás nélkül elindítható a teljes lánc (Postgres indítás → migráció → seed → szerver → tesztek) egy tiszta gépen. Validates FR-12, FR-14, UJ-1.

**Secondary**
- **SM-3**: A BMAD tervezési lánc (PRD → architektúra → epic/story-k → fejlesztés) minden lépése dokumentált és nyomon követhető, összevethető a Superpowers megoldással. Validates §2 Evaluation Context.

**Counter-metrics (do not optimize)**
- **SM-C1**: A tesztlefedettség vagy dokumentáltság hajszolása ne menjen a scope-kúszás rovására — a §6 Non-Goals határainak tartása fontosabb, mint extra funkciók hozzáadása. Counterbalances SM-1.

## 9. Open Questions

Nincs nyitott, blokkoló kérdés a PRD lezárásakor — mindhárom korábbi nyitott pont (Haversine-tolerancia, Budapest kerületek kezelése, referencia mérete) lezárva, lásd §5 FR-9, FR-4, FR-3.

## 10. Decision and PM Notes Index

Minden korábbi `[ASSUMPTION]` a Discovery/Coaching menet során explicit döntéssé alakult a felhasználóval (lásd `.memlog.md`) — a PRD lezárásakor nincs hátralévő, megerősítetlen feltételezés. Az alábbiak a PRD-ben megjelölt `[NOTE FOR PM]` callout-ok, deferred döntések, nem nyitott kérdések:

- §5 FR-5 / FR-10 `[NOTE FOR PM]` — az ismeretlen település ág a valódi 15-elemű seeden várhatóan nem aktiválódik; lefedettségét dedikált teszt-fixture bizonyítja.
- §5 FR-13 `[NOTE FOR PM]` — a Postgres MCP inkább fejlesztési folyamat-/eszközkövetelmény, mint API-viselkedés; konkrét mechanizmusát az architektúra rögzíti.
- §7.2 `[NOTE FOR PM]` — `countryCode`-alapú geokódolási egyértelműsítés jelenleg nem szükséges, de revizitálandó, ha a település-referencia bővül.
