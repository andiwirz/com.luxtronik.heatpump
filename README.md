# Luxtronik Heat Pump Manager – Homey App

**App ID:** `com.luxtronik.heatpump`  
**SDK:** Homey SDK 3  
**Compatibility:** Homey firmware `>= 5.0.0`  
**Device class:** `heater`

The app talks to the controller over the local network (TCP), so it needs a Homey that runs apps locally — Homey Pro.

---

## Supported Heat Pumps

This app communicates with the **Luxtronik 2.0 / 2.1** controller, which is built into heat pumps from the following manufacturers:

| Manufacturer      | Example Models                         |
|-------------------|----------------------------------------|
| Alpha Innotec     | LW/SW/WZS series                       |
| Siemens Novelan   | WPR NET, WSV series                    |
| Roth              | ThermoAura, ThermoTerra               |
| Elco              | Aquatop, Aerotop                      |
| Buderus           | Logamatic HMC20, HMC20 Z              |
| Nibe              | AP-AW10                               |
| Wolf Heiztechnik  | BWL/BWS                               |
| CTA               | Aeroheat AH CI 1-16iL                 |
| Waterkotte        | DS 5009.5 AI, EasyCon series          |
| Ochsner           | GMLW / GMWW / Air series              |

---

## Feature Overview

### Readable Values (Sensors)

| Icon | Capability                                         | Description                              |
|------|----------------------------------------------------|------------------------------------------|
| <img src="assets/capabilities/heatpump_state.svg" width="24"> | Heat Pump State | Heating / Hot Water / Defrost / Standby / EVU Lock / Cooling / External / Off |
| <img src="assets/capabilities/heating_state_string.svg" width="24"> | Heating Status | Detailed heating status from the controller (Extended State String) |
| <img src="assets/capabilities/hotwater_state_string.svg" width="24"> | Hot Water Status | Lock Period / Heating Up / Temp. OK / Off |
| <img src="assets/capabilities/measure_temp_outdoor.svg" width="24"> | Outdoor Temperature | Current + rolling 24h average |
| <img src="assets/capabilities/outdoor_temp_min.svg" width="24"> <img src="assets/capabilities/outdoor_temp_max.svg" width="24"> | Min. / Max. Outdoor Temperature | Configured limits from the controller |
| <img src="assets/capabilities/supply_temp.svg" width="24"> | Flow Temperature | Heating circuit flow |
| <img src="assets/capabilities/return_temp.svg" width="24"> | Return Temperature | Heating circuit return + setpoint |
| <img src="assets/capabilities/temperature.svg" width="24"> | Hot Gas Temperature | Compressor outlet |
| <img src="assets/capabilities/measure_temp_hotwater.svg" width="24"> | Hot Water Temperature | Actual temperature — empty on units without hot water, see *Why some tiles are missing* |
| <img src="assets/capabilities/target_temperature_level.svg" width="24"> | Hot Water Target (current) | The controller's **momentary** control value — "Deckung WP". Not the same as the thermostat setpoint, see below |
| <img src="assets/capabilities/temperature.svg" width="24"> | Heat Source Inlet / Outlet | Brine / air temperature |
| <img src="assets/capabilities/measure_temp_outdoor.svg" width="24"> | Suction Air Temperature | Air-source heat pumps only |
| <img src="assets/capabilities/measure_temperature.svg" width="24"> | Room Temperature Actual / Target | Only with connected RBE room display |
| <img src="assets/capabilities/flow.svg" width="24"> | Volume Flow | l/h (heat source) |
| <img src="assets/capabilities/energy.svg" width="24"> | Energy Heating / Hot Water / Total | kWh (from controller, only on units with a heat meter) |
| <img src="assets/capabilities/round-hours-icon.svg" width="24"> | Operating Hours Compressor / Heating / Hot Water / Cooling | Hours |
| <img src="assets/capabilities/round-hours-icon.svg" width="24"> | Total Operating Hours · Auxiliary Heater Hours · Compressor Starts | Counters every controller keeps |
| <img src="assets/capabilities/round-hours-icon.svg" width="24"> | Compressor 2 Hours | Only on units with a second compressor |
| <img src="assets/capabilities/pressure_high.svg" width="24"> <img src="assets/capabilities/pressure_low.svg" width="24"> | High / Low Pressure | Refrigerant circuit, bar — needs a LIN bus |
| <img src="assets/capabilities/suction_temp_evaporator.svg" width="24"> <img src="assets/capabilities/suction_temp_compressor.svg" width="24"> | Suction Temperature Evaporator / Compressor | Refrigerant circuit — needs a LIN bus |
| <img src="assets/capabilities/heat_output.svg" width="24"> | Heat Output | Current thermal output in W |
| <img src="assets/capabilities/measure_water.svg" width="24"> | Heat Source Flow Rate | l/h at the heat source |
| <img src="assets/capabilities/heating_curve.svg" width="24"> | Heating Curve Endpoint / Offset | Heating curve parameters |
| <img src="assets/capabilities/heating_curve.svg" width="24"> | MK1 Curve Endpoint / Offset | MK1 mixed circuit parameters |
| <img src="assets/capabilities/heating_limit.svg" width="24"> | Heating Limit | Outdoor temperature limit for heating |
| <img src="assets/capabilities/temp_setback.svg" width="24"> | Setback Temperature Limit | Heating setback threshold |
| <img src="assets/capabilities/temp_setback.svg" width="24"> | Heating Setback Delta / MK1 Setback Delta | Temperature reduction values (K) |
| <img src="assets/capabilities/supply_temp.svg" width="24"> | Supply Temperature Limit | Maximum flow temperature |
| <img src="assets/capabilities/return_temp.svg" width="24"> | Return Temperature Limit / Min. | Return temperature boundaries |
| <img src="assets/capabilities/return_temp.svg" width="24"> | Return Temperature Hysteresis | Hysteresis for return temperature control |
| <img src="assets/capabilities/water.svg" width="24"> | Hot Water Hysteresis | Hysteresis for hot water control |
| <img src="assets/capabilities/temp_zwe_enable.svg" width="24"> | ZWE Enable Temperature | Enable temperature for 2nd heat source |
| <img src="assets/capabilities/temperature.svg" width="24"> | 2nd Compressor Heating / Hot Water Temp. | Thresholds for engaging the 2nd compressor |
| <img src="assets/capabilities/temperature.svg" width="24"> | Cooling Release / Inlet Temperature | Cooling circuit setpoints (only with cooling support) |
| <img src="assets/capabilities/alarm.svg" width="24"> | Error Alarm | Error active: Yes / No |
| <img src="assets/capabilities/alarm.svg" width="24"> | Switch-off Reason | Why the heat pump last stopped running |
| <img src="assets/capabilities/alarm.svg" width="24"> | Last Error | Newest plausible entry from the controller's error log, with its code, in your language |
| <img src="assets/capabilities/last_poll.svg" width="24"> | Last Poll | Time of last successful poll (local time) |
| <img src="assets/capabilities/firmware_version.svg" width="24"> | Firmware Version | Controller software version |

