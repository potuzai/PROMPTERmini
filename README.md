# PROMPTER mini

Aplikace pro psaní, úpravy a zobrazování textů písní na čtečce (prompteru) kapely.

- **Čtečka**: samostatný program pro Windows (`PROMPTER mini.exe`). Funguje **úplně bez internetu**, startuje rovnou přes celou obrazovku a data má jako soubory ve složce `data` vedle programu.
- **Prohlížečová verze**: stejná aplikace na adrese https://potuzai.github.io/PROMPTERmini/. Je to plnohodnotný editor i čtečka, který se synchronizuje s kapelou stejně jako program. Hodí se pro členy, kteří nechtějí nic instalovat, nebo když upravuješ z cizího počítače.
- **Sdílení s kapelou**: písně se synchronizují samy přes internet (Mega nebo GitHub, obojí zdarma). Kapela má jeden společný účet Mega a členové se přihlásí jeho **e-mailem a heslem**. Data zůstávají v každém zařízení a s Mega se jen synchronizují.

---

## 1. Čtečka (PC u monitoru)

1. Rozbal `PROMPTER-mini-Windows-64bit.zip` třeba do `C:\PROMPTER mini`.
2. Spusť `PROMPTER mini.exe`. Při prvním spuštění Windows může ukázat „Systém Windows ochránil váš počítač“. Klikni na **Další informace → Přesto spustit**. Program si sám vytvoří **zástupce na ploše a v nabídce Start** (znovu: Nastavení › Toto zařízení › Program). Mezi nainstalovanými aplikacemi není – je přenosný, celý ve své složce (i s daty); odinstalace = smazat složku a zástupce.
3. Při prvním spuštění programu se objeví **průvodce nastavením zařízení** (ovládá se i jen šipkami a OK):
   - **K čemu zařízení slouží**: čtečka na pódiu, počítač pro úpravy, nebo obojí na jednom. Čtečka pak po zapnutí otevře výběr playlistu (přes celou obrazovku) a do úprav pustí jen s **PINem** – u čtečky je povinný.
   - **Orientace monitoru** (na výšku / na šířku) a otočení obrazu, když ho Windows neotáčí.
   - **Obrazovka kapely**: zda je to hlavní čtečka, jiná už nadefinovaná obrazovka, nebo nová (např. „Tablet“).
   - **Velikost displeje**: rozlišení (předvolby 21,5″–43″ nebo **Z této obrazovky**), úhlopříčka a vzdálenost zpěváka. Z nich průvodce doporučí velikost písma.
   - **Vzhled aplikace** (tmavý, světlý, podle systému), volitelně **PIN** a připojení ke kapele.
   - Průvodce jde odložit tlačítkem **Později** (nebo Esc na první stránce); nabídne se znovu při dalším spuštění. Vpravo nahoře je i **Ukončit**.
4. Vše jde později změnit v **Nastavení › Toto zařízení** (tam je i **Průvodce nastavením → Spustit**). V **Nastavení › Čtečka a ovládání**:
   - Zapni **Spustit po zapnutí počítače**.
   - **PIN** pro úpravy: na čtečce (role *Čtečka na pódiu*) je povinný – bez něj se do úprav nikdo nedostane (když ho čtečka ještě nemá, při prvním vstupu do úprav se zvolí) a po návratu do čtečky se úpravy zase zamknou. Na ostatních zařízeních je nepovinný (Nastavení › Toto zařízení).
   - V **Nastavení › Kapela a synchronizace** se přihlas ke kapele a zapni **Jen pro čtení**. Čtečka si pak při každém spuštění sama stáhne nové písně, pokud je internet.

### Ovládání čtečky

**Vlastní nožní pedál** (3 tlačítka a deska RP2040-Zero, hlásí se jako USB klávesnice): návod, zapojení a program jsou ve složce [`pedal`](pedal/README.md). Levé = PageUp, pravé = PageDown, prostřední = F13 (playlist, v nabídce potvrdit).

