# ASCE 7-22 Door/Window Wind Pressure Calculator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A web-based tool to estimate wind pressures and loads on doors and windows (components and cladding) for low-rise buildings per ASCE 7-22 Chapter 30, Part 1. The calculator reports net pressures for interior (Zone 4) and corner (Zone 5) wall zones at both ultimate (LRFD) and ASD (0.6W) levels, with a live zone diagram showing where each applies.

**Note:** This is an estimation tool. Always consult a licensed engineer for actual designs and code compliance. Assumes low-rise (h ≤ 60 ft) buildings; walls only (no roof zones).

## Features

- **Input parameters:**
  - Ultimate wind speed, V (mph, from ASCE 7-22 maps)
  - Building length, width, and mean roof height, h (ft)
  - Exposure category (B: urban, C: open, D: coastal)
  - Enclosure classification — Enclosed / Partially Open (GCpi = ±0.18) or Partially Enclosed (GCpi = ±0.55) per Table 26.13-1
  - Topographic factor, Kzt (any value ≥ 1.0)
  - Roof slope θ (triggers the 10% wall GCp reduction when θ ≤ 10° per the Fig. 30.3-1 footnote)
  - Ground elevation above sea level → Ke per Table 26.9-1 (optional; 0 = conservative Ke = 1.0)
  - Effective wind area, A (sq ft; GCp log-interpolated between A = 10 and A = 500)

- **Outputs:**
  - End zone width 'a' (ft), Kh, qh, and Ke in a stat strip
  - Ultimate (strength-level) positive and negative pressures (psf) for Zones 4 and 5
  - ASD pressures (0.6 × ultimate) for comparison against window/door DP ratings
  - Component wind loads (lbf) at ultimate
  - Automatic enforcement of the 16 psf minimum net C&C pressure per Section 30.2.2, with a badge when the minimum governs
  - Live wall-elevation zone diagram showing the Zone 5 end strips at width 'a'
  - Step-by-step calculation breakdown with code references (included in the printed report)

- **No dependencies:** Pure HTML, CSS, and JavaScript — runs in any modern browser. Print-ready report layout.

## Demo

Try the calculator live at [oasisengineering.com/free-wind-load-calculator](https://oasisengineering.com/free-wind-load-calculator/).

## Installation

No installation required — this is a static web page.

1. Clone the repository.
2. Open `index.html` in your web browser.

## Usage

1. Enter wind speed, building dimensions, exposure, enclosure classification, Kzt, roof slope, optional ground elevation, and effective area.
2. Click **Calculate Pressures** (or press Enter).
3. Review ultimate and ASD pressures for Zones 4 and 5, and the zone diagram to determine which zone applies to your opening (within 'a' of a corner → Zone 5).
4. Use **Copy Summary** for a plain-text record or **Print PDF** for a report that includes the full calculation breakdown.

### Worked example

Inputs: V = 115 mph, L × W = 100 ft × 50 ft, h = 30 ft, Exposure C, Enclosed, Kzt = 1.0, θ = 5°, elevation 0 ft, A = 20 sq ft.

Results:
- a = 5.00 ft, Kh = 0.981, qh = 33.20 psf, Ke = 1.000
- Zone 4 (ultimate): +29.1 / −31.7 psf
- Zone 5 (ultimate): +29.1 / −37.9 psf
- Zone 4 (ASD 0.6W): +17.5 / −19.0 psf
- Zone 5 (ASD 0.6W): +17.5 / −22.8 psf
- Loads at ultimate: Zone 5 negative = −37.9 × 20 ≈ −759 lbf

## Technical Details

- **Velocity pressure:** qh = 0.00256 · Kh · Kzt · Ke · V² per ASCE 7-22 Eq. 26.10-1. Kd = 0.85 is applied in the pressure equation (Eq. 30.3-1), not in qh, consistent with the 7-22 restructuring.
- **Exposure coefficient:** Kh = 2.41 (z/zg)^(2/α) with ASCE 7-22 Table 26.11-1 constants (B: α = 7.5, zg = 3280; C: α = 9.8, zg = 2460; D: α = 11.5, zg = 1935) and the Table 26.10-1 formula floor of z = 15 ft for all exposures. The "Kz = 0.70 below 30 ft in Exposure B" provision applies only to the Chapter 28 envelope MWFRS procedure and is intentionally not used here.
- **External coefficients:** Fig. 30.3-1 wall values, log-interpolated on effective wind area: positive +1.0 → +0.7, Zone 4 negative −1.1 → −0.8, Zone 5 negative −1.4 → −0.8 (A = 10 → 500 sq ft), reduced 10% when θ ≤ 10°.
- **Internal pressure:** GCpi = ±0.18 (enclosed / partially open) or ±0.55 (partially enclosed) per Table 26.13-1, combined for worst case.
- **Minimum pressure:** net design pressures not less than 16 psf in either direction per Section 30.2.2 (strength level); ASD values are derived after the minimum is applied.
- **Limitations:** wall zones only (no roof zones); rigid buildings; no parapet, overhang, or rooftop equipment provisions; tornado loads (ASCE 7-22 Ch. 32) not included; h > 60 ft is outside the method (the tool warns and continues for reference only). For complex cases, use the full ASCE provisions.

## Changelog

### v3 (current)
- **Fixed:** Exposure B velocity pressure coefficient now uses the Table 26.10-1 formula floor of 15 ft for all exposures. The previous version applied a 30 ft floor in Exposure B (Kz = 0.70 instead of 0.57 at h = 15 ft), overstating pressures by up to ~20% for short suburban buildings; the 0.70 value belongs to the Chapter 28 envelope MWFRS procedure only.
- **Added:** 16 psf minimum net pressure check per Section 30.2.2, with a "min governs" indicator.
- **Added:** Enclosure classification (enclosed / partially open / partially enclosed) — GCpi ±0.18 or ±0.55.
- **Added:** Ground elevation factor Ke per Table 26.9-1.
- **Added:** ASD (0.6W) pressures alongside ultimate values.
- **Added:** Live wall-elevation zone diagram with the computed end-zone width 'a'; 'a', Kh, qh, Ke stat strip.
- **Improved:** Kzt accepts any value ≥ 1.0; mobile layout; keyboard (Enter) support; accessible tooltips and live regions; clipboard fallback; printed report now includes the full breakdown and input summary.

### v2
- Migrated constants and equation structure from ASCE 7-16 to 7-22 (Kd moved out of qh; new α/zg; 2.41 coefficient); corrected Zone 4 negative base coefficient to −1.1; added roof slope reduction, calculation breakdown, print layout.

### v1
- Initial ASCE 7-16-style implementation.

## Contributing

Contributions are welcome. Fork the repo, create a feature branch, and open a pull request.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool provides estimates only and is not a substitute for professional engineering advice. Calculations are based on simplified assumptions from ASCE 7-22. Verify all designs with a licensed structural engineer to ensure compliance with local codes and site-specific conditions. Oasis Engineering assumes no liability for any use of this tool or for any errors, omissions, or damages arising from its use.

## Acknowledgments

- Based on ASCE 7-22, Minimum Design Loads and Associated Criteria for Buildings and Other Structures.

Learn more at [WindCalculations.com](https://windcalculations.com): site-specific wind load calculations, certifications, and engineering letters for permitting and installing building components like windows, doors, rooftop solar equipment, and roofing materials — full compliance with the latest building codes and ASCE 7-22.