> **Switch-off Reason and Last Error are history, not live state.** The controller keeps two five-entry ring buffers and the app shows the newest record of each. An entry can be days old and stays until the controller writes a new one, so "Switch-off Reason" does not mean the heat pump is off right now — only **Error Alarm** reports a currently active fault. The buffers are not returned in chronological order, so the newest entry is picked by timestamp rather than by position. A controller that has never written a buffer returns random values from it; entries with an implausible code or a date before 2000 are ignored, and the tile stays empty rather than showing them.
>
> Switch-off codes are translated from [`lib/luxtronik-codes.js`](lib/luxtronik-codes.js): the bundled library only maps codes 0–9 and only to German, while controllers emit codes up to 27. Codes the controller leaves unassigned fall back to the library's text. Error codes come from [`lib/luxtronik-errors.js`](lib/luxtronik-errors.js): 88 codes with a short text and a hint in English, German, Dutch and French, where the library knows 73 codes in German only. A code missing from both reads "Unknown" rather than the library's German "Unbekannter Fehler".
>
> The flow triggers follow the same split. *Error Occurred* fires for every new entry in the error log — also for an error that cleared itself before the next poll, because its entry stays — and *Error Cleared* fires when the Error Alarm goes off.

### Why some tiles are missing

No two Luxtronik installations are wired the same, and the controller answers for hardware it does not have rather than saying so. The app therefore hides a tile instead of showing a number that is not a measurement:

| Tile | Hidden when |
|------|-------------|
| Heat Source Inlet / Outlet | The controller reports **−50 °C**, its value for an unconnected sensor. Air-source units have no such sensors at all. |
| Energy Heating / Hot Water / Total | The counter reads 0 kWh although the circuit has run for more than a day — that unit has no heat meter. Below a day of runtime the tile stays, since 0 may simply mean "newly commissioned". A counter that has counted once keeps its tile, even if it reads 0 later (reset, or a single faulty reading). |
| Refrigerant pressures, suction temperatures, Compressor 2 Hours, Heat Output, Heat Source Flow Rate | The controller has never reported anything but zero. |
| Room Temperature Actual / Target | No RBE room unit is connected. |
| Suction Air Temperature | Not an air-source unit. |
| Cooling tiles | See *Cooling Mode* below. |
| Hot Water Temperature *(empty rather than hidden)* | The unit has no hot water. Its sensor input then reports a placeholder — **75 °C** on heating-only units, otherwise 0 or 5 °C — and no hot water hours have run. Once hot water has been seen, the value stays, even at exactly 75 °C. |
| Last Error *(empty rather than hidden)* | The controller has never logged an error. Its error log then holds random values (codes in the millions, dates from 1935 or 1970), which are ignored; only codes 700–999 dated from 2000 on count. |

Once a sensor has reported a real value its tile stays, even when the value legitimately returns to zero. Heat output is 0 W whenever the compressor rests and the heat source flow is 0 l/h whenever the pump is off — a tile that came and went with every cycle would lose its Insights history each time.

### Controllable Values

| Capability                         | Range / Options                                              |
|------------------------------------|--------------------------------------------------------------|
| **Hot Water Thermostat**           | Setpoint: 30–65 °C, up to the controller's max. hot water temperature · Actual: current hot water temperature |
| **Heating Thermostat**             | Correction: −5 to +5 °C · Actual: current flow temperature  |
| **Heating Operation Mode**         | Automatic · Auxiliary · Party · Holiday · Off               |
| **Hot Water Operation Mode**       | Automatic · Auxiliary · Party · Holiday · Off               |
| **Cooling Operation Mode**         | Off · Automatic (only on devices with cooling support)       |
| **Hot Water Boost (Auxiliary)**    | Toggle – auxiliary mode, automatic stop, then back to the mode before |
| **Hot Water Boost (Party)**        | Toggle – party mode, automatic stop, then back to the mode before |
| **Thermal Disinfection**           | Toggle – continuous mode, auto-stop at target temperature    |
| **Refresh** *(optional)*           | Button – triggers an immediate poll (enable in device settings) |

The **TDI Setpoint** (`tdi_target_temperature`) is read-only on the tile — it shows parameter 47 as reported by the controller. Change it under *Device Settings → Hot Water* (50–80 °C, default 65).

### Device Indicator

The `heatpump_state_string` capability shows the current heat pump state as an emoji (e.g. `⏸️` for Standby, `🔥` for Heating, `💧` for Hot Water). It is hidden from the device tile but can be selected as the **device indicator** (the value shown below the device name in the Homey device list):

**Device → ⚙️ → Device display → Heat Pump State**

| State           | Emoji |
|-----------------|-------|
| Heating         | 🔥    |
| Hot Water       | 💧    |
| Defrost         | 🌡️    |
| Standby         | ⏸️    |
| EVU Lock        | 🔒    |
| Cooling         | ❄️    |
| Swimming Pool   | 🏊    |
| External        | ⚡    |
| Off             | ⭕    |
| Unknown         | ❓    |

---

## Heating Correction

The heating thermostat and the flow action *Set Heating Temperature Correction* write parameter 1 — on the controller, the correction shown as **+/-** on the home screen: a shift of the heating curve by −5 to +5 K in 0.5 K steps. Positive values → warmer, negative values → cooler. It is not a room temperature. The home screen only redraws when you leave it and come back, so a value written from Homey shows up there after that.

Don't check it in the **Temperatur +-** entry of the heating menu. On at least some controllers that entry shifts the heating curve points once and then returns to 0, so it never shows the value — which made a working correction look as if it had been ignored.

It needs a heating curve to shift, and a controller that keeps the value:

| Situation | What to expect |
|-----------|----------------|
| No room unit, RFV or plain RBE; control mode *heating curve* | The curve shifts as intended. |
| **Smart** or **RBE Plus** room unit (RBE firmware 2.0 or later) | The heating target is a room temperature (parameter 1148) rather than this correction — the Home Assistant integration writes that one instead. |
| Control mode **fixed temperature** or **analog input** | The heating curve is bypassed, so a correction to it has nothing to shift. |
| Controller firmware **V1.90.0** or **V2.90.0** | A known defect in the network write path, reproduced outside Homey: depending on the unit, the controller restarts after every write or accepts the value without applying it. Owners who went back to the previous firmware (V1.88.3 / V2.89) report writes working again; the installer or the manufacturer's support does that. See [BenPru/luxtronik#761](https://github.com/BenPru/luxtronik/issues/761). |

