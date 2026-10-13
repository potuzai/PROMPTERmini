# Prompter písní

Aplikace pro psaní, úpravy a zobrazování textů písní na čtečce (prompteru) kapely.

- **Čtečka**: samostatný program pro Windows (`Prompter.exe`). Funguje **úplně bez internetu**, startuje rovnou přes celou obrazovku a data má jako soubory ve složce `data` vedle programu.
- **Editor**: stejná aplikace v prohlížeči (GitHub Pages nebo lokálně). Členové kapely v něm píšou písně a skládají playlisty.
- **Sdílení s kapelou**: písně se synchronizují samy přes internet (Mega nebo GitHub, obojí zdarma). Členové kapely nic nezakládají ani neinstalují, jen vloží **kód kapely**.

---

## 1. Čtečka (PC u monitoru)

1. Rozbal `Prompter-Windows-64bit.zip` třeba do `C:\Prompter` (pro starší 32bitová Windows použij `-32bit`).
2. Spusť `Prompter.exe`. Při prvním spuštění Windows může ukázat „Systém Windows ochránil váš počítač“. Klikni na **Další informace → Přesto spustit**.
3. V programu: `Esc` → **Upravit písně a playlisty** → **Nastavení**:
   - **Monitor čtečky**: zadej rozlišení monitoru (u 24" obvykle 1920×1080 nebo 1920×1200) nebo klikni na **Z této obrazovky**.
   - Zaškrtni **Spustit program automaticky po zapnutí počítače**.
   - Volitelně nastav **PIN**, aby na čtečce nikdo omylem nic neupravil.
   - Volitelně připoj **GitHub** (stačí token jen pro čtení). Čtečka si pak při každém spuštění sama stáhne nové písně, pokud je internet.

### Ovládání čtečky

| Akce | Myš | Klávesnice |
|---|---|---|
| další stránka / píseň | **pravé tlačítko** | → ↓ PgDn mezera Enter |
| předchozí stránka | **levé tlačítko** | ← ↑ PgUp |
| seznam písní (skok) | prostřední tlačítko | L, Tab, pak číslo nebo šipky |
| další / předchozí píseň | | Shift + → / ← |
| výběr playlistu | | P |
| zatemnit obrazovku | | B |
| větší / menší písmo | | + / − (0 = výchozí) |
| zrcadlení (sklo prompteru) | | M |
| celá obrazovka | | F nebo F11 |
| stáhnout změny | | S |
| nápověda | | H |
| zpět / úpravy | | Esc |

Monitor čtečky během běhu programu neusne. Program se po případném pádu sám obnoví a každý den zálohuje data do `data\zalohy` (drží 14 dní).

## 2. Editor (počítače členů kapely)

- **Varianta A (doporučeno):** otevři adresu GitHub Pages (např. `https://<uživatel>.github.io/prompter/`). V Edge/Chrome pak jde přes menu **Aplikace → Nainstalovat** vytvořit ikonu na ploše.
- **Varianta B:** rozbal zdrojové soubory a spusť `Editor v prohlizeci.bat`.
- **Varianta C:** použij přímo `Prompter.exe`, který obsahuje i plný editor.

### Psaní textu

Vlož text (Ctrl+V). Akordy, zbytečné mezery a prázdné řádky se automaticky vyčistí a sloky a refrény se rozpoznají. Pak označ řádky a klikni na zpěváka (nebo použij **Alt+1 / Alt+2 / Alt+3**). Případně vyber zpěváka a klikej přímo na řádky v náhledu vpravo.

| Zápis | Význam |
|---|---|
| `## Refrén` | nadpis sekce |
| `## Refrén @V` | celou sekci zpívají všichni |
| `@J text` | řádek zpívám já |
| `@J+T text` | řádek zpíváme oba |
| `{T:slovo}` | jiný zpěvák jen pro část řádku |
| `>> Refrén` | zopakuje refrén (nemusíš ho psát znovu) |
| `// 2× opakovat` | poznámka malým písmem |
| `**tučně**` `*kurzíva*` | zvýraznění |
| `---` | nová stránka |

Zpěváky (jména, barvy) upravíš v záložce **Zpěváci**. Vzhled stránky (písmo, velikost, barvy, okraje, zarovnání, sloupce, zmenšení dlouhých písní, zrcadlení) nastavíš v záložce **Šablony**. Šablonu pak přiřadíš playlistu, aby všechny písně vypadaly jednotně.

Náhled v editoru odpovídá přesně monitoru čtečky. Rozměr monitoru se sdílí s celou kapelou.

## 3. Sdílení s kapelou

### Člen kapely (1 minuta)
1. Stáhne a spustí Prompter.
2. V uvítacím okně klikne na **🔑 Mám kód kapely** (nebo vpravo nahoře na **připojit ke kapele**).
3. Vloží kód od správce a klikne na **Připojit**. Písně a playlisty se stáhnou samy a další změny se synchronizují automaticky.

### Správce kapely (jednou, asi 10 minut)
V **Nastavení → Sdílení s kapelou** zvol, kde budou písně uložené:

- **Mega** (jen v programu Prompter.exe):
  1. Na mega.io založ **nový společný účet pro kapelu**, ne svůj osobní, protože heslo se přes kód kapely dostane ke všem členům. Dvoufázové ověření nezapínej.
  2. Vyplň e-mail a heslo tohoto účtu a klikni na **Připojit k Mega**. Program si sám vytvoří složku „Prompter kapela“ a nahraje do ní písně.
- **GitHub** (funguje i ve webovém editoru): program tě provede třemi odkazy: účet, soukromý repozitář a token.

Po připojení se ukáže **kód kapely**. Zkopíruj ho a pošli členům. Pro PC čtečky můžeš vytvořit kód **jen pro čtení**: čtečka pak písně jen stahuje a nic neodešle.

Když dva lidé upraví stejnou píseň najednou, nic se neztratí: druhá verze se uloží jako kopie „(konflikt)“. Bez internetu vše funguje dál a změny se odešlou při dalším připojení. Když kód unikne, změň heslo k Mega (nebo vytvoř nový token na GitHubu), připoj se znovu a pošli členům nový kód.

**Pokročilá varianta:** synchronizovaná složka. Program může používat i složku, kterou synchronizuje jiná aplikace (MEGA Desktop, OneDrive, Dropbox, síťový disk).

> Připojení k Mega používá neoficiální knihovnu `megajs`. Kdyby ho Mega někdy změnou na své straně rozbila, přepni na GitHub. Písně v programu zůstanou.

## 4. Pro vývoj

```
npm install
npm start            # spustí program lokálně
npm run build:win    # sestaví dist/Prompter-win32-x64
```

Po nahrání tohoto kódu na GitHub se program pro Windows sestaví automaticky (Actions → artefakt **Prompter-Windows**). Webový editor se zveřejní na GitHub Pages: v repozitáři zapni **Settings → Pages → Source: GitHub Actions**.

Testy (`tests/`, Playwright): `npm test` spustí testy rozhraní, sdílené složky, GitHubu (proti napodobenině `tests/mock-github.js`) i programu.
