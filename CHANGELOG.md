# Changelog

## [2.0.33] - 2026-04-26

### Changed
- Notifications now use `this.homey.notifications.createNotification()` (correct Homey SDK v3 API)
- Added push notifications for operation mode changes: heating mode, hot water mode, cooling mode
- New trigger cards: Hot Water Boost (Auxiliary) started, Hot Water Boost (Party) started (incl. duration token)
- Added `titleFormatted` with token values to flow trigger cards for heating/hot water/cooling mode changes and heat pump state changes — timeline entries now show the actual new value

### Fixed
- Notifications were silently failing due to use of `this.homey.timeline` (SDK v2 API, unavailable in device context in SDK v3)

---

## [2.0.32] - 2026-04-26

### Added
- **Homey Timeline integration:** Key events are now written directly to the Homey Timeline
  - 🔄 Heat pump state changes (e.g. Standby → Heating)
  - ⚠️ Error active (with error message)
  - ✅ Error cleared
  - 🧫 Thermal disinfection completed (with reached temperature)
  - 💧 Hot water boost (auxiliary) started / ended
  - 🎉 Hot water boost (party) started / ended
  - Timeline entries are written in the Homey interface language (DE / EN)
- **PayPal donation link** added via `contributing.donate` in app manifest

---

## [2.0.31] - 2026-04-25

### Added
- **Cooling operation mode** (`cooling_operation_mode`): Off / Automatic
  - Only shown when the controller reports cooling as available (`FreigabKuehl = 1`)
  - Supported on devices such as Novelan WSV 6.2K3M
  - Flow trigger: Cooling Mode Changed (token: `mode`)
  - Flow condition: Cooling Mode Is …
  - Flow action: Set Cooling Mode
- **Thermal Disinfection Setpoint** (`target_temperature.tdi`): 50–80 °C thermostat slider
  - Reads `parameters.temperature_hot_water_limit` (parameter 47) from controller
  - Writes via direct parameter index (`_writeRaw`)
  - Auto-stop threshold: TDI setpoint − 1 °C
- **Estimated power sensor** (`measure_power`): configurable watt value per heat pump state
- **Cumulative energy meter** (`meter_power` / kWh): activates automatically when Heating, Hot Water and Standby watt values are all > 0
  - Calculated from elapsed time between polls × configured watts
  - Stored persistently across app restarts (`setStoreValue`)
  - Appears in the Homey Energy dashboard

### Changed
- Settings UI (`settings/index.html`) completely redesigned
  - Light theme (white surfaces, gray background)
  - Burger menu with animated hamburger / close icon
  - Dropdown menu positioned dynamically below the sticky header
  - All 6 sections accessible: Sensors, Controls, Functions, Flows, Power, Settings
  - All new features (TDI, cooling mode, kWh meter) fully documented in DE / EN

---

## [2.0.30] - 2026-04-20

### Added
- **Connection watchdog:** Poll timeout (30 s) and watchdog timer (configurable threshold and check interval)
  - Device marked unavailable immediately on poll timeout
  - Watchdog checks periodically if last successful poll exceeds the threshold (default: 3× poll interval)
  - Configurable via device settings: timeout, threshold, check interval
- **Flow triggers:** Device Unavailable / Device Available
- **Flow triggers:** Outdoor Temperature Dropped Below / Rose Above (with threshold argument)
- **Flow conditions:** Outdoor Temperature Above / Below, Heating Status Is, Hot Water Status Is, Device Is Available
- **Heating Status String** (`heating_state_string`): detailed extended state from controller, translated DE/EN
- **Hot Water Status String** (`hotwater_state_string`): Lock Period / Heating Up / Temp. OK / Off, translated DE/EN
- **Thermal Disinfection Continuous** toggle with flow trigger Thermal Disinfection Ended and auto-stop
- **Hot Water Boost (Party)** mode with separate timer, flow trigger, and auto-stop
- **Flow trigger:** Error Cleared

### Changed
- README.md translated fully to English

---

## [2.0.20] - 2026-04-10

### Added
- Initial public release
- Readable sensors: temperatures, volume flow, energy (kWh), operating hours, firmware version
- Controllable: heating/hot water operation mode, heating temperature correction, hot water setpoint
- Hot water boost (auxiliary) with configurable duration and auto-stop
- Thermal disinfection toggle
- Flow triggers: State Changed, Heating Mode Changed, Hot Water Mode Changed, Error Occurred, Boost Ended
- Flow conditions: State Is, Heating Mode Is, Hot Water Mode Is, Thermal Disinfection Active, Boost Active
- Flow actions: Set Heating Mode, Set Hot Water Mode, Set Correction, Set Hot Water Temperature, Start/Stop Boost, Enable/Disable Thermal Disinfection
- Capability migration from old naming scheme
- Write protection (120 s) to prevent poll overwriting manual values
