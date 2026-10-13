# Prompter písní

Aplikace pro psaní, úpravy a zobrazování textů písní na čtečce (prompteru) kapely.

- **Čtečka**: samostatný program pro Windows (`Prompter.exe`). Funguje **úplně bez internetu**, startuje rovnou přes celou obrazovku a data má jako soubory ve složce `data` vedle programu.
- **Editor**: stejná aplikace v prohlížeči (GitHub Pages nebo lokálně). Členové kapely v něm píšou písně a skládají playlisty.
- **Sdílení** si vybereš v Nastavení:
  - **sdílená složka** v cloudu (Mega zdarma, Proton Drive, OneDrive, Dropbox…): nejjednodušší, funguje v programu `Prompter.exe`,
  - **GitHub** (zdarma): funguje i ve webovém editoru v prohlížeči.

  V obou případech data vidí a mění jen ten, koho pozveš.

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

## 3a. Sdílení přes cloudovou složku (Mega, Proton Drive…)

1. **Ty:** nainstaluj **MEGA Desktop App** (mega.io/desktop). Ve složce MEGA vytvoř složku např. `Kapela-pisne`.
2. Na webu mega.io ji **sdílej** členům kapely (zadáš jejich e-maily) s právem **Číst a zapisovat**. Nepoužívej „Sdílet odkaz“.
3. **Každý člen** (i PC čtečky): účet Mega zdarma, přijme pozvánku a v MEGA Desktop App si sdílenou složku nastaví k **synchronizaci** na disk.
4. V Prompteru: **Nastavení → Sdílení s kapelou → Sdílená složka → Vybrat složku…** a zvolí tu složku.

Změny se mezi počítači přenášejí samy, zhruba do minuty po synchronizaci cloudu. Program sleduje složku a změny načte sám. Když cloud vytvoří konfliktní kopii souboru, Prompter ji převezme jako samostatnou píseň „(konflikt)“, takže nic se neztratí. Čtečka má vždy i vlastní kopii dat, a hraje proto i bez internetu nebo bez cloudu.

U **Proton Drive** je postup stejný (oprávnění *Editor*). Ověř si ale, že aplikace Proton Drive pro Windows u členů umí synchronizovat složky, které jim někdo nasdílel.

## 3b. Sdílení přes GitHub (nastaví jednou správce)

1. Na github.com vytvoř **soukromý (Private)** repozitář, např. `kapela-pisne`.
2. **Settings → Collaborators → Add people**: pozvi členy kapely.
3. Každý člen si vytvoří token na `github.com/settings/personal-access-tokens/new`:
   - *Repository access*: **Only select repositories** → `kapela-pisne`
   - *Permissions → Contents*: **Read and write** (čtečka stačí **Read-only**)
4. V aplikaci: **Nastavení → Sdílení s kapelou**. Vyplň vlastníka, repozitář a token a klikni **Připojit**.

Změny se odesílají automaticky jedním commitem. Když dva lidé upraví stejnou píseň zároveň, nic se neztratí: novější verze zůstane a starší se uloží jako kopie s označením „(konflikt)“. Bez internetu vše funguje dál a změny se odešlou při dalším připojení.

## 4. Pro vývoj

```
npm install
npm start            # spustí program lokálně
npm run build:win    # sestaví dist/Prompter-win32-x64
```

Po nahrání tohoto kódu na GitHub se program pro Windows sestaví automaticky (Actions → artefakt **Prompter-Windows**). Webový editor se zveřejní na GitHub Pages: v repozitáři zapni **Settings → Pages → Source: GitHub Actions**.

Testy (`tests/`, Playwright): `npm test` spustí testy rozhraní, sdílené složky, GitHubu (proti napodobenině `tests/mock-github.js`) i programu.
