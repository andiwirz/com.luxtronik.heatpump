Luxtronik Wärmepumpen Manager verbindet deine Luxtronik-basierte Wärmepumpe (z. B. Alpha-Innotec, CTA, Novelan, Roth, Elco, Buderus, Nibe, Wolf Heiztechnik) mit Homey. Die App liest alle verfügbaren Messwerte der Steuerung aus und ermöglicht es, diese Werte in Homey Flows zu nutzen sowie zentrale Steuerfunktionen direkt aus Homey heraus zu schreiben.

Funktionen

- Alle von Luxtronik bereitgestellten Werte auslesen (Temperaturen, Betriebsstunden, Energiewerte, Volumenstrom, Betriebszustand und vieles mehr)
- Schreibzugriff auf Betriebsmodi und Sollwerte: Heizungsmodus umschalten, Warmwassermodus umschalten, Solltemperaturen setzen.
- Heizung-Sollwertkorrektur: Korrektur der Heizungs-Solltemperatur im Bereich von -5 °C bis +5 °C
- Flow-Integration: Alle Messwerte und Steuerfunktionen stehen als Auslöser, Bedingungen und Aktionen in Homey Flows zur Verfügung.
- Stabile Verbindung: Unterstützung für lokale IP-Verbindungen zur Wärmepumpe über das luxtronik2 NPM-Paket.

Kompatibilität

Luxtronik Wärmepumpen Manager ist mit vielen Luxtronik-basierten Systemen und Wärmepumpenherstellern kompatibel, darunter häufig eingesetzte Modelle wie Alpha-Innotec, CTA Aeroheat, Siemens Novelan, Roth ThermoAura, Elco Aquatop, Buderus Logamatic, Nibe AP-AW10 und Wolf Heiztechnik BWL/BWS. Die App nutzt die standardisierten Werte der Luxtronik-Schnittstelle und funktioniert daher in verschiedenen Anlagenkonfigurationen.

Voraussetzungen

- Lokaler Zugriff auf den Luxtronik-Regler (feste IP-Adresse oder DHCP-Reservierung empfohlen).
- Der Standardport der Luxtronik-Schnittstelle (8889) muss erreichbar sein.

Kurzanleitung zur Installation

Einfaches Einrichten über IP-Adresse und Port — alle Sensorwerte und Steuerfunktionen sind danach sofort in Homey verfügbar. Änderungen an Sollwerten wirken sich direkt auf die Anlage aus — bitte die Betriebsanleitung beachten und lokale Vorschriften einhalten.

Entwicklung

Diese App wurde vollständig mit Unterstützung von Claude (Anthropic AI) entwickelt. Besonderer Dank gilt Robin Flikkema für seine ursprüngliche Luxtronik Homey App, die als Grundlage und Inspiration für dieses Projekt diente.
