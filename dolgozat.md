# Superpowers és BMAD-METHOD összehasonlítása

A feladatban ugyanazt a PostgreSQL-alapú REST API-t készítettem el kétszer, két külön branchen. A `harness/superpowers` branch Superpowers-szel, a `harness/bmad` branch pedig BMAD-METHOD-del készült. Mindkét megoldás ugyanabból a `main` branchből és ugyanabból a `seed-customers.json` fájlból indult.

## Setup és tanulási görbe

A Superpowers beállítása egyszerű volt. Claude Code plugin formájában telepítettem, ezután automatikusan használta a brainstorming, planning, TDD és review skilleket. A folyamatot gyorsan meg lehetett érteni: először tisztáztuk a fontos technikai döntéseket, készült egy design és egy implementációs terv, majd taskonként elkészült a projekt.

A BMAD telepítése sem volt különösebben nehéz, maga a módszer viszont jóval összetettebb. Külön PRD, architecture spine, epicek, storyk, readiness check és sprint planning készült. Első alkalommal idő kellett ahhoz is, hogy megértsem, melyik workflow-t mikor érdemes használni.

## Steering és tervezés

A Superpowers esetében főleg a kezdeti technikai választásokat kellett jóváhagynom, például az Express, a PostgreSQL, a Docker Compose és a Vitest használatát. Ezután nagyrészt önállóan hajtotta végre a tervet. A taskokat külön commitokban készítette el, és minden lépés után review-t végzett.

A BMAD-nél sokkal több manuális irányításra volt szükség. Coaching módban szinte minden részletet külön meg akart beszélni: Vision, Target User, Glossary, feature-csoportok, funkcionális követelmények, success metrics, adatmodell, naming convention, hibaformátum és további architektúradöntések.

Ennek egy része hasznos volt, mert több valódi hiányosságot is megtalált. Ugyanakkor nagyon könnyen belemerült olyan részletekbe, amelyek egy kétvégpontos homework API esetében már nem adtak arányos értéket. Egy-egy reviewer gate után újabb kisebb inkonzisztenciákat talált, kijavította őket, majd a módosításokat ismét felülvizsgálta. Emiatt a folyamat hajlamos volt szinte végtelen javítási körökbe kerülni.

A BMAD emellett rendkívül sok tokent használt. Míg a Superpowers nagyjából a napi keretem 20%-át használta el, a BMAD összesen körülbelül három teljes napi keretet fogyasztott el. A hosszú PRD-, architektúra- és review-folyamat sokkal több kontextust igényelt, mint maga az implementáció.

Végül Fast path módra váltottam, és azt kértem, hogy csak valódi követelményellentmondásnál vagy scope-növelő döntésnél álljon meg. Ettől a fejlesztés lényegesen gyorsabb lett.

## Kódminőség és tesztelés

Mindkét harness működő megoldást készített. A seed kétszer futtatva sem duplázta az adatokat, a települések koordinátái lokális referenciából származtak, a távolságszámítás működött, és mindkét végpont helyes eredményt adott.

A Superpowers megoldása tömörebb maradt. A végső ellenőrzés során 7 teszt futott sikeresen, köztük Haversine unit tesztek és valódi PostgreSQL-lel futó integrációs tesztek.

A BMAD sokkal részletesebb tesztcsomagot készített: 89 unit és 19 integrációs teszt futott sikeresen. Tiszta Docker volume-ról is ellenőrizte a migrációt, a seed kétszeri futását, a 15 rekordot, az API-végpontokat és az MCP-kapcsolatot.

A több teszt önmagában nem jelenti automatikusan azt, hogy a BMAD megoldása jobb. Inkább azt mutatja, hogy a BMAD sokkal kisebb részekre bontotta a követelményeket, és szinte minden döntést külön teszttel vagy dokumentummal próbált igazolni.

## Kontroll és fejlesztői élmény

A Superpowers mellett jobban éreztem, hogy én irányítom a fejlesztést. Volt terv és review, de a folyamat végig közel maradt a tényleges kódhoz. Egy kisebb backend projektnél ez számomra megfelelő egyensúlyt adott.

A BMAD nagyobb kontrollt és jobb traceabilityt biztosított. Pontosan vissza lehet követni, hogy egy követelmény melyik architecture decisionhöz, storyhoz és teszthez kapcsolódik. Nagyobb vagy üzletileg kritikus projektnél ez valódi előny lehet.

A hátránya, hogy önmagától nem mindig méri fel jól a projekt méretét. Hajlamos ugyanazzal a részletességgel kezelni egy kis homework API-t, mint egy komoly termékfejlesztést. Emiatt a fejlesztőnek kell meghúznia a határt, különben túl sok idő és token megy el dokumentációra, reviewer körökre és apró javításokra.

## Összegzés

Mindennapi fejlesztéshez a Superpowers-t választanám. Gyorsabban jut el a működő kódig, miközben továbbra is ad tervezést, TDD-t, taskonkénti commitokat és code review-t. Ennél a feladatnál ez volt a praktikusabb megközelítés.

A BMAD-et olyan nagyobb projektnél használnám, ahol több szereplő dolgozik együtt, sok követelményt kell nyomon követni, és fontos a formális PRD–architektúra–story–teszt kapcsolat. Kis projektnél viszont csak rövidített vagy Fast path módban használnám.

A két eszköz közül tehát egyik sem minden helyzetben jobb. A Superpowers fejlesztőközpontú és könnyű, a BMAD pedig folyamatközpontú és nagyon alapos. Ennél a konkrét feladatnál a Superpowers adott jobb arányt a befektetett munka és a végeredmény között.