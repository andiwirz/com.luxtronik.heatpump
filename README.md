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

| Fähigkeit                         | Beschreibung                         |
|-----------------------------------|--------------------------------------|
| Wärmepumpen-Status                | Heizen / Warmwasser / Abtauen / ...  |
| Außentemperatur                   | Aktuell + gleitender Mittelwert      |
| Vorlauftemperatur                 | Heizkreis Vorlauf                    |
| Rücklauftemperatur                | Heizkreis Rücklauf + Sollwert        |
| Heißgastemperatur                 | Verdichter Austritt                  |
| Warmwassertemperatur              | Ist + Soll                           |
| Wärmequelle Eingang / Ausgang     | Sole- / Lufttemperatur               |
| Ansauglufttemperatur              | Bei Luft-WP                          |
| Raumtemperatur Ist / Soll         | Nur mit RBE-Raumdisplay              |
| Volumenstrom                      | l/h                                  |
| Energie Heizung / Warmwasser / Gesamt | kWh                            |
| Betriebsstunden Verdichter / Heizung / Warmwasser | Stunden          |
| Fehleralarm                       | Fehler aktiv: Ja / Nein              |

### Steuerbare Werte (Aktoren)

| Fähigkeit                        | Wertebereich / Optionen                       |
|----------------------------------|-----------------------------------------------|
| **Heizungs-Betriebsart**         | Automatik · Zuheizer · Party · Ferien · Aus   |
| **Brauchwasser-Betriebsart**     | Automatik · Zuheizer · Party · Ferien · Aus   |
| **Heizungs-Temperaturkorrektur** | −5 °C bis +5 °C in 0,5 °C-Schritten           |
| **Brauchwasser Soll-Temperatur** | 30 °C bis 65 °C in 0,5 °C-Schritten           |

---

## Installation

### Voraussetzungen

- Luxtronik 2.0 / 2.1 Controller über LAN erreichbar
- Statische IP-Adresse empfohlen (im Router DHCP-Reservierung einrichten)
- Standard-Port: **8889** (TCP)

### Einrichtung in Homey

1. App aus dem Homey App Store installieren (`com.luxtronik.heatpump`)  
   oder als Developer-Build:
   ```bash
   homey app install
   ```
2. Gerät hinzufügen: **Geräte → + → Luxtronik Wärmepumpe**
3. IP-Adresse und Port (Standard: 8889) eingeben
4. Verbindungstest – bei Erfolg wird das Gerät angelegt

### Entwickler-Build (lokale Installation)

```bash
git clone https://github.com/yourusername/homey-luxtronik.git
cd homey-luxtronik
npm install
homey app install      # installiert auf deinen lokalen Homey
```

---

## Flow-Karten

### Auslöser (Triggers)

| Karte                              | Token        | Beschreibung                      |
|------------------------------------|--------------|-----------------------------------|
| Heizungs-Betriebsart geändert      | `mode`       | Neue Betriebsart als Text         |
| Brauchwasser-Betriebsart geändert  | `mode`       | Neue Betriebsart als Text         |
| Wärmepumpen-Status geändert        | `state`      | Neuer Status als Text             |
| Fehler aufgetreten                 | `error`      | Fehlermeldung als Text            |

### Bedingungen (Conditions)

| Karte                              | Parameter    |
|------------------------------------|--------------|
| Heizungs-Betriebsart ist …         | Dropdown     |
| Brauchwasser-Betriebsart ist …     | Dropdown     |
| Wärmepumpen-Status ist …           | Dropdown     |

### Aktionen (Actions)

| Karte                                   | Parameter                   |
|-----------------------------------------|-----------------------------|
| Heizungs-Betriebsart setzen             | Dropdown (0–4)              |
| Brauchwasser-Betriebsart setzen         | Dropdown (0–4)              |
| Heizungs-Temperaturkorrektur setzen     | Zahl: −5 … +5 °C            |
| Brauchwasser Soll-Temperatur setzen     | Zahl: 30 … 65 °C            |

---

## Betriebsart-Codes (Referenz)

| Code | Heizung           | Brauchwasser       |
|------|-------------------|--------------------|
| 0    | Automatik         | Automatik          |
| 1    | Zuheizer          | Zuheizer           |
| 2    | Party             | Party              |
| 3    | Ferien            | Ferien             |
| 4    | Aus               | Aus                |

---

## Wärmepumpen-Status-Codes (Referenz)

| Slug            | Bedeutung                      |
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

> ⚠️ **Vorsicht:** Falsche Einstellungen können die Wärmepumpe in einen Fehlerzustand versetzen. Änderungen nur vornehmen, wenn die Funktion des Parameters bekannt ist. Konsultiere das [Alpha Innotec Bedienungshandbuch](https://mw.ait-group.net/files/docs/EN/A0220/83055400.pdf).

- Die Temperaturkorrektur (`heating_target_temperature`) verschiebt die Heizkurve um den eingestellten Wert.  
  Positive Werte → wärmer, negative Werte → kühler.
- Alle Schreiboperationen werden sofort an den Controller gesendet.
- Der Abfrageintervall (Standard: 30 s) kann in den Geräteeinstellungen angepasst werden.

---

## Technischer Hintergrund

Die App kommuniziert über TCP (Port 8889) direkt mit dem Luxtronik-Controller.  
Als Protokoll-Bibliothek wird [`luxtronik2`](https://www.npmjs.com/package/luxtronik2) verwendet.

Parameter-Referenz:
- [Bouni/python-luxtronik – parameters.py](https://github.com/Bouni/python-luxtronik/blob/master/luxtronik/parameters.py)
- [Bouni/python-luxtronik – calculations.py](https://github.com/Bouni/python-luxtronik/blob/master/luxtronik/calculations.py)
- [FHEM Luxtronik Wiki (DE)](https://wiki.fhem.de/wiki/Luxtronik_2.0)

---

## Danksagungen

Basiert auf der Arbeit von:
- [RobinFlikkema/homey-luxtronik](https://github.com/RobinFlikkema/homey-luxtronik)
- [coolchip/luxtronik2](https://github.com/coolchip/luxtronik2) (npm-Paket)
- [BenPru/luxtronik](https://github.com/BenPru/luxtronik) (Home Assistant Integration)
- [Bouni/luxtronik](https://github.com/Bouni/luxtronik)

---

## Lizenz

MIT License – siehe [LICENSE](LICENSE)

---

## 🤖 KI-Entwicklung

Diese App wurde vollständig mit Hilfe von **Claude (Anthropic AI)** entwickelt. Sämtlicher Code, die Konfiguration sowie die Dokumentation wurden durch KI generiert und iterativ verfeinert — ohne manuelle Programmierung.

---

## 🙏 Danksagungen

Besonderer Dank gilt **Robin Flikkema** für die ursprüngliche [Luxtronik Homey App](https://github.com/RobinFlikkema/homey-luxtronik), die als Grundlage und Inspiration für dieses Projekt gedient hat. Ohne seine Vorarbeit wäre diese App in dieser Form nicht entstanden.
