# PROMPTER mini – pravidla pro práci na projektu

- Komunikace i texty v aplikaci česky.
- **Vývoj probíhá ve větvi `vyvoj`.** Push do `main` spouští sestavení (GitHub Pages + vydání programu pro Windows),
  proto se do `main` dostávají jen vydání.
- **Verze se nezvyšuje po každé úpravě.** Číslo verze (package.json, `APP_VERSION` v js/db.js, `CACHE` v sw.js) se mění
  jen při vydání; testy kontrolují, že sedí na všech třech místech.
- Průběžné úpravy se ukazují v náhledu (artefakt na claude.ai), ne vydáním.
- **Vydání doporučit uživateli**, když: je hotový ucelený celek odsouhlasený v náhledu (nic rozdělaného), nebo jde o opravu
  chyby, která vadí v provozu (synchronizace, data), nebo to kapela potřebuje do termínu. Vydat až na pokyn uživatele:
  `vyvoj` → `main`, jednou zvýšit verzi, `npm test`, push.
- Data kapely (texty písní) nikdy do repozitáře – je veřejný. Patří jen do Mega.
- Před testy ukončit zatoulané servery: `pgrep -f "[h]ttp-server/bin|[m]ock-github" | xargs -r kill` (hranatá závorka je nutná).
