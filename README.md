# PROMPTER mini

Aplikace pro psaní, úpravy a zobrazování textů písní na čtečce (prompteru) kapely.

- **Čtečka**: samostatný program pro Windows (`PROMPTER mini.exe`). Funguje **úplně bez internetu**, startuje rovnou přes celou obrazovku a data má jako soubory ve složce `data` vedle programu.
- **Prohlížečová verze**: stejná aplikace na adrese https://potuzai.github.io/PROMPTERmini/. Je to plnohodnotný editor i čtečka, který se synchronizuje s kapelou stejně jako program. Hodí se pro členy, kteří nechtějí nic instalovat, nebo když upravuješ z cizího počítače.
- **Sdílení s kapelou**: písně se synchronizují samy přes internet (Mega nebo GitHub, obojí zdarma). Kapela má jeden společný účet Mega a členové se přihlásí jeho **e-mailem a heslem**. Data zůstávají v každém zařízení a s Mega se jen synchronizují.

---

## 1. Čtečka (PC u monitoru)

1. Rozbal `PROMPTER-mini-Windows-64bit.zip` třeba do `C:\PROMPTER mini` (pro starší 32bitová Windows použij `-32bit`).
2. Spusť `PROMPTER mini.exe`. Při prvním spuštění Windows může ukázat „Systém Windows ochránil váš počítač“. Klikni na **Další informace → Přesto spustit**.
3. Při prvním spuštění programu se objeví **průvodce nastavením zařízení** (ovládá se i jen šipkami a OK):
   - **K čemu zařízení slouží**: čtečka na pódiu, počítač pro úpravy, obojí na jednom, nebo muzikant (mobil, tablet). Čtečka pak po zapnutí rovnou otevře poslední playlist.
   - **Orientace monitoru** (na výšku / na šířku) a otočení obrazu, když ho Windows neotáčí.
   - **Obrazovka kapely**: zda je to hlavní čtečka, jiná už nadefinovaná obrazovka, nebo nová (např. „Tablet – kytara“).
   - **Velikost displeje**: rozlišení (předvolby 21,5″–43″ nebo **Z této obrazovky**), úhlopříčka a vzdálenost zpěváka. Z nich průvodce doporučí velikost písma.
   - **Vzhled aplikace** (tmavý, světlý, podle systému), volitelně **PIN** a připojení ke kapele.
4. Vše jde později změnit v **Nastavení › Toto zařízení** (tam je i **Průvodce nastavením → Spustit**). V **Nastavení › Čtečka a ovládání**:
   - Zapni **Spustit po zapnutí počítače**.
   - V **Nastavení › Toto zařízení** volitelně nastav **PIN**, aby na čtečce nikdo omylem nic neupravil.
   - V **Nastavení › Kapela a synchronizace** se přihlas ke kapele a zapni **Jen pro čtení**. Čtečka si pak při každém spuštění sama stáhne nové písně, pokud je internet.

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

## 2. Prohlížečová verze a aplikace v telefonu (PWA)

- Otevři **https://potuzai.github.io/PROMPTERmini/** v Edge nebo Chrome. Napoprvé se objeví uvítání: zvol **🔑 Přihlásit ke kapele** a zadej e-mail a heslo kapely. Web se na monitor neptá: stránka čtečky se přizpůsobí oknu prohlížeče nebo telefonu (i po otočení). Pevnou obrazovku kapely zvolíš v Nastavení › Toto zařízení jen pro displej, který slouží jako čtečka.
- Písně se uloží v tom prohlížeči a synchronizují se s kapelou, stejně jako v programu.
- **Instalace jako aplikace** (ikona na ploše, celá obrazovka, funguje i bez internetu): **Nastavení → Toto zařízení → Nainstalovat aplikaci** (nebo Nastavení → O aplikaci). V Chrome, Edge a na Androidu se rovnou nabídne instalace. Na iPhonu a iPadu: Safari → **Sdílet → Přidat na plochu**.
- Na **cizím počítači** při přihlášení vypni **Zůstat přihlášen**, nebo se po práci odhlas: **Nastavení → Kapela a synchronizace → Odhlásit**. Heslo se tím z prohlížeče smaže.
- Pro PC čtečky doporučuji program `PROMPTER mini.exe`: data má v souborech, startuje sám a nezávisí na aktualizacích prohlížeče.

### Playlisty

**Seznam playlistů** (úvodní stránka) má nahoře sekci **PŘIPRAVENO k přehrání**. Playlist do ní dostaneš přetažením nebo tlačítkem **★ Připravit** a zůstane tam, dokud ho nevrátíš. Pořadí v ní určuješ přetažením, řazení (nejnovější, nejstarší, název, počet písní) platí jen pro ostatní playlisty. Vpravo je náhled vybraného playlistu s laděním a BPM u každé písně. Ladění má barevný štítek, každý tón svou barvu.

