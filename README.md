# Luxtronik Heat Pump Manager – Homey App

**App ID:** `com.luxtronik.heatpump`  
**SDK:** Homey SDK 3  
**Compatible with:** Homey Pro (Early 2023), Homey Pro (2019), Homey Bridge (Firmware >= 11.0.0)

---

## Supported Heat Pumps

This app communicates with the **Luxtronik 2.0 / 2.1** controller, which is built into heat pumps from the following manufacturers:

| Manufacturer      | Example Models                         |
|-------------------|----------------------------------------|
| Alpha Innotec     | LW/SW/WZS series                       |
| Siemens Novelan   | WPR NET                                |
| Roth              | ThermoAura, ThermoTerra               |
| Elco              | Aquatop, Aerotop                      |
| Buderus           | Logamatic HMC20, HMC20 Z              |
| Nibe              | AP-AW10                               |
| Wolf Heiztechnik  | BWL/BWS                               |
| CTA               | Aeroheat AH CI 1-16iL                 |

---

## Feature Overview

### Readable Values (Sensors)

| Capability                                         | Description                              |
|----------------------------------------------------|------------------------------------------|
| Heat Pump Status                                   | Heating / Hot Water / Defrost / Standby / EVU Lock / … |
| Heating Status                                     | Detailed heating status from the controller (Extended State String) |
| Hot Water Status                                   | Lock Period / Heating Up / Temp. OK / Off |
| Outdoor Temperature                                | Current + rolling 24h average            |
| Flow Temperature                                   | Heating circuit flow                     |
| Return Temperature                                 | Heating circuit return + setpoint        |
| Hot Gas Temperature                                | Compressor outlet                        |
| Hot Water Temperature                              | Actual temperature                       |
| Hot Water Target Temperature (read)                | Setpoint read from the controller        |
| Heat Source Inlet / Outlet                         | Brine / air temperature                  |
| Suction Air Temperature                            | Air-source heat pumps only               |
| Room Temperature Actual / Target                   | Only with connected RBE room display     |
| Volume Flow                                        | l/h (heat source)                        |
| Energy Heating / Hot Water / Total                 | kWh                                      |
| Operating Hours Compressor / Heating / Hot Water   | Hours                                    |
| Error Alarm                                        | Error active: Yes / No                   |
| Last Poll                                          | Time of last successful poll (local time)|
| Firmware Version                                   | Controller software version              |

### Controllable Values

| Capability                         | Range / Options                                              |
|------------------------------------|--------------------------------------------------------------|
| **Hot Water Thermostat**           | Setpoint: 30–65 °C · Actual: current hot water temperature   |
| **Heating Thermostat**             | Correction: −5 to +5 °C · Actual: current flow temperature  |
| **Heating Operation Mode**         | Automatic · Auxiliary · Party · Holiday · Off               |
| **Hot Water Operation Mode**       | Automatic · Auxiliary · Party · Holiday · Off               |
| **Hot Water Boost (Auxiliary)**    | Toggle – auxiliary mode, automatic stop                      |
| **Hot Water Boost (Party)**        | Toggle – party mode, automatic stop                          |
| **Thermal Disinfection**           | Toggle – continuous mode, auto-stop at target temperature    |
| **TDI Setpoint**                   | Target temperature for thermal disinfection: 50–80 °C        |

---

## Hot Water Boost

Two modes are available:

**Boost (Auxiliary Heating):** Sets the hot water operation mode to "Auxiliary"  
**Boost (Party):** Sets the hot water operation mode to "Party"

Both variants:
- Stop automatically when the hot water temperature reaches the target temperature
- Stop after the configured maximum duration (default: 60 min., configurable in device settings)
- Reset the operation mode back to "Automatic" afterwards
- Fire the flow trigger "Hot Water Boost Ended" on automatic stop

---

## Thermal Disinfection

Activates continuous operation (parameter 27) for legionella protection:

- After each hot water heating cycle, thermal disinfection follows automatically
- Stops automatically when the hot water temperature ≥ TDI setpoint (read directly from the controller, adjustable via the "Thermal Disinfection Setpoint" thermostat slider, 50–80 °C)
- Manual stop possible at any time
- Fires the flow trigger "Thermal Disinfection Ended"

> **Note:** Requires a connected second heat source (auxiliary heater).

---

## Connection Watchdog

- **Poll Timeout (30s):** No response within 30 seconds → device immediately marked as unavailable
- **Watchdog Timer:** Checks every minute whether the last successful poll is too far in the past (threshold: 3× polling interval)
- **Last Poll:** Capability shows the time of the last successful poll in local time
- Device is automatically marked as available again as soon as the controller responds

---

## Installation

### Requirements

- Luxtronik 2.0 / 2.1 controller reachable via LAN
- Static IP address recommended (set up DHCP reservation in your router)
- Default port: **8889** (TCP)

### Setup in Homey

1. Install the app from the Homey App Store
2. Add device: **Devices → + → Luxtronik Heat Pump Manager**
3. Enter IP address and port (default: 8889)
4. Connection test – if successful, the device is created

### Device Settings

| Setting                             | Default  | Description                                          |
|-------------------------------------|----------|------------------------------------------------------|
| IP Address                          | –        | IP of the Luxtronik controller                       |
| Port                                | 8889     | TCP port of the controller                           |
| Poll Interval (seconds)             | 60       | How often the heat pump is queried (min. 10 s)       |
| Hot Water Boost Duration (minutes)  | 60       | Maximum runtime for both boost modes                 |

