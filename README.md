
# Customer Distance API

Ez a házi feladat ugyanazon PostgreSQL REST API feladaton keresztül hasonlítja össze a Superpowers és a BMAD-METHOD módszertant.

## Séma- és adatellenőrzés PostgreSQL MCP-vel

A repo gyökerében lévő [`.mcp.json`](./.mcp.json) egy Postgres MCP szervert (`@modelcontextprotocol/server-postgres`) konfigurál, amivel kód írása nélkül, közvetlenül ellenőrizhető a `customers` tábla sémája és a seedelt adat — akár még azelőtt, hogy a Story 2.x-ben elkészülő HTTP API léteznék.

**Előfeltétel:** egy futó és migrált (opcionálisan seedelt) lokális Postgres — ld. `docker compose up -d` + `npm run migrate:up` + `npm run seed` (a teljes végigfutási dokumentáció a Story 3.1 README-jében készül el).

**Hogyan működik a kapcsolat titkosítás nélkül:** a `.mcp.json` a kapcsolatot NEM tartalmazza hardcode-olva — az `args` tömb `${DATABASE_URL}` hivatkozást tartalmaz, amit a Claude Code a saját [MCP env-var expanziós mechanizmusával](https://code.claude.com/docs/en/mcp) (a `command`/`args`/`env`/`url`/`headers` mezőkben támogatott `${VAR}`/`${VAR:-default}` szintaxis) a szerver indításakor old fel a ténylegesen futó shell/`.env` környezetből. Ha a `DATABASE_URL` nincs beállítva, a szerver nem indul el érvényes kapcsolattal — nincs beégetett fallback jelszó vagy connection string a committolt fájlban.

**Használat lépései:**

1. Győződj meg róla, hogy a `DATABASE_URL` be van állítva a shell környezetedben (pl. `set -a && source .env && set +a`, a `.env` fájl a repo gyökerében lévő `.env.example` alapján hozható létre — a teljes indítási/migrációs/seedelési végigfutás a Story 3.1 README-jében készül el).
2. Indítsd a Claude Code-ot a repo gyökeréből (`claude`). Első alkalommal jóvá kell hagyni a projekt-szintű `.mcp.json`-ban definiált `postgres` szervert (workspace trust / MCP approval dialógus).
3. A `/mcp` paranccsal ellenőrizhető, hogy a `postgres` szerver csatlakozott-e.
4. Kérd meg az agentet, hogy listázza ki a `customers` tábla oszlopait és megszorításait (a szerver `resources/list` + `resources/read` képessége az `information_schema.columns`-t adja vissza; a megszorítások — `UNIQUE(name, telepules)`, lat/lon `CHECK`-ek — egy `pg_constraint`-re irányuló, a szerver `query` eszközén keresztüli SQL-lekérdezéssel kérhetők le, pl.: `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'customers'::regclass`).
5. Kérdezz le néhány sort a spot-check-hez, pl.: `SELECT name, telepules, lat, lon FROM customers ORDER BY name LIMIT 5;` — a szerver a `query` eszközén keresztül csak olvasási (`BEGIN TRANSACTION READ ONLY`) módban futtatja a megadott SQL-t, minden írási kísérletet (pl. `DELETE`/`UPDATE`/`INSERT`) elutasít tranzakció-szinten, majd `ROLLBACK`-el zár.

**Megjegyzés a csomagról:** a `@modelcontextprotocol/server-postgres` az npm registry-n `DEPRECATED — Package no longer supported` jelzéssel szerepel; ennek ellenére ténylegesen telepíthető és működik, és ez a hivatalos, az architektúra-dokumentumban (AD-11) explicit megnevezett csomag erre a fejlesztői-eszköz célra. A `.mcp.json` a `@0.6.2` verzióra van pontosan pinnelve (a projekt más függőségeihez hasonlóan, ld. `package.json`), hogy egy jövőbeli `latest`-váltás ne változtassa meg csendben a viselkedést. Ha a csomag idővel teljesen eltűnne az npm-ről, egy alternatív Postgres MCP szerver kereshető az npm-en — ezt a README-t megelőzően nem vizsgáltunk meg konkrét, ellenőrzött alternatívát, ezért itt nem nevezünk meg egyet sem, hogy ne állítsunk ellenőrizetlen csomagról "karbantartott" státuszt.

**Ismert korlát:** a `${DATABASE_URL}` a `npx` gyermekfolyamat parancssori argumentumaként adódik át, ami azt jelenti, hogy a teljes connection string (a jelszóval együtt) rövid ideig látható a helyi gép folyamatlistájában (pl. `ps aux`) a szerver indítása közben. Ez a csomag natív viselkedése (a connection stringet argv-ként várja, nem env változóként) — lokális, nem-titkos fejlesztői adatbázis esetén elfogadott kompromisszum, éles/titkos adatbázisra nem javasolt.