| Akce | Pedál / myš | Airmouse, klávesnice |
|---|---|---|
| další stránka / píseň | **pravé tlačítko** | → ↓ PgDn mezera Enter |
| předchozí stránka | **levé tlačítko** | ← ↑ PgUp |
| playlist a nabídka | **podržet levé**, oba najednou, nebo prostřední | L, Tab, Q, klávesa Menu |
| v nabídce: předchozí / další položka | levé / pravé | ↑ ↓ |
| v nabídce: potvrdit / zpět | **podržet** pravé / levé | Enter / Esc (nebo podržet → / ←) |
| v nabídce: na tlačítka dole a zpět | **oba najednou** | → a ← najednou |
| další / předchozí píseň | | Shift + → / ← |
| výběr playlistu | | P |
| celá obrazovka | | F (ukončit: F, F) nebo F11 |
| stáhnout změny | | S |
| tlačítka dole v playlistu | | Q nebo klávesa Menu |
| upravit píseň | | E, E |
| nápověda | | H |
| zavřít čtečku | | Esc, Esc |

**Na pódiu je čtečka blbuvzdorná:** prázdný playlist – kterékoli tlačítko pedálu otevře výběr playlistu; pedál vždy jen listuje – i když kurzor airmouse zůstal stát nad tlačítkem nebo nabídkou; každé šlápnutí se počítá zvlášť, i rychlé klikání za sebou (rychlý přesun na vzdálenou píseň) – ignoruje se jen zákmit kontaktu do 40 ms; podržení je jen opravdu držené tlačítko. Pedál, který posílá klávesy: držená klávesa nelistuje; v nabídce se výběr posune až při puštění klávesy, takže podržení (0,6 s) potvrdí / vrátí přesně tu položku, na které výběr stojí. Kurzor se ukáže jen při záměrném pohybu myši (chvění airmouse se nepočítá) a teprve tehdy kliknutí ovládá tlačítka. Co čtečku opouští (Esc, E, ukončení celé obrazovky), chce stisk dvakrát; tlačítka myši zpět / vpřed čtečku nezavřou. Seznam písní a nabídka se samy zavřou po 20 s nečinnosti, aby nepřekrývaly text. Když má píseň víc stránek, ukazují je tečky dole; na poslední stránce je vpravo dole další píseň (pokud ji neukazuje zápatí šablony) a při přechodu na jinou píseň se krátce ukáže její pořadí a název. Změny ze synchronizace během hraní nepřeskočí na jinou píseň.

**Úvod čtečky** (čtečka vždy začíná tady, přes celou obrazovku) je výběr playlistu: první **Všechny písně** (sestavují se samy ze všech písní, podle interpreta), pak oblíbené playlisty s hvězdou a pod tlačítkem **Všechny playlisty** ostatní. Dole je vybrané **Pokračovat** (otevře playlist, píseň i stránku, kde se naposledy skončilo – nahoře je napsané kde), **Stáhnout změny**, **Minimalizovat** (v okně místo něj **Celá obrazovka**; po obnovení z hlavního panelu se program vrátí přes celou obrazovku) a **Další** (upravit písně, upravit playlisty, nápověda, ukončit). **Playlist** (Tab, L, prostřední tlačítko, podržet levý pedál) se vysune zprava a text písně zůstane vidět: odehrané písně s ✓, hraje, další, přídavky a u každé písně barevné ladění, BPM, délka a kdo zpívá. Dole má **Pokračovat** (zpět do textu), **Jiný playlist**, **Stáhnout** a **Další** (upravit píseň, upravit playlist, nápověda, nastavení) – Q nebo klávesa Menu ho otevře rovnou na tlačítkách. Dole je **stavový řádek**: pořadí a název písně, tečky stránek a co bude dál (schová se, když šablona ukazuje zápatí; jde vypnout v Nastavení). Při každém listování pedálem (i když myš sjede dolů) se na chvíli objeví **ovládací lišta**: předchozí píseň, hrající píseň s barevným laděním, BPM, délkou a pořadím, další píseň, tlačítka pro listování a červené tlačítko playlistu (*podrž levé* = totéž pedálem); nahoře je pruh s průběhem playlistu.

