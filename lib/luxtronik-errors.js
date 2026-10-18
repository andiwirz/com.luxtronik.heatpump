'use strict';

// Störungscodes des Reglers (Fehlerspeicher, C0095-C0104) mit Kurztext und
// Hinweis in vier Sprachen, dazu die Art der Quittierung, die das Display in
// der zweiten Zeile zeigt.
//
// Übernommen aus der Windows-App desselben Autors (Luxtronik-win-app,
// src/Luxtronik.Core/LuxTexts.cs und Resources/CoreStrings*.resx). Dort
// folgen die deutschen Kurztexte der Luxtronik-Betriebsanleitung (Endkunde
// 83052200d, Fachhandwerker 83052300e), die Hinweise geben das
// Fachhandwerker-Handbuch sinngemäss wieder; 794-807 stammen aus neueren
// Handbüchern (BenPru/luxtronik, docs/error_reason_codes.yaml). Die
// Übersetzungen sind maschinell erstellt und an den Anleitungen ausgerichtet,
// Begriffe können vom Display in der jeweiligen Sprache abweichen.
//
// Die Bibliothek kennt 73 dieser Codes, nur auf Deutsch und in Umschrift
// ("Niederdruckstoerung - Bitte Inst. rufen").

// Quittierung wie in der zweiten Zeile des Displays; hh:mm steht dort für die
// verbleibende Zeit.
const ERROR_RESETS = Object.freeze({
  installer: { de: 'Bitte Inst. rufen', en: 'Please call installer', nl: 'Installateur bellen', fr: 'Appeler Install' },
  automatic: { de: 'RESET automatisch', en: 'Automatic RESET', nl: 'RESET automatisch', fr: 'Réinitial. autom.' },
  automatic_delayed: { de: 'RESET automatisch in hh:mm', en: 'Automatic RESET in hh:mm', nl: 'RESET automatisch over hh:mm', fr: 'Réinitial. autom. en hh:mm' },
  delayed: { de: 'Reset in hh:mm', en: 'Reset in hh:mm', nl: 'Reset over hh:mm', fr: 'Réinitial. en hh:mm' },
});

