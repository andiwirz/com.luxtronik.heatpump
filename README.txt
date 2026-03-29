Luxtronik Heat Pump Manager connects your Luxtronik-based heat pump (e.g. Alpha-Innotec, CTA, Novelan, Roth, Elco, Buderus, Nibe, Wolf Heiztechnik) with Homey. The app reads all available measurement values from the controller and allows you to use these values in Homey Flows as well as write central control functions directly from Homey.

Features

- Read all values from the Luxtronik controller: temperatures, operating hours, energy values, volume flow, operating states and more
- Thermostat widgets for hot water and heating: set target temperatures and view actual values directly on the device tile
- Hot water boost (Auxiliary Heating): start immediate hot water heating via the second heat source with automatic stop when target temperature is reached or time limit expires
- Hot water boost (Party): same function using Party mode
- Thermal disinfection: enable continuous disinfection mode for legionella protection directly on the controller (parameter 27), auto-stops at configurable target temperature (default 65 °C)
- Heating and hot water status sensors: detailed status strings directly from the controller
- Connection watchdog: monitors polling and marks the device unavailable if the controller stops responding; shows time of last successful poll
- Comprehensive flow integration: 12 triggers, 13 conditions and 11 actions available in Homey Flows

Compatibility

Luxtronik Heat Pump Manager is compatible with many Luxtronik-based systems and heat pump manufacturers, including Alpha-Innotec, CTA Aeroheat, Siemens Novelan, Roth ThermoAura, Elco Aquatop, Buderus Logamatic, Nibe AP-AW10 and Wolf Heiztechnik BWL/BWS. The app uses the standardised values of the Luxtronik interface and works in different system configurations.

Requirements

- Local access to the Luxtronik controller (fixed IP address or DHCP reservation recommended)
- Standard port of the Luxtronik interface (8889) must be reachable
- Homey Pro with firmware >= 11.0.0

Quick Guide for Installation

Simple pairing via IP address and port — all sensor values and control functions are immediately available in Homey afterwards. Changes to target values affect the system directly — please consult the operating manual and observe local regulations.

Development

This app was developed entirely with the help of Claude (Anthropic AI). Special thanks go to Robin Flikkema for his original Luxtronik Homey App, which served as the foundation and inspiration for this project.
