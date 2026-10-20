# PROMPTER mini – pravidla pro práci na projektu

- Komunikace i texty v aplikaci česky.
- **Vývoj probíhá ve větvi `vyvoj`.** Push do `main` spouští sestavení (GitHub Pages + vydání programu pro Windows),
  proto se do `main` dostávají jen vydání.
- **Verze se nezvyšuje po každé úpravě.** Číslo verze (package.json, `APP_VERSION` v js/db.js, `CACHE` v sw.js) se mění
  jen při vydání; testy kontrolují, že sedí na všech třech místech.
- **Lokální sezení v desktopové aplikaci Claude (preferované):** webová verze se spouští z `.claude/launch.json`
  (http://localhost:8080) v Browser pane; uživatel se v ní přihlásí ke kapele a úkoly zadává výběrem prvku (Ctrl+Shift+S).
  Po úpravě stačí stránku v Browser pane obnovit.
- V cloudovém sezení se průběžné úpravy ukazují v náhledu (artefakt na claude.ai), ne vydáním. Po každé úpravě náhled sestavit a publikovat:
  `node tools/nahled/sestavit.js <scratchpad>/artifact`, pak Artifact publish `prompter.html` s `root` = ta složka,
  `files` = vypsaný seznam a schopností `comments`. Data kapely (`data/kapela.json`) leží jen ve složce náhledu, ne v repozitáři.
- Náhled má **režim úkolů** (tlačítko „Úkol“, tools/nahled/ukoly.js): uživatel klikne na prvek a úkol přijde jako komentář
  „Send to Claude“ s popisem prvku (obrazovka, cesta CSS, značka). Postup: úprava ve `vyvoj` → sestavit a publikovat náhled →
  odpovědět ve vlákně komentáře → vlákno vyřešit (resolve).
- **Vydání doporučit uživateli**, když: je hotový ucelený celek odsouhlasený v náhledu (nic rozdělaného), nebo jde o opravu
  chyby, která vadí v provozu (synchronizace, data), nebo to kapela potřebuje do termínu. Vydat až na pokyn uživatele:
  `vyvoj` → `main`, jednou zvýšit verzi, `npm test`, push.
- Data kapely (texty písní) nikdy do repozitáře – je veřejný. Patří jen do Mega.
- Před testy ukončit zatoulané servery: `pgrep -f "[h]ttp-server/bin|[m]ock-github" | xargs -r kill` (hranatá závorka je nutná).
