---
baseline_commit: fd9dc19dc7f813227c7dec3f12555feeca957fb
---

# Story 2.1: Tiszta Haversine-függvény unit tesztekkel

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Mint fejlesztő,
egy tiszta Haversine-függvényt szeretnék a Budapest referenciakoordinátával,
hogy a távolságszámítás helyessége az API-tól függetlenül garantált legyen.

## Acceptance Criteria

1. **Given** a `src/services/haversine.ts` fájlban egy DB/HTTP-független, tiszta függvény, amely importálja a `BUDAPEST_REF`-et a `src/geocoding/townReference.ts`-ből, **when** Budapest és Bécs koordinátáit adjuk meg neki, **then** kb. 214 km-t ad vissza, ±1 km tolerancián belül. [Source: epics.md#Story 2.1; prd.md#FR-8, #FR-9; ARCHITECTURE-SPINE.md#AD-6, #AD-13]
2. **When** Budapest koordinátáit adjuk meg mindkét paraméterként, **then** a függvény 0 km-t ad vissza (pontosan). [Source: epics.md#Story 2.1; prd.md#FR-9]
3. **When** a függvény `null` koordinátát kap bemenetként (bármelyik paraméterben), **then** definiált módon kezeli — nem dob kivételt, `null`-t ad vissza. [Source: epics.md#Story 2.1; prd.md#FR-9]
4. A függvény kizárólag sík (`{lat, lon}`-alakú) argumentumokat vesz át és egy sima `number`-t (vagy `null`-t) ad vissza — nincs DB-kliens, HTTP- vagy egyéb I/O-függősége (AD-6). Nem hardcode-ol egy második, divergáló Budapest-koordinátát — a `BUDAPEST_REF`-et importálja (AD-13). [Source: ARCHITECTURE-SPINE.md#AD-6, #AD-13]
5. Unit tesztek (`test/unit/haversine.test.ts`) fedik pontosan az FR-9 három kötelező esetét (Budapest–Bécs ≈214 km ±1 km valós, a `townReference.ts`-ben már rögzített Bécs-koordinátával; Budapest–Budapest = 0 km; null-kezelés), és a projekt `npm test`/`npm run test:unit` parancsa ténylegesen lefut, minden teszt zölden. [Source: epics.md#Story 2.1; prd.md#FR-9; ARCHITECTURE-SPINE.md#Capability→Architecture Map FR-9 sor]

## Tasks / Subtasks

- [ ] **Task 1 — `src/services/haversine.ts`: tiszta Haversine-függvény (AC: #1, #2, #3, #4)**
  - [ ] Importáld a `BUDAPEST_REF` konstanst és a `TownCoordinate` típust a `../geocoding/townReference.js`-ből (ESM/`NodeNext` konvenció: explicit `.js` kiterjesztés a relatív TS importban — ld. Story 1.1/1.3 tanulsága).
  - [ ] Definiáld a függvényt két, `TownCoordinate | null` típusú paraméterrel (`from`, `to`), ahol `to` alapértelmezett értéke `BUDAPEST_REF` (a domain-igény — FR-8 — mindig Budapesthez viszonyít; az alapértelmezett paraméter azt is kielégíti, hogy maga a `haversine.ts` fájl importálja és ténylegesen használja a `BUDAPEST_REF`-et, nem csak a jövőbeli hívó).
  - [ ] Implementáld a szabvány Haversine-képletet (Föld sugár ≈ 6371 km), `Math.sin`/`Math.cos`/`Math.atan2`/`Math.sqrt`, fokból radiánba konvertálással.
  - [ ] Ha `from === null` vagy a felbontott `to === null`, a függvény `null`-t ad vissza — nem dob kivételt.
  - [ ] Ne implementálj kerekítést (1 tizedesjegyre kerekítés a válaszban — FR-8 "consequences" pont — a 2.4 story service-rétegének felelőssége, nem ezé a pure function-é).
  - [ ] Ne hozz létre `src/services/customersService.ts`-t, ne nyúlj `src/app.ts`/`server.ts`/route-okhoz (2.2/2.3/2.4 hatóköre).

- [ ] **Task 2 — Unit tesztek (AC: #5)**
  - [ ] Hozd létre a `test/unit/haversine.test.ts`-t.
  - [ ] Teszt: Budapest (`BUDAPEST_REF`) → Bécs (`townReference.ts` `vienna` bejegyzése, `{lat: 48.2082, lon: 16.3738}`) ≈ 214 km, ±1 km tolerancián belül (számított referenciaérték: ≈214.04 km — ellenőrizve független Python-implementációval a story-készítés során).
  - [ ] Teszt: Budapest → Budapest (mindkét paraméter `BUDAPEST_REF`) === 0 (pontos egyenlőség, nem tolerancia-alapú).
  - [ ] Teszt: `null` bemenet mindkét pozícióban (`from = null`, `to = null`, mindkettő `null`) → `null`-t ad vissza, nem dob kivételt.
  - [ ] Kiegészítő józanság-tesztek (nem FR-9 kötelező eset, de olcsó és értékes): szimmetria (`haversine(A, B) === haversine(B, A)`); alapértelmezett `to` paraméter (`haversine(vienna)` ugyanazt adja, mint `haversine(vienna, BUDAPEST_REF)`); egy harmadik, független várospár (Budapest–München, `townReference.ts` `munich` bejegyzése) egy előre kiszámított, tolerált értékkel (≈561.15 km ±1 km).
  - [ ] Futtasd: `npm run test:unit` — minden tesztnek zöldnek kell lennie; rögzítsd a valódi pass-számot a Dev Agent Record-ban.

- [ ] **Task 3 — Story-dokumentáció és delivery (delivery norma, NFR7)**
  - [ ] Frissítsd ezt a story fájlt: Tasks pipálása, Dev Agent Record kitöltése, Status `ready-for-dev` → `in-progress` → `review`.
  - [ ] Frissítsd a `sprint-status.yaml`-t: `epic-2` `backlog` → `in-progress`; `2-1-tiszta-haversine-fuggveny-unit-tesztekkel` `backlog` → `ready-for-dev` → `in-progress` → `review`.
  - [ ] Kis, fókuszált commitok: (1) story-fájl létrehozása, (2) `haversine.ts` implementáció + unit tesztek együtt (kicsi, kohéz egység — nincs értelme szétbontani implementáció és teszt között, mivel egyetlen fájlpár).

## Dev Notes

- **Előző story-k (1.1, 1.3) tanulságai, relevánsak erre a story-ra:**
  - ESM (`"type": "module"`), `NodeNext` modulrezolúció (1.1) — relatív TS→TS import explicit `.js` kiterjesztéssel: `import { BUDAPEST_REF } from '../geocoding/townReference.js'`.
  - Story 1.3 pontosan ezért hagyta tisztán, jól típusozottan exportálva a `BUDAPEST_REF`-et és a `TownCoordinate` interfészt — ez az első story, amely ténylegesen importálja őket (1.3 Dev Notes: "a 2.1 IMPORTÁLNI FOGJA a `BUDAPEST_REF`-et ebből a fájlból").
  - `tsconfig.json` `"strict": true` már érvényesül forráskódra (1.3 óta) — a Haversine-függvény típusai (`TownCoordinate | null`) explicit null-kezelést igényelnek fordítási időben is, nem csak futásidőben.
- **AD-6 (tiszta Haversine-függvény)** — a függvény kizárólag sík argumentumokat vesz át, sima `number | null`-t ad vissza, nincs DB/HTTP/I/O-függősége. [Source: ARCHITECTURE-SPINE.md#AD-6]
- **AD-13 (egyetlen `BUDAPEST_REF`)** — a `haversine.ts` importálja, nem definiál második másolatot. [Source: ARCHITECTURE-SPINE.md#AD-13]
- **Rétegződés (Consistency Conventions / AD-1)** — a `services/` réteg (Haversine, majd 2.4-ben `customersService.ts`) végzi a `distanceKm`-számítást, kerekítést, rendezést; a route-ok csak HTTP I/O-t végeznek; a repository csak SQL-t. Ez a story kizárólag a Haversine pure function-t adja — a kerekítés (1 tizedesjegy) és a rendezés a 2.4 story felelőssége, itt NEM implementálandó. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions, sor 41-42]
- **Signature-döntés `[ASSUMPTION]`:** a két Given/When/Then eset közül a második ("Budapest koordinátáit adjuk meg mindkét paraméterként") explicit két paramétert feltételez ("mindkét paraméterként" = "as both parameters"), tehát a függvény generikus, két-koordinátás (`from`, `to`), NEM egy Budapest-re fixált egyparaméteres függvény. Ugyanakkor az első Given-tagmondat explicit előírja, hogy maga a `haversine.ts` fájl importálja a `BUDAPEST_REF`-et — ezt egy `to: TownCoordinate | null = BUDAPEST_REF` alapértelmezett paraméterrel oldom fel: a függvény generikus marad (a tesztek explicit mindkét paramétert adhatják), de a valós domain-használat (2.4: `distanceKm` mindig Budapesthez viszonyítva, FR-8) `haversine(customerCoord)` alakban hívható majd, anélkül hogy a 2.4 service rétegnek külön kellene importálnia a `BUDAPEST_REF`-et (bár az AD-13 ezt is megengedné "any other consumer"-ként).
- **Bécs-koordináta forrása:** a `townReference.ts` `vienna` bejegyzése (`{lat: 48.2082, lon: 16.3738}`, Story 1.3-ban rögzítve) — a teszt ebből importál, NEM egy második, kézzel beírt Bécs-koordinátából, hogy a teszt ugyanazon az adaton alapuljon, amit az app ténylegesen használ (AD-13 szellemében, még ha AD-13 szó szerint csak Budapestről szól).
- **Tolerancia-számítás ellenőrzése:** Budapest (47.4979, 19.0402) → Bécs (48.2082, 16.3738) Haversine-távolság független Python-implementációval kiszámítva a story-készítés során: **214.044 km** — jól az FR-9 "≈214 km, ±1 km" elvárásán belül, nincs verzió-currency vagy adat-drift kockázat.
- **Kizárt ebből a story-ból (más story-k felelőssége — ne nyúlj bele):** `src/services/customersService.ts` (2.4 — `distanceKm` összeállítás, kerekítés, rendezés); `src/app.ts`/`server.ts`/route-ok (2.2/2.3/2.4); bármilyen HTTP-végpont.

### Project Structure Notes

- Alignment: `src/services/haversine.ts` pontosan megfelel az `ARCHITECTURE-SPINE.md#Structural Seed` bejegyzésének (`services/haversine.ts # pure Haversine distance function`). [Source: ARCHITECTURE-SPINE.md#Structural Seed]
- Alignment: `test/unit/haversine.test.ts` a `test/unit/` könyvtárban, pontosan a Structural Seed és a Capability→Architecture Map (FR-9 sor: "`test/unit/haversine.test.ts`") szerint.
- Nincs eltérés (variance) — ez a story szigorúan a `src/services/haversine.ts`-re és a hozzá tartozó unit tesztekre korlátozódik; nincs új npm-dependency, nincs meglévő fájl módosítása a `townReference.ts`-en kívüli importon túl.

### References

- [Source: epics.md#Story 2.1: Tiszta Haversine-függvény unit tesztekkel] — a story pontos Given/When/Then AC-jei
- [Source: epics.md#Epic 2: Verifiable Customer Distance API] — epic-szintű kontextus, FR/NFR/AD lefedettség
- [Source: prd.md#FR-8: Haversine-távolságszámítás] — a `distanceKm` Haversine-képlettel számítva, ügyfél-koordináta ↔ Budapest referencia-koordináta között; kerekítés a válaszban (2.4 felelőssége)
- [Source: prd.md#FR-9: Haversine unit tesztek] — a három kötelező teszteset (Budapest–Bécs ≈214 km ±1 km, Budapest–Budapest = 0 km, null-kezelés)
- [Source: ARCHITECTURE-SPINE.md#AD-6 — Pure Haversine function] — sík argumentumok, sima `number`/`null` visszatérés, nincs I/O-függőség
- [Source: ARCHITECTURE-SPINE.md#AD-13 — Single Budapest reference coordinate] — egyetlen `BUDAPEST_REF`, `haversine.ts` importálja
- [Source: ARCHITECTURE-SPINE.md#Consistency Conventions, sor 41-42] — rétegződési szabály: service végzi a `distanceKm`-számítást/kerekítést/rendezést, route csak HTTP I/O
- [Source: ARCHITECTURE-SPINE.md#Structural Seed] — `src/services/haversine.ts` fájlhely, `test/unit/` teszt-könyvtár
- [Source: ARCHITECTURE-SPINE.md#Capability→Architecture Map, FR-8/FR-9 sorok]
- [Source: 1-3-offline-telepules-koordinata-referencia-es-normalizetown.md#Dev Notes] — ESM/`NodeNext` explicit `.js` import-kiterjesztés konvenció; `BUDAPEST_REF`/`TownCoordinate` export szerződés, amit ez a story importál
- `src/geocoding/townReference.ts` (repo, Story 1.3-ban létrehozva) — `BUDAPEST_REF`, `TownCoordinate`, `vienna`/`munich` bejegyzések pontos koordinátái

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
