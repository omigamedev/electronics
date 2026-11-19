# Electronics learning path for a software developer

**Goal:** build and debug your own boards for RC and robotics (ESP32, Arduino, BLE, I2C/SPI, motors, sensors, batteries), including designing your own PCBs.

**Starting point:** you can read simple schematics, use resistors and Ohm's law. What's missing is the physics: what current actually is and why circuits behave the way they do.

**Pacing:** about 6–9 months at 5–8 h/week. Every phase ends with a small build, because you only really learn electronics by measuring real circuits.

---

## Phase 0 — Tools to buy (week 0)

| Tool | Why | Example |
|---|---|---|
| Decent multimeter | Volts, amps, continuity, diode test | UNI-T UT61E+, Brymen BM235 |
| Bench power supply with current limit | Keeps a short circuit from turning into smoke | Any 30 V / 5 A adjustable supply |
| Logic analyzer, 8 ch | See I2C, SPI and UART traffic | Saleae clone + PulseView (sigrok), or a Saleae Logic 8 |
| Oscilloscope (by Phase 2) | Without one you can't see what's actually happening | Rigol DHO804 / DHO914, Siglent SDS800X HD |
| Temperature-controlled soldering iron | Through-hole now, SMD later | Pinecil, any T12/JBC-clone station |
| Breadboards, jumper wires, component kit | Assorted R/C/diodes/transistors/MOSFETs | — |
| Simulators (free) | Try circuits before you build them | **Falstad** (falstad.com/circuit, animated current flow), **LTspice** |

---

## Phase 1 — The physics: how current really flows (2–3 weeks)

This is the gap you named, so start here. Aim for intuition, not heavy math.

1. **Charge and electric field.** Charges push and pull on each other, and a field is the "map" of that force.
2. **Voltage = energy per unit charge** (potential difference). Voltage is always *between two points*, and "ground" is just the reference point we agreed on.
3. **Current = flow of charge.** Conventional current vs. electron flow. Electron *drift velocity* is mm/s, yet the *signal* travels at close to light speed. Why? The field moves through the whole wire at once (the hose-full-of-marbles model).
4. **Where the energy actually travels.** Energy moves in the fields around the wires, not "inside" the electrons. The Poynting vector, at an intuitive level only.
5. **Resistance at the microscopic level.** Electrons collide with the lattice, which makes heat (P = I²R). Resistivity, wire gauge, and why thin traces get hot.
6. **Conservation laws → Kirchhoff.** KCL (charge is conserved) and KVL (energy is conserved). Every circuit is a *closed loop*, and **current always returns to its source**. This one idea later explains ground loops, ground bounce and PCB return paths.
7. **Capacitance.** Energy stored in an electric field; a capacitor resists *changes in voltage*.
8. **Inductance and magnetism.** A current creates a magnetic field, and a changing field induces a voltage (Faraday/Lenz). An inductor resists *changes in current*. This explains **motors, back-EMF, flyback diodes, buck converters and relays**, which is most of RC/robotics.
9. **Real sources.** Batteries have internal resistance, which is why the voltage sags under motor load and the MCU browns out.

**References**
- 📘 *There Are No Electrons* — Kenn Amdahl. A light, funny book that builds intuition. Read it first.
- 📘 *Electrical Engineering 101* — Darren Ashby. Practical intuition.
- 🎓 **MIT 8.02 Electricity & Magnetism** — Walter Lewin (MIT OCW / YouTube). The classic lectures; watch them selectively.
- 📘 *Feynman Lectures on Physics, Vol. II* — free at feynmanlectures.caltech.edu. Ch. 1–17 if you want the deeper story.
- 📘 *Electricity and Magnetism* — Purcell & Morin. The rigorous version, optional.
- 🎥 Veritasium, "The Big Misconception About Electricity", plus the follow-up videos (Poynting vector and energy flow).
- 🌐 Khan Academy, "Electrical engineering" and "Physics → Electric charge, field & potential".

**Build:** play in Falstad with an LED + resistor, an RC charge circuit, and an inductor with a switch (watch the voltage spike).

---

## Phase 2 — DC circuit analysis, properly (2–3 weeks)