**Which one applies** is in the app log, written once after every start:

```
Regler-Konfiguration: Raumeinheit=keine (P0033=0), Regelungsart=Heizkurve (P0103=0)
```

A diagnostics report contains that line. The same raw values are in the Debug tab of the app settings (`raw_room_unit_type`, `raw_heating_control_mode`, `raw_rbe_version`), and the firmware is on the Firmware Version tile.

**Which register a setting lands in** is logged too. After every poll the app records each parameter that changed since the previous one, by name and raw value:

```
Parameteränderung: P0013_HEATING_CURVE_NIGHT_TEMPERATURE 0 → -15
```

Change a value on the controller panel and a diagnostics report shows where it went; run a flow card and it shows what the controller made of the write. Counters that move with every poll, such as the energy input, are muted after three polls in a row.

**A flow card only succeeds if the controller kept the value.** The controller's acknowledgement repeats the parameter number, not the value, so after every write the app reads the parameter back: after one second, and if the value is not there yet, again after 0.5, 1 and 2 s, because some controllers take a moment. If the controller still reports its old value — a value outside its range is dropped without an error — the flow card fails with *The heat pump did not accept the value*, and the tile shows the controller's value again with the next poll. A device setting the controller did not accept is named in a message after saving. If the read-back itself fails, the write counts as sent but unchecked. The Debug tab lists the last 20 writes.

> **Known issue:** on at least one controller (an LWD90V on firmware V3.88.0), a correction set directly with the +/- on the home screen did not reach parameter 1 — minutes later the controller still reported the previous value, so the *Heating Correction* tile did not follow. A value written from Homey does reach it, and the heating responds: the return temperature target rose by 1.6 K after +1.0. Where that controller keeps the home-screen value is still open; the raw parameter list in the Debug tab is how to find out. Set a distinctive value with the +/- on the home screen and filter for it in tenths (+2.0 °C → `20`).

---

## Hot Water: Setpoint vs. "Target (current)"

These are two different values, and the difference matters:

| Value | What it is |
|-------|------------|
| **Hot water setpoint** (thermostat) | Your desired value, read from the register the controller evaluates for it (see below). On current firmware it stays where you put it. |
| **Hot Water Target (current)** (tile) | The controller's momentary control value — called **"Deckung WP"** in the Luxtronik manual. |

When the heat pump cannot reach the desired value — for example when the outdoor temperature is outside its operating limits — the controller lowers "Deckung WP" by 1 K at a time and keeps heating to that reduced value. The manual is explicit that the configured desired value stays untouched.

The app therefore reads the thermostat setpoint from the same register it writes, and shows the momentary value separately on its own tile. Hot water boost stops based on the momentary value, since that is what the controller is actually regulating to.

Which register holds the setpoint depends on the firmware: the controller evaluates parameter 2 up to x.88.2 and parameter 105 from x.88.3. That is the boundary the Home Assistant integration uses; measured there is only that it is 105 from 90.0 at the latest. A firmware version the app cannot read counts as current. The thermostat shows that register, the app writes it, and a flow card succeeds when the controller keeps the value there. Parameter 2 is the value the controller lowers by itself, so on firmware before x.88.3 the thermostat setpoint drops with it. There the app also sets parameter 105, the desired value, as the controller panel does: the controller raises a lowered parameter 2 again only as far as the desired value.

The thermostat ends at the controller's **max. hot water temperature** (parameter 973, an installer setting), unless the current setpoint is higher, so that it can still be shown. A flow card asking for more is limited to it, and the tile shows the limited value after the next poll. The controller limits the value itself — an LWC on firmware V1.89.0 turned 53 °C in parameter 105 into 52 °C when tested, and parameter 2 followed — but without the app limiting it first, the read-back would report the value as not accepted. Without that parameter (older firmware) the range is 30–65 °C. The max. hot water temperature itself can be changed in the device settings under **Hot Water** (30–65 °C, whole degrees); after the read-back the limit and the thermostat follow the new value.

---

## Hot Water Boost

Two modes are available:

**Boost (Auxiliary Heating):** Sets the hot water operation mode to "Auxiliary"  
**Boost (Party):** Sets the hot water operation mode to "Party"

Both variants:
- Stop automatically when the hot water temperature reaches the target temperature
- Stop after the configured maximum duration (default: 60 min., configurable in device settings)
- Switch the hot water operation mode back to what it was before the boost — "Off" stays "Off", "Holiday" stays "Holiday"
- Fire the flow trigger "Hot Water Boost Ended" exactly once on stop
- Create a **Timeline entry** when started and when ended

**One boost at a time.** Both write the same operation mode, so starting one ends the other. The switch-back then goes to the mode before the first boost, and extending a running boost keeps it too.

**Restarts.** A running boost is stored with the device, so an app update or a Homey restart no longer strands the heat pump in auxiliary or party mode. With the first poll afterwards the boost continues for its remaining time, or ends if that ran out in the meantime. If someone has changed the hot water mode on the controller in between, the boost counts as over and nothing is switched back.

**If the switch back fails**, the boost tile is reset anyway and the reason is logged. This matters more than it looks: write timeouts do happen on these controllers, and leaving the tile on while its timer is already gone would mean nothing ever switches the pump back — it would keep running its auxiliary heater. A flow action or the tile switch reports the failure so it is visible; the polling cycle carries on regardless. The app tries the switch-back again after 10 minutes, without firing "Hot Water Boost Ended" a second time.

---

## Thermal Disinfection

Activates continuous operation (parameter 27) for legionella protection:

- After each hot water heating cycle, thermal disinfection follows automatically
- Stops automatically when the hot water temperature ≥ TDI setpoint − 1 °C (set under *Device Settings → Hot Water*, 50–80 °C)
- Manual stop possible at any time
- Fires the flow trigger "Thermal Disinfection Ended" when it stops on reaching the temperature — not on a manual stop
- Creates a **Timeline entry** when completed
- Reports completion only once the controller has accepted the switch-off. If that fails, the app tries again after 10 minutes rather than with every poll.

> **Note:** Requires a connected second heat source (auxiliary heater).

---

## Cooling Mode

On devices with cooling support (e.g. Novelan WSV 6.2K3M), the **Cooling Operation Mode** capability is shown automatically:

- **Off** – cooling disabled
- **Automatic** – cooling enabled when outdoor temperature permits

The visibility of cooling capabilities is controlled via the device setting **"Cooling capabilities visibility"**:

