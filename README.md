# ASCE 7-22 Door/Window Wind Pressure Calculator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/yourusername/asce-wind-calculator.svg?style=social)](https://github.com/yourusername/asce-wind-calculator/stargazers)

A simple, web-based tool to estimate wind pressures and loads on doors and windows (components and cladding) for low-rise enclosed buildings based on ASCE 7-22. This calculator helps users determine net pressures for interior (Zone 4) and corner (Zone 5) zones, incorporating factors like wind speed, building dimensions, exposure, topography, and effective area.

**Note:** This is an estimation tool for educational purposes. Always consult a licensed engineer for actual designs and code compliance. Assumes low-rise (h ≤ 60 ft), enclosed buildings; simplified for walls only (no roofs).

## Features

- **Input Parameters:**
  - Ultimate wind speed, V (mph, from ASCE maps)
  - Building length, width, and mean roof height, h (ft)
  - Exposure category (B: urban, C: open, D: coastal)
  - Topographic factor, Kzt (default 1.0 for flat sites)
  - Effective wind area, A (sq ft, for the component)

- **Outputs:**
  - End zone width 'a' (ft)
  - Velocity pressure qh (psf)
  - Exposure coefficient Kz
  - Positive (inward) and negative (outward) pressures (psf) for Zones 4 and 5
  - Corresponding wind loads (lbf)
  - Warnings for heights >60 ft

- **Reference Tables:** Results in a structured table for clarity.
- **Responsive Design:** Works on desktop and mobile with tooltips for guidance.
- **No Dependencies:** Pure HTML, CSS, and JavaScript—runs in any modern browser.

## Demo

You can try the calculator live [here]([https://oasisengineering.com/asce-7-22-door-window-wind-pressure-calculator/](https://oasisengineering.com/free-wind-load-calculator/)).
https://oasisengineering.com/free-wind-load-calculator/ 

## Installation

No installation required! This is a static web page.

1. Clone the repository:
2. Open `index.html` in your web browser.

Alternatively, download the ZIP and open the HTML file directly.

## Usage

1. Enter wind speed, building dimensions, select exposure, input Kzt and effective area.
2. Click **Calculate** to view results.
3. Review pressures and loads for Zones 4 (interior) and 5 (corners).
4. If height >60 ft, a warning suggests consulting ASCE for mid/high-rise methods.
5. Use the **Reset** button to clear inputs.

### Example

- Wind Speed: 115 mph
- Building Length: 100 ft
- Building Width: 50 ft
- Mean Roof Height: 30 ft
- Exposure: C
- Kzt: 1.0
- Effective Wind Area: 20 sq ft

**Result:** 
- 'a': 12 ft
- qh: ~28.5 psf
- Kz: ~0.85
- Zone 4: Positive 33.6 psf, Negative -28.5 psf
- Zone 5: Positive 33.6 psf, Negative -45.6 psf
- Loads accordingly multiplied by area.

## Technical Details

- **Calculations:** Based on ASCE 7-22 Chapter 30 (components/cladding for walls). Uses exact Kz formulas, interpolated GCp from Fig. 30.3-1 (area-dependent for negative), GCpi=±0.18 for enclosed. No directionality (Kd=0.85 not applied, as per maps). qh at h, Ke=1.0 (sea level).
- **Prescriptive Check:** Aligns with low-rise enclosed building assumptions; 'a' per definition.
- **Limitations:** Walls only (no roof zones); no internal pressure variations beyond enclosed; simplified GCp positive=1.0; no shear or combined loads. For complex cases, use full ASCE provisions.

## Contributing

Contributions are welcome! Please fork the repo and submit a pull request.

1. Fork the project.
2. Create a feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool provides estimates only and is not a substitute for professional engineering advice. Calculations are based on simplified assumptions from ASCE 7-22. Verify all designs with a licensed structural engineer to ensure compliance with local codes and site-specific conditions. Oasis Engineering assumes no liability for any use of this tool or for any errors, omissions, or damages arising from its use.

## Acknowledgments

- Based on ASCE 7-22 Minimum Design Loads and Associated Criteria for Buildings and Other Structures.
- Inspired by engineering tools for quick wind load estimates.

If you find this useful, star the repo! ⭐

Learn More at WindCalculations.com: WindCalculations.com provides site-specific wind load calculations, certifications, and engineering letters essential for permitting and installing building components like windows, doors, rooftop solar equipment, and roofing materials. It ensures full compliance with the latest Building Codes and ASCE 7-22 standards.
