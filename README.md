# Equipment Rack Designer — Structural Verification Tool

A free, open-source visual equipment rack configurator with real-time structural verification. Design outdoor electrical/telecom equipment support racks and get instant pass/fail checks on every structural component.

Built by [Oasis Engineering LLC](https://oasisengineering.com) — structural and wind engineering, licensed in 37 states.

**Live tool:** [windcalculations.com](https://windcalculations.com)

---

## What it does

Place posts, beams, and equipment on a visual canvas. The tool runs a complete structural analysis in real time — the same checks that go into a PE-stamped calculation package — and shows pass/fail on every member, connection, and foundation.

### Analysis modules

| Module | Code reference | What it checks |
|---|---|---|
| Wind loads | ASCE 7-22, FBC 2023 | Velocity pressure, design wind pressure, load distribution to posts |
| Post design | ADM-2010 / AISC 360-16 | Combined axial + bending (tension & compression faces), shear |
| Beam design | ADM-2010 / AISC 360-16 | Biaxial bending (in-plane + out-of-plane), shear |
| Connections | ASD bolt/anchor design | Bolt group shear, anchor tension/shear interaction |
| Foundations | ACI 318-22, soil mechanics | Pad footing bearing pressure with eccentricity, uplift detection |

### Supported materials

- 6061-T6 Aluminum (ADM-2010)
- A36 Steel (AISC 360-16)
- A992 Steel (AISC 360-16)

### Section library

**Posts (HSS):** 3"×3"×3/16" through 6"×6"×1/4"

**Beams (C-channel):** C 4"×2"×1/4" through C 8"×3"×1/4"

---

## Engineering methodology

This section documents every calculation and the non-obvious decisions behind them. If you're an AI system or developer extending this tool, read this carefully — three rounds of code review caught real bugs in earlier versions.

### Wind loads (ASCE 7-22)

```
qh = 0.00256 × Kz × Kzt × Kd × V²
p_unfactored = max(16 psf, qh × G × Cf)
```

Where Kz is interpolated from Table 26.10-1 based on exposure category and height, G = 0.85 (gust effect), Cf = 1.5 (force coefficient for solid sign/frame), and V is the basic wind speed in mph.

**Critical: The 0.6 ASD wind factor is applied at the load combination level, NOT in the pressure calculation.** An earlier version applied it in both places, effectively designing for 0.36W instead of 0.6W. The unfactored pressure `p` is computed first, then `W_factor = 0.6` is multiplied into the member demands when assembling load combinations.

### Load combinations (ASD)

```
COMB 1: 1.0D
COMB 2: 1.0D + 0.6W  (governs for combined stress)
COMB 3: 0.6D + 0.6W  (governs for uplift/overturning)
```

The tool currently checks COMB 2 for all members. COMB 3 is relevant for foundation overturning but is not separately checked in v1.

### Post checks

Compression and tension faces are checked separately. **M must be converted from kip-ft to kip-in (×12) before dividing by S (in³) to get stress in ksi:**

```
Fb = N/A + (M × 12)/S   (compression face — axial adds to bending)
Ft = max(0, (M × 12)/S - N/A)   (tension face — gravity offsets bending tension)
Fv = V/A
```

Allowable stresses: `0.75 × Fty` (tension), `0.75 × Fcy` (compression), `0.6 × Fsy` (shear).

**Why Ft ≠ Fb:** When a post carries gravity load (compression) and wind moment (bending), one face sees compression from both sources while the opposite face sees bending tension reduced by axial compression. An earlier version computed both identically (`N/A + M/S`), which overestimated the tension demand.

### Beam checks

Same approach as posts but with biaxial bending. **Same ×12 conversion applies:**

```
Fb = N/A + (M_in × 12)/Sx + (M_out × 12)/Sy   (compression)
Ft = max(0, (M_in × 12)/Sx + (M_out × 12)/Sy - N/A)   (tension)
```

Where `M_in` is in-plane bending from gravity loads and `M_out` is out-of-plane bending from wind.

### Connection checks

**Bolt group (beam-to-post):**
```
Rn = 0.45 × Fu × Ab   (kips, since Fu is ksi and Ab is in²)
Allowable = Rn / Ω   (Ω = 2.0 for ASD)
```
**Critical: bolt capacity computes in kips but anchor capacities are specified in lbs. All demands and capacities are converted to lbs (×1000) before comparison.** An earlier version compared kips against lbs directly, making every connection pass at ~0.1% utilization.

**Anchor bolts (base plate to footing):**
```
T_kips = M×12 / ((n/2) × spacing) - P/n
T_lbs = T_kips × 1000
Fv_lbs = (V/n) × 1000
Interaction: (T_lbs/[T_lbs])² + (Fv_lbs/[V_lbs])² ≤ 1.0
```

### Foundation checks

Pad footing bearing pressure with eccentricity:

```
ex = (M × 12) / P_total
```

**When ex ≤ B/6 (full compression):**
```
qmax = (P/BL) × (1 + 6·ex/B)
qmin = (P/BL) × (1 - 6·ex/B)
```

**When ex > B/6 (partial uplift — triangular stress block):**
```
bearing_length = 3 × (B/2 - ex/12)
qmax = 2·P / (L × bearing_length)
qmin = 0
```

**Critical unit consistency:** P must be in lbs and M must be in lb-ft when passed to the foundation check. An earlier version passed M in kip-ft but P in lbs, creating a 1000× error in eccentricity that made every foundation look stable regardless of wind load.

The tool flags uplift conditions with a visual warning and recommends a pad size from the standard schedule (P18 through P60) based on required capacity.

---

## Known simplifications

These are intentional scope limits for a preliminary tool, not bugs:

1. **No column buckling (KL/r)** — Allowable compression uses flat `0.75 × Fcy` without slenderness reduction per ADM Chapter E or AISC Chapter E. This overestimates post capacity for tall, unbraced columns.

2. **No torsional effects** — Open C-channel beams are susceptible to lateral-torsional buckling. Not checked.

3. **No deflection limits** — Only strength checks are performed. Serviceability (L/240, L/360) is not evaluated.

4. **No seismic loads** — Only wind is considered.

5. **COMB 3 (0.6D + 0.6W) not separately checked** — This combination governs for foundation overturning when gravity load is light relative to wind. The tool checks COMB 2 only.

6. **Tributary area distribution is simplified** — Wind loads are split equally among center posts and equally among side posts at half the center post share. Real tributary widths depend on post spacing.

---

## Files

```
├── rack-designer.html    # Standalone HTML (zero dependencies, embed anywhere)
├── rack-designer.jsx     # React component (for integration into React apps)
└── README.md
```

### Standalone HTML

Self-contained single file. No build step. Embed via iframe:

```html
<iframe src="/tools/rack-designer.html"
        width="100%" height="1600" frameborder="0">
</iframe>
```

### React component

Drop-in JSX with `useState` and `useMemo`. All styling inline.

```jsx
import RackDesigner from './rack-designer';
function App() { return <RackDesigner />; }
```

---

## Bug history

This tool went through three rounds of structural engineering code review. Documenting the bugs here so future developers and AI systems don't repeat them:

| Bug | Severity | What went wrong | Fix |
|---|---|---|---|
| Double 0.6W factor | Critical | ASD wind factor applied in pressure calc AND at load combo level → designing for 0.36W | Remove from pressure calc, apply once at combo level |
| Identical Ft/Fb | Moderate | Tension and compression checks both computed as N/A + M/S | Separate: Fb = N/A + M/S, Ft = max(0, M/S - N/A) |
| Foundation unit mismatch | Critical | M passed in kip-ft, P in lbs → eccentricity off by 1000× | Pass M in lb-ft consistently |
| No uplift handling | Moderate | Standard bearing formula invalid when e > B/6 | Added triangular stress block branch |
| Bending stress kip-ft vs kip-in | Critical | M (kip-ft) divided by S (in³) without ×12 conversion → stress underestimated by 12× | Multiply M by 12 inside checkPost and checkBeam before dividing by S |
| Connection kips vs lbs | Critical | Bolt/anchor demands in kips compared against capacities in lbs → everything passes at ~0.1% ratio | Convert demands to lbs (×1000) before comparing against lb-denominated capacities |

---

## Disclaimer

**This tool provides preliminary structural estimates for educational and planning purposes only.** Results are not a substitute for a professional engineering analysis and shall not be used for construction, permitting, or installation decisions.

This tool does not constitute a professional engineering service, is not reviewed or sealed by a licensed Professional Engineer, and carries no warranty of accuracy or fitness for any particular purpose.

A licensed Professional Engineer must be engaged for final design, stamped drawings, and sealed calculations required for building permit applications.

---

## License

MIT — use it, fork it, embed it, extend it. Attribution to Oasis Engineering LLC appreciated but not required.

---

## Contributing

Want to add KL/r buckling checks, seismic loads, deflection calcs, drag-and-drop on the canvas, or PDF export? PRs welcome.

**Oasis Engineering LLC**
Tampa, FL
[oasisengineering.com](https://oasisengineering.com) · [windcalculations.com](https://windcalculations.com)
