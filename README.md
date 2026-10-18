# Prompter písní

Aplikace pro psaní, úpravy a zobrazování textů písní na čtečce (prompteru) kapely.

- **Čtečka**: samostatný program pro Windows (`Prompter.exe`). Funguje **úplně bez internetu**, startuje rovnou přes celou obrazovku a data má jako soubory ve složce `data` vedle programu.
- **Prohlížečová verze**: stejná aplikace na adrese https://potuzai.github.io/RUSTEDprompter/. Je to plnohodnotný editor i čtečka, který se synchronizuje s kapelou stejně jako program. Hodí se pro členy, kteří nechtějí nic instalovat, nebo když upravuješ z cizího počítače.
- **Sdílení s kapelou**: písně se synchronizují samy přes internet (Mega nebo GitHub, obojí zdarma). Členové kapely nic nezakládají ani neinstalují, jen vloží **kód kapely**.

---

## 1. Čtečka (PC u monitoru)

1. Rozbal `Prompter-Windows-64bit.zip` třeba do `C:\Prompter` (pro starší 32bitová Windows použij `-32bit`).
2. Spusť `Prompter.exe`. Při prvním spuštění Windows může ukázat „Systém Windows ochránil váš počítač“. Klikni na **Další informace → Přesto spustit**.
3. Při prvním spuštění programu se objeví **průvodce nastavením zařízení** (ovládá se i jen šipkami a OK):
   - **K čemu zařízení slouží**: čtečka na pódiu, počítač pro úpravy, obojí na jednom, nebo muzikant (mobil, tablet). Čtečka pak po zapnutí rovnou otevře poslední playlist.
   - **Orientace monitoru** (na výšku / na šířku) a otočení obrazu, když ho Windows neotáčí.
   - **Obrazovka kapely**: zda je to hlavní čtečka, jiná už nadefinovaná obrazovka, nebo nová (např. „Tablet – kytara“).
   - **Velikost displeje**: rozlišení (předvolby 21,5″–43″ nebo **Z této obrazovky**), úhlopříčka a vzdálenost zpěváka. Z nich průvodce doporučí velikost písma.
   - **Vzhled aplikace** (tmavý, světlý, podle systému), volitelně **PIN** a připojení ke kapele.
4. Vše jde později změnit v **Nastavení › Toto zařízení** (tam je i **Spustit průvodce znovu**). V **Nastavení › Čtečka a ovládání**:
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
| rychlá nabídka (dlaždice) | | Q nebo klávesa menu |
| nápověda | | H |
| zpět / úpravy | | Esc |

Když myš sjede do spodní části obrazovky, objeví se **ovládací lišta** (předchozí / další, pořadí písně a stránky, seznam písní, nabídka) a nahoře tenký pruh s průběhem playlistu. Po chvíli sama zmizí. **Rychlá nabídka** má velké dlaždice: seznam písní, černá obrazovka, menší / větší písmo, zrcadlení, synchronizace, úprava písně, nápověda a zavření čtečky. Vybraný prvek má vždy bílý rámeček, aby byl vidět i z dálky.

Monitor čtečky během běhu programu neusne. Program se po případném pádu sám obnoví a každý den zálohuje data do `data\zalohy` (drží 14 dní).

## 2. Prohlížečová verze (bez instalace)

- Otevři **https://potuzai.github.io/RUSTEDprompter/** v Edge nebo Chrome. Napoprvé se objeví uvítání: zvol **🔑 Mám kód kapely** a vlož kód. Web se na monitor neptá: stránka čtečky se přizpůsobí oknu prohlížeče nebo telefonu (i po otočení). Pevnou obrazovku kapely zvolíš v Nastavení › Toto zařízení jen pro displej, který slouží jako čtečka.
- Písně se uloží v tom prohlížeči a synchronizují se s kapelou, stejně jako v programu.
- Ikonu na plochu přidáš v Edge přes **⋯ → Aplikace → Nainstalovat tento web jako aplikaci**.
- Na **cizím počítači** se po práci odpoj: **Nastavení → Sdílení s kapelou → Odpojit**. Heslo se tím z prohlížeče smaže.
- Pro PC čtečky doporučuji program `Prompter.exe`: data má v souborech, startuje sám a nezávisí na aktualizacích prohlížeče.

