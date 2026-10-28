# PROMPTER mini – nožní pedál (Waveshare RP2040-Zero, CircuitPython 9)
#
# Tři tlačítka bez aretace, každé mezi svůj pin a GND (bez rezistorů – stačí vnitřní pull-up).
# Pedál se hlásí jako USB klávesnice, takže nezávisí na kurzoru airmouse:
#   levé       = PageUp    (zpět; podržet = playlist, v nabídce podržet = zpět)
#   prostřední = F13       (playlist a nabídka; v nabídce potvrdit)
#   pravé      = PageDown  (dál; v nabídce podržet = potvrdit)
#   levé + pravé najednou  = playlist, v nabídce skok na tlačítka dole
# Klávesa zůstává stisknutá, dokud je tlačítko sešlápnuté – podržení i obě najednou pozná čtečka sama
# (opakování podržené klávesy dělá systém, pedál nic neopakuje).
import time
import board
import digitalio
import neopixel_write
import usb_hid

# ----- nastavení -----
TLACITKA = (                              # (pin, kód klávesy USB HID, barva LED při sešlápnutí R, G, B)
    (board.GP2, 0x4B, (0, 0, 60)),        # levé:       PageUp,   modrá
    (board.GP3, 0x68, (60, 0, 0)),        # prostřední: F13,      červená
    (board.GP4, 0x4E, (0, 60, 0)),        # pravé:      PageDown, zelená
)
ZAKMIT_MS = 8                             # nový stav musí vydržet tolik ms (zákmit kontaktu se nepočítá)
KLID = (0, 4, 0)                          # LED v klidu: slabě zelená = pedál je připravený
LED_GRB = True                            # pořadí barev LED; když svítí jiné barvy, než mají, dej False

# ----- LED na desce (WS2812 na GP16) -----
led_pin = digitalio.DigitalInOut(getattr(board, 'NEOPIXEL', board.GP16))
led_pin.direction = digitalio.Direction.OUTPUT


def led(rgb):
    r, g, b = rgb
    neopixel_write.neopixel_write(led_pin, bytearray((g, r, b) if LED_GRB else (r, g, b)))


# ----- USB klávesnice (bez knihoven: hlášení = 8 bajtů, až 6 kláves najednou) -----
klavesnice = next(d for d in usb_hid.devices if d.usage_page == 0x01 and d.usage == 0x06)
hlaseni = bytearray(8)


def posli(kody):
    for i in range(6):
        hlaseni[2 + i] = kody[i] if i < len(kody) else 0
    try:
        klavesnice.send_report(hlaseni)
        return True
    except OSError:                       # počítač ještě nespolupracuje (start, uspání) – zkusí se znovu
        return False


# ----- tlačítka -----
piny = []
for pin, _, _ in TLACITKA:
    p = digitalio.DigitalInOut(pin)
    p.direction = digitalio.Direction.INPUT
    p.pull = digitalio.Pull.UP            # nesešlápnuté = 1, sešlápnuté (spojené s GND) = 0
    piny.append(p)

n = len(piny)
dole = [False] * n                        # uznaný stav tlačítek
od = [0] * n                              # od kdy se surový stav liší od uznaného (0 = neliší)
odeslat = True                            # po startu poslat „nic nestisknuto“

time.sleep(1)                             # počkat, až počítač pedál přijme
led(KLID)
while True:
    ted = time.monotonic_ns() // 1_000_000 or 1
    for i in range(n):
        surovy = not piny[i].value
        if surovy == dole[i]:
            od[i] = 0
        elif not od[i]:
            od[i] = ted
        elif ted - od[i] >= ZAKMIT_MS:
            dole[i] = surovy
            od[i] = 0
            odeslat = True
    if odeslat:
        stisk = [TLACITKA[i][1] for i in range(n) if dole[i]]
        odeslat = not posli(stisk)
        led(next((TLACITKA[i][2] for i in range(n) if dole[i]), KLID))
    time.sleep(0.001)
