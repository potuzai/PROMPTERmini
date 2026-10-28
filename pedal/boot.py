# Na pódiu se pedál hlásí jen jako klávesnice: bez disku CIRCUITPY a sériové linky
# (Windows ani Linux pak nic neotevírají a neohlašují).
# Úprava programu: při zapojování USB drž levé tlačítko – disk CIRCUITPY se zase ukáže.
import board
import digitalio
import storage
import usb_cdc
import usb_hid

levy = digitalio.DigitalInOut(board.GP2)
levy.pull = digitalio.Pull.UP
if levy.value:                            # levé nesešlápnuté
    storage.disable_usb_drive()
    usb_cdc.disable()
levy.deinit()
usb_hid.enable((usb_hid.Device.KEYBOARD,))
