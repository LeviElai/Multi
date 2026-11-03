# Design direction and audit

Baseline: production source 8881c5b; root inspected live desktop homepage 2026-11-03. User supplied mobile captures; narrow full-page image is pinch-zoomed and does not establish a width defect.

## Confirmed systemic findings
- High: mobile Quizzes routes to personal /library; desktop exposes public /community separately. Public discovery is inconsistent.
- High: fourteen imported style layers repeatedly override shared header/page classes. Layout ownership is unclear.
- High: homepage spends separate panels on Daily, join form, hosting and game showcase. Multiple slogans repeat context instead of improving actions.
- High: account screenshot shows failed profile retrieval. Root cause not yet reproduced; do not label cosmetic.
- High: live Daily still displays ten questions for the published date. Prepared future arcade content is not proof today's experience changed.
- Medium: mobile header consumes two rows of boxed controls, footer repeats branding/account. Community card cover occupies excessive space relative to playable information.

## Alternatives before implementation
| Screen | A | B | Decision and reason |
|---|---|---|---|
| Home | Two destinations: compact Daily feature and Friends entry, join form on Join route | Embedded code form and host panel under Daily | A: clearer first action and less height; B avoids one tap but remains form-heavy |
| Daily | Entry with five mode tokens, Play, compact standings; full standings after run | Calendar/map entry with game nodes | A: readable and fast; B adds decoration and navigation complexity |
| Login | Compact player-card form with labelled fields and sign-in/register tabs | Split illustration and form | A on phones, B possible desktop only if artwork improves hierarchy; no empty full-height parchment |
| Game frame | Question / flexible stage / control dock within dynamic viewport | Side-by-side question and stage | A mobile, B wide desktop; never crop controls to force fit |

## Shared rules
Use existing ink #244758, parchment #fff1d1, gold #ffd37b, sky #bfe5ec, teal #397d79 and wood #76543c. Existing pixel font for short headings; readable body font for labels/questions. Spacing 4/8/12/16/24/32px; controls at least 44px. Borders 2–4px with hard offset shadows. One decorated panel per action group; avoid panel-inside-panel decoration. Preserve existing SVG sprites with crisp integer scaling. No smooth substitute illustrations or emoji icons. Local CSS modules own new components; retire old selectors as components migrate. Reduced-motion support and visible keyboard focus required.

Independent specialist review could not execute: all three agents returned workspace out-of-credits. Proposed alternatives are not rendered/accepted designs yet.
