# Luxtronik Heat Pump Manager – Homey App

**App ID:** `com.luxtronik.heatpump`  
**SDK:** Homey SDK 3  
**Kompatibel mit:** Homey Pro (Early 2023), Homey Pro (2019), Homey Bridge (Firmware >= 11.0.0)

---

## Unterstützte Wärmepumpen

Diese App kommuniziert mit dem **Luxtronik 2.0 / 2.1** Controller, der in Wärmepumpen folgender Hersteller verbaut ist:

| Hersteller        | Beispiel-Modelle                       |
|-------------------|----------------------------------------|
| Alpha Innotec     | LW/SW/WZS-Serie                        |
| Siemens Novelan   | WPR NET                                |
| Roth              | ThermoAura, ThermoTerra               |
| Elco              | Aquatop, Aerotop                      |
| Buderus           | Logamatic HMC20, HMC20 Z              |
| Nibe              | AP-AW10                               |
| Wolf Heiztechnik  | BWL/BWS                               |
| CTA               | Aeroheat AH CI 1-16iL                 |

---

## Funktionsübersicht

### Lesbare Werte (Sensoren)

| Capability                                         | Beschreibung                              |
|----------------------------------------------------|-------------------------------------------|
| Wärmepumpen-Status                                 | Heizen / Warmwasser / Abtauen / Standby / EVU-Sperre / … |
| Heizung Status                                     | Detaillierter Heizungsstatus vom Controller (Extended State String) |
| Warmwasser Status                                  | Sperrzeit / Aufheizen / Temp. OK / Aus    |
| Aussentemperatur                                   | Aktuell + gleitender 24h-Mittelwert       |
| Vorlauftemperatur                                  | Heizkreis Vorlauf                         |
| Rücklauftemperatur                                 | Heizkreis Rücklauf + Sollwert             |
| Heissgastemperatur                                 | Verdichter Austritt                       |
| Warmwassertemperatur                               | Ist-Temperatur                            |
| Warmwasser Soll-Temperatur (gelesen)               | Vom Controller gelesener Sollwert         |
| Wärmequelle Eingang / Ausgang                      | Sole- / Lufttemperatur                    |
| Ansauglufttemperatur                               | Nur bei Luft-Wärmepumpen                 |
| Raumtemperatur Ist / Soll                          | Nur mit angeschlossenem RBE-Raumdisplay   |
| Volumenstrom                                       | l/h (Wärmequelle)                         |
| Energie Heizung / Warmwasser / Gesamt              | kWh                                       |
| Betriebsstunden Verdichter / Heizung / Warmwasser  | Stunden                                   |
| Fehleralarm                                        | Fehler aktiv: Ja / Nein                   |
| Letzte Abfrage                                     | Uhrzeit des letzten erfolgreichen Polls (lokale Zeit) |
| Firmware-Version                                   | Softwarestand des Controllers             |

### Steuerbare Werte

| Capability                         | Wertebereich / Optionen                                      |
|------------------------------------|--------------------------------------------------------------|
| **Warmwasser Thermostat**          | Soll: 30–65 °C · Ist: aktuelle Warmwassertemperatur         |
| **Heizungs Thermostat**            | Korrektur: −5 bis +5 °C · Ist: aktuelle Vorlauftemperatur   |
| **Heizungs-Betriebsart**           | Automatik · Zuheizer · Party · Ferien · Aus                  |
| **Brauchwasser-Betriebsart**       | Automatik · Zuheizer · Party · Ferien · Aus                  |
| **Schnellladung (Zuheizung)**      | Toggle – Zuheizer-Modus, automatische Abschaltung            |
| **Schnellladung (Party)**          | Toggle – Party-Modus, automatische Abschaltung               |
| **Thermische Desinfektion**        | Toggle – Dauerbetrieb, auto. Abschaltung bei Zieltemperatur  |
| **TDI-Solltemperatur**             | Zieltemperatur für thermische Desinfektion: 50–80 °C         |

---

## Brauchwasser Schnellladung

Zwei Modi stehen zur Verfügung:

**Schnellladung (Zuheizung):** Setzt die Brauchwasser-Betriebsart auf „Zuheizer"  
**Schnellladung (Party):** Setzt die Brauchwasser-Betriebsart auf „Party"