**Plynulost:** nabídky a lišta se animují jen posunem a průhledností a překreslují se odděleně od textu písně. Když počítač nemá funkční grafickou kartu (Nastavení › O aplikaci › Grafika ukazuje „softwarové vykreslování“), čtečka animace a stíny vypne úplně – pomůže aktualizace ovladače grafiky.

**Zadaná hesla a PIN** jde ukázat okem vedle pole.

**Cesta ven z programu (i jen airmouse, bez klávesy Windows):** v levé liště tlačítko **Program** → **Minimalizovat** (do Windows), **Celá obrazovka** zapnout / vypnout, **Ukončit program**. V úvodní nabídce čtečky (výběr playlistu) je dole **Minimalizovat** / **Celá obrazovka** a v **Další** **Ukončit program**. Funguje i F11 (celá obrazovka) a Alt+F4.

**Virtuální klávesnice:** když klávesnice airmouse píše jiné znaky, než má natištěné, klikni v aktivním textovém poli na malé tlačítko **⌨** vpravo – otevře se česká klávesnice na obrazovce (háčky a čárky, čísla, ⇧ velká písmena – 2× trvale, ?# symboly, ⌫ podržením maže dál, ⏎ potvrdí, ✕ nebo Esc zavře). Sama se nikdy neotevře. Funguje i v řádku textu na stránce editoru. Vypnout jde v Nastavení › Toto zařízení.

Monitor čtečky během běhu programu neusne. Program se po případném pádu sám obnoví a každý den zálohuje data do `data\zalohy` (drží 14 dní).

## 2. Prohlížečová verze a aplikace v telefonu (PWA)

- Otevři **https://potuzai.github.io/PROMPTERmini/** v Edge nebo Chrome. Napoprvé se objeví uvítání: zvol **🔑 Přihlásit ke kapele** a zadej e-mail a heslo kapely. Web se na monitor neptá: stránka čtečky se přizpůsobí oknu prohlížeče nebo telefonu (i po otočení). Pevnou obrazovku kapely zvolíš v Nastavení › Toto zařízení jen pro displej, který slouží jako čtečka.
- Písně se uloží v tom prohlížeči a synchronizují se s kapelou, stejně jako v programu.
- **Instalace jako aplikace** (ikona na ploše, celá obrazovka, funguje i bez internetu): **Nastavení → Toto zařízení → Nainstalovat aplikaci** (nebo Nastavení → O aplikaci). V Chrome, Edge a na Androidu se rovnou nabídne instalace. Na iPhonu a iPadu: Safari → **Sdílet → Přidat na plochu**.
- Na **cizím počítači** při přihlášení vypni **Zůstat přihlášen**, nebo se po práci odhlas: **Nastavení → Kapela a synchronizace → Odhlásit**. Heslo se tím z prohlížeče smaže.
- Pro PC čtečky doporučuji program `PROMPTER mini.exe`: data má v souborech, startuje sám a nezávisí na aktualizacích prohlížeče.

### Playlisty

**Seznam playlistů** (úvodní stránka) má nahoře sekci **★ OBLÍBENÉ**. Playlist do ní dostaneš přetažením nebo tlačítkem **☆ Oblíbený** a zůstane tam, dokud ho nevrátíš. Pořadí v ní určuješ přetažením, řazení (nejnovější, nejstarší, název, počet písní) platí jen pro ostatní playlisty. Vpravo je vybraný playlist a dá se upravovat přímo tam. Tužka otevře název, datum a poznámku, **＋ Přidat** otevře výběr písní z knihovny. Pořadí změníš přetažením nebo kliknutím na číslo, ✕ píseň odebere (s potvrzením). Je tam i čára pro přídavky; Uložit, Uložit jako, Tisk a Celá stránka jsou pod tlačítkem **💾 Uložit ▾**. U každé písně je vidět ladění, BPM, délka a zpěváci, klik na název otevře píseň. **Celá stránka** otevře úpravu přes celou šířku. Ladění má barevný štítek, každý tón svou barvu.

**V úpravě playlistu** přidáš píseň psaním do pole **Přidat píseň…** (nabídnou se shody, Enter přidá) nebo jich vybereš víc najednou přes **Vybrat z knihovny…**. Vedle pole je políčko **pořadí**: píseň se přidá rovnou jako zadané číslo. Pořadí písně v seznamu změníš kliknutím na její číslo. Na obsazené číslo se nová píseň vloží po potvrzení a ostatní se posunou. U písně, která už v seznamu je, si vybereš, jestli písně prohodit, nebo ji vložit a ostatní posunout. Při výběru z knihovny se písně přidají v pořadí, v jakém je označuješ (pořadí ukazuje číslo u zaškrtnutí), a lze zadat **Vložit od pořadí**. Pořadí změníš také přetažením myší. Odebrání písně z playlistu (✕) se vždy potvrzuje. Tlačítkem **Ve sloupcích / Jeden sloupec** přepneš zobrazení; sloupců je tolik, kolik se jich do šířky okna vejde se všemi údaji (u krátkých playlistů jeden). **＋ Čára pro přídavky** oddělí písně, které jsou jen jako možné přídavky. Čára je vidět i ve čtečce a v tisku.

### Ukládání

Písně, playlisty i šablony se ukládají **ručně**: tlačítkem **💾 Uložit** nebo **Ctrl+S**. Neuložené změny ukazuje nápis „Neuloženo“ a zvýrazněné tlačítko Uložit. Když odcházíš s neuloženými změnami (jiná záložka, zpět, čtečka, zavření okna), aplikace se zeptá: **Uložit**, **Uložit jako…** (vznikne nová píseň / playlist / šablona, původní zůstane beze změny), **Zahodit**, nebo **Zůstat**. Nastavení a sekce „Oblíbené“ se ukládají hned.

### Psaní textu

**Seznam písní** zabírá dvě třetiny okna (interpret, název, ladění a BPM, kdo zpívá), vpravo je náhled vybrané písně: první stránka, tlačítka **Upravit** a **▶ Čtečka** a playlisty, ve kterých píseň je (i s pořadím). Klik = náhled, dvojklik nebo Enter = editor, šipky ↑↓ vybírají.

V editoru je uprostřed přesně stránka čtečky: celý rozměr monitoru včetně záhlaví (název, interpret, ladění, BPM a pořadí v playlistu). Text se upravuje přímo v ní, bez značek.

**Ovládání jen šipkami a OK (airmouse):**

| Tlačítko | Co udělá |
|---|---|
| ↑ ↓ | vybere řádek (na konci stránky přejde na další) |
| ← → | kdo řádek zpívá (dokola: nikdo → Já → Ty → Všichni) |
| OK (Enter) | nabídka: upravit text, písmo, vložit sekci / opakování / poznámku / novou stránku, smazat… (šipkami vybrat, OK potvrdit, ← zpět) |
| psaní | upravuje vybraný řádek, Enter = nový řádek, Esc = hotovo |
| PgUp / PgDn | předchozí / další stránka |

Myší jako v textovém editoru: klik do řádku = psaní na tom místě, tažením označíš slova v řádku nebo víc řádků najednou (pak zpěvák, písmo či smazání platí pro celé označení), pravé tlačítko otevře nabídku řádku. Jde to i Shift + klik nebo Shift + ↓.

**Pravý panel** shora: **▶ Čtečka**, **⋯** (uložit jako – kopie, soubor PROMPTER, PDF, text; přidat do playlistu, vyčistit text, nápověda, smazat píseň) a **💾 Uložit**, nastavení **stránky písně** (dlouhá píseň, okraje, sloupce, záhlaví a zápatí), **úpravy textu**, **zpěváci** a **náhled** (obrazovka a playlist). Úpravy textu mohou být místo v panelu i v liště nad stránkou nebo v plovoucím panelu (ikona u nadpisu Text).

**Levý panel:** údaje o písni (interpret, název, ladění, BPM, délka, šablona), struktura písně – jediné místo pro sekce: **＋ Sekce** (u vybraného řádku, nebo přesně z řádků označených tažením), **↻** zopakovat sekci, u každé sekce **⋯** přejmenovat, typ (sloka, refrén, mezičást, předehra, mezihra, sólo…), počet opakování, vlastní barva písma, smazat (klik na sekci ji vybere) a moje poznámky (jen na tomto zařízení).

**Úpravy textu** platí pro označená slova, řádek s kurzorem, nebo – když nic vybrané není (klik vedle stránky) – pro celou píseň: písmo, barva, B, I, Aa (VELKÁ / malá), velikost (− px +), rozestup písmen, řádkování, mezera pod řádkem, zarovnání, zpět / znovu. Barva písma: platí poslední úprava (barva z lišty přebije zpěváka i sekci, zpěvák s barvou písma nebo barva sekce zase ji). Novou stránku vytvoříš prázdnými řádky Enterem, nebo pravým tlačítkem › Vložit › Novou stránku; víc stránek je pod sebou a listuje se kolečkem nebo šipkami vpravo dole.

**Import** (tlačítko v Písních i Playlistech, Nastavení › Záloha a import, nebo přetažení souborů do okna): texty písní (`.txt`, ChordPro – každý soubor jedna píseň), soubor PROMPTER (`.json` – píseň, playlist nebo záloha) a **setlist z Excelu** (`.xlsx`) nebo `.csv` – vznikne z něj playlist. Sloupce se poznají podle záhlaví (Název, Interpret, Ladění, BPM, Délka), písně se najdou podle názvu, chybějící se založí bez textu a řádek „Přídavky“ udělá čáru pro přídavky.

**Šablony** (záložka Šablony) se upravují rovnou: vlevo nahoře výběr šablony a **＋ Nová**, pod tím všechny volby, uprostřed stránka ukázkové písně, vpravo uložení, použití (výchozí šablona, kolik písní ji má) a výběr písně pro náhled.

**Vzhled aplikace** přepneš v **Nastavení › Toto zařízení**: tmavý, světlý (do jasné místnosti), nebo podle systému (přepíná se sám s Windows / telefonem). Barvy stránky na čtečce určuje šablona písně, ne vzhled aplikace.

Text písně se ukládá se značkami (v editoru se nepíšou ručně, vzniknou úpravami na stránce):

| Zápis | Význam |
|---|---|
| `## Refrén` | nadpis sekce |
| `## Refrén @V` | celou sekci zpívají všichni |
| `##` | konec sekce – další řádky už do ní nepatří (v editoru Shift+Enter) |
| `## Mezihra ⊘` | nadpis této sekce skrytý (Struktura › ⋯ › Skrýt nadpis v textu) |
| `## Refrén 2× #ffff00` | sekce se opakuje 2× (ukáže se u prvního řádku), vlastní barva písma |
| `## Předehra 8×` | předehra / mezihra / sólo – pokyn bez textu, na stránce vždy vidět |
| `{#ff0000:slova}` | vlastní barva písma části textu |
| `{↕1.4:řádek}` | řádkování jednoho řádku (v liště pole ↕) |
| `{aa:slova}` | malá písmena i v šabloně, která píše VELKÝMI (v liště Aa) |
| `{⇤:řádek}` `{↔:…}` `{⇥:…}` | zarovnání řádku vlevo / na střed / vpravo (v liště) |
| `{⤓0.5:řádek}` | mezera pod řádkem (× výška písma, v liště) |
| `{⇿0.05:slova}` | rozestup písmen (× výška písma, v liště v %) |
| `{ƒArial:slova}` | jiné písmo části textu (v liště výběr písma) |
| `@J text` | řádek zpívám já |
| `@J+T text` | řádek zpíváme oba |
| `{T:slovo}` | jiný zpěvák jen pro část řádku |
| `>> Refrén` | zopakuje refrén (nemusíš ho psát znovu) |
| `// 2× opakovat` | poznámka malým písmem |
| `**tučně**` `*kurzíva*` | zvýraznění |
| `---` | nová stránka |

Starší zápisy pro muzikanty (akordy `[Am]`, `%G …`, bloky `%%G … %%`) se nikde nezobrazují; **⋯ › Vyčistit text** je z písně smaže. Akordy z textu vloženého z webu se odstraní samy.

**Barva textu** je podle **části písně** – barvy sloky, refrénu, mezičásti a předehry / mezihry / sóla určuje šablona (Šablony › Barva textu). Část se pozná podle názvu sekce: „Refrén…“, „Mezičást / Bridge / Předrefrén…“, „Předehra / Mezihra / Sólo“, ostatní je sloka. Zpěváka ukazuje proužek (nebo barva písma, když ji má v šabloně zapnutou); vlastní barva sekce nebo slov přebije obojí.

**Zpěváky** určuje šablona: v záložce **Šablony › Zpěváci** je přidáš, odebereš, změníš barvu (klik na tečku) a nastavíš, jak se označí (proužek vlevo / vpravo, podklad, barva písma). Platí pro všechny písně s touto šablonou; jednu píseň jde nastavit jinak v editoru (ikona vedle zpěváků). Vzhled stránky (písmo, velikost, barvy, okraje, zarovnání, sloupce, zmenšení dlouhých písní) nastavíš v záložce **Šablony**. Šablonu přiřadíš písni v editoru vlevo (pole Šablona). Formátování drží každá píseň sama, playlist ho nemění – rozměr stránky určuje jen nastavení monitoru.

### Obrazovky kapely a osobní zobrazení

Píseň se píše **jen jednou** a sdílí se. Kapela si ale může nadefinovat víc **obrazovek** (Nastavení › Obrazovky kapely), třeba *Hlavní čtečka 24″ na výšku*, *Tablet*, *Mobil*. Každá obrazovka má:

- svůj rozměr a orientaci,
- velikost písma oproti šabloně,
- **vlastní konce stránek**: tlačítko *Nová stránka* v editoru vloží konec jen pro obrazovku, pro kterou se právě díváš (zápis `---` = hlavní čtečka, `--- id` = jiná obrazovka). Ostatní obrazovky stránkují samy.

Obrazovky se sdílí s celou kapelou. **Každé zařízení si vybere, kterou obrazovkou je** (Nastavení › Toto zařízení), a k tomu si může nastavit jen pro sebe:

- **zvýraznit moje řádky** – zvolíš, kdo jsi, a řádky ostatních zpěváků se ztlumí (řádky „všichni“ zůstanou),
- **soukromé poznámky** k písni – v editoru vlevo *Moje poznámky*. Vidíš je jen ty na svém zařízení, ve čtečce nahoře na stránce; do kapely se neposílají.

V editoru vpravo v části **Náhled** přepínáš obrazovku a vidíš píseň přesně tak, jak ji uvidí.

### V telefonu

Navigace je dole (Playlisty, Písně, Čtečka, Šablony, Nastavení). Playlist je přehledná karta (＋ Přidat, Uložit, ⋯, ▶ Čtečka; pořadí změníš klepnutím na číslo). Editor písně má nahoře jednu řadu: zpět, přepínač **Text | Údaje**, čtečka, ⋯ a uložit; spodní navigace se v editoru schová. **Text** = stránka na celou šířku displeje a dole na dosah palce **Zpět**, **Znovu**, **Písmo** a **Zpěváci** – Písmo a Zpěváci otevřou nad nimi panel s velkými popsanými ovládacími prvky (písmo, barva a styl, velikost, rozestup, řádkování, mezera, zarovnání; zpěváci vybraného řádku), stránka zůstane vidět a řádky jde dál vybírat; **Údaje** = údaje písně, stránka písně, struktura (klepnutí na sekci vrátí na její text), poznámky a náhled. Nabídky se otevírají pod tlačítkem přes celou šířku, okna s otázkou nahoře (klávesnice je nepřekryje) s velkými tlačítky.

## 3. Sdílení s kapelou

### Člen kapely (1 minuta)
1. Otevře adresu aplikace ze zprávy od správce (nebo program `PROMPTER mini.exe`) a klikne na **🔑 Přihlásit ke kapele**.
2. Zadá **e-mail a heslo kapely** (heslo mu správce řekne zvlášť). Písně a playlisty se stáhnou samy.
3. **Zůstat přihlášen**: zapnuté = příště se na nic neptá. Vypnuté (cizí / sdílený počítač) = po zavření prohlížeče je potřeba přihlásit se znovu; písně v zařízení zůstanou.

Prohlížeč, který po zavření maže data webů, zapomene i přihlášení. Pomůže aplikaci nainstalovat (viz výše) nebo přidat `potuzai.github.io` do výjimek. Program `PROMPTER mini.exe` si přihlášení pamatuje vždy (heslo šifrované přes Windows) a data drží v souborech.

V **Nastavení › Kapela a synchronizace** je **Jen pro čtení** (pro čtečky: písně jen stahuje a nic neodešle) a v části Pokročilé jiná složka v Mega.

### Správce kapely (jednou, asi 5 minut)
1. Na mega.io založ **nový společný účet pro kapelu**, ne svůj osobní, protože heslo budou znát všichni členové. Dvoufázové ověření nezapínej.
2. V aplikaci klikni na **🔑 Přihlásit ke kapele** a zadej e-mail a heslo tohoto účtu. Aplikace si v Mega sama vytvoří složku „PROMPTERmini“ a nahraje do ní písně.
3. **Nastavení → Kapela a synchronizace → Pozvat členy** připraví zprávu s adresou aplikace a e-mailem kapely. Heslo pošli zvlášť (ústně, SMS).

Když dva lidé upraví stejnou píseň najednou, nic se neztratí: druhá verze se uloží jako kopie „(konflikt)“. Bez internetu vše funguje dál a změny se odešlou při dalším připojení. Když někdo z kapely odejde nebo heslo unikne, změň heslo účtu Mega a řekni nové ostatním; každý se pak jednou přihlásí znovu.

**Jiné úložiště:** místo Mega jde v Nastavení → Kapela a synchronizace → Jiné úložiště zvolit GitHub (soukromý repozitář a token – každý člen zadá repozitář a token) nebo v programu synchronizovanou složku (MEGA Desktop, OneDrive, Dropbox, síťový disk).

> Připojení k Mega používá neoficiální knihovnu `megajs`. Kdyby ho Mega někdy změnou na své straně rozbila, přepni na GitHub. Písně v programu zůstanou.

### Zabezpečení

- Hesla a tokeny jsou v programu pro Windows zašifrované systémem (rozšifruje je jen stejný uživatel na stejném PC); v prohlížeči jen zakódované – na cizím počítači proto vypni **Zůstat přihlášen**.
- Stránka aplikace spouští jen vlastní skripty (Content Security Policy); text písní, barvy a písma ze sdílených dat se do stránky nikdy nedostanou jako kód.
- Program pro Windows běží v izolovaném režimu (sandbox, oddělený kontext), přijímá příkazy jen od vlastní stránky, nikam jinam nenaviguje a odkazy otevírá jen přes https v běžném prohlížeči.
- Při selhání zápisu (plný disk) aplikace nahlásí chybu a změny nechá neuložené – nic se tiše neztratí. Synchronizace nic nepřepíše bez kopie „(konflikt)“ a co smaže, jde vrátit (Nastavení › Záloha a import).

## 4. Pro vývoj

```
npm install
npm start            # spustí program lokálně
npm run build:win    # sestaví "dist/PROMPTER mini-win32-x64"
```

Vývoj probíhá ve větvi `vyvoj` (na GitHubu se při každém nahrání spustí testy). Nahráním do `main` se po úspěšných testech sestaví program pro Windows (Releases a Actions → artefakt **PROMPTER-mini-Windows**). Webový editor se zveřejní na GitHub Pages: v repozitáři zapni **Settings → Pages → Source: GitHub Actions**.

Testy (`tests/`, Playwright): `npm test` spustí testy rozhraní, telefonu, editoru, sdílené složky, Mega a GitHubu (proti napodobeninám v `tests/`) i programu; `node tests/run-all.js full mobile` spustí jen vybrané.