- KVL/KCL on multi-loop circuits; nodal analysis
- Series and parallel circuits; voltage dividers, **and why a divider is not a power supply** (loading)
- Thevenin/Norton equivalents: every source has an output impedance and every input has an input impedance
- Superposition
- Power, component ratings (W, V, A) and derating
- Measuring: voltage in parallel, current in series. Multimeter burden voltage.

**References**
- 🎓 **MIT 6.002 Circuits and Electronics** — Anant Agarwal (MIT OCW / edX). *The* core course for this phase and Phase 3.
- 🌐 *Lessons in Electric Circuits* — Tony Kuphaldt, free at allaboutcircuits.com (Vol. I DC, Vol. II AC, Vol. III Semiconductors).
- 📘 **Practical Electronics for Inventors** — Scherz & Monk (4th ed.). Keep it as your everyday reference book.

**Build:** a battery voltage monitor. Divider → Arduino ADC → print volts. Then calculate the divider's current draw and why it drains the battery.

---

## Phase 3 — Capacitors, inductors, AC and frequency (3–4 weeks)

- RC and RL transients, time constant τ (debouncing, power-on reset)
- Sinusoids, RMS, frequency; **impedance** (Z of R, C, L) and phasors (light treatment)
- Filters: RC low-pass and high-pass, cutoff frequency, Bode plots
- **Decoupling/bypass capacitors.** Why every IC needs a 100 nF cap right next to its pins.
- Resonance (LC); parasitics (every wire is an inductor, every pair of traces is a capacitor)
- PWM as "averaged" DC, and filtering PWM

**References**
- 🎓 MIT 6.002 (continued)
- 📘 **Learning the Art of Electronics** — Hayes & Horowitz. A hands-on lab course that pairs with *The Art of Electronics*.
- 🎥 **EEVblog** fundamentals videos (Dave Jones), e.g. "#1116 How to remove noise", decoupling, scope tutorials
- 🎥 **AddOhms**, **GreatScott!** "Electronic Basics" series

**Build:** look at your scope. Watch an RC circuit charge, filter PWM into an analog voltage, and see the noise on an ESP32's 3.3 V rail with and without decoupling.

---

## Phase 4 — Semiconductors: diodes, transistors, op-amps (4 weeks)

- **Diodes:** forward voltage, rectification, **flyback/freewheeling diodes on motors and relays**, reverse-polarity protection, Zener, Schottky, TVS/ESD, LEDs
- **BJT** as a switch (base resistor, saturation); as an amplifier only briefly
- **MOSFET** as a switch, which is the key component for motors and LEDs:
  low-side N-channel, high-side P-channel, *logic-level* gate (Vgs(th) vs. 3.3 V drive), Rds(on) → heat, gate resistor, gate pull-down, gate drivers
- **H-bridge** for bidirectional motors; shoot-through
- **Op-amps:** the golden rules, buffer, non-inverting/inverting amp, comparator, current sense with a shunt resistor
- Reading **datasheets**: absolute max ratings vs. recommended conditions, graphs over typical values

**References**
- 📘 **The Art of Electronics** — Horowitz & Hill (3rd ed., 2015). The bible. Don't read it cover to cover; use Ch. 1–4 and 9, then look things up.
- 📘 *Make: Electronics* — Charles Platt (3rd ed.). Learn-by-doing; good if you want something lighter.
- 🎥 **Ben Eater** (YouTube): transistors and logic, and the breadboard-computer series, which is excellent for understanding digital electronics from scratch
- 🌐 SparkFun and Adafruit Learn tutorials (transistors, MOSFETs, motors)

**Build:** drive a DC motor from an ESP32 with a logic-level MOSFET plus a flyback diode. Scope the drain with and without the diode. Then use an H-bridge module (DRV8833 / TB6612) for direction and PWM speed.

---

## Phase 5 — Power for robots (2–3 weeks)

- Batteries: **LiPo/Li-ion** (cell voltage 3.0–4.2 V, C-rating, internal resistance), NiMH; safety, BMS, balance charging
- Linear regulators (LDO): dropout and dissipation, P = (Vin − Vout) × I
- Switching regulators: **buck, boost, buck-boost**. How they work (which uses the inductor from Phase 1), efficiency, noise.
- Power budget: MCU + radio peaks (ESP32 Wi-Fi TX pulls ~300–500 mA spikes) + motors + servos
- **Separate motor power from logic power**, star grounds, bulk capacitors; brown-out resets
- Protection: fuses/polyfuses, reverse-polarity MOSFET, TVS
- Level shifting between 3.3 V and 5 V

