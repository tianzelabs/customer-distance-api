# Superpowers és BMAD-METHOD összehasonlítása

A feladatban ugyanazt a PostgreSQL-alapú REST API-t készítettem el kétszer, két külön branchen. A `harness/superpowers` branch Superpowers-szel, a `harness/bmad` branch pedig BMAD-METHOD-del készült. Mindkettő ugyanabból a `main` branchből és ugyanabból a `seed-customers.json` fájlból indult.

## Setup és tanulási görbe

A Superpowers telepítése egyszerű volt: Claude Code pluginként hozzáadtam, majd automatikusan használta a brainstorming, planning, TDD és review skilleket. A folyamat gyorsan átláthatóvá vált: először tisztáztuk a technikai döntéseket, ezután design és implementációs terv készült, majd taskonként végrehajtotta azt.

A BMAD telepítése szintén problémamentes volt, maga a módszer viszont sokkal összetettebb. Külön PRD, Architecture Spine, epicek, storyk, readiness check és sprint planning készült. Több idő kellett annak megértéséhez, hogy melyik workflow-t mikor érdemes használni.

## Steering és tervezés

A Superpowersnél főleg a kezdeti technológiai döntéseket kellett jóváhagynom. Ezután nagyrészt önállóan haladt, és minden task után review-t végzett. A branch rövid, jól követhető commit historyval készült.

A BMAD sokkal több manuális irányítást igényelt. Coaching módban szinte minden részletet külön meg akart beszélni, például a Visiont, a Glossaryt, a funkcionális követelményeket, az adatmodellt és a naming conventionöket. Több valódi hiányosságot is megtalált, de könnyen belemerült olyan részletekbe, amelyek egy kétvégpontos homework API esetében már nem adtak arányos értéket.

A reviewer gate-ek után gyakran újabb apró inkonzisztenciákat talált, kijavította őket, majd ismét felülvizsgálta a módosításokat. Emiatt a folyamat hajlamos volt szinte végtelen javítási körökbe kerülni. A Superpowers nagyjából a napi tokenkeretem 20%-át használta el, míg a BMAD összesen körülbelül három teljes napi keretet fogyasztott el.

Végül Fast path módra váltottam, és csak valódi követelményellentmondásnál vagy scope-növelő döntésnél engedtem megállni. Ettől a fejlesztés jelentősen gyorsabb lett. A különbséget a commit history is mutatja: a `harness/superpowers` branch 13, a `harness/bmad` branch 55 commitból áll (ebből 4 tisztán tervezési dokumentum — PRD, Architecture Spine, epics/readiness report —, a fennmaradó 51 kód-szintű implementáció és review-javítás).

## Kódminőség és edge case-ek

Mindkét harness működő megoldást készített. Az idempotens seed kétszeri futtatás után is 15 rekordot eredményezett, a koordináták lokális referenciából származtak, és mindkét GET végpont helyesen működött.

A Superpowers megoldása tömörebb maradt. A végső ellenőrzés során 7 teszt futott sikeresen: lefedte a Budapest–Bécs távolságot, a 0 km-es esetet és a null koordinátát. A teljes branch review nem talált blokkoló hibát, csak néhány kisebb, nem kötelező javítási lehetőséget.

A BMAD readiness checkje elsőre `NEEDS WORK` eredményt adott (2 major hiba: az Epic 1 rejtett függése az Epic 2-ben létrehozandó `pool.ts`/`env.ts`-től, és a Postgres MCP csomag nevesítetlensége), majd e két probléma javítása után lett `READY`. A végső megoldás 89 unit és 19 integrációs tesztet tartalmazott. Külön tesztelte többek között az ékezetes településneveket, az ismeretlen települést, a null koordinátát, a rendezést és a valódi PostgreSQL-integrációt.

A több teszt nem jelenti automatikusan azt, hogy a BMAD megoldása jobb. Inkább azt mutatja, hogy sokkal kisebb részekre bontotta a követelményeket, és szinte minden döntést külön dokumentummal vagy teszttel igazolt.

## Kontroll és összegzés

A Superpowers mellett jobban éreztem, hogy én irányítom a fejlesztést. Volt értelmes terv, TDD és review, de a folyamat végig közel maradt a tényleges kódhoz.

A BMAD sokkal jobb formális traceabilityt adott: pontosan követhető, hogy egy követelmény melyik architektúradöntéshez, storyhoz és teszthez kapcsolódik. Nagyobb, több szereplős vagy üzletileg kritikus projektnél ez komoly előny lehet. Kis projektnél viszont a fejlesztőnek kell határt szabnia, különben túl sok idő és token megy el dokumentációra és ismétlődő review-körökre.

Mindennapi fejlesztéshez a Superpowers-t választanám. Gyorsabban jutott el a működő kódig, miközben megfelelő tervezési és minőségi kontrollt adott. A BMAD-et nagyobb, szigorú követelménykövetést igénylő projektnél használnám, kisebb feladathoz pedig csak Fast path vagy rövidített workflow mellett.
