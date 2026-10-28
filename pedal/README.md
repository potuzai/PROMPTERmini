# Nožní pedál pro PROMPTER mini (RP2040-Zero)

Tři nožní tlačítka a deska **Waveshare RP2040-Zero**. Pedál se hlásí jako **USB klávesnice**, takže funguje v programu
i ve webové verzi, na Windows, Linuxu i Raspberry Pi, bez ovladačů a nezávisle na kurzoru airmouse.

| Tlačítko | Klávesa | V textu písně | V nabídce (playlist, výběr playlistu) |
|---|---|---|---|
| levé | PageUp | předchozí stránka; **podržet** = playlist | předchozí položka; **podržet** = zpět |
| prostřední | F13 | playlist a nabídka | **potvrdit** |
| pravé | PageDown | další stránka / píseň | další položka; **podržet** = potvrdit |
| levé + pravé najednou | | playlist | skok na tlačítka dole (znovu = zpět do seznamu) |

Mimo čtečku prostřední tlačítko otevře čtečku (výběr playlistu). Při listování se dole na chvíli ukáže lišta
s předchozí a další písní.

## Díly
- Waveshare **RP2040-Zero** (s USB-C)
- 3× nožní tlačítko **bez aretace** (momentary, „soft-touch“ = tiché). Pozor: hodně kytarových spínačů má aretaci
  (stisk zapne, další vypne) – ty nefungují.
- krabička (hliník nebo pevný plast), vodiče, USB-C kabel datový (ne jen nabíjecí), délka podle pódia
- nic dalšího – rezistory nejsou potřeba (deska má vnitřní pull-up)

## Zapojení
Každé tlačítko jedním vývodem na svůj pin, druhým na **GND** (všechna tři GND mohou být spojená):

| Tlačítko | Pin na desce |
|---|---|
| levé | GP2 |
| prostřední | GP3 |
| pravé | GP4 |
| druhé vývody všech tlačítek | GND |

Čísla pinů jsou natištěná vedle pájecích plošek. Jiné piny jde nastavit v `code.py` (`TLACITKA`) – levé pak změň i v `boot.py`.

## Nahrání programu
1. Stáhni CircuitPython pro desku **Waveshare RP2040-Zero** (soubor `.uf2`) z https://circuitpython.org/board/waveshare_rp2040_zero/
2. Drž na desce tlačítko **BOOT** a zapoj USB. Objeví se disk **RPI-RP2** – přetáhni na něj stažený `.uf2`.
   Deska se restartuje a objeví se disk **CIRCUITPY**.
3. Na disk CIRCUITPY zkopíruj z této složky **`code.py`** a **`boot.py`** (přepiš existující `code.py`).
4. Odpoj a znovu zapoj USB. LED na desce svítí slabě zeleně = pedál je připravený. Při sešlápnutí svítí
   levé modře, prostřední červeně, pravé zeleně. (Jiné barvy? V `code.py` přepni `LED_GRB = False`.)

Díky `boot.py` se pedál na pódiu hlásí **jen jako klávesnice** – počítač neukazuje disk ani nic nehlásí.
**Úprava programu později:** při zapojování USB drž **levé** tlačítko – disk CIRCUITPY se zase objeví.
(Kdyby nešlo nic, drž BOOT při zapojení a nahraj `.uf2` znovu.)

## Vyzkoušení
Otevři čtečku (PROMPTER mini nebo webovou verzi): pravé = další stránka, levé = zpět, prostřední = playlist,
v playlistu podrž pravé = otevře vybranou píseň.

## Když něco nejde
- **Nic se neděje, LED nesvítí:** datový USB kabel (nabíjecí nepřenáší data); zkus jiný port.
- **Jedno šlápnutí listuje dvakrát:** zvětši v `code.py` `ZAKMIT_MS` (např. na 15).
- **Tlačítko „drží“ samo:** spínač s aretací, nebo zkrat vodiče na GND.
- **Dlouhý kabel k tlačítkům (přes 1 m) a falešné stisky:** přidej ke každému pinu kondenzátor 100 nF proti GND.