Beide Varianten:
- Schalten automatisch ab wenn die Warmwassertemperatur die Soll-Temperatur erreicht
- Schalten nach der konfigurierten Maximaldauer ab (Standard: 60 Min., einstellbar in den Geräteeinstellungen)
- Setzen die Betriebsart danach zurück auf „Automatik"
- Lösen den Flow-Trigger „Schnellladung beendet" bei automatischer Abschaltung aus

---

## Thermische Desinfektion

Aktiviert den Dauerbetrieb (Parameter 27) für den Legionellenschutz:

- Nach jeder Warmwasserbereitung folgt automatisch eine thermische Desinfektion
- Schaltet automatisch ab wenn die Warmwassertemperatur ≥ TDI-Solltemperatur (direkt vom Controller gelesen, einstellbar über den Thermostat-Schieberegler „Thermische Desinfektion Soll", 50–80 °C)
- Manuelles Beenden jederzeit möglich
- Löst den Flow-Trigger „Thermische Desinfektion beendet" aus

> **Hinweis:** Setzt einen angeschlossenen zweiten Wärmeerzeuger (ZWE) voraus.

---

## Verbindungs-Watchdog

- **Poll-Timeout (30s):** Keine Antwort innerhalb von 30 Sekunden → Gerät sofort als unavailable markiert
- **Watchdog-Timer:** Prüft jede Minute ob der letzte erfolgreiche Poll zu lange zurückliegt (Schwellwert: 3× Polling-Intervall)
- **Letzte Abfrage:** Capability zeigt die Uhrzeit des letzten erfolgreichen Polls in lokaler Zeit
- Gerät wird automatisch wieder als available markiert sobald der Controller antwortet

---

## Installation

### Voraussetzungen

- Luxtronik 2.0 / 2.1 Controller über LAN erreichbar
- Statische IP-Adresse empfohlen (DHCP-Reservierung im Router einrichten)
- Standard-Port: **8889** (TCP)

### Einrichtung in Homey

1. App aus dem Homey App Store installieren
2. Gerät hinzufügen: **Geräte → + → Luxtronik Wärmepumpen Manager**
3. IP-Adresse und Port (Standard: 8889) eingeben
4. Verbindungstest – bei Erfolg wird das Gerät angelegt

### Geräteeinstellungen

| Einstellung                         | Standard | Beschreibung                                          |
|-------------------------------------|----------|-------------------------------------------------------|
| IP-Adresse                          | –        | IP des Luxtronik-Controllers                          |
| Port                                | 8889     | TCP-Port des Controllers                              |
| Abfrageintervall (Sekunden)         | 60       | Wie oft die Wärmepumpe abgefragt wird (min. 10 s)    |
| Schnellladung Dauer (Minuten)       | 60       | Maximale Laufzeit beider Schnellladungs-Modi          |

---

## Flow-Karten

### Auslöser (Triggers)

| Karte                                      | Token      | Beschreibung                                  |
|--------------------------------------------|------------|-----------------------------------------------|
| Heizungs-Betriebsart geändert              | `mode`     | Neue Betriebsart als Text                     |
| Brauchwasser-Betriebsart geändert          | `mode`     | Neue Betriebsart als Text                     |
| Wärmepumpen-Status geändert                | `state`    | Neuer Status als Text                         |
| Fehler aufgetreten                         | `error`    | Fehlermeldung als Text                        |
| Fehler quittiert                           | –          | Wenn Fehler wieder verschwindet               |
| Schnellladung (Zuheizung) beendet          | –          | Bei automatischer Abschaltung                 |
| Schnellladung (Party) beendet              | –          | Bei automatischer Abschaltung                 |
| Thermische Desinfektion beendet            | –          | Bei automatischer Abschaltung                 |
| Gerät nicht erreichbar                     | –          | Wenn Watchdog anschlägt                       |
| Gerät wieder erreichbar                    | –          | Wenn Verbindung wiederhergestellt             |
| Aussentemperatur fiel unter … °C           | Schwellwert| Schwellwert-Vergleich mit aktuellem Wert      |
| Aussentemperatur stieg über … °C           | Schwellwert| Schwellwert-Vergleich mit aktuellem Wert      |

### Bedingungen (Conditions)

| Karte                                      | Parameter              |
|--------------------------------------------|------------------------|
| Heizungs-Betriebsart ist …                 | Dropdown               |
| Brauchwasser-Betriebsart ist …             | Dropdown               |
| Wärmepumpen-Status ist …                   | Dropdown               |
| Heizung Status ist …                       | Freitext               |
| Warmwasser Status ist …                    | Dropdown (4 Werte)     |
| Warmwassertemperatur ist über … °C         | Zahl                   |
| Warmwassertemperatur ist unter … °C        | Zahl                   |
| Aussentemperatur ist über … °C             | Zahl                   |
| Aussentemperatur ist unter … °C            | Zahl                   |
| Thermische Desinfektion ist aktiv          | –                      |
| Schnellladung (Zuheizung) ist aktiv        | –                      |
| Schnellladung (Party) ist aktiv            | –                      |
| Gerät ist erreichbar                       | –                      |

### Aktionen (Actions)

| Karte                                              | Parameter                      |
|----------------------------------------------------|--------------------------------|
| Heizungs-Betriebsart setzen                        | Dropdown (Automatik … Aus)     |
| Brauchwasser-Betriebsart setzen                    | Dropdown (Automatik … Aus)     |
| Heizungs-Temperaturkorrektur setzen                | Zahl: −5 … +5 °C               |
| Brauchwasser Soll-Temperatur setzen                | Zahl: 30 … 65 °C               |
| Brauchwasser Soll-Temperatur anpassen (relativ)    | Offset: −20 … +20 °C           |
| Schnellladung (Zuheizung) starten                  | Dauer in Minuten (5–480)       |
| Schnellladung (Zuheizung) stoppen                  | –                              |
| Schnellladung (Party) starten                      | Dauer in Minuten (5–480)       |
| Schnellladung (Party) stoppen                      | –                              |
| Thermische Desinfektion aktivieren                 | –                              |
| Thermische Desinfektion deaktivieren               | –                              |

---

## Betriebsart-Codes (Referenz)

| Code | Heizung    | Brauchwasser |
|------|------------|--------------|
| 0    | Automatik  | Automatik    |
| 1    | Zuheizer   | Zuheizer     |
| 2    | Party      | Party        |
| 3    | Ferien     | Ferien       |
| 4    | Aus        | Aus          |

---

## Wärmepumpen-Status-Codes (Referenz)

| Slug            | Bedeutung                     |
|-----------------|-------------------------------|
| `heating`       | Heizen                        |
| `hotwater`      | Warmwasserbereitung           |
| `swimming`      | Schwimmbadheizung             |
| `provider_lock` | EVU-Sperre                    |
| `defrost`       | Abtauen                       |
| `off`           | Aus                           |
| `external`      | Extern (2. Wärmeerzeuger)     |
| `cooling`       | Kühlen                        |
| `standby`       | Bereitschaft                  |

---

## Hinweise & Warnungen

> ⚠️ **Vorsicht:** Falsche Einstellungen können die Wärmepumpe in einen Fehlerzustand versetzen. Änderungen nur vornehmen, wenn die Funktion des Parameters bekannt ist.

- Die Thermostat-Korrektur (`target_temperature.heating`) verschiebt die Heizkurve um den eingestellten Wert. Positive Werte → wärmer, negative Werte → kühler.
- Alle Schreiboperationen werden sofort an den Controller gesendet.
- Der Write-Schutz verhindert dass Polling-Zyklen manuell gesetzte Werte sofort überschreiben (120s Schutzfenster).

---

## Technischer Hintergrund

Die App kommuniziert über TCP (Port 8889) direkt mit dem Luxtronik-Controller.  
Als Protokoll-Bibliothek wird [`luxtronik2`](https://www.npmjs.com/package/luxtronik2) verwendet.

Parameter-Referenz:
- [Bouni/python-luxtronik – parameters.py](https://github.com/Bouni/python-luxtronik/blob/master/luxtronik/parameters.py)
- [Bouni/python-luxtronik – calculations.py](https://github.com/Bouni/python-luxtronik/blob/master/luxtronik/calculations.py)
- [FHEM Luxtronik Wiki (DE)](https://wiki.fhem.de/wiki/Luxtronik_2.0)

---

## Lizenz

MIT License – siehe [LICENSE](LICENSE)

---

## 🤖 KI-Entwicklung

Diese App wurde vollständig mit Hilfe von **Claude (Anthropic AI)** entwickelt.

---

## 🙏 Danksagungen

- [RobinFlikkema/homey-luxtronik](https://github.com/RobinFlikkema/homey-luxtronik)
- [coolchip/luxtronik2](https://github.com/coolchip/luxtronik2) (npm-Paket)
- [BenPru/luxtronik](https://github.com/BenPru/luxtronik) (Home Assistant Integration)
- [Bouni/luxtronik](https://github.com/Bouni/luxtronik)
