'use strict';

// Benannte Register der Luxtronik-Steuerung.
//
// Die Steuerung liefert drei Blöcke: Berechnungen (Kommando 3004, Messwerte),
// Parameter (3003, Einstellungen) und Visibilities (3005, Sichtbarkeitsflags).
// luxtronik2 spricht sie ausschließlich über feste, im Code verstreute
// Array-Offsets an; diese Tabelle gibt ihnen Namen, damit weitere Werte ohne
// Zahlenraten ergänzt werden können.
//
// Übernommen aus der Home-Assistant-Integration BenPru/luxtronik (MIT):
//   https://github.com/BenPru/luxtronik
//   custom_components/luxtronik2/const.py
//     -> LuxCalculation, LuxParameter, LuxVisibility
//
// Die Schlüssel behalten die dortige Schreibweise inklusive Registernummer,
// damit sich beide Seiten gegeneinander greppen lassen - und weil der Name
// allein nicht eindeutig ist: P0002 und P0105 heißen beide
// DHW_TARGET_TEMPERATURE und bezeichnen verschiedene Register. Der Kommentar
// hinter jedem Eintrag ist der Feldname der Steuerung, für den Abgleich gegen
// Controller-Dumps.
//
// Die Indizes sind stabil; ob ein Gerät ein Register tatsächlich liefert,
// hängt von Modell und Firmware ab und ist beim Lesen zu prüfen - ältere
// Firmware liefert kürzere Blöcke.
//
// Nicht übernommen: LuxVisibility.V0059A_DHW_CHARGING_PUMP - kein echtes
// Register, sondern dort die Umkehrung von V0059.