| Option | Behaviour |
|--------|-----------|
| **Auto** *(default)* | Show when the app detects cooling — see below |
| **Always show** | Always visible, regardless of detection — useful when cooling disappears from the tile after the cooling season ends |
| **Always hide** | Never visible — useful if your heat pump supports cooling but you don't use it |

**How cooling is detected.** The release flag `FreigabKuehl` alone is not enough: it reads 0 whenever the controller is not currently allowed to cool, even on a unit that can, and the cooling tiles then vanished mid-season. The app therefore accepts three independent pieces of evidence, and **what has been detected stays detected**, across app restarts too:

- `FreigabKuehl = 1` — cooling is released right now
- The cooling operating-hours counter is above zero — the unit has cooled at some point, and that counter cannot go back
- A mixing circuit is configured as cooling-capable (`LuxMkTypes` 3 or 4)

Changes are applied immediately.

**When the state shows "Cooling".** Some controllers (e.g. MSW2-6S) report cooling not as a state of its own but as state3=0 ("Heating"), the same as actual heating. The cooling counter (`C0066`, in seconds) tells the two apart: while it rises between two polls, the controller is cooling, and the heat pump state and the heating status show "Cooling". The Home Assistant integration uses the same rule. `FreigabKuehl` plays no part here, because it only means cooling is allowed: on a unit that had never cooled, it stayed at 1 all year, including while the unit was heating. After a restart or a lost connection, the first poll has no previous reading to compare against. For that one poll the state shown before stays, so *Heat pump state changed* does not fire twice for nothing.

---

## Solar-Driven Hot Water Heating

Two flow actions make it easy to maximize hot water production when solar surplus is available:

| Action | Effect |
|--------|--------|
| **Minimize Hot Water Hysteresis** | Sets the hysteresis to 0.5 K — the heat pump reheats as soon as the temperature drops by 0.5 K, keeping the tank as full as possible |
| **Restore Hot Water Hysteresis** | Restores the hysteresis to the value configured in device settings (see *Hysteresis Restore Value*) |

**Typical flow:** When solar surplus detected → Minimize hysteresis → when solar surplus ends → Restore hysteresis.

The Home Assistant integration gives 1 K as the lowest hot water hysteresis, but that is not every controller's limit: an LWC on firmware V1.89.0 took 0.5 K when tested, and read back it held the value. A controller that does not take 0.5 K keeps its previous value, and since the app reads every write back, *Minimize Hot Water Hysteresis* then fails with *The heat pump did not accept the value* instead of reporting success.

The restore value is stored in the device setting **Hysteresis Restore Value (K)** and is automatically initialized from the current controller value on first app start. Adjust it to match your normal operating hysteresis if needed.

---

## Estimated Power Sensor

An optional estimated power sensor (`measure_power`) can be activated in the device settings. It reports the estimated power consumption in watts based on the current heat pump state (Heating, Hot Water, Standby, etc.).

Each state can be configured separately with a typical watt value for your installation.

**Automatic energy meter (kWh):** If Heating, Hot Water, and Standby watts are all set to a value > 0, a cumulative energy meter (`meter_power`) is activated automatically. The device then appears as a consumer in the **Homey Energy dashboard**. The kWh value is calculated from the time between polls and the configured watt value, and is stored persistently across app restarts.

After a connection loss the operating state during the gap is unknown, so the counted gap is capped at twice the poll interval. Without that cap a six-hour outage would book "6 h × current watts" into the meter and permanently skew the energy dashboard.

---

## Homey Timeline

The following events are written directly to the **Homey Timeline**:

| Event                                | Entry                                              |
|--------------------------------------|----------------------------------------------------|
| Heat pump state changes              | 🔄 `State: Heating` / `Betriebsart: Heizbetrieb`  |
| Heating mode changes                 | 🌡️ `Heating mode: Automatic`                       |
| Hot water mode changes               | 💧 `Hot water mode: Party`                         |
| Cooling mode changes                 | ❄️ `Cooling mode: Automatic`                       |
| New entry in the error log           | ⚠️ `Error occurred: 701 - Low pressure fault. Please call installer · …` — code, text and hint as on the *Error Occurred* trigger |
| Error cleared                        | ✅ `Error cleared`                                 |
| Thermal disinfection completed       | 🧫 `Thermal disinfection completed (65.2 °C)`      |
| Hot water boost (auxiliary) started  | 💧 `Hot water boost started (60 min)`              |
| Hot water boost (auxiliary) ended    | 💧 `Hot water boost ended`                         |
| Hot water boost (party) started      | 🎉 `Hot water boost (party) started (60 min)`      |
| Hot water boost (party) ended        | 🎉 `Hot water boost (party) ended`                 |

Timeline entries are written in German on a German Homey and in English otherwise. The state names, error texts and hints in them also exist in Dutch and French.

---

## Connection Watchdog

Two independent safety nets, because they catch different failures:

- **Poll Timeout (30 s):** No response within the timeout → device immediately marked as unavailable. This only fires for a poll that is actually running. The configured value is capped just below the poll interval, so a slow poll can never collide with the next one.
- **Watchdog Timer:** Checks periodically whether the last successful poll is too far in the past (threshold: 3× polling interval, check interval and threshold both configurable). This is the net for the case the poll timeout cannot see — polling having stopped altogether.
- **Last Poll:** Capability shows the time of the last successful poll in local time
- Whichever net catches the outage, the flow trigger *Device Unavailable* fires once — not again on every further failed check
- Device is automatically marked as available again as soon as the controller responds, which fires *Device Available*
- A poll that is still running blocks the next one. The controller does not tolerate parallel TCP connections, so the app never opens more than one at a time.
- Connections carry their own inactivity timeout. Without one, a controller that accepts the connection and then goes quiet leaves the socket open forever — and since the controller serves only one client, every such leak makes the next attempt more likely to hang too.
- **Discarded polls:** now and then the controller returns a poll in which every register reads 0. A poll whose measured values or parameters are all 0, or in which all counters that were running drop to 0 at once, is discarded — taken over, counters would jump back, temperatures would drop to 0 °C, triggers would fire and the device settings would be synced to 0. The app asks again after 5 seconds, and only once per series. A discarded poll does not count as successful, so if the fault persists the watchdog marks the device unavailable. A read-back after a write that gets such a poll counts as unchecked, not as rejected.
- Writes are no exception. Every write, raw parameters and thermal disinfection included, has the same timeouts and resumes polling once the value has been read back, so a controller that never acknowledges a write (firmware V1.90.0 / V2.90.0) cannot stop polling for good. The read-back waits for a running poll and shares its single connection.

---

## App Settings

The app settings page is a reference for the whole app, reachable via the burger menu. It opens with a loading screen while the Homey SDK completes its handshake, and has a DE/EN toggle in the header (English is the default).