const ERRORS = Object.freeze({
  701: {
    reset: 'installer',
    text: { de: 'Niederdruckstörung', en: 'Low pressure fault', nl: 'Lagedrukstoring', fr: 'Défaut basse pression' },
    hint: {
      de: 'Niederdruck-Pressostat hat angesprochen. Leckage, Schaltpunkt, Abtauung und TA-min prüfen.',
      en: 'Low-pressure switch has tripped. Check for leaks, switching point, defrost and TA-min.',
      nl: 'Lagedrukpressostaat is aangesproken. Lekkage, schakelpunt, ontdooiing en TA-min controleren.',
      fr: 'Le pressostat basse pression s\'est déclenché. Vérifier fuite, point de commutation, dégivrage et TA-min.',
    },
  },
  702: {
    reset: 'automatic',
    text: { de: 'Niederdrucksperre', en: 'Low pressure lock', nl: 'Lagedrukblokkering', fr: 'Bloc. basse pression' },
    hint: {
      de: 'Nur L/W: Niederdruck hat angesprochen, die Wärmepumpe läuft selbstständig wieder an.',
      en: 'Air/water only: low pressure has tripped; the heat pump restarts automatically.',
      nl: 'Alleen L/W: lage druk is aangesproken, de warmtepomp start vanzelf weer op.',
      fr: 'Air/eau uniquement : la basse pression s\'est déclenchée, la pompe à chaleur redémarre d\'elle-même.',
    },
  },
  703: {
    reset: 'installer',
    text: { de: 'Frostschutz', en: 'Frost protection', nl: 'Vorstbeveiliging', fr: 'Antigel' },
    hint: {
      de: 'Nur L/W: Vorlauf unter 5 °C bei laufender Wärmepumpe. Leistung, Abtauventil und Heizanlage prüfen.',
      en: 'Air/water only: flow below 5 °C while the heat pump is running. Check output, defrost valve and heating system.',
      nl: 'Alleen L/W: aanvoer onder 5 °C bij draaiende warmtepomp. Vermogen, ontdooiklep en verwarmingsinstallatie controleren.',
      fr: 'Air/eau uniquement : départ inférieur à 5 °C avec la pompe à chaleur en marche. Vérifier la puissance, la vanne de dégivrage et l\'installation de chauffage.',
    },
  },
  704: {
    reset: 'delayed',
    text: { de: 'Heissgasstörung', en: 'Hot gas fault', nl: 'Heetgasstoring', fr: 'Défaut gaz chaud' },
    hint: {
      de: 'Max. Heissgastemperatur überschritten. Kältemittelmenge, Verdampfung, Überhitzung und Wärmequelle prüfen.',
      en: 'Max. hot gas temperature exceeded. Check refrigerant charge, evaporation, superheat and heat source.',
      nl: 'Max. heetgastemperatuur overschreden. Hoeveelheid koudemiddel, verdamping, oververhitting en warmtebron controleren.',
      fr: 'Température max. des gaz chauds dépassée. Vérifier la quantité de fluide frigorigène, l\'évaporation, la surchauffe et la source de chaleur.',
    },
  },
  705: {
    reset: 'installer',
    text: { de: 'Motorschutz VEN', en: 'Motor protection VEN', nl: 'Motorbeveiliging VEN', fr: 'Protection moteur VEN' },
    hint: {
      de: 'Nur L/W: Motorschutz des Ventilators hat ausgelöst.',
      en: 'Air/water only: fan motor protection has tripped.',
      nl: 'Alleen L/W: motorbeveiliging van de ventilator is aangesproken.',
      fr: 'Air/eau uniquement : la protection moteur du ventilateur s\'est déclenchée.',
    },
  },
  706: {
    reset: 'installer',
    text: { de: 'Motorschutz BSUP', en: 'Motor protection BSUP', nl: 'Motorbeveiliging BSUP', fr: 'Protection moteur BSUP' },
    hint: {
      de: 'Motorschutz der Sole-/Brunnenpumpe oder des Verdichters hat ausgelöst.',
      en: 'Motor protection of the brine/well pump or the compressor has tripped.',
      nl: 'Motorbeveiliging van de brine-/bronpomp of de compressor is aangesproken.',
      fr: 'La protection moteur de la pompe de puits/d\'eau glycolée ou du compresseur s\'est déclenchée.',
    },
  },
  707: {
    reset: 'installer',
    text: { de: 'Codierung WP', en: 'HP coding', nl: 'Codering WP', fr: 'Codage PAC' },
    hint: {
      de: 'Kodierungsbrücke unterbrochen oder kurzgeschlossen. Kodierwiderstand, Stecker und Leitung prüfen.',
      en: 'Coding jumper open or short-circuited. Check coding resistor, plug and cable.',
      nl: 'Coderingsbrug onderbroken of kortgesloten. Coderingsweerstand, stekker en kabel controleren.',
      fr: 'Pont de codage interrompu ou en court-circuit. Vérifier la résistance de codage, le connecteur et le câble.',
    },
  },
  708: {
    reset: 'installer',
    text: { de: 'Fühler Rücklauf', en: 'Return sensor', nl: 'Voeler retour', fr: 'Sonde retour' },
    hint: {
      de: 'Rücklauffühler defekt. Fühler, Stecker und Leitung prüfen.',
      en: 'Return sensor defective. Check sensor, plug and cable.',
      nl: 'Retourvoeler defect. Voeler, stekker en kabel controleren.',
      fr: 'Sonde retour défectueuse. Vérifier la sonde, le connecteur et le câble.',
    },
  },
  709: {
    reset: 'installer',
    text: { de: 'Fühler Vorlauf', en: 'Flow sensor', nl: 'Voeler aanvoer', fr: 'Sonde départ' },
    hint: {
      de: 'Vorlauffühler defekt. Fühler, Stecker und Leitung prüfen.',
      en: 'Flow sensor defective. Check sensor, plug and cable.',
      nl: 'Aanvoervoeler defect. Voeler, stekker en kabel controleren.',
      fr: 'Sonde départ défectueuse. Vérifier la sonde, le connecteur et le câble.',
    },
  },
  710: {
    reset: 'installer',
    text: { de: 'Fühler Heissgas', en: 'Hot gas sensor', nl: 'Voeler heetgas', fr: 'Sonde gaz chaud' },
    hint: {
      de: 'Heissgasfühler defekt. Fühler, Stecker und Leitung prüfen.',
      en: 'Hot gas sensor defective. Check sensor, plug and cable.',
      nl: 'Heetgasvoeler defect. Voeler, stekker en kabel controleren.',
      fr: 'Sonde gaz chauds défectueuse. Vérifier la sonde, le connecteur et le câble.',
    },
  },
  711: {
    reset: 'installer',
    text: { de: 'Fühler Aussentemp.', en: 'Outside temp. sensor', nl: 'Voeler buitentemp.', fr: 'Sonde extérieure' },
    hint: {
      de: 'Aussenfühler defekt – der Regler rechnet mit −5 °C weiter. Fühler, Stecker und Leitung prüfen.',
      en: 'Outside sensor defective – the controller continues with −5 °C. Check sensor, plug and cable.',
      nl: 'Buitenvoeler defect – de regelaar rekent verder met −5 °C. Voeler, stekker en kabel controleren.',
      fr: 'Sonde extérieure défectueuse – le régulateur continue avec −5 °C. Vérifier la sonde, le connecteur et le câble.',
    },
  },
  712: {
    reset: 'installer',
    text: { de: 'Fühler Warmwasser', en: 'Hot water sensor', nl: 'Voeler warm water', fr: 'Sonde ECS' },
    hint: {
      de: 'Warmwasserfühler defekt. Fühler, Stecker und Leitung prüfen.',
      en: 'Hot water sensor defective. Check sensor, plug and cable.',
      nl: 'Warmwatervoeler defect. Voeler, stekker en kabel controleren.',
      fr: 'Sonde ECS défectueuse. Vérifier la sonde, le connecteur et le câble.',
    },
  },
  713: {
    reset: 'installer',
    text: { de: 'Fühler WQ-Ein', en: 'HS-in sensor', nl: 'Voeler WB-in', fr: 'Sonde SC-On' },
    hint: {
      de: 'Fühler Wärmequelle-Eintritt defekt. Fühler, Stecker und Leitung prüfen.',
      en: 'Heat source inlet sensor defective. Check sensor, plug and cable.',
      nl: 'Voeler warmtebron-intrede defect. Voeler, stekker en kabel controleren.',
      fr: 'Sonde entrée source de chaleur défectueuse. Vérifier la sonde, le connecteur et le câble.',
    },
  },
  714: {
    reset: 'delayed',
    text: { de: 'Heissgas WW', en: 'Hot gas HW', nl: 'Heetgas WW', fr: 'Gaz chaud ECS' },
    hint: {
      de: 'Thermische Einsatzgrenze im Warmwasserbetrieb überschritten, Warmwasser vorübergehend gesperrt.',
      en: 'Thermal operating limit exceeded in hot water mode; hot water temporarily locked.',
      nl: 'Thermische inzetgrens in warmwaterbedrijf overschreden, warm water tijdelijk geblokkeerd.',
      fr: 'Limite d\'utilisation thermique dépassée en production ECS, ECS temporairement bloquée.',
    },
  },
  715: {
    reset: 'automatic',
    text: { de: 'Hochdruck-Abschalt.', en: 'High pressure cut-out', nl: 'Hogedrukuitschak.', fr: 'Arrêt haute pression' },
    hint: {
      de: 'Hochdruck-Pressostat hat angesprochen. Durchfluss Heizwasser, Überströmer und Temperaturen prüfen.',
      en: 'High-pressure switch has tripped. Check heating water flow rate, overflow valve and temperatures.',
      nl: 'Hogedrukpressostaat is aangesproken. Debiet verwarmingswater, overstortventiel en temperaturen controleren.',
      fr: 'Le pressostat haute pression s\'est déclenché. Vérifier le débit d\'eau de chauffage, la soupape différentielle et les températures.',
    },
  },
  716: {
    reset: 'installer',
    text: { de: 'Hochdruckstörung', en: 'High pressure fault', nl: 'Hogedrukstoring', fr: 'Défaut haute pression' },
    hint: {
      de: 'Hochdruck hat mehrfach angesprochen. Wie 715 prüfen.',
      en: 'High pressure has tripped repeatedly. Check as for 715.',
      nl: 'Hoge druk is meermaals aangesproken. Controleren zoals bij 715.',
      fr: 'La haute pression s\'est déclenchée plusieurs fois. Vérifier comme pour 715.',
    },
  },
  717: {
    reset: 'installer',
    text: { de: 'Durchfluss-WQ', en: 'Flow rate HS', nl: 'Debiet-WB', fr: 'Débit SC' },
    hint: {
      de: 'Durchflussschalter Wärmequelle. Durchfluss, Schaltpunkt, Filter und Luftfreiheit prüfen.',
      en: 'Heat source flow switch. Check flow rate, switching point, filter and venting.',
      nl: 'Debietschakelaar warmtebron. Debiet, schakelpunt, filter en ontluchting controleren.',
      fr: 'Contrôleur de débit source de chaleur. Vérifier le débit, le point de commutation, le filtre et la purge d\'air.',
    },
  },
  718: {
    reset: 'automatic_delayed',
    text: { de: 'Max. Aussentemp.', en: 'Max. outside temp.', nl: 'Max. buitentemp.', fr: 'Temp. ext. max.' },
    hint: {
      de: 'Nur L/W: Aussentemperatur über dem Maximalwert. Läuft selbstständig wieder an.',
      en: 'Air/water only: outside temperature above the maximum. Restarts automatically.',
      nl: 'Alleen L/W: buitentemperatuur boven de maximumwaarde. Start vanzelf weer op.',
      fr: 'Air/eau uniquement : température extérieure supérieure à la valeur maximale. Redémarrage automatique.',
    },
  },
  719: {
    reset: 'automatic_delayed',
    text: { de: 'Min. Aussentemp.', en: 'Min. outside temp.', nl: 'Min. buitentemp.', fr: 'Temp. ext. min.' },
    hint: {
      de: 'Nur L/W: Aussentemperatur unter dem Minimalwert. Läuft selbstständig wieder an.',
      en: 'Air/water only: outside temperature below the minimum. Restarts automatically.',
      nl: 'Alleen L/W: buitentemperatuur onder de minimumwaarde. Start vanzelf weer op.',
      fr: 'Air/eau uniquement : température extérieure inférieure à la valeur minimale. Redémarrage automatique.',
    },
  },
  720: {
    reset: 'automatic_delayed',
    text: { de: 'WQ-Temperatur', en: 'HS temperature', nl: 'WB-temperatuur', fr: 'Température SC' },
    hint: {
      de: 'Verdampferaustritt mehrfach unter dem Sicherheitswert. Durchfluss, Filter und Temperaturen prüfen.',
      en: 'Evaporator outlet repeatedly below the safety value. Check flow rate, filter and temperatures.',
      nl: 'Verdamperuitgang meermaals onder de veiligheidswaarde. Debiet, filter en temperaturen controleren.',
      fr: 'Sortie évaporateur plusieurs fois sous la valeur de sécurité. Vérifier le débit, le filtre et les températures.',
    },
  },
  721: {
    reset: 'automatic',
    text: { de: 'Niederdruckabschaltung', en: 'Low pressure cut-out', nl: 'Lagedrukuitschakeling', fr: 'Arrêt basse pression' },
    hint: {
      de: 'Niederdruck hat angesprochen. Schaltpunkt Pressostat und Durchfluss Wärmequelle prüfen.',
      en: 'Low pressure has tripped. Check pressure switch setting and heat source flow rate.',
      nl: 'Lage druk is aangesproken. Schakelpunt pressostaat en debiet warmtebron controleren.',
      fr: 'La basse pression s\'est déclenchée. Vérifier le point de commutation du pressostat et le débit de la source de chaleur.',
    },
  },
  722: {
    reset: 'installer',
    text: { de: 'Tempdiff Heizwasser', en: 'Temp. diff. heating water', nl: 'Temp.verschil CV-water', fr: 'Diff. temp. HW' },
    hint: {
      de: 'Spreizung im Heizbetrieb negativ. Funktion und Platzierung von Vor- und Rücklauffühler prüfen.',
      en: 'Negative temperature spread in heating mode. Check function and position of flow and return sensors.',
      nl: 'Spreiding in verwarmingsbedrijf negatief. Werking en plaatsing van aanvoer- en retourvoeler controleren.',
      fr: 'Écart départ-retour négatif en mode chauffage. Vérifier le fonctionnement et l\'emplacement des sondes départ et retour.',
    },
  },
  723: {
    reset: 'installer',
    text: { de: 'Tempdiff Warmw.', en: 'Temp. diff. hot water', nl: 'Temp.verschil WW', fr: 'Diff. temp. ECS' },
    hint: {
      de: 'Spreizung im Warmwasserbetrieb negativ. Vor- und Rücklauffühler prüfen.',
      en: 'Negative temperature spread in hot water mode. Check flow and return sensors.',
      nl: 'Spreiding in warmwaterbedrijf negatief. Aanvoer- en retourvoeler controleren.',
      fr: 'Écart départ-retour négatif en production ECS. Vérifier les sondes départ et retour.',
    },
  },
  724: {
    reset: 'installer',
    text: { de: 'Tempdiff Abtauen', en: 'Temp. diff. defrost', nl: 'Temp.verschil ontdooien', fr: 'Diff. temp. Abt' },
    hint: {
      de: 'Spreizung beim Abtauen über 15 K (Frostgefahr). Fühler, Heizungspumpe, Überströmer prüfen.',
      en: 'Temperature spread during defrost above 15 K (risk of freezing). Check sensors, heating pump, overflow valve.',
      nl: 'Spreiding bij ontdooien boven 15 K (vorstgevaar). Voelers, verwarmingspomp, overstortventiel controleren.',
      fr: 'Écart départ-retour supérieur à 15 K pendant le dégivrage (risque de gel). Vérifier les sondes, le circulateur chauffage et la soupape différentielle.',
    },
  },
  725: {
    reset: 'installer',
    text: { de: 'Anlagefehler WW', en: 'System error HW', nl: 'Installatiefout WW', fr: 'Défaut installation ECS' },
    hint: {
      de: 'Speichertemperatur weit unterschritten. Warmwasserpumpe, Speicherfüllung und Umschaltventil prüfen.',
      en: 'Tank temperature far below set point. Check hot water pump, tank filling and diverter valve.',
      nl: 'Boilertemperatuur ver onderschreden. Warmwaterpomp, vulling van de boiler en omschakelklep controleren.',
      fr: 'Température du ballon nettement trop basse. Vérifier le circulateur ECS, le remplissage du ballon et la vanne d\'inversion.',
    },
  },
  726: {
    reset: 'installer',
    text: { de: 'Fühler Mischkreis 1', en: 'Mixing circuit 1 sensor', nl: 'Voeler mengkring 1', fr: 'Sonde Mél 1' },
    hint: {
      de: 'Mischkreisfühler defekt. Fühler, Stecker und Leitung prüfen.',
      en: 'Mixing circuit sensor defective. Check sensor, plug and cable.',
      nl: 'Mengkringvoeler defect. Voeler, stekker en kabel controleren.',
      fr: 'Sonde circuit mélangeur défectueuse. Vérifier la sonde, le connecteur et le câble.',
    },
  },
  727: {
    reset: 'installer',
    text: { de: 'Soledruck', en: 'Brine pressure', nl: 'Brinedruk', fr: 'Pression eau glyc.' },
    hint: {
      de: 'Soledruck-Pressostat hat angesprochen. Soledruck prüfen.',
      en: 'Brine pressure switch has tripped. Check brine pressure.',
      nl: 'Brinedrukpressostaat is aangesproken. Brinedruk controleren.',
      fr: 'Le pressostat d\'eau glycolée s\'est déclenché. Vérifier la pression d\'eau glycolée.',
    },
  },
  728: {
    reset: 'installer',
    text: { de: 'Fühler WQ-Aus', en: 'HS-out sensor', nl: 'Voeler WB-uit', fr: 'Sonde SC-Off' },
    hint: {
      de: 'Fühler Wärmequelle-Austritt defekt. Fühler, Stecker und Leitung prüfen.',
      en: 'Heat source outlet sensor defective. Check sensor, plug and cable.',
      nl: 'Voeler warmtebron-uittrede defect. Voeler, stekker en kabel controleren.',
      fr: 'Sonde sortie source de chaleur défectueuse. Vérifier la sonde, le connecteur et le câble.',
    },
  },
  729: {
    reset: 'installer',
    text: { de: 'Drehfeldfehler', en: 'Phase sequence error', nl: 'Draaiveldfout', fr: 'Erreur compresseur' },
    hint: {
      de: 'Verdichter ohne Leistung. Drehfeld und Verdichter prüfen.',
      en: 'Compressor without output. Check phase sequence and compressor.',
      nl: 'Compressor zonder vermogen. Draaiveld en compressor controleren.',
      fr: 'Compresseur sans puissance. Vérifier l\'ordre des phases et le compresseur.',
    },
  },
  730: {
    reset: 'installer',
    text: { de: 'Leistung Ausheizen', en: 'Output screed drying', nl: 'Vermogen droogstoken', fr: 'Puissance séchage' },
    hint: {
      de: 'Das Ausheizprogramm erreicht die Vorlaufstufe nicht (läuft weiter).',
      en: 'The screed drying program does not reach the flow temperature step (keeps running).',
      nl: 'Het droogstookprogramma bereikt de aanvoertemperatuur van de stap niet (loopt door).',
      fr: 'Le programme de séchage n\'atteint pas le palier de température départ (il continue).',
    },
  },
  731: {
    reset: null,
    text: { de: 'Zeitüberschreitung TDI', en: 'Timeout TDI', nl: 'Time-out TDI', fr: 'Dépassement de temps TDI' },
    hint: {
      de: 'Die Desinfektionstemperatur wurde innerhalb der Schaltzeiten nicht erreicht. Zweiten Wärmeerzeuger und Schaltzeiten prüfen.',
      en: 'The disinfection temperature was not reached within the switching times. Check the second heat generator and the switching times.',
      nl: 'De desinfectietemperatuur is binnen de schakeltijden niet bereikt. Tweede warmteopwekker en schakeltijden controleren.',
      fr: 'La température de désinfection n\'a pas été atteinte dans les plages horaires. Vérifier le deuxième générateur de chaleur et les horaires.',
    },
  },
  732: {
    reset: 'installer',
    text: { de: 'Störung Kühlung', en: 'Cooling fault', nl: 'Storing koeling', fr: 'Défaut rafraîchissement' },
    hint: {
      de: 'Heizwasser mehrfach unter 16 °C. Mischer und Heizungspumpe prüfen.',
      en: 'Heating water repeatedly below 16 °C. Check mixer and heating pump.',
      nl: 'Verwarmingswater meermaals onder 16 °C. Mengklep en verwarmingspomp controleren.',
      fr: 'Eau de chauffage plusieurs fois sous 16 °C. Vérifier le mélangeur et le circulateur chauffage.',
    },
  },
  733: {
    reset: 'installer',
    text: { de: 'Störung Anode', en: 'Anode fault', nl: 'Storing anode', fr: 'Défaut anode' },
    hint: {
      de: 'Störeingang Fremdstromanode. Anodenleitung prüfen, Warmwasserspeicher füllen.',
      en: 'Fault input impressed-current anode. Check anode cable, fill hot water tank.',
      nl: 'Storingsingang externe-stroomanode. Anodekabel controleren, warmwaterboiler vullen.',
      fr: 'Entrée défaut de l\'anode à courant imposé. Vérifier le câble d\'anode, remplir le ballon ECS.',
    },
  },
  734: {
    reset: 'installer',
    text: { de: 'Störung Anode', en: 'Anode fault', nl: 'Storing anode', fr: 'Défaut anode' },
    hint: {
      de: 'Störung 733 besteht seit über 2 Wochen, Warmwasser gesperrt.',
      en: 'Fault 733 has persisted for more than 2 weeks; hot water locked.',
      nl: 'Storing 733 bestaat al meer dan 2 weken, warm water geblokkeerd.',
      fr: 'Le défaut 733 persiste depuis plus de 2 semaines, ECS bloquée.',
    },
  },
  735: {
    reset: 'installer',
    text: { de: 'Fühler Ext. En', en: 'Ext. en. sensor', nl: 'Voeler ext. en.', fr: 'Sonde ext. En' },
    hint: {
      de: 'Fühler externe Energiequelle defekt. Fühler, Stecker und Leitung prüfen.',
      en: 'External energy source sensor defective. Check sensor, plug and cable.',
      nl: 'Voeler externe energiebron defect. Voeler, stekker en kabel controleren.',
      fr: 'Sonde source d\'énergie externe défectueuse. Vérifier la sonde, le connecteur et le câble.',
    },
  },
  736: {
    reset: 'installer',
    text: { de: 'Fühler Solarkollektor', en: 'Solar collector sensor', nl: 'Voeler zonnecollector', fr: 'Sonde collecteur solaire' },
    hint: {
      de: 'Solarkollektorfühler defekt. Fühler, Stecker und Leitung prüfen.',
      en: 'Solar collector sensor defective. Check sensor, plug and cable.',
      nl: 'Zonnecollectorvoeler defect. Voeler, stekker en kabel controleren.',
      fr: 'Sonde capteur solaire défectueuse. Vérifier la sonde, le connecteur et le câble.',
    },
  },
  737: {
    reset: 'installer',
    text: { de: 'Fühler Solarspeicher', en: 'Solar tank sensor', nl: 'Voeler zonneboiler', fr: 'Sonde cuve solaire' },
    hint: {
      de: 'Solarspeicherfühler defekt. Fühler, Stecker und Leitung prüfen.',
      en: 'Solar tank sensor defective. Check sensor, plug and cable.',
      nl: 'Zonneboilervoeler defect. Voeler, stekker en kabel controleren.',
      fr: 'Sonde ballon solaire défectueuse. Vérifier la sonde, le connecteur et le câble.',
    },
  },
  738: {
    reset: 'installer',
    text: { de: 'Fühler Mischkreis2', en: 'Mixing circuit 2 sensor', nl: 'Voeler mengkring2', fr: 'Sonde circuit mélangeur 2' },
    hint: {
      de: 'Fühler Mischkreis 2 defekt. Fühler, Stecker und Leitung prüfen.',
      en: 'Mixing circuit 2 sensor defective. Check sensor, plug and cable.',
      nl: 'Voeler mengkring 2 defect. Voeler, stekker en kabel controleren.',
      fr: 'Sonde circuit mélangeur 2 défectueuse. Vérifier la sonde, le connecteur et le câble.',
    },
  },
  739: {
    reset: 'installer',
    text: { de: 'Fühler Mischkreis3', en: 'Mixing circuit 3 sensor', nl: 'Voeler mengkring3', fr: 'Sonde circuit mélangeur 3' },
    hint: {
      de: 'Fühler Mischkreis 3 defekt (nur mit Erweiterungsplatine). Fühler, Stecker und Leitung prüfen.',
      en: 'Mixing circuit 3 sensor defective (expansion board only). Check sensor, plug and cable.',
      nl: 'Voeler mengkring 3 defect (alleen met uitbreidingsprint). Voeler, stekker en kabel controleren.',
      fr: 'Sonde circuit mélangeur 3 défectueuse (uniquement avec carte d\'extension). Vérifier la sonde, le connecteur et le câble.',
    },
  },
  750: {
    reset: 'installer',
    text: { de: 'Fühler Rücklauf extern', en: 'External return sensor', nl: 'Voeler retour extern', fr: 'Sonde retour ext.' },
    hint: {
      de: 'Externer Rücklauffühler defekt. Fühler, Stecker und Leitung prüfen.',
      en: 'External return sensor defective. Check sensor, plug and cable.',
      nl: 'Externe retourvoeler defect. Voeler, stekker en kabel controleren.',
      fr: 'Sonde retour externe défectueuse. Vérifier la sonde, le connecteur et le câble.',
    },
  },
  751: {
    reset: null,
    text: { de: 'Phasenüberwachungsfehler', en: 'Phase monitoring error', nl: 'Fasebewakingsfout', fr: 'Défaut de rotation de phase' },
    hint: {
      de: 'Phasenfolgerelais hat ausgelöst. Drehfeld prüfen.',
      en: 'Phase sequence relay has tripped. Check phase sequence.',
      nl: 'Fasevolgorderelais is aangesproken. Draaiveld controleren.',
      fr: 'Le relais de contrôle des phases s\'est déclenché. Vérifier l\'ordre des phases.',
    },
  },
  752: {
    reset: null,
    text: { de: 'Phasenüberwachungs / Durchflussfehler', en: 'Phase monitoring / flow error', nl: 'Fasebewakings- / debietfout', fr: 'Erreur de débit' },
    hint: {
      de: 'Phasenfolgerelais oder Durchflussschalter, siehe 751 und 717.',
      en: 'Phase sequence relay or flow switch, see 751 and 717.',
      nl: 'Fasevolgorderelais of debietschakelaar, zie 751 en 717.',
      fr: 'Relais de contrôle des phases ou contrôleur de débit, voir 751 et 717.',
    },
  },
  755: {
    reset: 'installer',
    text: { de: 'Verbindung zu Slave verloren', en: 'Connection to slave lost', nl: 'Verbinding met slave verloren', fr: 'Perte de connexion avec l\'esclave' },
    hint: {
      de: 'Slave antwortet seit über 5 Minuten nicht. Netzwerk, Switch und IP-Adressen prüfen.',
      en: 'Slave has not responded for more than 5 minutes. Check network, switch and IP addresses.',
      nl: 'Slave antwoordt al meer dan 5 minuten niet. Netwerk, switch en IP-adressen controleren.',
      fr: 'L\'esclave ne répond plus depuis plus de 5 minutes. Vérifier le réseau, le switch et les adresses IP.',
    },
  },
  756: {
    reset: 'installer',
    text: { de: 'Verbindung zu Master verloren', en: 'Connection to master lost', nl: 'Verbinding met master verloren', fr: 'Perte de connexion avec le maître' },
    hint: {
      de: 'Master antwortet seit über 5 Minuten nicht. Netzwerk, Switch und IP-Adressen prüfen.',
      en: 'Master has not responded for more than 5 minutes. Check network, switch and IP addresses.',
      nl: 'Master antwoordt al meer dan 5 minuten niet. Netwerk, switch en IP-adressen controleren.',
      fr: 'Le maître ne répond plus depuis plus de 5 minutes. Vérifier le réseau, le switch et les adresses IP.',
    },
  },
  757: {
    reset: null,
    text: { de: 'ND-Störung bei WW-Gerät', en: 'LP fault in HW heat pump', nl: 'LD-storing bij WW-toestel', fr: 'Panne basse pression appareil eau chaude' },
    hint: {
      de: 'Niederdruck-Pressostat. Nach 3 Störungen Freigabe nur durch den Kundendienst.',
      en: 'Low-pressure switch. After 3 faults, release by customer service only.',
      nl: 'Lagedrukpressostaat. Na 3 storingen vrijgave alleen door de servicedienst.',
      fr: 'Pressostat basse pression. Après 3 défauts, réarmement uniquement par le service après-vente.',
    },
  },
  758: {
    reset: null,
    text: { de: 'Störung Abtauung', en: 'Defrost fault', nl: 'Storing ontdooiing', fr: 'Dysfonction dégivrage' },
    hint: {
      de: 'Abtauung 5× wegen zu niedriger Vorlauftemperatur beendet. Durchfluss und Vorlauffühler prüfen.',
      en: 'Defrost ended 5× due to low flow temperature. Check flow rate and flow sensor.',
      nl: 'Ontdooiing 5× beëindigd wegens te lage aanvoertemperatuur. Debiet en aanvoervoeler controleren.',
      fr: 'Dégivrage interrompu 5× pour cause de température départ trop basse. Vérifier le débit et la sonde départ.',
    },
  },
  759: {
    reset: null,
    text: { de: 'Meldung TDI', en: 'TDI message', nl: 'Melding TDI', fr: 'Message désinfect.' },
    hint: {
      de: 'Thermische Desinfektion 3× nicht korrekt. Zweiten Wärmeerzeuger und STB prüfen.',
      en: 'Thermal disinfection failed 3×. Check second heat generator and STB.',
      nl: 'Thermische desinfectie 3× niet correct. Tweede warmteopwekker en STB controleren.',
      fr: 'Désinfection thermique 3× incorrecte. Vérifier le deuxième générateur de chaleur et le STB.',
    },
  },
  760: {
    reset: null,
    text: { de: 'Störung Abtauung', en: 'Defrost fault', nl: 'Storing ontdooiing', fr: 'Dysfonction dégivrage' },
    hint: {
      de: 'Abtauung 5× über die Maximalzeit (z. B. starker Wind). Verdampfer vor Wind schützen.',
      en: 'Defrost exceeded the maximum time 5× (e.g. strong wind). Protect the evaporator from wind.',
      nl: 'Ontdooiing 5× langer dan de maximale tijd (bijv. harde wind). Verdamper tegen wind beschermen.',
      fr: 'Dégivrage 5× au-delà de la durée maximale (p. ex. vent fort). Protéger l\'évaporateur du vent.',
    },
  },
  761: {
    reset: null,
    text: { de: 'LIN-Verbindung unterbrochen', en: 'LIN connection interrupted', nl: 'LIN-verbinding onderbroken', fr: 'Connexion LIN perdue' },
    hint: {
      de: 'LIN-Timeout. Kabel und Kontakte prüfen.',
      en: 'LIN timeout. Check cable and contacts.',
      nl: 'LIN-time-out. Kabel en contacten controleren.',
      fr: 'Délai LIN dépassé. Vérifier le câble et les contacts.',
    },
  },
  762: {
    reset: null,
    text: { de: 'Fühler Ansaug Verdichter', en: 'Compressor suction sensor', nl: 'Voeler aanzuig compressor', fr: 'Capteur aspiration compresseur' },
    hint: {
      de: 'Fühlerfehler Ansaugtemperatur Verdichter.',
      en: 'Sensor error compressor suction temperature.',
      nl: 'Voelerfout aanzuigtemperatuur compressor.',
      fr: 'Défaut du capteur de température d\'aspiration compresseur.',
    },
  },
  763: {
    reset: null,
    text: { de: 'Fühler Ansaug-Verdampfer', en: 'Evaporator suction sensor', nl: 'Voeler aanzuig verdamper', fr: 'Capteur aspiration évaporateur' },
    hint: {
      de: 'Fühlerfehler Ansaugtemperatur Verdampfer.',
      en: 'Sensor error evaporator suction temperature.',
      nl: 'Voelerfout aanzuigtemperatuur verdamper.',
      fr: 'Défaut du capteur de température d\'aspiration évaporateur.',
    },
  },
  764: {
    reset: null,
    text: { de: 'Fühler Verdichterheizung', en: 'Compressor heating sensor', nl: 'Voeler compressorverwarming', fr: 'Capteur chauffage de compresseur' },
    hint: {
      de: 'Fühler der Verdichterheizung defekt.',
      en: 'Compressor heating sensor defective.',
      nl: 'Voeler van de compressorverwarming defect.',
      fr: 'Capteur du chauffage de compresseur défectueux.',
    },
  },
  765: {
    reset: null,
    text: { de: 'Überhitzung', en: 'Superheat', nl: 'Oververhitting', fr: 'Surchauffe' },
    hint: {
      de: 'Über 5 Minuten unter 2 K. Bei Ersteinschaltung Drehfeld prüfen, sonst Kundendienst.',
      en: 'Below 2 K for more than 5 minutes. On first start-up check phase sequence, otherwise contact customer service.',
      nl: 'Meer dan 5 minuten onder 2 K. Bij eerste inschakeling draaiveld controleren, anders servicedienst.',
      fr: 'Plus de 5 minutes sous 2 K. À la première mise en service, vérifier l\'ordre des phases, sinon contacter le service après-vente.',
    },
  },
  766: {
    reset: null,
    text: { de: 'Einsatzgrenzen-VD', en: 'Comp. operating limits', nl: 'Inzetgrenzen-VD', fr: 'Limite de fonctionnement' },
    hint: {
      de: '5 Minuten ausserhalb des Einsatzbereichs. Drehfeld prüfen.',
      en: '5 minutes outside the operating range. Check phase sequence.',
      nl: '5 minuten buiten het inzetbereik. Draaiveld controleren.',
      fr: '5 minutes hors de la plage d\'utilisation. Vérifier l\'ordre des phases.',
    },
  },
  767: {
    reset: null,
    text: { de: 'STB E-Stab', en: 'STB heating element', nl: 'STB E-element', fr: 'STB résistance électrique' },
    hint: {
      de: 'Sicherheitstemperaturbegrenzer des Heizstabs hat ausgelöst.',
      en: 'Safety temperature limiter of the heating element has tripped.',
      nl: 'Veiligheidstemperatuurbegrenzer van het elektrische verwarmingselement is aangesproken.',
      fr: 'Le limiteur de température de sécurité de la résistance électrique s\'est déclenché.',
    },
  },
  768: {
    reset: null,
    text: { de: 'Durchflussüberwachung', en: 'Flow monitoring', nl: 'Debietbewaking', fr: 'Surveillance du débit' },
    hint: {
      de: 'Zu geringer Durchfluss bei der Abtauung. Hydraulik, Pumpe und Durchfluss prüfen.',
      en: 'Insufficient flow during defrosting. Check hydraulics, pump and flow.',
      nl: 'Te laag debiet tijdens het ontdooien. Hydrauliek, pomp en debiet controleren.',
      fr: 'Débit insuffisant pendant le dégivrage. Vérifier l\'hydraulique, la pompe et le débit.',
    },
  },
  769: {
    reset: null,
    text: { de: 'Pumpenansteuerung', en: 'Pump control', nl: 'Pompaansturing', fr: 'Commande de pompe' },
    hint: {
      de: 'Kein gültiges Durchflusssignal der Umwälzpumpe nach 10 s Verdichterlauf. PWM-Kabel und Pumpe prüfen.',
      en: 'No valid flow signal from the circulation pump after 10 s of compressor operation. Check PWM cable and pump.',
      nl: 'Geen geldig debietsignaal van de circulatiepomp na 10 s compressorbedrijf. PWM-kabel en pomp controleren.',
      fr: 'Aucun signal de débit valable du circulateur après 10 s de fonctionnement du compresseur. Vérifier le câble PWM et la pompe.',
    },
  },
  770: {
    reset: null,
    text: { de: 'Niedrige Überhitzung', en: 'Low superheat', nl: 'Lage oververhitting', fr: 'Surchauffe mini' },
    hint: {
      de: 'Länger unter dem Grenzwert. Fühler, Drucksensor und Expansionsventil prüfen.',
      en: 'Below the limit for a prolonged time. Check sensors, pressure sensor and expansion valve.',
      nl: 'Langere tijd onder de grenswaarde. Voeler, druksensor en expansieventiel controleren.',
      fr: 'Longtemps sous la valeur limite. Vérifier la sonde, le capteur de pression et le détendeur.',
    },
  },
  771: {
    reset: null,
    text: { de: 'Hohe Überhitzung', en: 'High superheat', nl: 'Hoge oververhitting', fr: 'Surchauffe maxi' },
    hint: {
      de: 'Länger über dem Grenzwert. Fühler, Drucksensor, Expansionsventil und Füllmenge prüfen.',
      en: 'Above the limit for a prolonged time. Check sensors, pressure sensor, expansion valve and refrigerant charge.',
      nl: 'Langere tijd boven de grenswaarde. Voeler, druksensor, expansieventiel en vulhoeveelheid controleren.',
      fr: 'Longtemps au-dessus de la valeur limite. Vérifier la sonde, le capteur de pression, le détendeur et la charge de fluide.',
    },
  },
  776: {
    reset: null,
    text: { de: 'Einsatzgrenzen-VD', en: 'Comp. operating limits', nl: 'Inzetgrenzen-VD', fr: 'Limite de fonctionnement' },
    hint: {
      de: 'Verdichter länger ausserhalb der Einsatzgrenzen.',
      en: 'Compressor outside the operating limits for a prolonged time.',
      nl: 'Compressor langere tijd buiten de inzetgrenzen.',
      fr: 'Compresseur longtemps hors des limites d\'utilisation.',
    },
  },
  777: {
    reset: null,
    text: { de: 'Expansionsventil', en: 'Expansion valve', nl: 'Expansieventiel', fr: 'Détendeur' },
    hint: {
      de: 'Expansionsventil defekt. Ventil und Kabel prüfen.',
      en: 'Expansion valve defective. Check valve and cable.',
      nl: 'Expansieventiel defect. Ventiel en kabel controleren.',
      fr: 'Détendeur défectueux. Vérifier la vanne et le câble.',
    },
  },
  778: {
    reset: null,
    text: { de: 'Fühler Niederdruck', en: 'Low pressure sensor', nl: 'Voeler lage druk', fr: 'Capteur basse pression' },
    hint: {
      de: 'Sensor, Stecker und Leitung prüfen.',
      en: 'Check sensor, plug and cable.',
      nl: 'Sensor, stekker en kabel controleren.',
      fr: 'Vérifier le capteur, le connecteur et le câble.',
    },
  },
  779: {
    reset: null,
    text: { de: 'Fühler Hochdruck', en: 'High pressure sensor', nl: 'Voeler hoge druk', fr: 'Capteur haute pression' },
    hint: {
      de: 'Sensor, Stecker und Leitung prüfen.',
      en: 'Check sensor, plug and cable.',
      nl: 'Sensor, stekker en kabel controleren.',
      fr: 'Vérifier le capteur, le connecteur et le câble.',
    },
  },
  780: {
    reset: null,
    text: { de: 'Fühler EVI', en: 'EVI sensor', nl: 'Voeler EVI', fr: 'Capteur EVI' },
    hint: {
      de: 'Sensor, Stecker und Leitung prüfen.',
      en: 'Check sensor, plug and cable.',
      nl: 'Sensor, stekker en kabel controleren.',
      fr: 'Vérifier le capteur, le connecteur et le câble.',
    },
  },
  781: {
    reset: null,
    text: { de: 'Fühler Flüssig, vor Ex-Ventil', en: 'Liquid sensor before exp. valve', nl: 'Voeler vloeistof, vóór exp.-ventiel', fr: 'Capteur liquide avant détendeur' },
    hint: {
      de: 'Sensor, Stecker und Leitung prüfen.',
      en: 'Check sensor, plug and cable.',
      nl: 'Sensor, stekker en kabel controleren.',
      fr: 'Vérifier le capteur, le connecteur et le câble.',
    },
  },
  782: {
    reset: null,
    text: { de: 'Fühler EVI Sauggas', en: 'EVI suction gas sensor', nl: 'Voeler EVI zuiggas', fr: 'Capteur EVI aspiration' },
    hint: {
      de: 'Sensor, Stecker und Leitung prüfen.',
      en: 'Check sensor, plug and cable.',
      nl: 'Sensor, stekker en kabel controleren.',
      fr: 'Vérifier le capteur, le connecteur et le câble.',
    },
  },
  783: {
    reset: null,
    text: { de: 'Kommunikation SEC - Inverter', en: 'Communication SEC - inverter', nl: 'Communicatie SEC - inverter', fr: 'Communication SEC - inverter' },
    hint: {
      de: 'Kommunikation gestört. Kabel und Verkabelung prüfen.',
      en: 'Communication fault. Check cables and wiring.',
      nl: 'Communicatie gestoord. Kabel en bekabeling controleren.',
      fr: 'Communication perturbée. Vérifier les câbles et le câblage.',
    },
  },
  784: {
    reset: null,
    text: { de: 'VSS gesperrt', en: 'VSS locked', nl: 'VSS geblokkeerd', fr: 'VSS bloqué' },
    hint: {
      de: 'Inverter gesperrt. Anlage 2 Minuten spannungslos schalten.',
      en: 'Inverter locked. Disconnect the system from power for 2 minutes.',
      nl: 'Inverter geblokkeerd. Installatie 2 minuten spanningsloos maken.',
      fr: 'Inverter bloqué. Mettre l\'installation hors tension pendant 2 minutes.',
    },
  },
  785: {
    reset: null,
    text: { de: 'SEC-Board defekt', en: 'SEC board defective', nl: 'SEC-board defect', fr: 'SEC-Board défectueux' },
    hint: {
      de: 'SEC-Board muss getauscht werden.',
      en: 'SEC board must be replaced.',
      nl: 'SEC-board moet worden vervangen.',
      fr: 'La carte SEC doit être remplacée.',
    },
  },
  786: {
    reset: null,
    text: { de: 'Kommunikation SEC - Inverter', en: 'Communication SEC - inverter', nl: 'Communicatie SEC - inverter', fr: 'Communication SEC - inverter' },
    hint: {
      de: 'Kommunikation SEC ↔ HZ/IO gestört. Kabel prüfen.',
      en: 'Communication SEC ↔ HZ/IO faulty. Check cable.',
      nl: 'Communicatie SEC ↔ HZ/IO gestoord. Kabel controleren.',
      fr: 'Communication SEC ↔ HZ/IO perturbée. Vérifier le câble.',
    },
  },
  787: {
    reset: null,
    text: { de: 'VD Alarm', en: 'Compressor alarm', nl: 'VD-alarm', fr: 'Défaut compresseur' },
    hint: {
      de: 'Der Verdichter meldet einen Fehler. Quittieren; bei Wiederholung Kundendienst.',
      en: 'The compressor reports an error. Acknowledge it; if it recurs, contact customer service.',
      nl: 'De compressor meldt een fout. Bevestigen; bij herhaling servicedienst.',
      fr: 'Le compresseur signale un défaut. Acquitter ; si le défaut se répète, contacter le service après-vente.',
    },
  },
  788: {
    reset: null,
    text: { de: 'Schwerw. Inverter Fehler', en: 'Severe inverter error', nl: 'Ernst. inverterfout', fr: 'Défaut inverter' },
    hint: {
      de: 'Inverter prüfen.',
      en: 'Check inverter.',
      nl: 'Inverter controleren.',
      fr: 'Vérifier l\'inverter.',
    },
  },
  789: {
    reset: null,
    text: { de: 'LIN/Kodierung nicht vorhanden', en: 'LIN/coding not present', nl: 'LIN/codering niet aanwezig', fr: 'Codage LIN introuvable' },
    hint: {
      de: 'Keine Kodierung erkannt. LIN-Kabel und Kodierwiderstand prüfen.',
      en: 'No coding detected. Check LIN cable and coding resistor.',
      nl: 'Geen codering herkend. LIN-kabel en coderingsweerstand controleren.',
      fr: 'Aucun codage détecté. Vérifier le câble LIN et la résistance de codage.',
    },
  },
  790: {
    reset: null,
    text: { de: 'Schwerw. Inverter Fehler', en: 'Severe inverter error', nl: 'Ernst. inverterfout', fr: 'Défaut inverter' },
    hint: {
      de: 'Stromversorgung Inverter/Verdichter prüfen.',
      en: 'Check inverter/compressor power supply.',
      nl: 'Voeding inverter/compressor controleren.',
      fr: 'Vérifier l\'alimentation électrique de l\'inverter/du compresseur.',
    },
  },
  791: {
    reset: null,
    text: { de: 'ModBus Verbindung verloren', en: 'ModBus connection lost', nl: 'ModBus-verbinding verloren', fr: 'Perte connexion Modbus' },
    hint: {
      de: 'SEC-Board nicht erreichbar. ModBus-Kabel prüfen.',
      en: 'SEC board not reachable. Check ModBus cable.',
      nl: 'SEC-board niet bereikbaar. ModBus-kabel controleren.',
      fr: 'Carte SEC injoignable. Vérifier le câble ModBus.',
    },
  },
  792: {
    reset: null,
    text: { de: 'LIN-Verbindung unterbrochen', en: 'LIN connection interrupted', nl: 'LIN-verbinding onderbroken', fr: 'Connexion LIN perdue' },
    hint: {
      de: 'Keine Grundplatine/Konfiguration. Kodierungsstecker prüfen.',
      en: 'No main board/configuration. Check coding plug.',
      nl: 'Geen basisprintplaat/configuratie. Coderingsstekker controleren.',
      fr: 'Pas de carte de base/configuration. Vérifier le connecteur de codage.',
    },
  },
  793: {
    reset: null,
    text: { de: 'Schwerw. Inverter Fehler', en: 'Severe inverter error', nl: 'Ernst. inverterfout', fr: 'Défaut inverter' },
    hint: {
      de: 'Temperaturfehler Inverter – behebt sich selbst.',
      en: 'Inverter temperature error – clears itself.',
      nl: 'Temperatuurfout inverter – verhelpt zichzelf.',
      fr: 'Défaut de température de l\'inverter – disparaît de lui-même.',
    },
  },
  794: {
    reset: null,
    text: { de: 'Überspannung', en: 'Overvoltage', nl: 'Overspanning', fr: 'Surtension' },
    hint: {
      de: 'Überspannung am Inverter. Spannungsversorgung des Inverters prüfen.',
      en: 'Overvoltage at the inverter. Check the inverter\'s power supply.',
      nl: 'Overspanning op de inverter. Voeding van de inverter controleren.',
      fr: 'Surtension sur l\'inverter. Vérifier l\'alimentation de l\'inverter.',
    },
  },
  795: {
    reset: null,
    text: { de: 'Unterspannung', en: 'Undervoltage', nl: 'Onderspanning', fr: 'Sous-tension' },
    hint: {
      de: 'Unterspannung am Inverter. Spannungsversorgung des Inverters prüfen.',
      en: 'Undervoltage at the inverter. Check the inverter\'s power supply.',
      nl: 'Onderspanning op de inverter. Voeding van de inverter controleren.',
      fr: 'Sous-tension sur l\'inverter. Vérifier l\'alimentation de l\'inverter.',
    },
  },
  796: {
    reset: null,
    text: { de: 'Sicherheitsabschaltung', en: 'Safety shutdown', nl: 'Veiligheidsuitschakeling', fr: 'Arrêt de sécurité' },
    hint: {
      de: 'Sicherheitseingang ausgelöst: Inverterstörung oder Hochdruckpressostat (setzt sich selbst zurück) bzw. bei LWDV Spannungsschwankungen (von Hand zurücksetzen). Inverter, Durchfluss, Überströmer und Hochdruckfühler prüfen.',
      en: 'Safety input triggered: inverter fault or high-pressure switch (resets itself), or on LWDV voltage fluctuations (reset manually). Check inverter, flow, overflow valve and high-pressure sensor.',
      nl: 'Veiligheidsingang aangesproken: inverterstoring of hogedrukpressostaat (reset zichzelf) of bij LWDV spanningsschommelingen (handmatig resetten). Inverter, debiet, overstortventiel en hogedrukvoeler controleren.',
      fr: 'Entrée de sécurité déclenchée : défaut de l\'inverter ou pressostat haute pression (réinitialisation automatique), ou sur LWDV variations de tension (réinitialiser manuellement). Vérifier l\'inverter, le débit, la soupape différentielle et la sonde haute pression.',
    },
  },
  797: {
    reset: null,
    text: { de: 'MLRH nicht unterstützt', en: 'MLRH not supported', nl: 'MLRH niet ondersteund', fr: 'MLRH non pris en charge' },
    hint: {
      de: 'Die Heizstabregelung wird nicht unterstützt.',
      en: 'Heating rod control is not supported.',
      nl: 'De regeling van het verwarmingselement wordt niet ondersteund.',
      fr: 'La régulation de la résistance électrique n\'est pas prise en charge.',
    },
  },
  798: {
    reset: 'automatic',
    text: { de: 'ModBus Ventilator', en: 'ModBus fan', nl: 'ModBus ventilator', fr: 'ModBus ventilateur' },
    hint: {
      de: 'Mindestens 10 s keine ModBus-Verbindung zum Ventilator. Verkabelung prüfen.',
      en: 'No ModBus connection to the fan for at least 10 s. Check wiring.',
      nl: 'Minstens 10 s geen ModBus-verbinding met de ventilator. Bekabeling controleren.',
      fr: 'Aucune connexion ModBus avec le ventilateur pendant au moins 10 s. Vérifier le câblage.',
    },
  },
  799: {
    reset: 'automatic',
    text: { de: 'ModBus ASB', en: 'ModBus ASB', nl: 'ModBus ASB', fr: 'ModBus ASB' },
    hint: {
      de: 'Mindestens 10 s keine ModBus-Verbindung zur ASB-Platine. Verkabelung prüfen.',
      en: 'No ModBus connection to the ASB board for at least 10 s. Check wiring.',
      nl: 'Minstens 10 s geen ModBus-verbinding met de ASB-print. Bekabeling controleren.',
      fr: 'Aucune connexion ModBus avec la carte ASB pendant au moins 10 s. Vérifier le câblage.',
    },
  },
  800: {
    reset: null,
    text: { de: 'Enthitzer-Fehler', en: 'Desuperheater error', nl: 'Fout desuperheater', fr: 'Défaut désurchauffeur' },
    hint: {
      de: 'Enthitzer 5-mal in 24 h über 80 °C. Wärme aus dem Enthitzer-Speicher abführen; Neustart, sobald er unter 80 °C liegt.',
      en: 'Desuperheater above 80 °C five times in 24 h. Draw heat from the desuperheater storage; restarts once it is below 80 °C.',
      nl: 'Desuperheater vijf keer in 24 uur boven 80 °C. Warmte uit het desuperheaterbuffer afvoeren; herstart zodra hij onder 80 °C is.',
      fr: 'Désurchauffeur au-dessus de 80 °C cinq fois en 24 h. Évacuer la chaleur du ballon du désurchauffeur ; redémarrage dès qu\'il est sous 80 °C.',
    },
  },
  802: {
    reset: 'automatic',
    text: { de: 'Ventilator Schaltkasten', en: 'Switch box fan', nl: 'Ventilator schakelkast', fr: 'Ventilateur coffret électrique' },
    hint: {
      de: 'Schaltkasten über 80 °C, Neustart unter 70 °C. Ventilator, Kabel, Fühler und Lüftungsöffnungen prüfen.',
      en: 'Switch box above 80 °C, restarts below 70 °C. Check fan, cable, sensor and vents.',
      nl: 'Schakelkast boven 80 °C, herstart onder 70 °C. Ventilator, kabel, voeler en ventilatieopeningen controleren.',
      fr: 'Coffret électrique au-dessus de 80 °C, redémarrage sous 70 °C. Vérifier le ventilateur, le câble, la sonde et les ouvertures d\'aération.',
    },
  },
  803: {
    reset: 'installer',
    text: { de: 'Ventilator Schaltkasten', en: 'Switch box fan', nl: 'Ventilator schakelkast', fr: 'Ventilateur coffret électrique' },
    hint: {
      de: 'Fehler 802 dreimal in 24 h, von Hand zurücksetzen. Ventilator, Kabel, Fühler und Lüftungsöffnungen prüfen.',
      en: 'Error 802 three times in 24 h, reset manually. Check fan, cable, sensor and vents.',
      nl: 'Fout 802 drie keer in 24 uur, handmatig resetten. Ventilator, kabel, voeler en ventilatieopeningen controleren.',
      fr: 'Erreur 802 trois fois en 24 h, réinitialiser manuellement. Vérifier le ventilateur, le câble, la sonde et les ouvertures d\'aération.',
    },
  },
  806: {
    reset: 'automatic',
    text: { de: 'ModBus SEC', en: 'ModBus SEC', nl: 'ModBus SEC', fr: 'ModBus SEC' },
    hint: {
      de: 'Mindestens 10 s keine ModBus-Verbindung zur SEC-Platine. Verkabelung prüfen.',
      en: 'No ModBus connection to the SEC board for at least 10 s. Check wiring.',
      nl: 'Minstens 10 s geen ModBus-verbinding met de SEC-print. Bekabeling controleren.',
      fr: 'Aucune connexion ModBus avec la carte SEC pendant au moins 10 s. Vérifier le câblage.',
    },
  },
  807: {
    reset: 'automatic',
    text: { de: 'ModBus Verbindung verloren', en: 'ModBus connection lost', nl: 'ModBus-verbinding verloren', fr: 'Perte connexion ModBus' },
    hint: {
      de: 'Alle ModBus-Verbindungen zu den Gerätekomponenten mindestens 10 s gestört. Schnittstelle, Kabel und ModBus-Verteiler prüfen.',
      en: 'All ModBus connections to the unit\'s components disrupted for at least 10 s. Check interface, cables and ModBus distributor.',
      nl: 'Alle ModBus-verbindingen met de componenten van het toestel minstens 10 s verstoord. Interface, kabels en ModBus-verdeler controleren.',
      fr: 'Toutes les connexions ModBus avec les composants de l\'appareil perturbées pendant au moins 10 s. Vérifier l\'interface, les câbles et le répartiteur ModBus.',
    },
  },
});

// Für Codes, die keine Tabelle kennt.
const UNKNOWN_ERROR = Object.freeze({ de: 'Unbekannt', en: 'Unknown', nl: 'Onbekend', fr: 'Inconnu' });

module.exports = { ERRORS, ERROR_RESETS, UNKNOWN_ERROR };