### Psaní textu

**Seznam písní** zabírá dvě třetiny okna (interpret, název, tónina a tempo, kdo zpívá, štítky), vpravo je náhled vybrané písně: první stránka, tlačítka **Upravit** a **▶ Čtečka** a playlisty, ve kterých píseň je (i s pořadím). Klik = náhled, dvojklik nebo Enter = editor, šipky ↑↓ vybírají.

V editoru je nahoře název a údaje písně (klikem je upravíš), **Uložit jako…** a **▶ Čtečka**. Uprostřed je přesně stránka čtečky: celý rozměr monitoru včetně záhlaví (název, interpret, tónina, BPM a pořadí v playlistu). Text se upravuje přímo v ní, bez značek.

**Ovládání jen šipkami a OK (airmouse):**

| Tlačítko | Co udělá |
|---|---|
| ↑ ↓ | vybere řádek (na konci stránky přejde na další) |
| ← → | kdo řádek zpívá (dokola: nikdo → Já → Ty → Všichni) |
| OK (Enter) | nabídka: upravit text, písmo, vložit sekci / opakování / poznámku / novou stránku, smazat… (šipkami vybrat, OK potvrdit, ← zpět) |
| psaní | upravuje vybraný řádek, Enter = nový řádek, Esc = hotovo |
| PgUp / PgDn | předchozí / další stránka |

Myší: klik vybere řádek, druhý klik začne psaní, pravé tlačítko otevře nabídku. Shift + klik nebo Shift + ↓ vybere víc řádků najednou.

**Levý sloupec:** struktura písně (sekce, opakování a konce stránek – klik na sekci ji vybere), zpěváci s klávesovými zkratkami (klik přiřadí vybraným řádkům), celá píseň (písmo písně, vyčištění, zdrojový text), pro muzikanty a dole Údaje…, Do playlistu, Uložit a Další (export, smazání).

**Pravý sloupec** patří vybranému řádku: kdo zpívá, písmo (B, I, A−, A+, VELKÁ / malá), vložit (řádek, sekci, opakování, novou stránku, poznámku, mezeru, text ze schránky), řádek (upravit, nahoru / dolů, smazat), zpět / znovu a nápověda.

**Vzhled aplikace** přepneš v **Nastavení › Toto zařízení**: tmavý, světlý (do jasné místnosti), nebo podle systému (přepíná se sám s Windows / telefonem). Barvy stránky na čtečce určuje šablona písně, ne vzhled aplikace.

Pokročilí můžou přes **Zdrojový text…** v levém sloupci upravit text tak, jak se ukládá (se značkami):

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

**Barva textu** může být podle zpěváka, nebo **podle části písně** (šablona *Barvy podle částí písně*: sloka bílá, refrén žlutý, mezičást zelená; zpěváka pak ukazuje jen barevný pruh). Část se pozná podle názvu sekce: „Refrén…“, „Mezičást / Bridge / Předrefrén…“, ostatní je sloka.

Zpěváky (jména, barvy) upravíš v záložce **Zpěváci**. Vzhled stránky (písmo, velikost, barvy, okraje, zarovnání, sloupce, zmenšení dlouhých písní, zrcadlení) nastavíš v záložce **Šablony**. Šablonu přiřadíš písni (Údaje… → Šablona písně). Formátování drží každá píseň sama, playlist ho nemění – rozměr stránky určuje jen nastavení monitoru.

### Obrazovky kapely a osobní zobrazení