**References**
- 🌐 **Battery University** (batteryuniversity.com)
- 📘 Practical Electronics for Inventors, power-supply chapters
- 🎥 **Phil's Lab** (YouTube): power supply and buck converter design
- 📄 TI application notes, e.g. "Basic Calculation of a Buck Converter's Power Stage" (SLVA477)

**Build:** a robot power board on perfboard. 2S LiPo → buck to 5 V (servos) → LDO to 3.3 V (ESP32), with a fuse, reverse protection and a voltage-monitor divider.

---

## Phase 6 — Digital interfaces at the electrical level (3 weeks)

This is where your developer background helps most, so focus on the *electrical* side.

- Logic levels (VIH/VIL), **push-pull vs. open-drain**, pull-up and pull-down resistors, floating inputs
- GPIO limits (source/sink current), why you never drive a motor from a pin
- ADC (resolution, reference, sampling, input impedance), DAC, PWM timers
- **UART:** baud rate, TTL vs. RS-232 levels
- **I2C:** open-drain plus pull-ups, **sizing the pull-ups against bus capacitance**, addressing, ACK/NACK, clock stretching, address conflicts, multiplexers (TCA9548A), bus recovery
- **SPI:** modes (CPOL/CPHA), chip select, speed versus wire length
- Others you'll meet: **CAN** (robotics), 1-Wire, WS2812 timing, **RC protocols** (servo PWM, PPM, SBUS, CRSF/ExpressLRS), DShot for ESCs
- Debugging with a **logic analyzer** (decode I2C/SPI in PulseView) and a scope (signal edges, ringing)

**References**
- 📄 **NXP UM10204, the I2C-bus specification**. Short and readable.
- 📄 TI app note "I2C Bus Pullup Resistor Calculation" (SLVA689)
- 🌐 SparkFun tutorials: "I2C", "Serial Peripheral Interface (SPI)", "Serial Communication", "Logic Levels", "Pull-up Resistors"
- 📘 **Making Embedded Systems** — Elecia White (2nd ed., 2024). Bridges software and hardware thinking. A must-read for a developer.

**Build:** read an IMU (MPU-6050 / ICM-42688 / BMI270) over I2C *and* SPI. Capture both buses on the logic analyzer. Remove the pull-ups and look at the I2C waveform on the scope.

---

## Phase 7 — Microcontrollers: Arduino → ESP32 → BLE (4–6 weeks)

- **Arduino (AVR):** start here for its simplicity, then go below the Arduino API: registers, timers, interrupts, the ATmega328P datasheet
- **ESP32:** Arduino-ESP32 first, then **ESP-IDF** with **FreeRTOS** (tasks, queues, ISRs), strapping pins and the pins you can't use, ADC quirks, deep-sleep and power modes, OTA updates
- **BLE:** the radio stack (advertising, scanning, connections), **GAP** roles, **GATT** (services, characteristics, notifications), MTU, connection intervals; NimBLE on ESP32. Test with **nRF Connect** (phone app).
- RF basics: antennas, keep-out zones, why a metal case kills your range
- Optional: **Rust on ESP32** (esp-rs) or **Zephyr**, which may suit you as a developer