| Tab | Contents |
|-----|----------|
| **Sensors** | Every readable value, grouped by topic |
| **Controls** | Every writable value and read-only controller parameter, each with its Luxtronik parameter number and where to configure it, plus when the heating correction has no effect and how to check |
| **Functions** | Hot water boost, thermal disinfection, solar-driven hot water heating, connection watchdog |
| **Flows** | All 17 triggers, 14 conditions and 17 actions with their value ranges, and which heat pump they act on |
| **Power** | How the estimated power sensor works, plus typical watt values per state |
| **Settings** | Connection and watchdog settings, an overview of all device settings groups with their controller parameters, and the compatibility list |
| **Debug** | All raw values and parameters read from the controller, including the complete parameter list |
| **Version** | App version, SDK, compatibility, protocol, library version, device class, author, GitHub link |

### Debug Tab

- Live filter across all keys and values
- Capability mapping: shows which Homey capability each key is mapped to
- Entry count for values and parameters
- App version and poll timestamp
- **Raw parameter list** – every parameter as the controller stores it (temperatures in tenths), including the registers the library has no name for. Collapsed by default, it opens as soon as the filter is used. This is how to find where a controller keeps a setting: give it a distinctive value on the panel and search for it.
- **Writes** – the last 20 values the app wrote to the heat pump, newest first: register, raw value before → written, and whether the controller held it when read back (accepted, not accepted with the value it kept, or not checked).
- **Copy Log** button – exports all data as formatted text for troubleshooting, the raw parameter list and the writes included. It contains the heat pump's serial number and network addresses, and the raw list also holds the controller's web server password and access code (parameters 755–760 and 107), so share it privately rather than in a public post.

---

## Language Support

The app is translated into the following languages:

| Language   | Code | Tiles | Flow Cards | Pairing | Device Settings |
|------------|------|-------|------------|---------|-----------------|
| English    | `en` | ✅    | ✅         | ✅      | ✅              |
| German     | `de` | ✅    | ✅         | ✅      | ✅              |
| Dutch      | `nl` | ✅    | ✅         | ✅      | ✅              |
| French     | `fr` | ✅    | ✅         | ✅      | ✅              |

The pairing view and device settings page default to **English**. German is available via the language toggle (DE/EN) in the settings header. Flow card titles, tile names and the device settings follow the Homey interface language automatically. In French, cooling is *rafraîchissement* throughout, the term of the French operating manual.

---

## Installation

### Requirements

- Luxtronik 2.0 / 2.1 controller reachable via LAN
- Default port: **8889** (TCP)

### Setup in Homey

1. Install the app from the Homey App Store
2. Add device: **Devices → + → Luxtronik Heat Pump Manager**
3. Press **Search network**, or enter the IP address by hand
4. Connection test – if successful, the device is created

The connection test gives up after 15 seconds and reports a clear failure rather than spinning indefinitely, and it closes the abandoned connection so an immediate retry is not blocked by it.

### Finding the controller

The app looks for controllers two ways, because neither is sufficient alone:

| Method | What it does | Limitation |
|--------|--------------|------------|
| **UDP broadcast** | Sends the Luxtronik discovery packet on ports 4444 and 47808. Only a Luxtronik answers, and the reply carries its data port. | Some controllers with older software do not answer. |
| **MAC address** | Homey's built-in discovery, matching the six manufacturer prefixes these controllers use. Keeps working in the background and tracks the address. | Matches the network card, not the heat pump — the prefixes belong to Siemens, so other Siemens hardware shows up too. |

Results that answered the broadcast are labelled **Luxtronik**; those found only by MAC are labelled **possible**. Picking one fills in the address and port. Manual entry stays available for anything neither method finds.

**A DHCP reservation is no longer necessary.** Once a device has been matched to a discovery result, the app follows its address: when the DHCP lease hands out a new one, the IP setting is updated and the connection re-established instead of the device going offline. Devices added before this existed adopt the MAC the first time they are seen at their configured address, and track it from then on.

The new device is named after the model the controller reports — `Luxtronik LWC`, for example — falling back to plain `Luxtronik` when the controller reports a model the library does not know. The IP address is deliberately not part of the name: it belongs in the device settings and would go stale the moment the DHCP lease changes. Existing devices keep the name they were given; Homey stores it at creation.

### Device Settings

| Setting                              | Default  | Description                                                        |
|--------------------------------------|----------|--------------------------------------------------------------------|
| Show Refresh Button                  | Off      | Shows a Refresh button on the device tile for immediate polling    |
| IP Address                           | –        | IP of the Luxtronik controller                                     |
| Port                                 | 8889     | TCP port of the controller                                         |
| Poll Interval (seconds)              | 60       | How often the heat pump is queried (min. 10 s)                     |
| Hot Water Boost Duration (minutes)   | 60       | Maximum runtime for both boost modes                               |
| Poll Timeout (seconds)               | 30       | Time before a non-responding device is marked unavailable          |
| Watchdog Threshold (× poll interval) | 3        | Missed poll intervals before watchdog triggers                     |
| Watchdog Check Interval (seconds)    | 60       | How often the watchdog checks for a successful poll                |
| Enable Power Sensor                  | Off      | Activates estimated watt sensor per heat pump state                |
| Heating / Hot Water / Standby (W)    | 0        | Required for the automatic kWh energy meter                        |
| Cooling Capabilities Visibility      | Auto     | Auto / Always show / Always hide — controls cooling capabilities   |
| Hysteresis Restore Value (K)         | 0 (auto) | Value restored by "Restore Hot Water Hysteresis" flow action. Auto-initialized from current controller value on first start. |

Beyond the table above, the device settings hold groups of **controller parameters that are written straight to the Luxtronik**:

| Group | Parameters |
|-------|-----------|
| Heating Curve | Endpoint and parallel offset for the heating circuit and MK1 (11, 12, 14, 15) |
| Outdoor Temperature Limits | Heating limit, max./min. outdoor temperature, setback limit (700, 91, 92, 111) |
| Heating Circuit Limits | Return hysteresis, supply/return limit, return minimum (88, 149, 87, 979) |
| Setback | Delta for heating and MK1 (13, 16) |
| Hot Water | Max. hot water temperature, TDI setpoint, hysteresis, hysteresis restore value (973, 47, 74) |
| Auxiliary Heater / 2nd Compressor | ZWE release, 2nd compressor heating and hot water (90, 95, 96) |
| Cooling | Release and inlet temperature (110, 132) |

Not every controller supports every parameter. When a value is not reported, the matching capability stays hidden and the setting is not written — the max. hot water temperature has no tile of its own, so there the app checks the parameter list instead; a value the controller does not keep is named in a message after saving (see *Heating Correction*). The labels and hints of all settings exist in English, German, Dutch and French.

