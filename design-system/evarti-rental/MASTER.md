# Evarti Rental — UI/UX design system

## Product and users
A React 18 / Vite workspace for camera-rental cashiers and the owner. Primary tasks: create a rental receipt, verify payments, manage cameras/add-ons, and review revenue. Indonesian interface; IDR amounts.

## Design direction
Functional, calm, warm, and readable. UI/UX Pro Max searches recommended minimalism, a clear grid, visible keyboard focus, controlled inputs, and explicit validation feedback. Its generated marketing-page pattern and blue/orange palette were not appropriate for this existing internal tool. Preserve Evarti's rose identity and use task-oriented dashboard layouts.

## Tokens
- Brand/action: `--pink-dark: #843452`; white action labels.
- Sidebar/featured revenue: `--sidebar: #492535`.
- Canvas: `--canvas: #f7f4f6`; white cards.
- Primary text: `--text: #30272e`; secondary: `--muted: #756771`.
- Borders: `--line: #e8dfe4`; stronger boundaries on form controls.
- Semantic success: `#246348` on `#edf7f1`; warning: `#805419` on `#fff7e8`.
- Rounded surfaces: 12–16px; input/button radius: 8–10px.
- Spacing: 4/8px rhythm; desktop gutters 24–36px, mobile 16px.

## Typography
System sans-serif with DM Sans when available. Page headings 28–36px, section headings 16–20px, body 14–16px, supporting labels 12–13px. Inputs use 16px on mobile. Tabular numerals for monetary metrics. Keep existing receipt-specific monospace typography and thermal-paper print rules.

## Layout
Desktop sidebar 232px, compact sidebar 208px, drawer below 768px. White topbar, warm canvas. Dashboard uses four metrics and grouped payment/recent-activity cards. Forms use a single primary action and a separate receipt preview. Catalog uses camera cards and two add-on categories per row on wide screens, then one on narrower screens. Avoid horizontal page overflow; transaction tables may scroll within their container.

## Interaction and accessibility
- Controls provide visible focus and hover states; frequent actions have 44px targets.
- Preserve drafts across in-app navigation and add/remove actions.
- Catalog status explicitly distinguishes saved content from unsaved edits.
- Save actions show progress and prevent duplicate submission; errors use alert semantics.
- Keep meaningful field labels, selected navigation state, accessible toggle state, and a skip-to-content link.
- Respect reduced motion and device safe areas. Do not rely on color alone for availability or payment status.
- Keep backend validation, payment authorization, and receipt printing behavior intact.
