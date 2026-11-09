# UI validation

Verified against an isolated backend with an in-memory SQLite database and synthetic rental data. The configured application MySQL data was not used for browser interactions.

- Production Vite build completed successfully.
- Dashboard, catalog, new rental, history, and reports checked at 375, 768, 1024, and 1440 CSS pixels; no horizontal page overflow or JavaScript runtime errors.
- Add-on edits survive in-app navigation and adding another option; explicit save survives page reload; cancel restores saved values; whitespace is normalized after save.
- Mobile navigation opens/closes, supports Escape, restores focus, and keeps the closed drawer inert. Landscape and reduced-motion mode checked.
- axe WCAG A/AA scans performed on login and the five main screens at desktop/mobile sizes. Contrast issues and missing filter labels found during review were fixed, then affected pages were rescanned.
- Thermal print stylesheet retained. Physical printer output was not tested.

Preview images use synthetic data and are for visual review only.

## Manual add-on extension

- Backend suite: 15 tests passed, including manual service validation, total/change calculation, zero-price services, audit logging, catalog isolation, persistence after reopening the database, and reprint eligibility.
- Browser check: optional manual fields, required-field errors, cancellation, live totals, saving, and customer receipt preview passed. Example: camera Rp15,000 + manual service Rp12,000 = Rp27,000; Rp30,000 cash produces Rp3,000 change.
- Manual panel checked at 375px and 1440px with no horizontal overflow, JavaScript errors, or axe WCAG A/AA violations in that panel.