---

## Flow Cards

### Triggers

| Card                                       | Token      | Description                                   |
|--------------------------------------------|------------|-----------------------------------------------|
| Heating Operation Mode Changed             | `mode`     | New mode as text; once per change, whether made on the controller or from Homey |
| Hot Water Operation Mode Changed           | `mode`     | New mode as text; once per change, whether made on the controller or from Homey |
| Cooling Operation Mode Changed             | `mode`     | New mode as text (Off / Automatic)            |
| Heat Pump Status Changed                   | `state`    | New status as text                            |
| Error Occurred                             | `error`, `hint` | Fires for every new entry in the controller's error log, as code and text in your language, e.g. `701 - Low pressure fault`; the hint gives the acknowledgement as shown on the display (e.g. *Please call installer*) and what to check. An error that cleared itself before the next poll or occurred while Homey restarted is reported too; entries already in the log when the app first starts are not. |
| Error Cleared                              | –          | When the error disappears                     |
| Hot Water Boost (Auxiliary) Started        | `duration` | Duration in minutes                           |
| Hot Water Boost (Auxiliary) Ended          | –          | When the boost ends — automatically, switched off, or replaced by the party boost; once per boost |
| Hot Water Boost (Party) Started            | `duration` | Duration in minutes                           |
| Hot Water Boost (Party) Ended              | –          | When the boost ends — automatically, switched off, or replaced by the auxiliary boost; once per boost |
| Thermal Disinfection Ended                 | –          | When the target temperature is reached (not on manual disable) |
| Device Unavailable                         | –          | When the device becomes unreachable — a failed poll, a poll timeout or the watchdog; once per outage |
| Device Available                           | –          | When connection is restored                   |
| Outdoor Temperature Dropped Below … °C    | Threshold  | When the temperature crosses the threshold between two polls, not on every change beyond it |
| Outdoor Temperature Rose Above … °C       | Threshold  | When the temperature crosses the threshold between two polls, not on every change beyond it |
| Room Temperature Dropped Below … °C       | Threshold  | Like the outdoor card; only when an RBE room display is connected |
| Room Temperature Rose Above … °C          | Threshold  | Like the outdoor card; only when an RBE room display is connected |

### Conditions

| Card                                       | Parameter              |
|--------------------------------------------|------------------------|
| Heating Operation Mode Is …               | Dropdown               |
| Hot Water Operation Mode Is …             | Dropdown               |
| Cooling Operation Mode Is …               | Dropdown (Off / Automatic) |
| Heat Pump Status Is …                     | Dropdown               |
| Heating Status Is …                       | Free text — a full status name matches exactly that status, in any Homey language; part of a name ("Heiz") matches as text |
| Hot Water Status Is …                     | Dropdown (4 values), in any Homey language |
| Outdoor Temperature Is Above … °C         | Number                 |
| Outdoor Temperature Is Below … °C         | Number                 |
| Room Temperature Is Above … °C            | Number                 |
| Room Temperature Is Below … °C            | Number                 |
| Thermal Disinfection Is Active            | –                      |
| Hot Water Boost (Auxiliary) Is Active     | –                      |
| Hot Water Boost (Party) Is Active         | –                      |
| Device Is Available                       | –                      |

### Actions

| Card                                               | Parameter                      |
|----------------------------------------------------|--------------------------------|
| Set Heating Operation Mode                         | Dropdown (Automatic … Off)     |
| Set Hot Water Operation Mode                       | Dropdown (Automatic … Off)     |
| Set Cooling Operation Mode                         | Dropdown (Off / Automatic)     |
| Set Heating Temperature Correction                 | Number: −5 … +5 °C (0.5 K)     |
| Set Hot Water Target Temperature                   | Number: 30 … 65 °C (0.5 K), limited to the controller's max. hot water temperature |
| Start Hot Water Boost (Auxiliary)                  | Duration in minutes (5–480)    |
| Stop Hot Water Boost (Auxiliary)                   | –                              |
| Start Hot Water Boost (Party)                      | Duration in minutes (5–480)    |
| Stop Hot Water Boost (Party)                       | –                              |
| Enable Thermal Disinfection                        | –                              |
| Disable Thermal Disinfection                       | –                              |
| Minimize Hot Water Hysteresis                      | Sets hysteresis to 0.5 K (solar boost) |
| Restore Hot Water Hysteresis                       | Restores hysteresis to configured value |
| Set Hot Water Hysteresis                           | Number: 0.5 … 10 K             |
| Set Return Temperature Hysteresis                  | Number: 0.5 … 10 K             |
| Set Outdoor Temperature Max                        | Number: 10 … 45 °C             |
| Set Heating Limit                                  | Number: 5 … 30 °C              |

**17 triggers, 14 conditions, 17 actions.** All writing actions are serialized — see *Notes & Warnings*.

Every action and condition acts on the heat pump selected in the card, so with several heat pumps paired, each flow controls the one it names.

---

## Operation Mode Codes (Reference)

| Code | Heating    | Hot Water  | Cooling    |
|------|------------|------------|------------|
| 0    | Automatic  | Automatic  | Off        |
| 1    | Auxiliary  | Auxiliary  | Automatic  |
| 2    | Party      | Party      | –          |
| 3    | Holiday    | Holiday    | –          |
| 4    | Off        | Off        | –          |

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
| `cooling`       | Cooling — how it is detected, see *Cooling Mode* |
| `standby`       | Standby                       |
| `unknown`       | Controller reported a state this app does not know |

### Heating Status Codes

The detailed heating status (`heating_state_string`) comes from the controller. Like the hot water status, it is shown in English, German, Dutch or French; the French terms follow the French operating manual where the author's Windows app has them. Two codes are undocumented in every reference implementation (`luxtronik2`, `python-luxtronik`, the Home Assistant integration) and are mapped by this app:

| Code | Shown as | Notes |
|------|----------|-------|
| 15   | Operating Limit | Observed together with error 718 "Max. Aussentemp." — the heat pump is outside its operating limits. The label is deliberately neutral: it is unclear whether 15 means specifically the outdoor temperature limit or generically "blocked due to fault". |
| 18   | Compressor Heating Up | Compressor warm-up phase |

The condition *Heating Status Is …* takes free text. A full status name from this table or the one above — in any of the four languages, upper or lower case — matches exactly that status, so a flow keeps working when the Homey language changes, and "Heating" does not match "DHW Reheating". Part of a name ("Heiz") is still matched as text. *Hot Water Status Is …* likewise compares the status, not the translated tile text.

---

## Notes & Warnings

> ⚠️ **Caution:** Incorrect settings can put the heat pump into an error state. Only make changes if the function of the parameter is known.

