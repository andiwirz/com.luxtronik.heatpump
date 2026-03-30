# [APP][Pro] Luxtronik Heat Pump Manager – Control and monitor your Luxtronik heat pump

Hi everyone 👋

I'm excited to share my Homey app for **Luxtronik-based heat pumps**. If you own a heat pump from Alpha Innotec, Novelan, Buderus, Roth, Elco, Nibe, Wolf Heiztechnik or CTA — and it has a Luxtronik 2.0 / 2.1 controller — this app is for you.

---

## 🔥 What is this app?

The **Luxtronik Heat Pump Manager** connects your heat pump directly to Homey via the local TCP interface (port 8889). No cloud, no third-party services — everything runs locally on your network.

:point_right: **[Install from the Homey App Store](https://homey.app/a/com.luxtronik.heatpump)**

---

## 🌡️ What can it do?

### Read all sensor values

The app reads all values exposed by the Luxtronik controller:

- **Heat Pump State** — Heating · Hot Water · Defrost · Standby · EVU Lock · Cooling · External · Off
- **Heating Status** — detailed extended state string from the controller (e.g. "Screed Program Level 2 – 35°C")
- **Hot Water Status** — Blocked · Heating · Temp. OK · Off
- **Temperatures** — Outdoor (current + 24h average) · Flow · Return (actual + target) · Hot gas · Hot water (actual + target) · Heat source in/out · Suction air · Room temp (with RBE display)
- **Energy values** — Heating / Hot Water / Total (kWh)
- **Operating hours** — Compressor / Heating / Hot Water
- **Volume flow** — l/h
- **Error alarm** — Yes/No
- **Last poll time** — local time of last successful connection (24h format)
- **Firmware version**

### Control your heat pump

All controls write directly to the Luxtronik controller:

- **Hot Water Thermostat** — set target temperature 30–65 °C, view current hot water temp
- **Heating Thermostat** — set correction value −5 to +5 °C, view current flow temperature
- **Hot Water Mode** — Automatic · Auxiliary · Party · Holidays · Off
- **Heating Mode** — Automatic · Auxiliary · Party · Holidays · Off

### Special functions

#### 🔥 Hot Water Boost (Auxiliary Heating)
Forces immediate hot water heating using the second heat source, ignoring the time schedule:
1. Sets hot water mode to **Auxiliary**
2. Auto-stops when target temperature is reached
3. Auto-stops after configurable maximum duration (default: 60 min)
4. Resets to **Automatic** afterwards
5. Fires Flow trigger "Hot Water Boost ended"

#### 🔥 Hot Water Boost (Party)
Same behaviour, but uses **Party mode** on the controller.

#### 🦠 Thermal Disinfection
Enables continuous disinfection mode (parameter 27) for legionella protection:
- Auto-stops when hot water reaches configurable target temperature (default: 65 °C)
- Fires Flow trigger "Thermal Disinfection ended"
- Note: Requires a second heat source (ZWE) enabled for hot water

#### 🔒 Connection Watchdog
- **Poll timeout (30s):** No response → device immediately marked unavailable
- **Watchdog timer:** Checks every minute if last successful poll was too long ago (threshold: 3× poll interval)
- Device automatically becomes available again when connection is restored

---

## 🔁 Flow Cards

### 12 Triggers
| Trigger | Description |
|---|---|
| Heating mode changed | Token: new mode |
| Hot water mode changed | Token: new mode |
| Heat pump state changed | Token: new state |
| Error occurred | Token: error message |
| Error cleared | When error disappears |
| Hot Water Boost (Auxiliary) ended | On auto-stop |
| Hot Water Boost (Party) ended | On auto-stop |
| Thermal Disinfection ended | On auto-stop |
| Device became unavailable | Watchdog triggered |
| Device became available again | Connection restored |
| Outdoor temperature dropped below … °C | Configurable threshold |
| Outdoor temperature rose above … °C | Configurable threshold |

### 13 Conditions
Heating/hot water mode · Heat pump state · Heating status (free text) · Hot water status (dropdown) · Hot water temperature above/below · Outdoor temperature above/below · Thermal Disinfection active · Hot Water Boost (Auxiliary/Party) active · Device available

### 11 Actions
Set heating/hot water mode · Set heating correction · Set hot water target temperature (absolute or relative offset) · Start/Stop Hot Water Boost (Auxiliary) · Start/Stop Hot Water Boost (Party) · Enable/Disable Thermal Disinfection

---

## ⚙️ Setup

**Requirements:**
- Luxtronik 2.0 / 2.1 controller reachable on your local network
- Static IP address (or DHCP reservation) recommended
- Port **8889** (TCP) must be reachable

**Installation:**
1. Install the app from the Homey App Store
2. Add device: **Devices → + → Luxtronik Heat Pump Manager**
3. Enter IP address and port (default: 8889)
4. Done — all values and controls are immediately available

**Device settings:**
| Setting | Default | Description |
|---|---|---|
| IP Address | — | Luxtronik controller IP |
| Port | 8889 | TCP port |
| Poll interval | 60 s | How often values are read |
| Boost duration | 60 min | Max duration for both boost modes |
| Disinfection target temp. | 65 °C | Auto-stop temperature for thermal disinfection (60–70 °C) |

---

## 🏭 Compatible manufacturers

| Manufacturer | Example models |
|---|---|
| Alpha Innotec | LW / SW / WZS series |
| Siemens Novelan | WPR NET |
| Roth | ThermoAura, ThermoTerra |
| Elco | Aquatop, Aerotop |
| Buderus | Logamatic HMC20 |
| Nibe | AP-AW10 |
| Wolf Heiztechnik | BWL / BWS |
| CTA | Aeroheat AH CI |

---

## ⚠️ Important notes

> Changing settings writes directly to the controller. Incorrect values can put the heat pump into an error state. Only change settings if you know what you're doing — consult your heat pump's manual.

- The heating correction shifts the heating curve. Positive = warmer, negative = cooler
- All writes are protected against immediate polling overwrite (120s write protection window)
- The app requires **Homey Pro** with firmware **>= 11.0.0**

---

## 🤖 About this app

This app was developed entirely with the help of **Claude (Anthropic AI)**. All code, configuration and documentation were generated and iteratively refined through AI-assisted development.

Special thanks to **Robin Flikkema** for his original [Luxtronik Homey App](https://github.com/RobinFlikkema/homey-luxtronik) which served as the foundation and inspiration for this project.

The app is open source:
:point_right: **[GitHub – com.luxtronik.heatpump](https://github.com/andiwirz/com.luxtronik.heatpump)**

If you find this app useful, I'd appreciate a coffee:
:point_right: **[PayPal – Support development](https://paypal.me/AndiWirz)**

---

## 💬 Feedback welcome!

I'm happy to hear from you:
- Does it work with your heat pump model?
- What features are missing?
- Any bugs or unexpected behaviour?

Drop a comment below or open an issue on GitHub. 

---

*Tags: `luxtronik` `heat-pump` `wärmepumpe` `alpha-innotec` `novelan` `homey-pro`*