---

## Flow Cards

### Triggers

| Card                                       | Token      | Description                                   |
|--------------------------------------------|------------|-----------------------------------------------|
| Heating Operation Mode Changed             | `mode`     | New mode as text                              |
| Hot Water Operation Mode Changed           | `mode`     | New mode as text                              |
| Heat Pump Status Changed                   | `state`    | New status as text                            |
| Error Occurred                             | `error`    | Error message as text                         |
| Error Cleared                              | –          | When the error disappears                     |
| Hot Water Boost (Auxiliary) Ended          | –          | On automatic stop                             |
| Hot Water Boost (Party) Ended              | –          | On automatic stop                             |
| Thermal Disinfection Ended                 | –          | On automatic stop                             |
| Device Unavailable                         | –          | When watchdog triggers                        |
| Device Available                           | –          | When connection is restored                   |
| Outdoor Temperature Dropped Below … °C    | Threshold  | Threshold comparison with current value       |
| Outdoor Temperature Rose Above … °C       | Threshold  | Threshold comparison with current value       |

### Conditions

| Card                                       | Parameter              |
|--------------------------------------------|------------------------|
| Heating Operation Mode Is …               | Dropdown               |
| Hot Water Operation Mode Is …             | Dropdown               |
| Heat Pump Status Is …                     | Dropdown               |
| Heating Status Is …                       | Free text              |
| Hot Water Status Is …                     | Dropdown (4 values)    |
| Hot Water Temperature Is Above … °C       | Number                 |
| Hot Water Temperature Is Below … °C       | Number                 |
| Outdoor Temperature Is Above … °C         | Number                 |
| Outdoor Temperature Is Below … °C         | Number                 |
| Thermal Disinfection Is Active            | –                      |
| Hot Water Boost (Auxiliary) Is Active     | –                      |
| Hot Water Boost (Party) Is Active         | –                      |
| Device Is Available                       | –                      |

### Actions

| Card                                               | Parameter                      |
|----------------------------------------------------|--------------------------------|
| Set Heating Operation Mode                         | Dropdown (Automatic … Off)     |
| Set Hot Water Operation Mode                       | Dropdown (Automatic … Off)     |
| Set Heating Temperature Correction                 | Number: −5 … +5 °C             |
| Set Hot Water Target Temperature                   | Number: 30 … 65 °C             |
| Adjust Hot Water Target Temperature (relative)     | Offset: −20 … +20 °C           |
| Start Hot Water Boost (Auxiliary)                  | Duration in minutes (5–480)    |
| Stop Hot Water Boost (Auxiliary)                   | –                              |
| Start Hot Water Boost (Party)                      | Duration in minutes (5–480)    |
| Stop Hot Water Boost (Party)                       | –                              |
| Enable Thermal Disinfection                        | –                              |
| Disable Thermal Disinfection                       | –                              |

---

## Operation Mode Codes (Reference)

| Code | Heating    | Hot Water  |
|------|------------|------------|
| 0    | Automatic  | Automatic  |
| 1    | Auxiliary  | Auxiliary  |
| 2    | Party      | Party      |
| 3    | Holiday    | Holiday    |
| 4    | Off        | Off        |

---

## Heat Pump Status Codes (Reference)

| Slug            | Meaning                       |
|-----------------|-------------------------------|
| `heating`       | Heating                       |
| `hotwater`      | Hot water heating             |
| `swimming`      | Swimming pool heating         |
| `provider_lock` | EVU lock                      |
| `defrost`       | Defrost                       |
| `off`           | Off                           |
| `external`      | External (2nd heat source)    |
| `cooling`       | Cooling                       |
| `standby`       | Standby                       |

---

## Notes & Warnings

> ⚠️ **Caution:** Incorrect settings can put the heat pump into an error state. Only make changes if the function of the parameter is known.

- The thermostat correction (`target_temperature.heating`) shifts the heating curve by the set value. Positive values → warmer, negative values → cooler.
- All write operations are sent to the controller immediately.
- Write protection prevents polling cycles from immediately overwriting manually set values (120s protection window).

---

## Technical Background

The app communicates via TCP (port 8889) directly with the Luxtronik controller.  
The protocol library used is [`luxtronik2`](https://www.npmjs.com/package/luxtronik2).

Parameter reference:
- [Bouni/python-luxtronik – parameters.py](https://github.com/Bouni/python-luxtronik/blob/master/luxtronik/parameters.py)
- [Bouni/python-luxtronik – calculations.py](https://github.com/Bouni/python-luxtronik/blob/master/luxtronik/calculations.py)
- [FHEM Luxtronik Wiki (DE)](https://wiki.fhem.de/wiki/Luxtronik_2.0)

---

## License

MIT License – see [LICENSE](LICENSE)

---

## 🤖 AI Development

This app was developed entirely with the help of **Claude (Anthropic AI)**.

---

## 🙏 Acknowledgements

- [RobinFlikkema/homey-luxtronik](https://github.com/RobinFlikkema/homey-luxtronik)
- [coolchip/luxtronik2](https://github.com/coolchip/luxtronik2) (npm package)
- [BenPru/luxtronik](https://github.com/BenPru/luxtronik) (Home Assistant integration)
- [Bouni/luxtronik](https://github.com/Bouni/luxtronik)
