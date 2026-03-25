---
name: asce-wind-calculator-maintainer
description: Maintain and improve the ASCE 7-22 Door/Window Wind Pressure Calculator static web app. Use when tasks involve editing wind pressure formulas, ASCE assumptions, UI/UX text, validation logic, calculator outputs, or project documentation for this repository.
---

# ASCE 7-22 Wind Calculator Maintainer

Execute changes as focused edits to a single-file web app (`index.html`) plus project docs.

## Understand the app quickly

1. Read `README.md` for scope, assumptions, and limitations.
2. Treat `index.html` as the source of truth for UI, styling, and calculation logic.
3. Keep the tool aligned with low-rise, enclosed-building, wall component/cladding assumptions unless explicitly asked to expand scope.

## Safe workflow

1. Identify whether the request is:
   - **Calculation logic** (Kz, qh, GCp/GCpi, zones, loads),
   - **Input/output behavior** (validation, defaults, warnings),
   - **UI/content** (labels, help text, layout), or
   - **Documentation** (`README.md`, disclaimers, usage notes).
2. Make the smallest coherent change that satisfies the request.
3. Preserve backward compatibility for existing inputs whenever possible.
4. If changing engineering assumptions, update user-facing explanation text and README notes in the same change.

## Calculation-edit rules

1. Keep units explicit and consistent:
   - Wind speed in mph,
   - Dimensions in ft,
   - Pressures in psf,
   - Loads in lbf.
2. Avoid hidden constants. Name constants in code and annotate with brief ASCE context.
3. Clamp/interpolate values deterministically and document interpolation assumptions in nearby comments.
4. Keep positive and negative pressure paths clearly separated to avoid sign errors.
5. For any formula change, add or update at least one worked example in comments or README.

## UI/content-edit rules

1. Maintain clear engineering wording; prefer "assumption" and "limitation" language over ambiguous phrasing.
2. Keep warnings prominent for out-of-scope usage (e.g., height > 60 ft, non-wall conditions).
3. Preserve responsive behavior and avoid introducing dependencies unless explicitly requested.

## Validation checklist after edits

1. Open `index.html` and run one baseline scenario:
   - V=115 mph, L=100 ft, W=50 ft, h=30 ft, Exposure C, Kzt=1.0, A=20 sf.
2. Confirm outputs are numerically reasonable and signs are correct for inward/outward pressure.
3. Test one edge condition relevant to the change (e.g., high height warning, tiny/large effective area, missing input validation).
4. If docs changed, ensure README example and stated assumptions still match app behavior.

## Output expectations for bot-generated changes

1. Summarize what changed in plain language.
2. List formulas/assumptions touched.
3. Report validation scenarios executed and outcomes.
4. Call out any remaining engineering caveats explicitly.
