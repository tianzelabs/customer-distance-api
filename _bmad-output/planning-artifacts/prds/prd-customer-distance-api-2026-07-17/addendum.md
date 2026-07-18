# Addendum — Customer Distance API

Technical-how tartalom, amely nem tartozik a PRD funkcionális-követelmény szintjéhez, de továbbadandó az architektúra/implementáció felé.

## Paraméterezett adatbázis-lekérdezések (kapcsolódik: FR-2, FR-6, FR-7)

- Minden dinamikus értéket tartalmazó adatbázis-művelet (pl. a seed-betöltés upsertje) kizárólag paraméterezett lekérdezést (prepared statement / parameter binding) használhat.
- A teljesen statikus, paraméter nélküli lekérdezések (pl. `SELECT COUNT(*) FROM customers`, `SELECT * FROM customers` `WHERE` nélkül) természetes kivételt képeznek — nincs mit paraméterezni rajtuk; ez nem gyengíti a szabályt, csak pontosítja a hatókörét. (Architektúra-szinten rögzítve: `ARCHITECTURE-SPINE.md` AD-2.)
- Tilos a seed vagy bármely felhasználói/dinamikus adatot SQL string-konkatenációval beilleszteni.
- Konkrét indok: a seedben szereplő `Niamh O'Brien` név aposztrófot tartalmaz — string-konkatenáció esetén ez szintaktikailag törné a lekérdezést és SQL injection-re nyitna felületet.
- Ez egyben alapvető SQL injection elleni védelem is, nem csupán a konkrét seed-adat kezelésének kérdése.