// Kommando 3004 - Messwerte und Zustände
const CALCULATIONS = Object.freeze({
  C0010_FLOW_IN_TEMPERATURE:                        10, // ID_WEB_Temperatur_TVL
  C0011_FLOW_OUT_TEMPERATURE:                       11, // ID_WEB_Temperatur_TRL
  C0012_FLOW_OUT_TEMPERATURE_TARGET:                12, // ID_WEB_Sollwert_TRL_HZ
  C0013_FLOW_OUT_TEMPERATURE_EXTERNAL:              13, // ID_WEB_Temperatur_TRL_ext
  C0014_HOT_GAS_TEMPERATURE:                        14, // ID_WEB_Temperatur_THG
  C0015_OUTDOOR_TEMPERATURE:                        15, // ID_WEB_Temperatur_TA
  C0016_OUTDOOR_TEMPERATURE_AVERAGE:                16, // ID_WEB_Mitteltemperatur
  C0017_DHW_TEMPERATURE:                            17, // ID_WEB_Temperatur_TBW
  C0019_HEAT_SOURCE_INPUT_TEMPERATURE:              19, // ID_WEB_Temperatur_TWE
  C0020_HEAT_SOURCE_OUTPUT_TEMPERATURE:             20, // ID_WEB_Temperatur_TWA
  C0021_FLOW_IN_CIRCUIT1_TEMPERATURE:               21, // ID_WEB_Temperatur_TFB1
  C0022_FLOW_IN_CIRCUIT1_TARGET_TEMPERATURE:        22, // ID_WEB_Sollwert_TVL_MK1
  C0023_ROOM_STATION_RFV:                           23, // ID_WEB_Temperatur_RFV
  C0024_FLOW_IN_CIRCUIT2_TEMPERATURE:               24, // ID_WEB_Temperatur_TFB2
  C0025_FLOW_IN_CIRCUIT2_TARGET_TEMPERATURE:        25, // ID_WEB_Sollwert_TVL_MK2
  C0026_SOLAR_COLLECTOR_TEMPERATURE:                26, // ID_WEB_Temperatur_TSK
  C0027_SOLAR_BUFFER_TEMPERATURE:                   27, // ID_WEB_Temperatur_TSS
  C0029_DEFROST_END_FLOW_OKAY:                      29, // ID_WEB_ASDin
  C0031_EVU_UNLOCKED:                               31, // ID_WEB_EVUin
  C0033_MOTOR_PROTECTION:                           33, // ID_WEB_MOTin
  C0037_DEFROST_VALVE:                              37, // ID_WEB_AVout
  C0038_DHW_RECIRCULATION_PUMP:                     38, // ID_WEB_BUPout
  C0039_CIRCULATION_PUMP_HEATING:                   39, // ID_WEB_HUPout
  C0043_PUMP_FLOW:                                  43, // ID_WEB_VBOout
  C0044_COMPRESSOR:                                 44, // ID_WEB_VD1out
  C0045_COMPRESSOR2:                                45, // ID_WEB_VD2out
  C0046_DHW_CIRCULATION_PUMP:                       46, // ID_WEB_ZIPout
  C0047_ADDITIONAL_CIRCULATION_PUMP:                47, // ID_WEB_ZUPout
  C0048_ADDITIONAL_HEAT_GENERATOR:                  48, // ID_WEB_ZW1out
  C0049_DISTURBANCE_OUTPUT:                         49, // ID_WEB_ZW2SSTout
  C0052_SOLAR_PUMP:                                 52, // ID_WEB_SLPout
  C0056_COMPRESSOR1_OPERATION_HOURS:                56, // ID_WEB_Zaehler_BetrZeitVD1
  C0057_COMPRESSOR1_IMPULSES:                       57, // ID_WEB_Zaehler_BetrZeitImpVD1
  C0058_COMPRESSOR2_OPERATION_HOURS:                58, // ID_WEB_Zaehler_BetrZeitVD2
  C0059_COMPRESSOR2_IMPULSES:                       59, // ID_WEB_Zaehler_BetrZeitImpVD2
  C0060_ADDITIONAL_HEAT_GENERATOR_OPERATION_HOURS:  60, // ID_WEB_Zaehler_BetrZeitZWE1
  C0061_ADDITIONAL_HEAT_GENERATOR2_OPERATION_HOURS: 61, // ID_WEB_Zaehler_BetrZeitZWE2
  C0063_OPERATION_HOURS:                            63, // ID_WEB_Zaehler_BetrZeitWP
  C0064_OPERATION_HOURS_HEATING:                    64, // ID_WEB_Zaehler_BetrZeitHz
  C0065_OPERATION_HOURS_DHW:                        65, // ID_WEB_Zaehler_BetrZeitBW
  C0066_OPERATION_HOURS_COOLING:                    66, // ID_WEB_Zaehler_BetrZeitKue
  C0067_TIMER_HEATPUMP_ON:                          67, // ID_WEB_Time_WPein_akt
  C0068_TIMER_ADD_HEAT_GENERATOR_ON:                68, // ID_WEB_Time_ZWE1_akt
  C0069_TIMER_SEC_HEAT_GENERATOR_ON:                69, // ID_WEB_Time_ZWE2_akt
  C0070_TIMER_NET_INPUT_DELAY:                      70, // ID_WEB_Timer_EinschVerz
  C0071_TIMER_SCB_OFF:                              71, // ID_WEB_Time_SSPAUS_akt
  C0072_TIMER_SCB_ON:                               72, // ID_WEB_Time_SSPEIN_akt
  C0073_TIMER_COMPRESSOR_OFF:                       73, // ID_WEB_Time_VDStd_akt
  C0074_TIMER_HC_ADD:                               74, // ID_WEB_Time_HRM_akt
  C0075_TIMER_HC_LESS:                              75, // ID_WEB_Time_HRW_akt
  C0076_TIMER_TDI:                                  76, // ID_WEB_Time_LGS_akt
  C0077_TIMER_BLOCK_DHW:                            77, // ID_WEB_Time_SBW_akt
  C0078_MODEL_CODE:                                 78, // ID_WEB_Code_WP_akt
  C0080_STATUS:                                     80, // ID_WEB_WP_BZ_akt
  C0081_FIRMWARE_VERSION:                           81, // ID_WEB_SoftStand
  C0095_ERROR_TIME:                                 95, // ID_WEB_ERROR_Time0
  C0100_ERROR_REASON:                               100, // ID_WEB_ERROR_Nr0
  C0117_STATUS_LINE_1:                              117, // ID_WEB_HauptMenuStatus_Zeile1
  C0118_STATUS_LINE_2:                              118, // ID_WEB_HauptMenuStatus_Zeile2
  C0119_STATUS_LINE_3:                              119, // ID_WEB_HauptMenuStatus_Zeile3
  C0120_STATUS_TIME:                                120, // ID_WEB_HauptMenuStatus_Zeit
  C0136_FLOW_IN_CIRCUIT3_TARGET_TEMPERATURE:        136, // ID_WEB_Sollwert_TVL_MK3
  C0137_FLOW_IN_CIRCUIT3_TEMPERATURE:               137, // ID_WEB_Temperatur_TFB3
  C0141_TIMER_DEFROST:                              141, // ID_WEB_Time_AbtIn
  C0146_APPROVAL_COOLING:                           146, // ID_WEB_FreigabKuehl
  C0151_HEAT_AMOUNT_HEATING:                        151, // ID_WEB_WMZ_Heizung
  C0152_DHW_HEAT_AMOUNT:                            152, // ID_WEB_WMZ_Brauchwasser
  C0153_POOL_HEAT_AMOUNT:                           153, // ID_WEB_WMZ_Schwimmbad
  C0154_HEAT_AMOUNT_COUNTER:                        154, // ID_WEB_WMZ_Seit
  C0155_HEAT_AMOUNT_FLOW_RATE:                      155, // ID_WEB_WMZ_Durchfluss
  C0156_ANALOG_OUT1:                                156, // ID_WEB_AnalogOut1
  C0157_ANALOG_OUT2:                                157, // ID_WEB_AnalogOut2
  C0158_TIMER_HOT_GAS:                              158, // ID_WEB_Time_Heissgas
  C0159_VENTILATION_SUPPLY_AIR_TEMPERATURE:         159, // ID_WEB_Temp_Lueftung_Zuluft
  C0160_VENTILATION_EXHAUST_AIR_TEMPERATURE:        160, // ID_WEB_Temp_Lueftung_Abluft
  C0164_VENTILATION_SUPPLY_FAN:                     164, // ID_WEB_Out_VZU
  C0165_VENTILATION_EXHAUST_FAN:                    165, // ID_WEB_Out_VAB
  C0173_HEAT_SOURCE_FLOW_RATE:                      173, // ID_WEB_Durchfluss_WQ
  C0175_SUCTION_EVAPORATOR_TEMPERATURE:             175, // ID_WEB_LIN_ANSAUG_VERDAMPFER
  C0176_SUCTION_COMPRESSOR_TEMPERATURE:             176, // ID_WEB_LIN_ANSAUG_VERDICHTER
  C0177_COMPRESSOR_HEATING_TEMPERATURE:             177, // ID_WEB_LIN_VDH
  C0178_OVERHEATING_TEMPERATURE:                    178, // ID_WEB_LIN_UH
  C0179_OVERHEATING_TARGET_TEMPERATURE:             179, // ID_WEB_LIN_UH_Soll
  C0180_HIGH_PRESSURE:                              180, // ID_WEB_LIN_HD
  C0181_LOW_PRESSURE:                               181, // ID_WEB_LIN_ND
  C0182_COMPRESSOR_HEATER:                          182, // ID_WEB_LIN_VDH_out
  C0183_PUMP_PWM:                                   183, // ID_WEB_HZIO_PWM
  C0185_EVU2:                                       185, // ID_WEB_HZIO_EVU2
  C0227_ROOM_THERMOSTAT_TEMPERATURE:                227, // ID_WEB_RBE_RT_Ist
  C0228_ROOM_THERMOSTAT_TEMPERATURE_TARGET:         228, // ID_WEB_RBE_RT_Soll
  C0231_PUMP_FREQUENCY:                             231, // ID_WEB_Freq_VD
  C0239_PUMP_FLOW_DELTA_TARGET:                     239, // VBO_Temp_Spread_Soll
  C0240_PUMP_FLOW_DELTA:                            240, // VBO_Temp_Spread_Ist
  C0241_CIRCULATION_PUMP_PWM:                       241, // HUP_PWM
  C0242_CIRCULATION_PUMP_DELTA_TARGET:              242, // HUP_Temp_Spread_Soll
  C0243_CIRCULATION_PUMP_DELTA:                     243, // HUP_Temp_Spread_Ist
  C0257_CURRENT_HEAT_OUTPUT:                        257, // Heat_Output
  C0258_RBE_VERSION:                                258, // RBE_Version
  C0268_CURRENT_POWER_CONSUMPTION:                  268, // Unknown_Calculation_268
});

