---
baseline_commit: 47791fac20f463a8412caf2b5029e7b523fa6c61
---

# Story 1.5: PostgreSQL MCP séma- és adatellenőrzés

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Mint kiértékelő,
MCP-n keresztül szeretném ellenőrizni a `customers` séma és a seedelt adatok helyességét,
hogy fejlesztés közben kód írása nélkül tudjam validálni az adatréteget.

## Acceptance Criteria

1. **Given** egy futó, migrált és seedelt lokális Postgres, **when** a fejlesztő megnyitja a repo gyökerében lévő `.mcp.json`-t, **then** a hivatalos `@modelcontextprotocol/server-postgres` csomag van konfigurálva Postgres MCP szerverként (read-only kényszerítéssel tranzakció-szinten), amely a kapcsolatot egy környezeti változóból (`DATABASE_URL`) kapja, nem hardcode-olt connection stringből vagy titokból. [Source: epics.md#Story 1.5; ARCHITECTURE-SPINE.md#AD-11]
2. **When** a kiértékelő az MCP-n keresztül lekérdezi a sémát, **then** látja a `customers` tábla oszlopait és megszorításait. [Source: epics.md#Story 1.5; prd.md#FR-13]
3. **When** a kiértékelő az MCP-n keresztül lekérdez néhány sort, **then** ellenőrizni tudja legalább a `name`/`telepules`/`lat`/`lon` értékeket. [Source: epics.md#Story 1.5; prd.md#FR-13]
4. A README dokumentálja ennek a séma-/adatellenőrzésnek a pontos lépéseit. [Source: epics.md#Story 1.5; ARCHITECTURE-SPINE.md#AD-11]

## Tasks / Subtasks

- [x] **Task 1 — Csomag- és formátum-research (AC: #1)**
  - [x] Ellenőrizd webről a `@modelcontextprotocol/server-postgres` csomag jelenlegi állapotát (npm registry: verzió, deprecation-jelzés, README-alapú CLI-invokáció szintaxis).
  - [x] Ellenőrizd webről a Claude Code `.mcp.json` formátumának hivatalos specifikációját, kifejezetten az env-var-expanziós mechanizmust (`${VAR}`/`${VAR:-default}`), és hogy melyik mezőkben (`command`/`args`/`env`/`url`/`headers`) működik.
  - [x] Olvasd el ténylegesen a telepített csomag forráskódját (`dist/index.js`, `npx` cache-elt példány), hogy megbizonyosodj róla: a csomag a DB connection stringet argv-ből olvassa (nem `process.env`-ből közvetlenül), és hogy a read-only kényszerítés hogyan van implementálva (tranzakció-szintű `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`).

- [x] **Task 2 — `.mcp.json` létrehozása env-var mechanizmussal (AC: #1)**
  - [x] Hozd létre a `.mcp.json`-t a repo gyökerében, `mcpServers.postgres` bejegyzéssel: `command: "npx"`, `args: ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]`.
  - [x] Ellenőrizd, hogy a fájl valid JSON, és hogy semmilyen literál connection string/jelszó/host nincs benne (csak a `${DATABASE_URL}` placeholder).
  - [x] Ellenőrizd, hogy a `.gitignore` NEM zárja ki a `.mcp.json`-t (`git check-ignore -v .mcp.json` üres/1-es kilépőkóddal tér vissza).

- [x] **Task 3 — Valódi, MCP-kliens nélküli verifikáció (AC: #2, #3)**
  - [x] Írj egy ideiglenes (nem committolt, scratchpad-beli) Node scriptet, ami nyers JSON-RPC 2.0 üzenetekkel (`initialize` → `notifications/initialized` → `resources/list` → `resources/read` → `tools/call "query"`) meghajtja a `npx -y @modelcontextprotocol/server-postgres "$DATABASE_URL"` folyamatot stdio-n keresztül, valódi, futó, migrált és seedelt lokális Postgres ellen.
  - [x] Bizonyítsd: (a) séma lekérdezhető (`resources/read` a `customers/schema` URI-ra → oszloplista adattípusokkal); (b) megszorítások lekérdezhetők (`query` eszköz `pg_constraint`-re irányuló SQL-lel → mind a 8 megszorítás, beleértve `UNIQUE(name, telepules)` és a két lat/lon `CHECK`-et); (c) adatsorok lekérdezhetők (`query` eszköz `SELECT name, telepules, lat, lon FROM customers ...`); (d) a read-only kényszerítés ténylegesen működik (egy `DELETE` írási kísérlet a `query` eszközön keresztül `"cannot execute DELETE in a read-only transaction"` hibával elutasítva).
  - [x] Dokumentáld a Dev Agent Record Debug Log-jában, hogy mi lett ténylegesen, valódi futtatással bizonyítva, és mi az, amit egy valódi MCP-kliens (interaktív Claude Code `/mcp` munkamenet) nélkül nem lehet ebben a környezetben bizonyítani (pl. a workspace-trust/approval UI-folyamat maga).

- [x] **Task 4 — README szakasz (AC: #4)**
  - [x] Adj hozzá egy önálló, fókuszált "Séma- és adatellenőrzés PostgreSQL MCP-vel" szekciót a `README.md`-hez (a meglévő egysoros bevezető után) — NE írd újra a teljes README-t, az a Story 3.1 feladata.
  - [x] Dokumentáld: előfeltétel (futó/migrált Postgres), az env-var mechanizmus rövid magyarázata (miért nincs titok a committolt fájlban), a konkrét lépések (Claude Code indítás, MCP approval, `/mcp`, séma-lekérdezés, megszorítás-lekérdezés, adat-spot-check), és egy rövid megjegyzés a csomag deprecation-státuszáról (átláthatóság).

- [x] **Task 5 — Story-dokumentáció és delivery (delivery norma, NFR7)**
  - [x] Frissítsd ezt a story fájlt: Tasks pipálása, Dev Agent Record kitöltése, Status `ready-for-dev` → `in-progress` → `review`.
  - [x] Frissítsd a `sprint-status.yaml`-t: `1-5-postgresql-mcp-sema-es-adatellenorzes` `backlog` → `ready-for-dev` → `in-progress` → `review`.
  - [x] Kis, fókuszált commitok (pl.: story-fájl; `.mcp.json`; README-szekció), nem egyetlen mindent-összefogó záró commit (NFR7).

## Dev Notes

- **Ez egy kis, elsősorban konfigurációs story — nincs alkalmazáskód-változás.** Explicit tiltott hatókör: `src/app.ts`/`src/server.ts`/route-ok (Epic 2 feladata), bármilyen `src/` alatti forráskód-változtatás. Nincs értelmes "unit teszt" egy statikus JSON konfigurációs fájlra — a verifikáció maga: valid JSON, nincs titok, és (amennyire lehetséges MCP-kliens nélkül) bizonyíték arra, hogy a hivatkozott MCP szerver-csomag ténylegesen létezik és fut.
- **AD-11 (Postgres MCP dev-tooling konfiguráció)** — a `.mcp.json` a repo gyökerén van, a hivatalos `@modelcontextprotocol/server-postgres` csomagot konfigurálja, a kapcsolat env változóból jön (`DATABASE_URL`, újrahasznosítva az AD-9 konvenciót), sosem hardcode-olt titokból. [Source: ARCHITECTURE-SPINE.md#AD-11]
- **`[ASSUMPTION]` Env-var mechanizmus a `.mcp.json`-ban.** Az AD-11 előírja, hogy a kapcsolat "egy környezeti változóból" jöjjön, de nem rögzíti a pontos szintaxist — ez egy valódi fájlformátum, nem kitalált. Web-research + a Claude Code hivatalos dokumentációja (`code.claude.com/docs/en/mcp`) alapján: a Claude Code `.mcp.json`-ja `${VAR}`/`${VAR:-default}` szintaxist támogat a `command`/`args`/`env`/`url`/`headers` mezőkben, amit a szerver indításakor a futó shell/`.env` környezetből told fel. Mivel a `@modelcontextprotocol/server-postgres` csomag maga a connection stringet argv-ből olvassa (nem `process.env.DATABASE_URL`-ből — ld. a telepített csomag `dist/index.js` forrása, `const databaseUrl = args[0]`), a helyes minta az `args` tömbben elhelyezett `${DATABASE_URL}` placeholder, NEM egy `env` blokk (az utóbbi nem érne célt, mert a csomag nem olvas saját maga környezeti változót a kapcsolathoz). Nincs `:-default` fallback megadva — ha a `DATABASE_URL` nincs beállítva, a szerver nem indul érvényes kapcsolattal (fail-fast jellegű, konzisztens az `env.ts` fail-fast konvenciójával, még ha ezt maga a `.mcp.json` formátum nem is kényszeríti ki explicit hibaüzenettel).
- **`[ASSUMPTION]` Nincs `:-default` fallback a `.mcp.json`-ban.** Egy `${DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/customer_distance}` forma technikailag ugyanazokat a nem-titkos, lokális dev-credential-öket írná be, mint a `.env.example` (Story 1.1) — de az AC #1 explicit "nem hardcode-olt connection stringből vagy titokból" megfogalmazása miatt a döntés: semmilyen kapcsolat-információ (még nem-titkos is) nem kerül a committolt fájlba defaultként; a `DATABASE_URL`-nek mindig a futtató környezetből kell jönnie.
- **Csomag-deprecation ténymegállapítás (nem blokkoló, dokumentált).** Az npm registry a `@modelcontextprotocol/server-postgres`-t `DEPRECATED — Package no longer supported`-ként jelzi (legutóbbi verzió `0.6.2`, publikálva kb. egy éve). Ez egy valódi, web-ellenőrzött tény, de NEM "uninstallable external dependency" — a csomag ténylegesen telepíthető és fut (ld. Task 3 valódi verifikációja), és az epics.md/ARCHITECTURE-SPINE.md explicit, a readiness-check UTÁN frissítve, név szerint ezt a csomagot nevezi meg. Ez tehát nem megállási ok (a megbízó instrukciója szerint sem az), csak egy dokumentálandó tény átláthatóság céljából — a README egy rövid megjegyzést tartalmaz erről.
- **Read-only kényszerítés mechanizmusa (ténylegesen ellenőrizve, nem csak dokumentáció alapján feltételezve).** A csomag `query` MCP-eszköze minden SQL-t egy `BEGIN TRANSACTION READ ONLY` ... `ROLLBACK` blokkba csomagol (ld. a telepített csomag forráskódja). Ez NEM egy `.mcp.json`-konfigurációs opció — a csomag maga kényszeríti ki, kódszinten, minden lekérdezésre, függetlenül attól, hogy a kliens milyen SQL-t küld. Task 3-ban egy tényleges `DELETE` írási kísérlettel bizonyítva: a szerver `"cannot execute DELETE in a read-only transaction"` hibával utasította el.
- **Séma + megszorítés lekérdezés kétféle úton.** A csomag beépített `resources/list` + `resources/read` képessége csak az oszloplistát adja (`information_schema.columns` — oszlopnév + adattípus), a megszorításokat (CHECK/UNIQUE/PK) NEM. Az AC #2 viszont mindkettőt ("oszlopait és megszorításait") megköveteli — ezt a csomag általános célú `query` eszköze fedi le, tetszőleges read-only SQL-lel (pl. `pg_constraint`-re irányuló lekérdezéssel). A README ezt a kétlépéses mintát dokumentálja, nem csak a beépített resource-listázást.
- **Scope-határ — mit NEM fed le ez a story:** `src/app.ts`/`src/server.ts`/route-ok (Epic 2), a teljes README (Story 3.1 feladata — ez a story csak egy önálló szekciót ad hozzá), bármilyen alkalmazáskód-változás.

### Project Structure Notes

- Alignment: `.mcp.json` a repo gyökerén pontosan megfelel az `ARCHITECTURE-SPINE.md#Structural Seed` bejegyzésének (`.mcp.json # Postgres MCP server config (AD-11) — connection via env var, no committed secret`). [Source: ARCHITECTURE-SPINE.md#Structural Seed]
- Nincs eltérés (variance) a Structural Seed-től.

### References

- [Source: epics.md#Story 1.5: PostgreSQL MCP séma- és adatellenőrzés] — a story pontos Given/When/Then AC-jei (a readiness-check utáni, `@modelcontextprotocol/server-postgres`-t explicit megnevező verzió)
- [Source: epics.md#Epic 1: Reproducible Local Data Foundation] — epic-szintű kontextus, FR13 lefedettség
- [Source: ARCHITECTURE-SPINE.md#AD-11 — PostgreSQL MCP dev-tooling configuration]
- [Source: ARCHITECTURE-SPINE.md#Structural Seed] — `.mcp.json` fájlpozíció és cél
- [Source: prd.md#FR-13: PostgreSQL MCP séma- és adatellenőrzés] — Consequences (működő MCP konfiguráció, dokumentált séma-lekérdezés)
- [Source: prd.md#SM-1] — FR-13-hoz elegendő a dokumentált konfiguráció + egy dokumentált séma-/adatellenőrzési lépés, automatizált teszt nélkül is
- [Source: 1-1-projekt-scaffold-es-lokalis-postgres-docker-compose-zal.md] — `.env.example` non-secret dev-credential konvenció, amivel a `.mcp.json` NEM egyezik meg (nincs default fallback benne)
- [Source: 1-4-idempotens-seed-script.md] — a jelen valódi dev-DB (`customer_distance`) már migrált és seedelt (15 sor, `Anna Kovács`/Budapest, `Niamh O'Brien` stb.), ezért a Task 3 verifikáció valódi, nem szintetikus adatot ellenőriz
- npm registry (`npm view @modelcontextprotocol/server-postgres`) — verzió (`0.6.2`), deprecation-jelzés, karbantartók, ebben a session-ben ellenőrizve
- A telepített csomag forráskódja (`~/.npm/_npx/*/node_modules/@modelcontextprotocol/server-postgres/dist/index.js`) — argv-alapú connection string olvasás, `resources`/`tools` képességek, tranzakció-szintű read-only kényszerítés implementációja, ebben a session-ben elolvasva
- Claude Code hivatalos dokumentáció (`code.claude.com/docs/en/mcp`) — `.mcp.json` env-var-expanziós szintaxis (`${VAR}`/`${VAR:-default}`), expanziós helyek (`command`/`args`/`env`/`url`/`headers`), projekt-scope fájlhely (`.mcp.json` a projekt gyökerén, verziókezelt)
- Saját, ebben a session-ben futtatott valódi verifikáció (nyers JSON-RPC 2.0 stdio session a `npx -y @modelcontextprotocol/server-postgres "$DATABASE_URL"` ellen, valódi futó/migrált/seedelt lokális Postgres-en) — ld. Dev Agent Record Debug Log

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code, bmad-dev-story workflow, autonomous mode)

### Debug Log References

- `npm view @modelcontextprotocol/server-postgres` (ebben a session-ben futtatva): `@modelcontextprotocol/server-postgres@0.6.2`, `DEPRECATED ⚠️ - Package no longer supported.`, publikálva kb. egy éve, karbantartók listája (`jspahrsummers`, `pcarleton`, `fweinberger`, stb. — Anthropic/MCP maintainer fiókok). Ténymegállapítás, nem blokkoló — ld. Dev Notes.
- `npx -y @modelcontextprotocol/server-postgres --help` — a csomagnak nincs `--help` kapcsolója; argv nélküli/hibás argv esetén `TypeError: Invalid URL`-lel/`process.exit(1)`-gyel hibázik, mert az első argumentumot connection stringként `new URL(...)`-lel próbálja parse-olni. Ez megerősítette, hogy a csomag argv-alapú, nem env-var-alapú connection-string-olvasást használ — ezért esett a döntés a `.mcp.json` `args`-beli `${DATABASE_URL}` expanzióra (nem `env` blokkra).
- A telepített csomag forráskódjának (`dist/index.js`) elolvasása megerősítette: (1) `const databaseUrl = args[0]` — argv[2]-ből olvas; (2) a `query` MCP-eszköz minden SQL-t `BEGIN TRANSACTION READ ONLY` ... (végül) `ROLLBACK` közé csomagol — ez a tényleges read-only kényszerítés mechanizmusa; (3) `resources/list`/`resources/read` az `information_schema.tables`/`information_schema.columns`-ra épül (csak oszloplista, megszorítás nélkül).
- Saját, nyers JSON-RPC 2.0 stdio verifikációs script (scratchpad, nem committolva) valódi, futó, migrált, Story 1.4-ben seedelt lokális Postgres (`DATABASE_URL`, `customer_distance`, 15 valódi sor) ellen, `npx -y @modelcontextprotocol/server-postgres "$DATABASE_URL"` folyamatot indítva:
  - `initialize` → sikeres handshake, `serverInfo: {name: "example-servers/postgres", version: "0.1.0"}`.
  - `resources/list` → két resource: `"pgmigrations" database schema`, `"customers" database schema`.
  - `resources/read` a `customers/schema` URI-ra → 8 oszlop, helyes adattípusokkal (`id: bigint`, `name: text`, `telepules: text`, `lat: double precision`, `lon: double precision`, `budget: integer`, `note: text`, `country_code: character varying`) — egyezik a Story 1.2 migrációjával.
  - `tools/call query` (`SELECT name, telepules, lat, lon FROM customers ORDER BY name LIMIT 3`) → valódi seedelt sorokat adott vissza (`Anna Kovács`/Budapest `47.4979/19.0402` — bit-for-bit egyezik a Story 1.4-ben rögzített `BUDAPEST_REF`-fel; `Diego Martín`/Barcelona; `Elena Popescu`/Bucharest).
  - `tools/call query` (`SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'customers'::regclass`) → mind a 8 megszorítás megjelent: `customers_pkey` (PK), `customers_name_telepules_key` (`UNIQUE(name, telepules)`), `customers_lat_check`, `customers_lon_check`, `customers_lat_lon_pair_check` (a Story 1.2-ben rögzített pontos CHECK-definíciókkal), `NOT NULL` megszorítások `id`/`name`/`telepules`-en.
  - `tools/call query` (`DELETE FROM customers WHERE name = 'nonexistent-mcp-verify-probe'`) → ténylegesen elutasítva: `{"error": {"code": -32603, "message": "cannot execute DELETE in a read-only transaction"}}` — a read-only kényszerítés valós, nem csak dokumentált feltételezés.
- **Amit NEM lehetett ebben a környezetben, MCP-kliens nélkül bizonyítani:** a Claude Code interaktív workspace-trust/MCP-approval UI-folyamatot magát (a `.mcp.json`-ban definiált, még jóvá nem hagyott projekt-szintű szerver `⏸ Pending approval` állapotát és a `claude`/`\/mcp` interaktív jóváhagyását) — ez a jelen (nem-interaktív, subagent) futtatási módban nem exercise-elhető, mivel egy külön, interaktív Claude Code munkamenetet igényelne. A nyers JSON-RPC stdio-driver ugyanazt a protokollt beszéli, amit egy valódi MCP-kliens is használna a handshake/resource/tool szinten, így funkcionálisan egyenértékű bizonyítékot ad a szerver tényleges működésére — de az approval-UI maga dokumentáció alapján van leírva a README-ben, nem session-ben exercise-elve.

### Completion Notes List

- Mind a 4 AC valódi, futtatott bizonyítékkal igazolva: AC #1 (`.mcp.json` létrehozva, valid JSON, nincs literál titok, `git check-ignore -v .mcp.json` megerősíti, hogy nincs kizárva), AC #2 (séma + mind a 8 megszorítás lekérdezve valódi MCP-protokoll-session-ben), AC #3 (valódi seedelt sorok `name`/`telepules`/`lat`/`lon` mezőkkel lekérdezve), AC #4 (README önálló, fókuszált szekcióval bővítve).
- A csomag deprecation-státusza web-ellenőrzött tény (npm registry), dokumentálva a README-ben és a Dev Notes-ban átláthatóság céljából — nem blokkolta a story-t, mert a csomag ténylegesen telepíthető és funkcionális, és az epics.md/ARCHITECTURE-SPINE.md explicit név szerint ezt írja elő.
- Scope-fegyelem: nincs `src/`-változás, nincs route/service/repository-kód, a README csak egy célzott szekcióval bővült (nem a teljes végigfutási dokumentáció — az Story 3.1 feladata).
- A `.env`/`.gitignore` állapota ellenőrizve — nem igényelt kódváltoztatást, mert az env-var mechanizmus helyesen lett alkalmazva a `.mcp.json`-ban (nincs valódi titok a committolt fájlokban).

### File List

**New:**
- `.mcp.json`
- `_bmad-output/implementation-artifacts/1-5-postgresql-mcp-sema-es-adatellenorzes.md`

**Modified:**
- `README.md` (új "Séma- és adatellenőrzés PostgreSQL MCP-vel" szekció hozzáadva)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (`1-5-postgresql-mcp-sema-es-adatellenorzes`: `backlog` → `ready-for-dev` → `in-progress` → `review`; `last_updated` frissítve)

### Change Log

- 2026-07-19: Story created (`bmad-create-story` workflow) és ugyanebben a session-ben implementálva (`bmad-dev-story` workflow, autonóm mód) — Task 1–5 elkészült. `.mcp.json` létrehozva env-var mechanizmussal; valódi, MCP-kliens nélküli JSON-RPC-verifikáció futtatva valódi Postgres ellen (séma, megszorítások, adatsorok, read-only kényszerítés mind bizonyítva); README szekció hozzáadva. Status `ready-for-dev` → `in-progress` → `review`.