- The thermostat correction (`target_temperature.heating`) shifts the heating curve by the set value. When it seems to have no effect, see *Heating Correction*.
- All write operations are sent to the controller immediately and read back; a flow card or control fails if the controller did not keep the value (see *Heating Correction*). A confirmation poll follows 3 seconds after the read-back to update the tiles without waiting for the next poll interval. A write that a poll starts itself — ending a boost or thermal disinfection on reaching the temperature — runs after that poll: its read-back needs the connection the poll holds, and waiting for it used to stall both until the poll's backstop marked the device unavailable for about 35 seconds.
- Write operations are serialized — if two flow actions trigger writes simultaneously (e.g. "Restore hysteresis" + "Set operation mode"), they are queued and executed one after the other to avoid TCP conflicts. That covers every write, including the device settings that go to raw parameters.
- Write protection prevents polling cycles from immediately overwriting manually set values (120s protection window). A value the controller did not accept lifts it at once, so the next poll shows what the controller really has.
- The cooling mode capability visibility is configurable: Auto (see *Cooling Mode*), Always show, or Always hide.
- Room temperature capabilities (`measure_temp_room`, `measure_temp_room_target`) are only populated when an RBE room display is physically connected to the controller.
- Polling pauses for the duration of a write, and a poll that is still running blocks the next one — the app never opens two connections to the controller at the same time.
- Capability titles are synced once per app version rather than on every restart, to stay clear of Homey's `setCapabilityOptions` rate limit. The upper end of the hot water thermostat goes the same way: it is only set when the controller's max. hot water temperature changes.

---

## Technical Background

The app communicates via TCP (port 8889) directly with the Luxtronik controller. The controller answers with three register blocks: **calculations** (command 3004, live readings), **parameters** (3003, settings) and **visibilities** (3005, which features the unit actually has). It accepts only one connection at a time, which is why the app serialises every read and write.

### `lib/`

