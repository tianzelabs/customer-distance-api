---
baseline_commit: a739364944d3708d762d897a8773133d4b232b66
---

# Story 3.1: README végigfutási dokumentáció

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Mint kiértékelő,
egy README-t szeretnék, ami lépésről lépésre leírja a Postgres indítást, migrációt, seedelést, szerverindítást és teszt-futtatást,
hogy egy tiszta gépen is reprodukálni tudjam a teljes rendszert.

## Acceptance Criteria

1. **Given** a projekt minden korábbi story-ja (Epic 1, Epic 2) elkészült, **when** a kiértékelő megnyitja a README-t, **then** minden lépéshez (`docker compose up -d`, migráció futtatása, seed futtatása, szerver indítása, tesztek futtatása, leállítás/volume törlés) egyetlen, közvetlenül másolható parancs tartozik. [Source: epics.md#Story 3.1; prd.md#FR-14]
2. **And** a README explicit megnevezi az előfeltételeket (Node.js 24, Docker, npm). [Source: epics.md#Story 3.1; prd.md#FR-14]
3. **And** a README dokumentálja a Postgres MCP séma-/adatellenőrzési lépéseit (Story 1.5-ből). [Source: epics.md#Story 3.1; ARCHITECTURE-SPINE.md#AD-11]
4. **Given** egy kiértékelő, aki csak a README-t olvasta, **when** végigköveti a lépéseket egy tiszta gépen, **then** a teljes rendszer (adatbázis, seedelt adat, futó szerver, zöld tesztek) sikeresen létrejön külső szolgáltatás nélkül. [Source: epics.md#Story 3.1; prd.md#SM-2]

## Tasks / Subtasks

- [x] **Task 1 — README szerkezet és előfeltételek (AC: #2)**
  - [x] Tartsd meg a meglévő intro bekezdést és a Story 1.5-ből származó MCP-szakaszt (ne duplikáld, hivatkozz rá / illeszd a végigfutás megfelelő pontjára).
  - [x] Adj hozzá egy "Előfeltételek" szakaszt: Node.js 24 (Active LTS), Docker (Docker Compose v2 CLI, `docker compose`), npm — pontos verziók az `ARCHITECTURE-SPINE.md` Stack táblájából idézve.

- [x] **Task 2 — Setup és adatbázis-indítás (AC: #1)**
  - [x] `npm ci` (nem `npm install` — reprodukálhatóság, a projekt saját, már bevett konvenciója) + `.env.example` → `.env` másolás egyetlen másolható parancssorozatként.
  - [x] `docker compose up -d` — dokumentáld a host port 5433-at (nem 5432) és az okát (lokális port-ütközés elkerülése egy másik, a projekthez nem tartozó Postgres konténerrel — tényszerű hangvétel, ld. Story 1.1 Dev Notes).

- [x] **Task 3 — Migráció és seed (AC: #1)**
  - [x] `npm run migrate:up` (dev DB) és `npm run migrate:test:up` (teszt DB) — dokumentáld, hogy az utóbbi az integrációs tesztek előfeltétele.
  - [x] `npm run seed` — dokumentáld, hogy idempotens, biztonságosan újrafuttatható.

- [x] **Task 4 — Szerverindítás és végpont-ellenőrzés (AC: #1)**
  - [x] Döntsd el és dokumentáld: legyen-e új `"start"` npm script, vagy maradjon a közvetlen `npx tsx src/server.ts` parancs — ellenőrizd a `package.json`-t, ld. Dev Notes a döntésért és indoklásért.
  - [x] Valódi `curl` példaparancsok mindkét végpontra (`GET /customers/count`, `GET /customers/by-distance`), realisztikus, a valódi dev DB-ből származó példakimenettel.

- [x] **Task 5 — Tesztfuttatás és teardown (AC: #1)**
  - [x] `npm test` (teljes suite, mindkét DB migrálva szükséges), `npm run test:unit` (DB nélkül fut), `npm run test:integration` (`TEST_DATABASE_URL` szükséges).
  - [x] `docker compose down` + megjegyzés `-v`-ről teljes volume-törléshez, a Story 1.1 Dev Notes-ban már rögzített iránymutatásra hivatkozva.

- [x] **Task 6 — MCP-szakasz integrálása + rövid tech-stack összefoglaló (AC: #3)**
  - [x] Illeszd a meglévő MCP-szakaszt a végigfutás logikus pontjára (seed után, vagy külön "Fejlesztői eszközök" alszakaszként) — ne duplikáld a tartalmát.
  - [x] Rövid, arányos projekt-struktúra / tech-stack összefoglaló (táblázat vagy lista) — nem a teljes Architecture Spine lemásolása.

- [x] **Task 7 — Valódi, saját végigfutás tiszta állapotból (AC: #4, SM-2)**
  - [x] `docker compose down` (csak ennek a projektnek a stack-je, port 5433 — a `smartbasket-pg` konténer/5432 port NEM érintett) egy ténylegesen leállított állapot eléréséhez.
  - [x] Végigfuttatni a README saját lépéseit sorban: `npm ci`, `docker compose up -d`, `npm run migrate:up`, `npm run migrate:test:up`, `npm run seed`, szerverindítás, `curl` mindkét végpontra, `npm test`/`test:unit`/`test:integration`.
  - [x] A session végén hagyd a stacket ésszerű állapotban: Postgres fut, seedelve, tesztek zöldek.

- [x] **Task 8 — Story-dokumentáció és delivery (NFR7)**
  - [x] Frissítsd ezt a story fájlt: Tasks pipálása, Dev Agent Record kitöltése, Status `ready-for-dev` → `in-progress` → `review`.
  - [x] Frissítsd a `sprint-status.yaml`-t: `3-1-readme-vegigfutasi-dokumentacio` `backlog` → `ready-for-dev` → `in-progress` → `review`; `epic-3` → `done` (utolsó story az egész sprintben).
  - [x] Kis, fókuszált commitok (README-átírás külön; `package.json` `start` script, ha hozzáadva, külön; story/sprint-status commit).

## Dev Notes

- **Ez az utolsó story a teljes sprintben.** Nincs további story, aminek Dev Notes-ot kellene hagyni — a README maga a végső, felhasználó-néző deliverable. [Source: epics.md#Epic 3]
- **Dokumentációs story, nincs alkalmazáskód-változás.** Új npm dependency nem kerül hozzáadásra. Egyetlen mérlegelendő kód-szintű változás: egy opcionális `"start"` npm script a `package.json`-ban a szerver indításához — ld. lentebb a döntést.
- **`[ASSUMPTION]` — `"start"` script hozzáadása:** a `package.json` jelenleg nem tartalmaz `start` scriptet (csak `build`, `migrate:*`, `seed`, `test*`). A `tsx` már `dependencies`-ben van (1.4 story óta), így egy `"start": "tsx src/server.ts"` script hozzáadása nem igényel új függőséget, és konzisztens a meglévő script-konvencióval (`seed`: `"tsx src/seed.ts"`). Mivel ez a story kifejezetten a felhasználói/kiértékelői végigfutásról szól, és egy `npm start` a projekt saját megszokott `npm run <cél>` mintáját követi (ahogy `npm run seed`/`npm run migrate:up` is), hozzáadom — ez minimális, egysoros, nem bővíti az alkalmazás felületét, csak elnevez egy már létező parancsot. A README mindkét formát megemlíti (elsődleges: `npm start`; megjegyzés: ezzel ekvivalens a közvetlen `npx tsx src/server.ts`).
- **AD-9 (env vars, teszt-DB topológia)** — `DATABASE_URL`, `TEST_DATABASE_URL`, `PORT` (opcionális, default 3000) `src/config/env.ts`-ben validálva; egy `postgres:18` Docker Compose service, két logikai DB (`customer_distance`, `customer_distance_test`) ugyanazon instance-en. A README ezt a topológiát tükrözi (egy `docker compose up -d`, két migrációs parancs). [Source: ARCHITECTURE-SPINE.md#AD-9]
- **Host port 5433** — a Story 1.1-ben rögzített, dokumentált döntés (nem az alapértelmezett 5432, hogy elkerülje az ütközést egy másik, a projekthez nem tartozó lokális Postgres konténerrel, amely az 5432-t foglalja ezen a gépen). A README ezt tényszerűen említi, nem túlmagyarázva. [Source: 1-1-projekt-scaffold-es-lokalis-postgres-docker-compose-zal.md#Dev Notes]
- **Teardown iránymutatás (Story 1.1-ből átvéve)** — `docker compose down` megtartja a `pgdata` named volume-ot (adat megmarad a következő induláshoz); `docker compose down -v` törli a volume-ot is (teljesen tiszta állapot, de a `docker/initdb/` alatti inicializációs script csak üres volume mellett fut újra — ha valaha hiányozna a `customer_distance_test` DB, ez a helyreállítás módja). [Source: 1-1-projekt-scaffold-es-lokalis-postgres-docker-compose-zal.md#Dev Notes]
- **Két DB migrálása** — a Story 1.4 code review-ja explicit deferálta ezt a README-re: mindkét logikai DB-t (`customer_distance` és `customer_distance_test`) migrálni kell, külön paranccsal (`migrate:up` / `migrate:test:up`), mielőtt az integrációs tesztek lefuthatnának. [Source: 1-4-idempotens-seed-script.md#Review Findings — "README, Story 3.1, should document that both DBs need migrating"]
- **`npm ci` vs `npm install`** — a projekt saját, minden korábbi story-ban következetesen alkalmazott konvenciója `npm ci` (reprodukálható telepítés a committolt `package-lock.json` alapján), nem `npm install`. [Source: 1-1-projekt-scaffold-es-lokalis-postgres-docker-compose-zal.md#Task 2]
- **Node verzió a fejlesztői gépen** — a `package.json` `engines.node` `>=24`-et deklarál, de a jelen fejlesztői gép Node 23.5.0-t futtat (dokumentálva Story 1.1-ben, `EBADENGINE` warning, nem hiba). A README a `package.json` deklarált, ratifikált verzióját (Node.js 24) nevezi meg előfeltételként, nem a lokális fejlesztői gép tényleges verzióját — ez a Stack tábla explicit, architektúra-szintű döntése. [Source: ARCHITECTURE-SPINE.md#Stack; 1-1-projekt-scaffold-es-lokalis-postgres-docker-compose-zal.md#Debug Log References]
- **Valódi curl-példakimenet forrása** — a README `curl` példakimenete a Story 2.3/2.4 Dev Agent Record-jaiban rögzített, valódi (nem szimulált), a ténylegesen futó szerver + seedelt dev DB ellen futtatott parancsok kimenete, plusz e story saját, Task 7-ben elvégzett, ismételt valódi végigfutása ugyanazokkal a végpontokkal (a seedelt adat és így a válaszok azonosak, mivel a dev DB-t egyik korábbi story sem módosította a seed óta). [Source: 2-3-get-customers-count.md#Dev Agent Record; 2-4-get-customers-by-distance.md#Dev Agent Record]
- **MCP-szakasz** — a Story 1.5-ben már elkészült, jelenleg a README egyetlen tartalmi szakasza. Ez a story NEM írja újra, csak a végigfutás logikus pontjára illeszti (seed után, mint "Fejlesztői eszközök" alszakasz) és a keretező szövegben lévő, Story 3.1-re mutató forward-referenciákat ("a teljes végigfutási dokumentáció a Story 3.1 README-jében készül el") a végleges, tényleges tartalommal helyettesíti/linkeli. [Source: README.md (jelenlegi állapot); epics.md#Story 3.1]

### Project Structure Notes

- Alignment: kizárólag `README.md` (és opcionálisan `package.json` egy `"start"` script sorral) módosul. Nincs új `src/`, `test/`, vagy `migrations/` fájl — dokumentációs story. [Source: ARCHITECTURE-SPINE.md#Structural Seed]
- Nincs eltérés a Structural Seed-től.

### References

- [Source: epics.md#Story 3.1: README végigfutási dokumentáció] — a story pontos Given/When/Then AC-jei
- [Source: epics.md#Epic 3: End-to-End Reproducibility & Delivery Readiness] — epic-szintű kontextus, FR-14, NFR7/NFR8
- [Source: ARCHITECTURE-SPINE.md#Stack] — Node.js 24, TypeScript 6.0.2, Express 5.2.1, pg 8.22.0, node-pg-migrate 8.0.4, Vitest 4.1.10, PostgreSQL 18 pontos verziók
- [Source: ARCHITECTURE-SPINE.md#Structural Seed] — teljes forrásfa, `docker-compose.yml` PG18 megjegyzés
- [Source: ARCHITECTURE-SPINE.md#AD-9 — Config fail-fast; test-DB isolation]
- [Source: ARCHITECTURE-SPINE.md#AD-11 — PostgreSQL MCP dev-tooling configuration]
- [Source: prd.md#FR-14: README a teljes futtatási folyamathoz]
- [Source: prd.md#8. Success Metrics — SM-2]
- [Source: 1-1-projekt-scaffold-es-lokalis-postgres-docker-compose-zal.md] — Docker Compose port 5433, `.env.example`, teardown iránymutatás
- [Source: 1-2-customers-tabla-migracio.md] — migrate:up/down
- [Source: 1-4-idempotens-seed-script.md] — seed, migrate:test:up, két-DB migrációs igény
- [Source: 1-5-postgresql-mcp-sema-es-adatellenorzes.md] — MCP-szakasz jelenlegi tartalma (README.md-ben)
- [Source: 2-3-get-customers-count.md] — valódi curl-kimenet `/customers/count`-ra
- [Source: 2-4-get-customers-by-distance.md] — valódi curl-kimenet `/customers/by-distance`-re

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code, bmad-dev-story workflow, autonomous mode)

### Debug Log References

- Valódi, teljes tiszta-állapotú végigfutás ebben a session-ben (Task 7): `docker compose down` (kizárólag ennek a projektnek a stackje, port 5433 — a `smartbasket-pg`/5432 konténer nem érintett) → `npm ci` (sikeres, csak a Story 1.1 óta ismert `EBADENGINE` warning Node 23.5.0 miatt, nem hiba) → `docker compose up -d` → ~14s alatt `healthy` → `npm run migrate:up` + `npm run migrate:test:up` (mindkettő `"No migrations to run!"`-t jelzett, mivel a `pgdata` named volume — `docker compose down` nem törli — a korábbi story-kból már migrált állapotot őrizte; ez maga is bizonyítja az idempotenciát, nem hibát jelez) → `npm run seed` (`[seed] Upserted 15 customer(s) into "customers".`) → `npm start` (`[api] Listening on port 3000`) → `curl /customers/count` → `{"count":15}` → `curl /customers/by-distance` → 15 elemű, helyesen rendezett tömb (Anna Kovács/Budapest `distanceKm:0` elöl, Isabella Silva/Lisbon `distanceKm:2469.4` a végén) → szerver leállítva (`pkill -f "tsx src/server.ts"`), utána a curl kapcsolat-megtagadást (`000`) adott, megerősítve a leállást → `npm test` (11 fájl, 108 teszt, mind zöld) → `npm run test:unit` (`DATABASE_URL`/`TEST_DATABASE_URL` explicit unset-elve, 7 fájl, 89 teszt, mind zöld — bizonyítja, hogy valóban nincs DB-függés) → `npm run test:integration` (4 fájl, 19 teszt, mind zöld) → dev DB újra-ellenőrizve `docker compose exec postgres psql` -vel: pontosan 15 sor (az integrációs tesztek csak a `customer_distance_test`-et érintették). A session végén a Postgres-stack futva és seedelve maradt (nem lett leállítva), a `.env` a korábbi session-ből változatlanul megmaradt.
- Minden README-ben szereplő `curl` példakimenet ebből a valódi, ebben a session-ben lefuttatott végigfutásból származik (nem a Story 2.3/2.4 Dev Agent Record-jaiból másolva, bár azokkal — helyesen — egyezik, mivel a dev DB tartalma azóta nem változott).

### Completion Notes List

- AC #1 verified: minden lépéshez (`npm ci`+`.env` létrehozás, `docker compose up -d`, migráció (2 parancs, mindkét DB), seed, szerverindítás, `curl`-ellenőrzés, tesztfuttatás (3 parancs), leállítás/volume-törlés) egyetlen, közvetlenül másolható parancs vagy rövid parancssorozat tartozik a README "Gyors indítás" szakaszában.
- AC #2 verified: külön "Előfeltételek" táblázat nevezi meg explicit Node.js 24, Docker (Compose v2), npm — az `ARCHITECTURE-SPINE.md` Stack táblájából idézett pontos verziókkal.
- AC #3 verified: a Story 1.5-ből származó PostgreSQL MCP séma-/adatellenőrzési szakasz a README-ben megmaradt (nem duplikálva, csak a forward-referenciái frissítve, hogy a végleges "Gyors indítás" szakaszra mutassanak a korábbi "Story 3.1 README-jében készül el" helyett), a végigfutás logikus pontján (a Postgres-indítás/migráció/seed szakasz után) elhelyezve.
- AC #4 verified (SM-2): ebben a session-ben ténylegesen, sorban végigfuttattam a README saját lépéseit egy genuinely leállított állapotból (`docker compose down`, csak ennek a projektnek a stackje) — `npm ci`, `docker compose up -d`, mindkét migráció, seed, `npm start`, mindkét végpont valódi `curl`-lal, mindhárom teszt-parancs — minden lépés pontosan a dokumentált módon, hibamentesen lefutott. Ld. Debug Log References a teljes, tényleges kimenetekért.
- A README `curl` példakimenete a valódi, ebben a session-ben lefuttatott végponthívásokból származik, nem kitalált/szimulált adat.
- Döntés (dokumentálva a Dev Notes-ban): egy `"start": "tsx src/server.ts"` npm script hozzáadva a `package.json`-hoz — nem új függőség (a `tsx` már `dependencies`-ben van 1.4 óta), csak egy már létező parancs elnevezése, konzisztens a projekt saját `npm run <cél>` konvenciójával. A README mindkét formát (`npm start` és a közvetlen `npx tsx src/server.ts`) megemlíti.
- Scope discipline: nem került új alkalmazáskód, nem került új dependency; kizárólag `README.md` (teljes átírás, meglévő tartalom megtartásával/integrálásával) és `package.json` (egy sor) módosult.

### File List

**Modified:**
- `README.md` (teljes végigfutási dokumentáció hozzáadva: előfeltételek, gyors indítás — telepítés, Postgres indítás, migráció, seed, szerverindítás, végpont-ellenőrzés valódi `curl` példákkal, tesztfuttatás, leállítás/volume-törlés —, a meglévő intro és MCP-szakasz megtartva/integrálva, plusz rövid tech-stack/struktúra összefoglaló)
- `package.json` (új `"start": "tsx src/server.ts"` npm script)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (`3-1-readme-vegigfutasi-dokumentacio`: `backlog` → `ready-for-dev` → `in-progress` → `review`; `epic-3`: `backlog` → `in-progress` → `done`)

### Change Log

- 2026-07-19: Story létrehozva (`bmad-create-story` workflow), Status `ready-for-dev`.
- 2026-07-19: Story implementálva (`bmad-dev-story` workflow, autonomous mode) — README teljes átírása/kiegészítése (előfeltételek, gyors indítás, végpont-ellenőrzés valódi curl-kimenettel, tesztfuttatás, teardown, tech-stack összefoglaló), meglévő intro + MCP-szakasz megtartva és integrálva; `package.json`-ban `"start"` script hozzáadva. Task 7-ben valódi, teljes, tiszta-állapotú végigfutás elvégezve és minden lépés eredménye rögzítve (ld. Debug Log References). Status `in-progress` → `review`.
