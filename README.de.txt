Luxtronik Wärmepumpen Manager verbindet deine Luxtronik-basierte Wärmepumpe (z. B. Alpha-Innotec, CTA, Novelan, Roth, Elco, Buderus, Nibe, Wolf Heiztechnik) mit Homey. Die App liest alle verfügbaren Messwerte der Steuerung aus und ermöglicht es, diese Werte in Homey Flows zu nutzen sowie zentrale Steuerfunktionen direkt aus Homey heraus zu schreiben.

Funktionen

- Alle Werte des Luxtronik-Controllers auslesen: Temperaturen, Betriebsstunden, Energiewerte, Volumenstrom, Betriebszustände und mehr
- Thermostat-Widgets für Warmwasser und Heizung: Sollwerte setzen und Ist-Werte direkt auf der Gerätekachel anzeigen
- Brauchwasser Schnellladung (Zuheizung): sofortige Warmwasserbereitung über den zweiten Wärmeerzeuger mit automatischer Abschaltung bei Zieltemperatur oder Zeitlimit
- Brauchwasser Schnellladung (Party): gleiche Funktion im Party-Modus
- Thermische Desinfektion: Dauerbetrieb für den Legionellenschutz direkt am Controller (Parameter 27), mit eigenem Thermostat-Schieberegler (50–80 °C) der die Zieltemperatur direkt vom Controller liest und schreibt — automatische Abschaltung bei Erreichen der Zieltemperatur
- Heizung und Warmwasser Statussensoren: detaillierte Statusmeldungen direkt vom Controller
- Verbindungs-Watchdog: überwacht die Abfragen und markiert das Gerät als nicht verfügbar wenn der Controller nicht mehr antwortet; zeigt Zeitpunkt der letzten erfolgreichen Abfrage
- Umfangreiche Flow-Integration: 12 Auslöser, 13 Bedingungen und 11 Aktionen in Homey Flows

Kompatibilität

Luxtronik Wärmepumpen Manager ist mit vielen Luxtronik-basierten Systemen und Herstellern kompatibel, darunter Alpha-Innotec, CTA Aeroheat, Siemens Novelan, Roth ThermoAura, Elco Aquatop, Buderus Logamatic, Nibe AP-AW10 und Wolf Heiztechnik BWL/BWS. Die App nutzt die standardisierten Werte der Luxtronik-Schnittstelle und funktioniert in verschiedenen Anlagenkonfigurationen.

Voraussetzungen

- Lokaler Zugriff auf den Luxtronik-Regler (feste IP-Adresse oder DHCP-Reservierung empfohlen)
- Der Standardport der Luxtronik-Schnittstelle (8889) muss erreichbar sein
- Homey Pro mit Firmware >= 11.0.0

Kurzanleitung zur Installation

Einfaches Einrichten über IP-Adresse und Port — alle Sensorwerte und Steuerfunktionen sind danach sofort in Homey verfügbar. Änderungen an Sollwerten wirken sich direkt auf die Anlage aus — bitte die Betriebsanleitung beachten und lokale Vorschriften einhalten.

Entwicklung

Diese App wurde vollständig mit Unterstützung von Claude (Anthropic AI) entwickelt. Besonderer Dank gilt Robin Flikkema für seine ursprüngliche Luxtronik Homey App, die als Grundlage und Inspiration für dieses Projekt diente.
