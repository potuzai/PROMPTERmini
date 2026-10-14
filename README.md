# Prompter písní

Aplikace pro psaní, úpravy a zobrazování textů písní na čtečce (prompteru) kapely.

- **Čtečka**: samostatný program pro Windows (`Prompter.exe`). Funguje **úplně bez internetu**, startuje rovnou přes celou obrazovku a data má jako soubory ve složce `data` vedle programu.
- **Prohlížečová verze**: stejná aplikace na adrese https://potuzai.github.io/RUSTEDprompter/. Je to plnohodnotný editor i čtečka, který se synchronizuje s kapelou stejně jako program. Hodí se pro členy, kteří nechtějí nic instalovat, nebo když upravuješ z cizího počítače.
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

## 2. Prohlížečová verze (bez instalace)

- Otevři **https://potuzai.github.io/RUSTEDprompter/** v Edge nebo Chrome. Napoprvé se objeví okno *Vítej*, v něm zvol **🔑 Mám kód kapely** a vlož kód.
- Písně se uloží v tom prohlížeči a synchronizují se s kapelou, stejně jako v programu.
- Ikonu na plochu přidáš v Edge přes **⋯ → Aplikace → Nainstalovat tento web jako aplikaci**.
- Na **cizím počítači** se po práci odpoj: **Nastavení → Sdílení s kapelou → Odpojit**. Heslo se tím z prohlížeče smaže.
- Pro PC čtečky doporučuji program `Prompter.exe`: data má v souborech, startuje sám a nezávisí na aktualizacích prohlížeče.

### Psaní textu

Uprostřed editoru je přesně stránka čtečky: celý rozměr monitoru včetně záhlaví (název, interpret, tónina, BPM a pořadí v playlistu). Text se upravuje přímo v ní, bez značek. Všechny další nástroje jsou v pravém panelu.

**Ovládání jen šipkami a OK (airmouse):**

| Tlačítko | Co udělá |
|---|---|
| ↑ ↓ | vybere řádek (na konci stránky přejde na další) |
| ← → | kdo řádek zpívá (dokola: nikdo → Já → Ty → Všichni) |
| OK (Enter) | nabídka: upravit text, písmo, vložit sekci / opakování / poznámku / novou stránku, smazat… (šipkami vybrat, OK potvrdit, ← zpět) |
| psaní | upravuje vybraný řádek, Enter = nový řádek, Esc = hotovo |
| PgUp / PgDn | předchozí / další stránka |

Myší: klik vybere řádek, druhý klik začne psaní, pravé tlačítko otevře nabídku. Shift + klik nebo Shift + ↓ vybere víc řádků najednou.

**Pravý panel** je klidný a jen pro vybraný řádek: kdo zpívá (barevné kostky), písmo (B, I, A+, A−) a vložit (řádek, sekce, další…). Vše ostatní – údaje o písni, ukázka jako v playlistu, akordy pro muzikanty, písmo písně, vyčištění, zdrojový text, export, smazání – je pod tlačítkem **Píseň ⋯**. Při úpravě písně se seznam písní schová, zpět vede **◀ Písně**.

Pokročilí můžou přes **Píseň ⋯ → Zdrojový text…** upravit text tak, jak se ukládá (se značkami):

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

**Pro muzikanty.** Tyto informace se ve čtečce nikdy nezobrazí. Uvidíš je v náhledu po přepnutí na **Pro muzikanty** (tlačítko **Vrstvy** určí, co se ukáže) a v tisku playlistu.

| Zápis | Význam |
|---|---|
| `[Am]Zpívám [C]ptákům` | akordy nad slovy |
| `[G] [D] [Em]` | samostatný řádek akordů (intro, mezihra) |
| `%G Ladění Drop D, capo 2` | informace pro kytaru (G = zkratka nástroje) |
| `%G+B stop na 4` | informace pro více nástrojů |
| `%%G Tabulatura intro` … `%%` | blok (tabulatura), mezery zůstanou přesně |

Nástroje (kytara, basa, bicí, klávesy…) a jejich zkratky a barvy nastavíš v záložce **Obsazení**. Když vložíš text z webu s akordy nad řádky, akordy se samy převedou do textu a tabulatury se zabalí do bloku pro kytaru.

Zpěváky (jména, barvy) upravíš v záložce **Zpěváci**. Vzhled stránky (písmo, velikost, barvy, okraje, zarovnání, sloupce, zmenšení dlouhých písní, zrcadlení) nastavíš v záložce **Šablony**. Šablonu pak přiřadíš playlistu, aby všechny písně vypadaly jednotně.

Náhled v editoru odpovídá přesně monitoru čtečky. Rozměr monitoru se sdílí s celou kapelou.

## 3. Sdílení s kapelou

### Člen kapely (1 minuta)
1. Stáhne a spustí Prompter.
2. V uvítacím okně klikne na **🔑 Mám kód kapely** (nebo vpravo nahoře na **připojit ke kapele**).
3. Vloží kód od správce a klikne na **Připojit**. Písně a playlisty se stáhnou samy a další změny se synchronizují automaticky.

### Správce kapely (jednou, asi 10 minut)
V **Nastavení → Sdílení s kapelou** zvol, kde budou písně uložené:

- **Mega** (v programu i v prohlížeči):
  1. Na mega.io založ **nový společný účet pro kapelu**, ne svůj osobní, protože heslo se přes kód kapely dostane ke všem členům. Dvoufázové ověření nezapínej.
  2. Vyplň e-mail a heslo tohoto účtu a klikni na **Připojit k Mega**. Program si sám vytvoří složku „Prompter kapela“ a nahraje do ní písně.
- **GitHub**: program tě provede třemi odkazy: účet, soukromý repozitář a token.

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