| Module | Purpose |
|--------|---------|
| [`lib/luxtronik2/`](lib/luxtronik2/) | The protocol library [`luxtronik2`](https://github.com/coolchip/luxtronik2) 2.7.2 (MIT), **bundled rather than pulled from npm**. Upstream has published nothing since February 2024 and the issue tracker is unattended, but the library needed fixes the app cannot apply from outside. `types.js` and `utils.js` are verbatim copies of the published tarball; the deviations in `luxtronik.js` and `utils.js` are documented in [`lib/luxtronik2/README.md`](lib/luxtronik2/README.md). |
| [`lib/luxtronik-registers.js`](lib/luxtronik-registers.js) | Named registers — 99 calculations, 105 parameters, 43 visibilities. The library addresses registers by bare array offsets scattered through its source; this table gives them names so further sensors can be added without guessing at positions. Each entry carries the controller's own field name as a comment. |
| [`lib/luxtronik-codes.js`](lib/luxtronik-codes.js) | Translation tables the bundled library lacks: switch-off reasons in EN/DE/NL/FR (the library maps only codes 0–9 and only to German, while controllers emit codes up to 27), error texts and hints from `luxtronik-errors.js`, heating and hot water status texts and defrost variants in EN/DE/NL/FR, mixing circuit types, and the room unit and control mode codes behind the configuration log line. Also builds the parameter-change log line, filters the error and switch-off logs down to entries a controller can actually have written, tells a hot water sensor from the placeholder of an unconnected input, decides from the cooling counter whether the unit is cooling, reads a written value back to see whether the controller kept it, picks the new entries out of the error log, and tells an unusable poll of zeros from a real one. It chooses the hot water setpoint register by firmware and limits the setpoint to the max. hot water temperature, maps a status name in any language back to its code for the flow conditions, and decides when a temperature has crossed a flow's threshold. |
| [`lib/luxtronik-errors.js`](lib/luxtronik-errors.js) | The controller's error codes, 88 of them, each with a short text, a hint and how it is acknowledged, in EN/DE/NL/FR. Taken from the author's own Windows app for Luxtronik controllers, whose German texts follow the Luxtronik operating manuals; the translations are machine-made and may differ from the wording on the controller display. |
| [`lib/luxtronik-discovery.js`](lib/luxtronik-discovery.js) | UDP broadcast search. Magic packet `2000;111;1;\0` to ports 4444 and 47808; a controller answers with `2500;111;…` whose third field carries its data port. Protocol taken from [python-luxtronik](https://github.com/Bouni/python-luxtronik) (`luxtronik/discover.py`). |

Both tables are transcribed from [BenPru/luxtronik](https://github.com/BenPru/luxtronik), which documents and translates them. Register keys keep the upstream spelling **including the register number**, because the name alone is not unique — `P0002` and `P0105` are both called `DHW_TARGET_TEMPERATURE` and are different registers (the configured setting versus the controller's momentary target; see *Hot Water: Setpoint vs. "Target (current)"* above).

### Reference material

- [BenPru/luxtronik – const.py](https://github.com/BenPru/luxtronik/blob/main/custom_components/luxtronik2/const.py) — register names and switch-off codes
- [Bouni/python-luxtronik – parameters.py](https://github.com/Bouni/python-luxtronik/blob/master/luxtronik/parameters.py)
- [Bouni/python-luxtronik – calculations.py](https://github.com/Bouni/python-luxtronik/blob/master/luxtronik/calculations.py)
- [FHEM Luxtronik Wiki (DE)](https://wiki.fhem.de/wiki/Luxtronik_2.0)

---

## Development

```bash
npm install
npm test          # 144 tests, no Homey required
npm run lint
npm run validate  # homey app validate
npm run build     # homey app build
npm run publish   # homey app publish (maintainer only)
```

Lint, tests and a publish-level validation run on every push to `main` and on every pull request — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

### Tests

`node --test`, no test framework dependency. The suite runs anywhere Node runs: nothing in it needs a Homey or a heat pump.

| File | Covers |
|------|--------|
| [`conversions.test.js`](test/conversions.test.js) | The unit conversions — seconds to hours, tenths and hundredths, the `-50 °C` sentinel of an unconnected sensor, and when a `0 kWh` reading means "no heat meter" rather than "nothing yet". A value that turns out to be a placeholder or garbage empties its tile instead of staying on it, and the error log and hot water temperature reach their tiles only through the plausibility checks. The error reaches the tile and the *Error Occurred* trigger translated, with the hint as a token of its own. Timeline state names and the hot water status exist in all four languages, and a missing language falls back to English rather than to the internal name. "Cooling" in the state comes from the cooling counter, never from the release flag, and without a previous reading the state shown before stays. An energy counter that has counted keeps its tile when it reads 0 later, and detected cooling stays detected. |
| [`codes.test.js`](test/codes.test.js) | The translation tables against the bundled library: every state code it knows must have a text, and every heating status and defrost variant exists in all four languages, defrost variants must follow its own logic, and switch-off codes 0–27 must be complete. Also the controller configuration line in the log: an RBE from firmware 2.0 on counts as RBE Plus, and a register the controller does not send is named as missing rather than read as 0. And the parameter-change line: registers by name with their raw values, a counter muted after three polls in a row but not a setting changed twice with a pause between, at most 20 entries per line, and a shorter parameter list compared only where both have values. The random contents of an error log that was never written are dropped, both by date and by code, and the 75 °C placeholder of a heating-only unit does not count as hot water — unless hot water hours have run. Cooling counts only while the cooling counter rises between two polls and never on a unit whose counter has never run; a glitch poll reading 0, a read seconds after the last one and a counter reset are not taken for a change. A written value counts as accepted only once the controller reports it back, with further reads after 0.5, 1 and 2 s for a controller that takes a moment; without a single successful read it stays unchecked. Every error code the library knows has a text and a hint in all four languages, an unknown code reads "Unknown" in the user's language, the hint starts with the acknowledgement as on the display, and every switch-off reason exists in French too. New error log entries are reported oldest first and only once, never the entries already there at first start, and the first entry after an empty log is not lost. A poll of nothing but zeros is unusable, as is one where every counter that was running drops to 0 at once; a single counter reset is not. The hot water setpoint register follows the firmware — parameter 2 up to x.88.2, 105 from x.88.3, an unreadable version counting as current — the thermostat falls back to the other register only when that one is missing or outside 30–65 °C, and the setpoint is limited to the max. hot water temperature where the controller reports one. The thermostat ends there too, unless the current setpoint is higher, and never outside 30–65 °C. The temperature triggers fire on crossing their threshold, not on every change beyond it. Both status conditions recognise a status in any language — "Temp. OK" matches "Temperature OK", "Heizbetrieb" matches "Heating" — and "Heating" no longer matches "DHW Reheating"; every status name belongs to exactly one code. |
| [`protocol.test.js`](test/protocol.test.js) | The library against a fake controller speaking the real 3002/3003/3004/3005 protocol — short parameter lists, a reply split across TCP segments, a controller that goes quiet mid-read. A write reports the register and raw value that went out, and only reading back tells a kept value from a dropped one: the acknowledgement is the same. |
| [`discovery.test.js`](test/discovery.test.js) | The UDP search: valid replies, missing or nonsensical ports, foreign traffic on the same ports, and the app's own broadcast coming back. |
| [`boost.test.js`](test/boost.test.js) | Hot water boost with fake timers. Ending one, including a failed switch-back — the tile must reset, the poll must carry on and the switch-back is retried later without a second *ended* trigger. The switch-back goes to the mode before the boost, one boost replaces the other, and extending one keeps its original mode. After a restart a stored boost continues for its remaining time or ends with the first poll; a mode changed on the controller in between is left alone, and a boost from a version without the store is ended as before. |
| [`flow.test.js`](test/flow.test.js) | Flow conditions and actions with two heat pumps: every listener must act on the device chosen in the flow, not on whichever one started last, and a failed boost stop must still fail the flow. An action that arrives while the device is still starting must find its state ready: everything onInit sets up and an action can reach comes before the first `await`. *Device Unavailable* must fire on every way into unavailability — failed poll, poll timeout, watchdog — and only once per outage, and after an outage the cooling counter starts afresh instead of comparing across the gap. Every write, raw registers included, goes through the write queue and its timeouts: the library's write functions may only be called in one place. Both status conditions hold in any Homey language, and a mode change made from Homey fires *Operation Mode Changed* once, from the confirmation poll. |
| [`poll.test.js`](test/poll.test.js) | What a poll takes over and what it reports. A poll of nothing but zeros reaches no tile and no trigger, does not count as successful and is repeated once after 5 s; a single reset counter still gets through. *Error Occurred* fires for an error that cleared itself before the next poll and for one that occurred during a restart, oldest first and in the user's language, but not for entries already in the log after an update, and the known state of the log survives a restart. A write the poll starts itself does not wait for the poll, so the backstop no longer fires; neither `_processData` nor the boost supervision awaits a write. Thermal disinfection reports completion only after an accepted switch-off, retries after 10 minutes instead of every poll and never runs two switch-offs at once. The temperature triggers pass the previous value along. |
| [`write.test.js`](test/write.test.js) | Writing with read-back: a flow action fails when the controller keeps its old value, lifts the write protection and still resumes polling; a read-back that fails leaves the write unchecked rather than failed. The hot water setpoint goes to the register the firmware evaluates — before x.88.3 also to the desired value, without failing on it — is limited to the max. hot water temperature, which the fake controller enforces like the real one, and fails naming that register when the controller drops it, and the thermostat reads the register the app writes. Its upper end follows the max. hot water temperature, set only when it changes, not retried on every poll after a failure, and without losing the other options; device settings name what was not accepted, and the max. hot water temperature is written in tenths to parameter 973, within 30–65 °C and only where the controller reports it; the read-back waits for a running poll and holds the single connection while it reads, a read-back of nothing but zeros counts as unchecked, and no write bypasses it. |
| [`manifest.test.js`](test/manifest.test.js) | The manifest against the code: every flow card registered, every capability written, every settable capability with a listener, no capability definition left that nothing uses or removes from old devices, no unreachable method, and every icon theme-aware and correctly scaled, with no visible tile left on Homey's placeholder icon. Tiles, flow cards, selection values and the device settings exist in all four languages, with no German left in an English settings group, cooling has one French name throughout, and the title sync also reaches tiles without a capability definition of their own. |

Each test covers a fault that actually occurred rather than a textbook case. The suite is mutation-checked: reintroducing the original defect makes the corresponding test fail.

---

## License

MIT License – see [LICENSE](LICENSE)

---

## 🤖 AI Development

This app was built with the help of **Claude (Anthropic AI)**, alongside contributions from the people listed below.

---

## 🙏 Acknowledgements

- [RobinFlikkema/homey-luxtronik](https://github.com/RobinFlikkema/homey-luxtronik)
- [coolchip/luxtronik2](https://github.com/coolchip/luxtronik2) (npm package)
- [BenPru/luxtronik](https://github.com/BenPru/luxtronik) (Home Assistant integration)
- [Bouni/luxtronik](https://github.com/Bouni/luxtronik)
- [@mgntrn](https://github.com/mgntrn) — room temperature firmware fix, cooling state detection, room temperature flow cards, Dutch translations
- [@scaronni](https://github.com/scaronni) — vendored the protocol library and fixed reads split across TCP segments, added the switch-off reason and last error tiles, contributed the named register table