Píseň se píše **jen jednou** a sdílí se. Kapela si ale může nadefinovat víc **obrazovek** (Nastavení › Obrazovky kapely), třeba *Hlavní čtečka 24″ na výšku*, *Tablet – kytara*, *Mobil – basa*. Každá obrazovka má:

- svůj rozměr a orientaci,
- co se na ní ukáže: text, akordy, poznámky pro vybrané nástroje,
- velikost písma oproti šabloně,
- **vlastní konce stránek**: tlačítko *Nová stránka* v editoru vloží konec jen pro obrazovku, pro kterou se právě díváš (zápis `---` = hlavní čtečka, `--- id` = jiná obrazovka). Ostatní obrazovky stránkují samy.

Obrazovky se sdílí s celou kapelou. **Každé zařízení si vybere, kterou obrazovkou je** (Nastavení › Toto zařízení), a k tomu si může nastavit jen pro sebe:

- **co vidím** (jako obrazovka, nebo vlastní výběr akordů a nástrojů),
- **zvýraznit moje řádky** – zvolíš, kdo jsi, a řádky ostatních zpěváků se ztlumí (řádky „všichni“ zůstanou),
- **velikost písma** (i ve čtečce klávesami + / −),
- **soukromé poznámky** k písni – v editoru vlevo *Moje poznámky*. Vidíš je jen ty na svém zařízení, ve čtečce nahoře na stránce; do kapely se neposílají.

V editoru pod stránkou přepínáš **Náhled pro: …** a vidíš píseň přesně tak, jak ji uvidí daná obrazovka.

## 3. Kalendář kapely

V boční liště **Kalendář**: koncerty, zkoušky, nahrávání a další akce. Sdílí se s kapelou stejně jako písně (Mega, GitHub nebo složka).

- **Akce** má druh a stav (potvrzeno / předběžně / zrušeno), datum (i vícedenní), časy *příjezd, zvuková zkouška, začátek, konec*, místo a adresu (odkaz na mapu), pořadatele a kontakt (telefon jde rovnou vytočit), s kým se hraje, **honorář** se stavem (dohodnuto / vyfakturováno / zaplaceno) a poznámkou, připojený **setlist** (playlist, rovnou do čtečky) a poznámku.
- **Potvrzení účasti**: každý člen klikne *Jedu / Možná / Nejedu* a může připsat poznámku. U akce je vidět, kdo jede, kdo ne a kdo ještě neodpověděl. Každá odpověď se ukládá zvlášť, takže se odpovědi členů nikdy nepřepíšou, ani když potvrzují současně.
- **Nemůžu…**: dovolená, nemoc a jiná nepřítomnost (od–do). Je vidět v kalendáři i u akcí, které do ní padnou.
- **Členové**: seznam členů kapely se sdílí; u sebe zaškrtni **já** (platí jen na tom zařízení).
- **Měsíc / Seznam**: měsíční mřížka, nebo seznam nadcházejících akcí s počty odpovědí a tvou odpovědí.
- **⇩ Do kalendáře / .ics**: stáhne akce jako soubor pro kalendář v telefonu, Google nebo Outlook.
- V telefonu se akce otevře přes celou obrazovku, potvrzení je jedno ťuknutí.

Aplikace nemá vlastní server, proto neposílá upozornění; změny se ukážou při otevření aplikace (nebo po synchronizaci).

## 4. Sdílení s kapelou

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

## 5. Pro vývoj

```
npm install
npm start            # spustí program lokálně
npm run build:win    # sestaví dist/Prompter-win32-x64
```

Po nahrání tohoto kódu na GitHub se program pro Windows sestaví automaticky (Actions → artefakt **Prompter-Windows**). Webový editor se zveřejní na GitHub Pages: v repozitáři zapni **Settings → Pages → Source: GitHub Actions**.

Testy (`tests/`, Playwright): `npm test` spustí testy rozhraní, sdílené složky, GitHubu (proti napodobenině `tests/mock-github.js`) i programu.