// Kommando 3003 - Einstellungen (schreibbar)
const PARAMETERS = Object.freeze({
  P0001_HEATING_TARGET_CORRECTION:                         1, // ID_Einst_WK_akt
  P0002_DHW_TARGET_TEMPERATURE:                            2, // ID_Einst_BWS_akt
  P0003_MODE_HEATING:                                      3, // ID_Ba_Hz_akt
  P0004_MODE_DHW:                                          4, // ID_Ba_Bw_akt
  P0006_AWAY_HEATING_ENDDATE:                              6, // ID_SU_FrkdHz
  P0007_AWAY_DHW_ENDDATE:                                  7, // ID_SU_FrkdBw
  P0011_HEATING_CURVE_END_TEMPERATURE:                     11, // ID_Einst_HzHwHKE_akt
  P0012_HEATING_CURVE_PARALLEL_SHIFT_TEMPERATURE:          12, // ID_Einst_HzHKRANH_akt
  P0013_HEATING_CURVE_NIGHT_TEMPERATURE:                   13, // ID_Einst_HzHKRABS_akt
  P0014_HEATING_CURVE_CIRCUIT1_END_TEMPERATURE:            14, // ID_Einst_HzMK1E_akt
  P0015_HEATING_CURVE_CIRCUIT1_PARALLEL_SHIFT_TEMPERATURE: 15, // ID_Einst_HzMK1ANH_akt
  P0016_HEATING_CURVE_CIRCUIT1_NIGHT_TEMPERATURE:          16, // ID_Einst_HzMK1ABS_akt
  P0017_HEATING_FLOW_OUT_TEMPERATURE_TARGET:               17, // ID_Einst_HzFtRl_akt
  P0033_ROOM_THERMOSTAT_TYPE:                              33, // ID_Einst_RFVEinb_akt
  P0042_MIXING_CIRCUIT1_TYPE:                              42, // ID_Einst_MK1Typ_akt
  P0047_DHW_THERMAL_DESINFECTION_TARGET:                   47, // ID_Einst_LGST_akt
  P0049_PUMP_OPTIMIZATION:                                 49, // ID_Einst_Popt_akt
  P0074_DHW_HYSTERESIS:                                    74, // ID_Einst_BWS_Hyst_akt
  P0085_DHW_CHARGING_PUMP:                                 85, // ID_Einst_BWZIP_akt
  P0088_HEATING_HYSTERESIS:                                88, // ID_Einst_HRHyst_akt
  P0089_HEATING_MAX_FLOW_OUT_INCREASE_TEMPERATURE:         89, // ID_Einst_TRErhmax_akt
  P0090_RELEASE_SECOND_HEAT_GENERATOR:                     90, // ID_Einst_ZWEFreig_akt
  P0093_HEAT_SOURCE_INPUT_TEMPERATURE_MIN:                 93, // ID_Einst_TWQmin_akt
  P0103_HEATING_CONTROL_CIRCUIT_MODE:                      103, // ID_Einst_RTyp_akt
  P0105_DHW_TARGET_TEMPERATURE:                            105, // ID_Soll_BWS_akt
  P0108_MODE_COOLING:                                      108, // ID_Einst_BA_Kuehl_akt
  P0110_COOLING_OUTDOOR_TEMP_THRESHOLD:                    110, // ID_Einst_KuehlFreig_akt
  P0111_HEATING_NIGHT_LOWERING_TO_TEMPERATURE:             111, // ID_Einst_TAbsMin_akt
  P0119_MODE_PV:                                           119, // ID_Ba_Sw_akt
  P0122_SOLAR_PUMP_ON_DIFFERENCE_TEMPERATURE:              122, // ID_Einst_TDC_Ein_akt
  P0123_SOLAR_PUMP_OFF_DIFFERENCE_TEMPERATURE:             123, // ID_Einst_TDC_Aus_akt
  P0124_SOLAR_PUMP_OFF_MAX_DIFFERENCE_TEMPERATURE_BOILER:  124, // ID_Einst_TDC_Max_akt
  P0130_MIXING_CIRCUIT2_TYPE:                              130, // ID_Einst_MK2Typ_akt
  P0132_COOLING_TARGET_TEMPERATURE_MK1:                    132, // ID_Sollwert_KuCft1_akt
  P0133_COOLING_TARGET_TEMPERATURE_MK2:                    133, // ID_Sollwert_KuCft2_akt
  P0141_HEATING_CURVE_CIRCUIT2_END_TEMPERATURE:            141, // ID_Einst_HzMK2E_akt
  P0142_HEATING_CURVE_CIRCUIT2_PARALLEL_SHIFT_TEMPERATURE: 142, // ID_Einst_HzMK2ANH_akt
  P0143_HEATING_CURVE_CIRCUIT2_NIGHT_TEMPERATURE:          143, // ID_Einst_HzMK2ABS_akt
  P0149_FLOW_IN_TEMPERATURE_MAX_ALLOWED:                   149, // ID_Einst_TVLmax_akt
  P0155_VENTING_TIME_HOURS:                                155, // ID_Einst_Entl_time_akt
  P0158_VENTING_ACTIVE:                                    158, // ID_Einst_Entl_akt
  P0222_TIMER_PROGRAM_HEATING:                             222, // ID_Einst_SuHkr_akt
  P0405_TIMER_PROGRAM_DHW:                                 405, // ID_Einst_SUBW_akt2
  P0678_VENTING_HUP_ACTIVE:                                678, // ID_Einst_Entl_Typ_0
  P0695_MODE_HZ_MK1:                                       695, // ID_Ba_Hz_MK1_akt
  P0696_MODE_HZ_MK2:                                       696, // ID_Ba_Hz_MK2_akt
  P0699_HEATING_THRESHOLD:                                 699, // ID_Einst_Heizgrenze
  P0700_HEATING_THRESHOLD_TEMPERATURE:                     700, // ID_Einst_Heizgrenze_Temp
  P0716_0720_SWITCHOFF_REASON:                             716, // ID_Switchoff_file_{ID}_0 (716-720, 5 Plätze)
  P0721_0725_SWITCHOFF_TIMESTAMP:                          721, // ID_Switchoff_file_{ID}_1 (721-725, 5 Plätze)
  P0731_AWAY_HEATING_STARTDATE:                            731, // ID_SU_FstdHz
  P0732_AWAY_DHW_STARTDATE:                                732, // ID_SU_FstdBw
  P0774_HEATING_CURVE_CIRCUIT3_END_TEMPERATURE:            774, // ID_Einst_HzMK3E_akt
  P0775_HEATING_CURVE_CIRCUIT3_PARALLEL_SHIFT_TEMPERATURE: 775, // ID_Einst_HzMK3ANH_akt
  P0776_HEATING_CURVE_CIRCUIT3_NIGHT_TEMPERATURE:          776, // ID_Einst_HzMK3ABS_akt
  P0779_MODE_HZ_MK3:                                       779, // ID_Ba_Hz_MK3_akt
  P0780_MIXING_CIRCUIT3_TYPE:                              780, // ID_Einst_MK3Typ_akt
  P0850_COOLING_START_DELAY_HOURS:                         850, // ID_Einst_Kuhl_Zeit_Ein_akt
  P0851_COOLING_STOP_DELAY_HOURS:                          851, // ID_Einst_Kuhl_Zeit_Aus_akt
  P0860_REMOTE_MAINTENANCE:                                860, // ID_Einst_Fernwartung_akt
  P0864_PUMP_OPTIMIZATION_TIME:                            864, // ID_Einst_Popt_Nachlauf_akt
  P0867_EFFICIENCY_PUMP_NOMINAL:                           867, // ID_Einst_Effizienzpumpe_Nominal_akt
  P0868_EFFICIENCY_PUMP_MINIMAL:                           868, // ID_Einst_Effizienzpumpe_Minimal_akt
  P0869_EFFICIENCY_PUMP:                                   869, // ID_Einst_Effizienzpumpe_akt
  P0874_SERIAL_NUMBER:                                     874, // ID_WP_SerienNummer_DATUM
  P0875_SERIAL_NUMBER_MODEL:                               875, // ID_WP_SerienNummer_HEX
  P0881_MODE_SOLAR:                                        881, // ID_Einst_Solar_akt
  P0882_SOLAR_OPERATION_HOURS:                             882, // ID_BSTD_Solar
  P0883_SOLAR_PUMP_MAX_TEMPERATURE_COLLECTOR:              883, // ID_Einst_TDC_Koll_Max_akt
  P0894_VENTILATION_MODE:                                  894, // ID_Einst_BA_Lueftung_akt
  P0895_TIMER_PROGRAM_VENTILATION:                         895, // ID_Einst_SuLuf_akt
  P0960_VENTILATION_STAGE_HUMIDITY_PROTECTION:             960, // ID_Einst_Luf_Feuchteschutz_akt
  P0961_VENTILATION_STAGE_REDUCED:                         961, // ID_Einst_Luf_Reduziert_akt
  P0962_VENTILATION_STAGE_NOMINAL:                         962, // ID_Einst_Luf_Nennlueftung_akt
  P0963_VENTILATION_STAGE_INTENSIVE:                       963, // ID_Einst_Luf_Intensivlueftung_akt
  P0966_COOLING_TARGET_TEMPERATURE_MK3:                    966, // ID_Sollwert_KuCft3_akt
  P0973_MAX_DHW_TEMPERATURE:                               973, // ID_Einst_BW_max
  P0979_HEATING_MIN_FLOW_OUT_TEMPERATURE:                  979, // ID_Einst_Minimale_Ruecklaufsolltemperatur
  P0980_HEATING_ROOM_TEMPERATURE_IMPACT_FACTOR:            980, // ID_RBE_Einflussfaktor_RT_akt
  P0992_RELEASE_TIME_SECOND_HEAT_GENERATOR:                992, // ID_Einst_Freigabe_Zeit_ZWE
  P0993_COOLING_MIN_FLOW_OUT_TEMPERATURE:                  993, // ID_Einst_min_VL_Kuehl
  P1030_SMART_GRID_SWITCH:                                 1030, // ID_Einst_SmartGrid
  P1032_HEATING_MAXIMUM_CIRCULATION_PUMP_SPEED:            1032, // ID_Einst_P155_PumpHeat_Max
  P1033_PUMP_HEAT_CONTROL:                                 1033, // ID_Einst_P155_PumpHeatCtrl
  P1045_DHW_FREQUENCY_CONTROL:                             1045, // ID_Einst_P155_DHW_Freq
  P1059_ADDITIONAL_HEAT_GENERATOR_AMOUNT_COUNTER:          1059, // ID_Waermemenge_ZWE
  P1119_LAST_DEFROST_TIMESTAMP:                            1119, // Unknown_Parameter_1119
  P1120_SMART_GRID_HEATING_REDUCTION:                      1120, // SMART_GRID_HEATING_REDUCTION
  P1121_SMART_GRID_HEATING_INCREASE:                       1121, // SMART_GRID_HEATING_INCREASE
  P1122_SMART_GRID_DHW_INCREASE:                           1122, // SMART_GRID_DHW_INCREASE
  P1135_COOLING_HEAT_AMOUNT:                               1135, // COOLING_HEAT_AMOUNT
  P1136_HEAT_ENERGY_INPUT:                                 1136, // HEAT_ENERGY_INPUT
  P1137_DHW_ENERGY_INPUT:                                  1137, // DHW_ENERGY_INPUT
  P1138_POOL_ENERGY_INPUT:                                 1138, // POOL_ENERGY_INPUT
  P1139_COOLING_ENERGY_INPUT:                              1139, // COOLING_ENERGY_INPUT
  P1140_SECOND_HEAT_GENERATOR_AMOUNT_COUNTER:              1140, // SECOND_HEAT_GENERATOR_AMOUNT_COUNTER
  P1146_EXTRA_DHW_TARGET_TEMPERATURE:                      1146, // Extra_DHW_target_temp
  P1147_EXTRA_DHW_DURATION:                                1147, // Extra_DHW_duration
  P1148_HEATING_TARGET_TEMP_ROOM_THERMOSTAT:               1148, // HEATING_TARGET_TEMP_ROOM_THERMOSTAT
  P1158_POWER_LIMIT_SWITCH:                                1158, // POWER_LIMIT_SWITCH
  P1159_POWER_LIMIT_VALUE:                                 1159, // ELECTRICAL_POWER_LIMIT_VALUE
  P1175_THERMAL_POWER_LIMIT_SWITCH:                        1175, // THERMAL_POWER_LIMIT_SWITCH
  P1176_THERMAL_POWER_LIMIT_HEATING:                       1176, // THERMAL_POWER_LIMIT_HEATING
  P1177_THERMAL_POWER_LIMIT_WATER:                         1177, // THERMAL_POWER_LIMIT_WATER
  P1179_THERMAL_POWER_LIMIT_COOLING:                       1179, // THERMAL_POWER_LIMIT_COOLING
});

