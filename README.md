# Luxtronik Heat Pump – Homey App

**App ID:** `com.luxtronik.heatpump`  
**SDK:** Homey SDK 3  
**Kompatibel mit:** Homey Pro (Early 2023), Homey Pro (2019), Homey Bridge

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

| Fähigkeit                                          | Beschreibung                              |
|----------------------------------------------------|-------------------------------------------|
| Wärmepumpen-Status                                 | Heizen / Warmwasser / Abtauen / …         |
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
| Firmware-Version                                   | Softwarestand des Controllers             |

### Steuerbare Werte (Aktoren)

| Fähigkeit                        | Wertebereich / Optionen                         |
|----------------------------------|-------------------------------------------------|
| **Heizungs-Betriebsart**         | Automatik · Zuheizer · Party · Ferien · Aus     |
| **Brauchwasser-Betriebsart**     | Automatik · Zuheizer · Party · Ferien · Aus     |
| **Heizungs-Temperaturkorrektur** | −5 °C bis +5 °C in 0,5 °C-Schritten             |
| **Brauchwasser Soll-Temperatur** | 30 °C bis 65 °C in 0,5 °C-Schritten             |
| **Brauchwasser Schnelladung**    | Toggle – Dauer konfigurierbar (Standard 60 min) |
| **Thermische Desinfektion**      | Toggle – automatische Abschaltung (siehe unten) |

---

## Brauchwasser Schnelladung

Der Toggle **Brauchwasser Schnelladung** setzt die Betriebsart vorübergehend auf „Party" und schaltet nach Ablauf der konfigurierten Dauer automatisch auf „Automatik" zurück.

Die Dauer kann in den Geräteeinstellungen unter **Schnelladung Dauer (Minuten)** festgelegt werden (Standard: 60 Minuten).

---

## Thermische Desinfektion

Der Toggle **Thermische Desinfektion** ermöglicht eine manuelle Legionellenschutz-Erwärmung:

- **Starten:** Setzt Brauchwasser Soll-Temperatur auf 65 °C und Betriebsart auf „Zuheizer"
- **Automatische Abschaltung** sobald die Warmwassertemperatur ≥ 60 °C erreicht
- **Notabschaltung** nach spätestens 2 Stunden
- **Manuelles Beenden:** jederzeit über Toggle oder Flow-Karte möglich
- Nach dem Beenden werden Soll-Temperatur und Betriebsart automatisch auf die vorherigen Werte zurückgestellt

> **Hinweis:** Die Funktion setzt einen angeschlossenen zweiten Wärmeerzeuger (ZWE) voraus. Im Luxtronik-Menü erscheint die Thermische Desinfektion nur, wenn ein ZWE für die Warmwasserbereitung freigeschaltet ist.

---

## Installation

### Voraussetzungen

- Luxtronik 2.0 / 2.1 Controller über LAN erreichbar
- Statische IP-Adresse empfohlen (DHCP-Reservierung im Router einrichten)
- Standard-Port: **8889** (TCP)

### Einrichtung in Homey

1. App aus dem Homey App Store installieren
2. Gerät hinzufügen: **Geräte → + → Luxtronik Wärmepumpe**
3. IP-Adresse und Port (Standard: 8889) eingeben
4. Verbindungstest – bei Erfolg wird das Gerät angelegt

### Geräteeinstellungen

| Einstellung                     | Standard | Beschreibung                                       |
|---------------------------------|----------|----------------------------------------------------|
| IP-Adresse                      | –        | IP des Luxtronik-Controllers                       |
| Port                            | 8889     | TCP-Port des Controllers                           |
| Abfrageintervall (Sekunden)     | 60       | Wie oft die Wärmepumpe abgefragt wird (min. 10 s) |
| Schnelladung Dauer (Minuten)    | 60       | Laufzeit der Brauchwasser-Schnelladung             |

---

## Flow-Karten

### Auslöser (Triggers)

| Karte                              | Token    | Beschreibung                         |
|------------------------------------|----------|--------------------------------------|
| Heizungs-Betriebsart geändert      | `mode`   | Neue Betriebsart als Text            |
| Brauchwasser-Betriebsart geändert  | `mode`   | Neue Betriebsart als Text            |
| Wärmepumpen-Status geändert        | `state`  | Neuer Status als Text                |
| Fehler aufgetreten                 | `error`  | Fehlermeldung als Text               |
| Brauchwasser Schnelladung beendet  | –        | Ausgelöst wenn Schnelladung endet    |

### Bedingungen (Conditions)

| Karte                              | Parameter |
|------------------------------------|-----------|
| Heizungs-Betriebsart ist …         | Dropdown  |
| Brauchwasser-Betriebsart ist …     | Dropdown  |
| Wärmepumpen-Status ist …           | Dropdown  |

### Aktionen (Actions)

| Karte                                    | Parameter                      |
|------------------------------------------|--------------------------------|
| Heizungs-Betriebsart setzen              | Dropdown (Automatik … Aus)     |
| Brauchwasser-Betriebsart setzen          | Dropdown (Automatik … Aus)     |
| Heizungs-Temperaturkorrektur setzen      | Zahl: −5 … +5 °C               |
| Brauchwasser Soll-Temperatur setzen      | Zahl: 30 … 65 °C               |
| Brauchwasser Schnelladung starten        | Dauer in Minuten (5 – 480)     |
| Brauchwasser Schnelladung stoppen        | –                              |
| Thermische Desinfektion starten          | –                              |
| Thermische Desinfektion beenden          | –                              |

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

> ⚠️ **Vorsicht:** Falsche Einstellungen können die Wärmepumpe in einen Fehlerzustand versetzen. Änderungen nur vornehmen, wenn die Funktion des Parameters bekannt ist. Konsultiere das [Luxtronik 2.0/2.1 Fachhandwerker-Handbuch](https://www.alpha-innotec.com).

- Die Temperaturkorrektur (`heating_temperature_correction`) verschiebt die Heizkurve um den eingestellten Wert. Positive Werte → wärmer, negative Werte → kühler.
- Alle Schreiboperationen werden sofort an den Controller gesendet.
- Der Abfrageintervall kann in den Geräteeinstellungen angepasst werden (Standard: 60 s, Minimum: 10 s).

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

Diese App wurde vollständig mit Hilfe von **Claude (Anthropic AI)** entwickelt. Sämtlicher Code, die Konfiguration sowie die Dokumentation wurden durch KI generiert und iterativ verfeinert — ohne manuelle Programmierung.

---

## 🙏 Danksagungen

Basiert auf der Arbeit von:
- [RobinFlikkema/homey-luxtronik](https://github.com/RobinFlikkema/homey-luxtronik)
- [coolchip/luxtronik2](https://github.com/coolchip/luxtronik2) (npm-Paket)
- [BenPru/luxtronik](https://github.com/BenPru/luxtronik) (Home Assistant Integration)
- [Bouni/luxtronik](https://github.com/Bouni/luxtronik)

Besonderer Dank gilt **Robin Flikkema** für die ursprüngliche [Luxtronik Homey App](https://github.com/RobinFlikkema/homey-luxtronik), die als Grundlage und Inspiration für dieses Projekt gedient hat.