**References**
- 🌐 **ESP-IDF Programming Guide** (docs.espressif.com) plus the ESP32 datasheet and hardware design guidelines
- 📘 *Getting Started with Bluetooth Low Energy* — Townsend, Cufí, Akiba & Davidson (O'Reilly). Short and clear.
- 🌐 Novel Bits blog (novelbits.io) for BLE in depth; Nordic DevAcademy (free BLE fundamentals course)
- 📘 *Exploring Arduino* — Jeremy Blum (2nd ed.)
- 🎓 *Embedded Systems – Shape the World* — Valvano & Yerraballi (UT Austin, free online). Bare-metal fundamentals.
- 🌐 Random Nerd Tutorials (ESP32 recipes)

**Build:** an ESP32 BLE RC controller. A phone app or second ESP32 sends throttle and steering over GATT; the robot drives motors and a servo, with a failsafe (stop on connection loss).

---

## Phase 8 — Actuators, sensors and control for RC/robotics (4 weeks)

- **Brushed DC motors:** torque vs. current, stall current, back-EMF, PWM frequency
- **Servos:** 50 Hz PWM, 1–2 ms pulse; current spikes
- **Brushless (BLDC) motors and ESCs:** 3-phase commutation, KV rating, ESC protocols; FOC (SimpleFOC library)
- **Steppers** and drivers (A4988/TMC2209), microstepping, current limit
- **Encoders** (quadrature) for odometry
- **IMU sensor fusion** (complementary filter, Madgwick), magnetometer calibration
- **PID control:** tuning, anti-windup. Build a self-balancing robot.
- Distance sensors: ToF (VL53L0X), ultrasonic, LiDAR

**References**
- 🎥 **Brian Douglas**, "Control Systems Lectures" and the MATLAB Tech Talks on PID and sensor fusion (YouTube). Exceptionally clear.
- 📘 *Robot Builder's Bonanza* — Gordon McComb (5th ed.). Practical.
- 📘 *Electric Motors and Drives* — Austin Hughes & Bill Drury. Motor physics, done well.
- 🌐 SimpleFOC docs; ArduPilot / Betaflight / ExpressLRS docs, for how real RC systems are built
- 📘 *Modern Robotics* — Lynch & Park (free PDF plus Coursera course). Later, for kinematics and planning.

**Build:** a self-balancing robot, or a differential-drive robot with encoders and a PID speed loop.

---

## Phase 9 — Designing your own PCBs (4–6 weeks, ongoing)

- Schematic capture in **KiCad**: symbols, footprints, ERC
- Part selection: JLCPCB/LCSC basic parts, availability, packages (0603/0805, SOIC, QFN)
- Layout: **solid ground plane**, **return current paths** (back to Phase 1!), decoupling placement, trace width vs. current (IPC-2152 calculators), via current, thermal relief
- Mixed signals: keep motor and power current paths away from sensors and the antenna; ESP32 antenna keep-out
- Design rules and DFM, Gerbers, BOM/CPL for assembly; first-board bring-up checklist (current-limited supply!)
- SMD soldering: hot air, solder paste and a stencil, flux, microscope
- Later: EMC basics, 4-layer stackups, impedance-controlled traces (USB)

**References**
- 🎥 **Phil's Lab** (YouTube plus courses): KiCad + STM32/ESP32 board design. The best start.
- 🎥 **Robert Feranec / FEDEVEL**: layout and high-speed design talks (e.g. with Eric Bogatin, Rick Hartley)
- 🎥 **Rick Hartley, "How to Achieve Proper Grounding"** (AltiumLive talk). A must-watch.
- 🌐 KiCad official "Getting Started" docs; *Contextual Electronics* (Chris Gammell)
- 📘 *Signal and Power Integrity — Simplified* — Eric Bogatin. Advanced, for when boards get fast.
- 📘 *Electromagnetic Compatibility Engineering* — Henry Ott. Advanced reference.

**Build:** your own ESP32 robot controller board. ESP32-S3 module, USB-C, LiPo input + buck + LDO, 2× motor driver, 4× servo headers, I2C (Qwiic/STEMMA QT) connector, battery monitor. Order from JLCPCB/PCBWay.

---

## Must-have books (short list)

1. **Practical Electronics for Inventors** — Scherz & Monk (daily reference)
2. **The Art of Electronics**, 3rd ed. — Horowitz & Hill (the bible) + **Learning the Art of Electronics** (labs)
3. **Making Embedded Systems**, 2nd ed. — Elecia White (for developers)
4. **There Are No Electrons** — Kenn Amdahl (intuition, Phase 1)
5. **Make: Electronics** — Charles Platt (hands-on, if you prefer doing over reading)

## Must-watch courses / channels

- MIT 6.002 (Agarwal), MIT 8.02 (Lewin)
- Ben Eater, EEVblog, Phil's Lab, GreatScott!, Brian Douglas (control)
- Free text: *Lessons in Electric Circuits* (All About Circuits)

## Habits that speed things up

- **Simulate first** (Falstad/LTspice), **build**, then **measure** (scope/LA), and compare with what you predicted.
- Read one datasheet a week end to end (start with the ATmega328P, a MOSFET, an LDO, an IMU).
- Always power new circuits from a **current-limited bench supply**.
- Keep a lab notebook (this repo works): schematic, expectation, measurement, what surprised you.