// Kommando 3005 - Sichtbarkeitsflags
const VISIBILITIES = Object.freeze({
  V0005_COOLING:                                    5, // ID_Visi_Kuhlung
  V0007_MK1:                                        7, // ID_Visi_MK1
  V0008_MK2:                                        8, // ID_Visi_MK2
  V0023_FLOW_IN_TEMPERATURE:                        23, // ID_Visi_Temp_Vorlauf
  V0024_FLOW_OUT_TEMPERATURE_EXTERNAL:              24, // ID_Visi_Temp_Rucklauf
  V0027_HOT_GAS_TEMPERATURE:                        27, // ID_Visi_Temp_Heissgas
  V0029_DHW_TEMPERATURE:                            29, // ID_Visi_Temp_BW_Ist
  V0038_SOLAR_COLLECTOR:                            38, // ID_Visi_Temp_Solarkoll
  V0039_SOLAR_BUFFER:                               39, // ID_Visi_Temp_Solarsp
  V0041_DEFROST_END_FLOW_OKAY:                      41, // ID_Visi_IN_ASD
  V0043_EVU_IN:                                     43, // ID_Visi_IN_EVU
  V0045_MOTOR_PROTECTION:                           45, // ID_Visi_IN_MOT
  V0049_DEFROST_VALVE:                              49, // ID_Visi_OUT_Abtauventil
  V0050_DHW_RECIRCULATION_PUMP:                     50, // ID_Visi_OUT_BUP
  V0052_CIRCULATION_PUMP_HEATING:                   52, // ID_Visi_OUT_HUP
  V0059_DHW_CIRCULATION_PUMP:                       59, // ID_Visi_OUT_ZIP
  V0060_ADDITIONAL_CIRCULATION_PUMP:                60, // ID_Visi_OUT_ZUP
  V0061_SECOND_HEAT_GENERATOR:                      61, // ID_Visi_OUT_ZWE1
  V0080_COMPRESSOR1_OPERATION_HOURS:                80, // ID_Visi_Bst_BStdVD1
  V0081_COMPRESSOR1_IMPULSES:                       81, // ID_Visi_Bst_ImpVD1
  V0083_COMPRESSOR2_OPERATION_HOURS:                83, // ID_Visi_Bst_BStdVD2
  V0084_COMPRESSOR2_IMPULSES:                       84, // ID_Visi_Bst_ImpVD2
  V0086_ADDITIONAL_HEAT_GENERATOR_OPERATION_HOURS:  86, // ID_Visi_Bst_BStdZWE1
  V0087_ADDITIONAL_HEAT_GENERATOR2_OPERATION_HOURS: 87, // ID_Visi_Bst_BStdZWE2
  V0105_HEAT_SOURCE_INPUT_TEMPERATURE_MIN:          105, // ID_Visi_EinstTemp_TWQmin
  V0121_EVU_LOCKED:                                 121, // ID_Visi_SysEin_EVUSperre
  V0122_ROOM_THERMOSTAT:                            122, // ID_Visi_SysEin_Raumstation
  V0144_PUMP_OPTIMIZATION:                          144, // ID_Visi_SysEin_Pumpenoptim
  V0163_PUMP_VENT_HUP:                              163, // ID_Visi_Enlt_HUP
  V0175_PUMP_VENT_TIMER_H:                          175, // ID_Visi_Enlt_Laufzeit
  V0211_MK3:                                        211, // ID_Visi_MK3
  V0239_EFFICIENCY_PUMP_NOMINAL:                    239, // ID_Visi_SysEin_EffizienzpumpeNom
  V0240_EFFICIENCY_PUMP_MINIMAL:                    240, // ID_Visi_SysEin_EffizienzpumpeMin
  V0248_ANALOG_OUT1:                                248, // ID_Visi_OUT_Analog_1
  V0249_ANALOG_OUT2:                                249, // ID_Visi_OUT_Analog_2
  V0250_SOLAR:                                      250, // ID_Visi_Solar
  V0289_SUCTION_COMPRESSOR_TEMPERATURE:             289, // ID_Visi_LIN_ANSAUG_VERDICHTER
  V0290_COMPRESSOR_HEATING:                         290, // ID_Visi_LIN_VDH
  V0291_OVERHEATING_TEMPERATURE:                    291, // ID_Visi_LIN_UH
  V0292_LIN_PRESSURE:                               292, // ID_Visi_LIN_Druck
  V0310_SUCTION_EVAPORATOR_TEMPERATURE:             310, // ID_Visi_LIN_ANSAUG_VERDAMPFER
  V0324_ADDITIONAL_HEAT_GENERATOR_AMOUNT_COUNTER:   324, // ID_Visi_Waermemenge_ZWE
  V0357_ELECTRICAL_POWER_LIMITATION_SWITCH:         357, // Unknown_Visibility_357
});

module.exports = {
  CALCULATIONS,
  PARAMETERS,
  VISIBILITIES,
};
