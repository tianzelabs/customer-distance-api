---
baseline_commit: 807c29ba990ec0fba7d9825d76cb0037e47d51da
---

# Story 2.2: Express app-scaffold tesztelhető szétválasztással és központi hibakezeléssel

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Mint fejlesztő,
egy tesztelhető Express appot szeretnék (`app.ts`/`server.ts` szétválasztva) központi hibakezeléssel,
hogy a végpontok konzisztensen hibázzanak és integrációs tesztelhetők legyenek.

## Acceptance Criteria

1. **Given** a `src/app.ts` egy kötetlen (unbound), importálható Express app-ot exportál, **when** a `src/server.ts` importálja és `.listen()`-t hív rá, **then** a szerver elindul a `PORT` env változón (dokumentált alapértelmezett érték, ha nincs megadva). [Source: epics.md#Story 2.2; ARCHITECTURE-SPINE.md#AD-4, #AD-9]
2. **When** egy integrációs teszt importálja `app.ts`-t, **then** HTTP hívásokat tud indítani rá anélkül, hogy valódi (fix, production) portot kötne — az app maga sosem hív `.listen()`-t; a teszt saját maga dönt arról, hogyan hajt végre rajta HTTP-hívást (pl. OS-kiosztott efemer port). [Source: epics.md#Story 2.2; ARCHITECTURE-SPINE.md#AD-4]
3. **Given** a `src/config/env.ts` (Story 1.4-ben létrehozva, itt bővítve/felhasználva) egyetlen helyen olvassa a `DATABASE_URL`/`TEST_DATABASE_URL`/`PORT` változókat, **when** egy kötelező env változó hiányzik vagy érvénytelen, **then** az alkalmazás azonnal, érthető hibaüzenettel leáll (fail-fast), hardcode-olt jelszó nélkül. [Source: epics.md#Story 2.2; ARCHITECTURE-SPINE.md#AD-9] — Megjegyzés: az `env.ts` fail-fast `DATABASE_URL`/`PORT` validációja Story 1.4-ben már elkészült és ellenőrzött (ld. `1-4-idempotens-seed-script.md`); ez a story `env.port`-ot **felhasználja** (`server.ts`-ben), nem újraimplementálja.
4. **Given** a `src/middleware/errorHandler.ts` központi hibakezelő middleware, **when** egy váratlan vagy DB-hiba történik bármelyik route-ban, **then** a kliens `{"error":{"message":"Internal server error"}}` választ kap HTTP 500-zal, nyers SQL-hiba, connection string, stack trace vagy titok nélkül, **and** a tényleges hiba `console.error`-ral, `[api]` prefixszel logolódik szerver-oldalon. [Source: epics.md#Story 2.2; ARCHITECTURE-SPINE.md#AD-8; Consistency Conventions]

## Tasks / Subtasks

- [x] **Task 1 — Express telepítése, verzió-ellenőrzés (AC: #1)**
  - [x] Ellenőrizd webről (npm registry) az Express jelenlegi stabil verzióját — az `ARCHITECTURE-SPINE.md#Stack` `5.2.1` pontos verziót ír elő ("Active support phase"). Ha eltérést találsz, dokumentáld a Story 1.2 mintája szerint (ne bírald felül csendben az architektúrát).
  - [x] `npm install --save-exact express@5.2.1` — `dependencies`-be (runtime-függőség, konzisztens `pg`/`node-pg-migrate` konvencióval).
  - [x] `npm install --save-dev --save-exact @types/express@<latest Express-5-kompatibilis verzió>` — `devDependencies`-be (build/tooling-időben szükséges típusdefiníció, ugyanaz a konvenció, mint `@types/pg`).

- [x] **Task 2 — `src/app.ts`: kötetlen, importálható Express app (AC: #1, #2)**
  - [x] Hozz létre egy `express()` app-ot, exportáld `app` néven, **NE** hívj rajta `.listen()`-t (AD-4).
  - [x] NE adj hozzá `src/routes/customersRoutes.ts` tartalmat vagy `/customers/*` végpontot — azok a 2.3/2.4 story hatóköre.
  - [x] Regisztráld a `src/middleware/errorHandler.ts`-t utolsó middleware-ként (Express az error-handling middleware-t a 4 paraméteres szignatúra alapján ismeri fel; a route-ok/egyéb middleware-ek UTÁN kell regisztrálni).
  - [x] Adj hozzá egy diagnosztikai, KIZÁRÓLAG teszt-kontextusban regisztrált route-ot (`process.env.NODE_ENV === 'test'` guard mögött — a Vitest ezt automatikusan `'test'`-re állítja, ellenőrizve), amely szándékosan dobtat egy hibát — ez teszi lehetővé, hogy egy integrációs teszt a teljes láncot (route → Express 5 automatikus hiba-forward → központi errorHandler → fix válasz-alak) valódi HTTP-híváson keresztül igazolja, anélkül hogy egy production route-ot vagy egy hamis `/customers` végpontot kellene erre a célra bevezetni (ld. Dev Notes a döntés indoklásáért).

- [x] **Task 3 — `src/server.ts`: `.listen()` kötés (AC: #1)**
  - [x] Importáld `app`-ot `./app.js`-ből és `env`-et `./config/env.js`-ből.
  - [x] Hívj `app.listen(env.port, ...)`-ot, egy rövid `[api]`-prefixes `console.log` indulási üzenettel (a `seed.ts` `console.log('[seed] ...')` mintáját követve).

- [x] **Task 4 — `src/middleware/errorHandler.ts`: központi hibakezelő (AC: #4)**
  - [x] Implementáld a 4 paraméteres Express error-handling middleware-t (`(err, req, res, next)`).
  - [x] A tényleges hibát `console.error('[api] ...', err)`-rel logold szerver-oldalon (soha ne kerüljön a válaszba).
  - [x] A válasz MINDIG pontosan `{"error":{"message":"Internal server error"}}`, HTTP 500 — nincs egyedi error-osztály hierarchia vagy error-kód taxonómia (AD-8 explicit kizárja).

- [x] **Task 5 — Tesztek (AC: #2, #4)**
  - [x] `test/unit/errorHandler.test.ts`: hívd meg közvetlenül a middleware-függvényt hamis `req`/`res` (mock `status`/`json`)/`next`-tel — igazold a pontos válasz-alakot, a HTTP 500-at, és hogy `console.error` `[api]` prefixszel, a valódi hibával hívódott (spy).
  - [x] `test/integration/app.test.ts`: kösd az `app`-ot egy OS-kiosztott efemer portra (`http.createServer(app).listen(0)`), és valódi `fetch`-csel hívd meg. Igazold: (a) egy nem létező route-ra (`GET /nincs-ilyen`) Express 5 alapértelmezett 404-válaszát kapod (dokumentáld pontosan, mit ad vissza — státusz + tartalom-típus); (b) a Task 2-ben regisztrált diagnosztikai throw-route-ra a pontos `{"error":{"message":"Internal server error"}}` + HTTP 500 választ kapod, valódi HTTP-n keresztül, nem csak unit-szinten.
  - [x] NE adj hozzá `supertest`-et vagy hasonló új dependency-t — Node beépített `http`/`fetch`-e elegendő (AD-10 szellemében).
  - [x] Futtasd: `npm test` — minden tesztnek zöldnek kell lennie (unit + integráció, valódi Postgres-szel a meglévő integrációs tesztekhez).

- [x] **Task 6 — Manuális végpont-a-végpontig ellenőrzés**
  - [x] Indítsd el ténylegesen a szervert (`npx tsx src/server.ts` vagy ezzel ekvivalens), `curl`-ozz rá egy tetszőleges route-ra (mivel nincs valódi `/customers` route még, egy nem létező útvonalra 404 várható — ez igazolja, hogy a `.listen()` ténylegesen működik), majd állítsd le. Rögzítsd az eredményt a Dev Agent Record-ban.

- [x] **Task 7 — Story-dokumentáció és delivery (delivery norma, NFR7)**
  - [x] Frissítsd ezt a story fájlt: Tasks pipálása, Dev Agent Record kitöltése, Status `ready-for-dev` → `in-progress` → `review`.
  - [x] Frissítsd a `sprint-status.yaml`-t: `2-2-express-app-scaffold-tesztelheto-szetvalasztassal-es-kozponti-hibakezelessel` `backlog` → `ready-for-dev` → `in-progress` → `review`.
  - [x] Kis, fókuszált commitok: (1) story-fájl létrehozása, (2) Express telepítés + `package.json`/lockfile, (3) `app.ts`+`server.ts`+`errorHandler.ts` implementáció + tesztek együtt (kohéz egység), (4) sprint-status frissítés (ha nem fér bele az utolsó commitba).

## Dev Notes

- **AD-4 (app/server szétválasztás)** — `src/app.ts` sosem hív `.listen()`-t; csak `src/server.ts` köti valódi porthoz. Ez teszi lehetővé, hogy egy integrációs teszt közvetlenül importálja és HTTP-hívásokat indítson rá anélkül, hogy a `PORT` env változótól vagy egy fix production-porttól függene. [Source: ARCHITECTURE-SPINE.md#AD-4]
- **AD-8 (központi hibakezelés, fix hiba-alak, nincs szivárgás)** — egyetlen, minden route UTÁN regisztrált 4 paraméteres Express error-middleware kezel minden váratlan/DB-hibát (nincs per-route try/catch erre a célra). A válasz MINDIG `{"error":{"message":"Internal server error"}}` + HTTP 500; sosem tartalmaz nyers SQL-hibát, connection stringet, stack trace-t vagy titkot. Nincs egyedi error-osztály hierarchia (AD-8 explicit kizárja — "keep it simple"). [Source: ARCHITECTURE-SPINE.md#AD-8]
- **AD-9 (config fail-fast, egyetlen `env.ts`)** — a `PORT` egyetlen forrása `src/config/env.ts` (`env.port`, Story 1.4-ben implementálva: opcionális, alapértelmezett `3000`, csak sima egész szám 1-65535 között fogadható el). Ez a story NEM módosítja `env.ts`-t, csak felhasználja `server.ts`-ben. [Source: ARCHITECTURE-SPINE.md#AD-9; 1-4-idempotens-seed-script.md]
- **Logolási konvenció** — `console.error` `[api]` prefixszel a hibakezelőben (AC #4 explicit követelmény); a `server.ts` indulási üzenete `console.log('[api] ...')`-lel, a `seed.ts`-ben már megalapozott `console.log('[seed] ...')` mintát követve (a Consistency Conventions táblázat "console.warn/console.error only" sora a figyelmeztetés-/hiba-szintű eseményekre vonatkozik, nem tiltja az informális `console.log`-ot — ezt már a `seed.ts` `main()`-je is így teszi). [Source: ARCHITECTURE-SPINE.md#Consistency Conventions; src/seed.ts]
- **Express verzió** — `npm view express dist-tags` (2026-07-19) `latest: '5.2.1'` — pontosan megegyezik az `ARCHITECTURE-SPINE.md#Stack` előírásával, nincs eltérés dokumentálandó (ellentétben a Story 1.2 `node-pg-migrate` esetével, ahol volt eltérés). [Source: npm registry ellenőrzés, 2026-07-19]
- **`@types/express` verzió** — Express 5 maga NEM szállít beépített TS-típusokat (`npm view express@5.2.1` → nincs `types`/`typings` mező); a `@types/express@5.0.6` (DefinitelyTyped, `latest` dist-tag, 2026-07-19-i ellenőrzés) az Express 5-tel kompatibilis típuscsomag — `devDependencies`, pontos pin, ugyanaz a mintázat, mint `@types/pg` (Story 1.4).
- **`[ASSUMPTION]` Diagnosztikai throw-route helyett/mellett a döntés:** a story explicit engedélyezi mindkét megközelítést ("consider adding a diagnostic-only test route ... or find another clean way"). Én mindkettőt alkalmaztam, nem választottam csak egyet:
  1. **Unit-szintű teszt** (`test/unit/errorHandler.test.ts`): közvetlenül hívja a middleware-függvényt hamis `req`/`res`/`next`-tel — ez tisztán, HTTP-réteg nélkül igazolja a válasz-alakot és a logolást, gyors és izolált.
  2. **Integrációs, end-to-end teszt** (`test/integration/app.test.ts`): egy `process.env.NODE_ENV === 'test'` mögé rejtett diagnosztikai route-on keresztül igazolja, hogy Express 5 ténylegesen forwardolja a dobott hibát a regisztrált errorHandlerbe, és hogy a válasz valódi HTTP-n keresztül is pontosan a várt alakú. A route SOSEM regisztrálódik `NODE_ENV !== 'test'` esetén (ellenőrizve: a Vitest automatikusan `NODE_ENV=test`-et állít be, ld. Debug Log References), így nem production route, nem szivárog ki éles használatra, és nem kell hozzá egy hamis `/customers` végpontot bevezetni (ami a 2.3/2.4 story hatóköre lenne).
  - Ez a kettős lefedettség olcsó (nincs új dependency, ~15-20 sor teszt-kód összesen) és nem sérti az AD-10 anti-over-engineering elvét — nincs custom error-osztály, nincs supertest, nincs mock-DB-réteg bevezetve csak erre a célra.
- **404-viselkedés (dokumentálva, nem egyedi implementálva)** — Express 5 alapértelmezett 404-je (nincs illeszkedő route) egy beépített `finalhandler`-generált HTML-választ ad, `404`-es státuszkóddal, `Content-Type: text/html`; NEM JSON és NEM megy át az `errorHandler`-en (ez nem egy `Error`, hanem "nincs illeszkedő route" eset — Express csak akkor hívja az error-middleware-t, ha valami ténylegesen hibát dob/rejectel). Az AC-k nem követelnek egyedi, JSON-alakú 404-et (AD-8 kizárólag az 5xx/DB-hiba alakot rögzíti), ezért NEM implementáltam egyedi 404-handlert — ez összhangban van AD-10-zel (ne over-engineeringeljünk egy nem kért funkciót). A pontos megfigyelt választ (státusz, tartalom-típus, body-minta) a teszt asserciók és a Completion Notes rögzítik.
- **Kizárt ebből a story-ból (más story-k felelőssége — ne nyúlj bele):** `GET /customers/count` (2.3), `GET /customers/by-distance` (2.4), `src/routes/customersRoutes.ts` tényleges tartalma (2.3/2.4), `src/services/customersService.ts` (2.4), README (3.1).

### Project Structure Notes

- Alignment: `src/app.ts`, `src/server.ts`, `src/middleware/errorHandler.ts` pontosan megfelelnek az `ARCHITECTURE-SPINE.md#Structural Seed` bejegyzéseinek. [Source: ARCHITECTURE-SPINE.md#Structural Seed]
- Alignment: `test/unit/errorHandler.test.ts` a `test/unit/`-ban (nincs DB-függősége, tiszta függvényhívás); `test/integration/app.test.ts` a `test/integration/`-ban (valódi HTTP-réteget, portkötést gyakorol, még ha DB-t nem is érint közvetlenül) — konzisztens a meglévő `test/integration/seed.test.ts` elhelyezési konvencióval.
- Nincs eltérés (variance) a Structural Seed-től. Új dependency: `express` (runtime), `@types/express` (dev) — mindkettő explicit szerepel az `ARCHITECTURE-SPINE.md#Stack` táblázatában, nem meglepetés.
- `src/middleware/.gitkeep` és `src/routes/.gitkeep` közül csak a `middleware/.gitkeep` törlődik ebben a story-ban (a `routes/` még üres marad — 2.3/2.4 hatóköre).

### References

- [Source: epics.md#Story 2.2: Express app-scaffold tesztelhető szétválasztással és központi hibakezeléssel] — a story pontos Given/When/Then AC-jei
- [Source: epics.md#Epic 2: Verifiable Customer Distance API] — epic-szintű kontextus, FR/NFR/AD lefedettség
- [Source: ARCHITECTURE-SPINE.md#AD-4 — App/server separation for testability]
- [Source: ARCHITECTURE-SPINE.md#AD-8 — Centralized error handling, fixed error shape, no leaked internals]
- [Source: ARCHITECTURE-SPINE.md#AD-9 — Config fail-fast; test-DB isolation]
- [Source: ARCHITECTURE-SPINE.md#Consistency Conventions] — logolási prefixek, hiba-alak
- [Source: ARCHITECTURE-SPINE.md#Stack] — Express 5.2.1 pontos verzió
- [Source: ARCHITECTURE-SPINE.md#Structural Seed] — `src/app.ts`/`server.ts`/`middleware/errorHandler.ts` fájlhelyek
- [Source: prd.md#6. Non-Goals] — nincs auth, nincs írási végpont (kontextus, nem közvetlenül ehhez a story-hoz)
- [Source: 1-4-idempotens-seed-script.md#Dev Notes] — `env.ts` jelen (review utáni) állapota: `env.databaseUrl`/`env.port`, `requireTestDatabaseUrl()`
- `src/config/env.ts` (repo, Story 1.4-ben létrehozva, review-fixek után) — `env.port` pontos szerződése, amit `server.ts` felhasznál
- npm registry (`npm view express dist-tags`, `npm view @types/express dist-tags`, 2026-07-19) — verzió-currency ellenőrzés

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code, bmad-dev-story workflow, autonomous mode)

### Debug Log References

_To be filled during implementation._

### Completion Notes List

_To be filled during implementation._

### File List

_To be filled during implementation._