**V úpravě playlistu** přidáš píseň psaním do pole **Přidat píseň…** (nabídnou se shody, Enter přidá) nebo jich vybereš víc najednou přes **Vybrat z knihovny…**. Vedle pole je políčko **pořadí**: píseň se přidá rovnou jako zadané číslo. Pořadí písně v seznamu změníš kliknutím na její číslo. Na obsazené číslo se nová píseň vloží po potvrzení a ostatní se posunou. U písně, která už v seznamu je, si vybereš, jestli písně prohodit, nebo ji vložit a ostatní posunout. Při výběru z knihovny se písně přidají v pořadí, v jakém je označuješ (pořadí ukazuje číslo u zaškrtnutí), a lze zadat **Vložit od pořadí**. Pořadí změníš také přetažením myší. Odebrání písně z playlistu (✕) se vždy potvrzuje. **Seřadit…** jednorázově přeřadí písně podle kapely, názvu, BPM, ladění nebo délky. **＋ Čára pro přídavky** oddělí písně, které jsou jen jako možné přídavky. Čára je vidět i ve čtečce a v tisku.

### Psaní textu

**Seznam písní** zabírá dvě třetiny okna (interpret, název, ladění a BPM, kdo zpívá, štítky), vpravo je náhled vybrané písně: první stránka, tlačítka **Upravit** a **▶ Čtečka** a playlisty, ve kterých píseň je (i s pořadím). Klik = náhled, dvojklik nebo Enter = editor, šipky ↑↓ vybírají.

V editoru je nahoře název a údaje písně (klikem je upravíš), **Uložit jako…** a **▶ Čtečka**. Uprostřed je přesně stránka čtečky: celý rozměr monitoru včetně záhlaví (název, interpret, ladění, BPM a pořadí v playlistu). Text se upravuje přímo v ní, bez značek.

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

Zpěváky (jména, barvy) upravíš v záložce **Obsazení**. Vzhled stránky (písmo, velikost, barvy, okraje, zarovnání, sloupce, zmenšení dlouhých písní, zrcadlení) nastavíš v záložce **Šablony**. Šablonu přiřadíš písni (Údaje… → Šablona písně). Formátování drží každá píseň sama, playlist ho nemění – rozměr stránky určuje jen nastavení monitoru.

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

## 3. Sdílení s kapelou

### Člen kapely (1 minuta)
1. Otevře adresu aplikace ze zprávy od správce (nebo program `PROMPTER mini.exe`) a klikne na **🔑 Přihlásit ke kapele**.
2. Zadá **e-mail a heslo kapely** (heslo mu správce řekne zvlášť). Písně a playlisty se stáhnou samy.
3. **Zůstat přihlášen**: zapnuté = příště se na nic neptá. Vypnuté (cizí / sdílený počítač) = po zavření prohlížeče je potřeba přihlásit se znovu; písně v zařízení zůstanou.

Prohlížeč, který po zavření maže data webů, zapomene i přihlášení. Pomůže aplikaci nainstalovat (viz výše) nebo přidat `potuzai.github.io` do výjimek. Program `PROMPTER mini.exe` si přihlášení pamatuje vždy (heslo šifrované přes Windows) a data drží v souborech.

Volba **Další možnosti** v přihlašovacím okně: jiná složka v Mega a **jen pro čtení** (pro čtečky: písně jen stahuje a nic neodešle).

### Správce kapely (jednou, asi 5 minut)
1. Na mega.io založ **nový společný účet pro kapelu**, ne svůj osobní, protože heslo budou znát všichni členové. Dvoufázové ověření nezapínej.
2. V aplikaci klikni na **🔑 Přihlásit ke kapele** a zadej e-mail a heslo tohoto účtu. Aplikace si v Mega sama vytvoří složku „PROMPTERmini“ a nahraje do ní písně.
3. **Nastavení → Kapela a synchronizace → Pozvat členy** připraví zprávu s adresou aplikace a e-mailem kapely. Heslo pošli zvlášť (ústně, SMS).

Když dva lidé upraví stejnou píseň najednou, nic se neztratí: druhá verze se uloží jako kopie „(konflikt)“. Bez internetu vše funguje dál a změny se odešlou při dalším připojení. Když někdo z kapely odejde nebo heslo unikne, změň heslo účtu Mega a řekni nové ostatním; každý se pak jednou přihlásí znovu.

**Jiné úložiště:** místo Mega jde v Nastavení → Kapela a synchronizace → Jiné úložiště zvolit GitHub (soukromý repozitář a token – každý člen zadá repozitář a token) nebo v programu synchronizovanou složku (MEGA Desktop, OneDrive, Dropbox, síťový disk).

> Připojení k Mega používá neoficiální knihovnu `megajs`. Kdyby ho Mega někdy změnou na své straně rozbila, přepni na GitHub. Písně v programu zůstanou.

## 4. Pro vývoj

```
npm install
npm start            # spustí program lokálně
npm run build:win    # sestaví "dist/PROMPTER mini-win32-x64"
```

Po nahrání tohoto kódu na GitHub se program pro Windows sestaví automaticky (Actions → artefakt **PROMPTER-mini-Windows**). Webový editor se zveřejní na GitHub Pages: v repozitáři zapni **Settings → Pages → Source: GitHub Actions**.

Testy (`tests/`, Playwright): `npm test` spustí testy rozhraní, sdílené složky, GitHubu (proti napodobenině `tests/mock-github.js`) i programu.
