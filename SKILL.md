---
name: asce-wind-calculator-maintainer
description: Maintain and improve the ASCE 7-22 Door/Window Wind Pressure Calculator static web app. Use when tasks involve editing wind pressure formulas, ASCE assumptions, UI/UX text, validation logic, calculator outputs, or project documentation for this repository.
---

# ASCE 7-22 Wind Calculator Maintainer

Execute changes as focused edits to a single-file web app (`index.html`) plus project docs.

## Understand the app quickly

1. Read `README.md` for scope, assumptions, limitations, and the changelog.
2. Treat `index.html` as the source of truth for UI, styling, and calculation logic.
3. Keep the tool aligned with low-rise, wall component/cladding assumptions unless explicitly asked to expand scope. Supported enclosure classes: enclosed, partially open (GCpi ±0.18), partially enclosed (±0.55).

## Safe workflow

1. Identify whether the request is:
   - **Calculation logic** (Kz/Kh, Ke, qh, GCp/GCpi, zones, 16 psf minimum, ASD conversion, loads),
   - **Input/output behavior** (validation, defaults, warnings, zone diagram),
   - **UI/content** (labels, help text, layout), or
   - **Documentation** (`README.md`, disclaimers, usage notes).
2. Make the smallest coherent change that satisfies the request.
3. Preserve backward compatibility for existing inputs whenever possible. Current input IDs: windSpeed, length, width, height, exposure, enclosure, kzt, theta, elevation, area.
4. If changing engineering assumptions, update user-facing explanation text and README notes in the same change.

## Calculation-edit rules

1. Keep units explicit and consistent: wind speed mph, dimensions ft, pressures psf, loads lbf, elevation ft above sea level.
2. Avoid hidden constants. All ASCE constants live in the `ASCE` object with code-section annotations. Keep them there.
3. Clamp/interpolate values deterministically and document interpolation assumptions in nearby comments.
4. Keep positive and negative pressure paths clearly separated to avoid sign errors. The Sec. 30.2.2 minimum (16 psf, strength level) is applied before the ASD 0.6 factor — keep that order.
5. Kz floor is 15 ft for all exposures per Table 26.10-1 Note 1. Do not reintroduce the 30 ft / Kz = 0.70 Exposure B floor — that provision is Chapter 28 (envelope MWFRS) only. See the comment block above the `ASCE` constants.
6. For any formula change, add or update at least one worked example in comments or README, and extend `validate.js` / `smoke-test.js` if present.

## UI/content-edit rules

1. Maintain clear engineering wording; prefer "assumption" and "limitation" language over ambiguous phrasing.
2. Keep warnings prominent for out-of-scope usage (e.g., height > 60 ft, non-wall conditions). Errors (red) block calculation; warnings (amber) do not.
3. Preserve responsive behavior (single-column below 860 px) and avoid introducing dependencies unless explicitly requested.
4. Keep the zone diagram, stat strip, and ASD sub-values in sync with any output changes; the print report must remain a complete record (inputs, results, breakdown, disclaimer).

## Validation checklist after edits

1. Run the baseline scenario:
   - V=115 mph, L=100 ft, W=50 ft, h=30 ft, Exposure C, Enclosed, Kzt=1.0, θ=5°, elev=0, A=20 sf.
   - Expected: a = 5.00 ft, Kh = 0.981, qh = 33.20 psf; Zone 4 ult +29.1/−31.7 psf; Zone 5 ult +29.1/−37.9 psf; ASD = 0.6×.
2. Confirm signs are correct for inward/outward pressure and the ASD values equal 0.6 × ultimate.
3. Test one edge condition relevant to the change. Useful edges: h > 60 warning; Exposure B at h = 15 (Kh = 0.573); low V where the 16 psf minimum governs; partially enclosed (GCpi = 0.55); elevation 5,000 ft (Ke ≈ 0.834); A ≤ 10 and A ≥ 500 interpolation clamps.
4. If `smoke-test.js` exists, run `node smoke-test.js` — all cases must pass.
5. If docs changed, ensure the README example, changelog, and stated assumptions still match app behavior.

## Output expectations for bot-generated changes

1. Summarize what changed in plain language.
2. List formulas/assumptions touched.
3. Report validation scenarios executed and outcomes.
4. Call out any remaining engineering caveats explicitly.
