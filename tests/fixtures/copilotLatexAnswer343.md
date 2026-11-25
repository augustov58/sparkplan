Here is the step-by-step derivation of the 3-phase capacity for panel **MDP** based on your project configuration.

---

### 1. Panel & Service Parameters from Your Project
From your project context, **MDP** has the following specifications:
* **System Type:** 3-phase, 4-wire (208Y/120V)
* **Nominal Line-to-Line Voltage ($V_{L-L}$):** 208 V
* **Bus & Main Breaker Rating ($I$):** 200 A (NEC 408.30 and 408.36 require the panelboard bus and main overcurrent protective device to be rated not less than the minimum feeder/service capacity).

---

### 2. The 3-Phase Apparent Power Formula
The standard formula for total apparent power (capacity in volt-amperes, VA) in a balanced 3-phase system is:

$$\text{Capacity (VA)} = V_{L-L} \times I \times \sqrt{3}$$

Where:
* $V_{L-L} = 208\text{ V}$ (line-to-line voltage)
* $I = 200\text{ A}$ (maximum continuous bus/breaker rating)
* $\sqrt{3} \approx 1.73205$ (phase factor for 3-phase power)

*(Alternatively, calculated phase-by-phase using nominal line-to-neutral voltage: $3 \times 120\text{ V} \times 200\text{ A} = 72,000\text{ VA}$)*

---

### 3. Step-by-Step Calculation

**Step 1: Multiply line-to-line voltage by the rated amperage**  
$$208\text{ V} \times 200\text{ A} = 41,600\text{ VA}$$

**Step 2: Apply the 3-phase factor ($\sqrt{3}$)**  
$$41,600\text{ VA} \times 1.73205 = 72,053.3\text{ VA}$$

**Step 3: Convert to kilovolt-amperes (kVA)**  
$$72,053.3\text{ VA} / 1,000 = 72.05\text{ kVA}$$

* **Total 3-Phase Capacity of MDP = 72.05 kVA (or 200 A at 208V, 3-phase)**

---

### 4. Application to Your Project (QA Commercial panel)

* **Rated Capacity:** 200 A (72.05 kVA)
* **Design Load:** 59 A (calculated per **NEC 230.42(A)(1)**: 100% of non-continuous loads + 125% of continuous loads)
* **Current Utilization:** 
  $$\frac{59\text{ A}}{200\text{ A}} \times 100\% = 29.5\% \approx 30\%$$
* **Available Spare Capacity:** 
  $$200\text{ A} - 59\text{ A} = 141\text{ A}\quad (141\text{ A} \times 208\text{ V} \times \sqrt{3} / 1,000 \approx 50.8\text{ kVA})$$

MDP has **50.8 kVA (141 A)** of headroom remaining before reaching its 200 A nameplate capacity.