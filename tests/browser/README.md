# Interactive browser QA
Start Next and the game service against an isolated test database. Install Playwright in your browser-testing environment, then run `node tests/browser/mobile-viewport.mjs` with QA_BASE pointing to the frontend. QA_SCREENSHOTS must be an existing writable directory. CHROMIUM_PATH optionally selects an installed Chromium; CHROMIUM_NO_SANDBOX=1 is only for isolated root-run test containers.

The script navigates all eleven practice games at seven widths, checks control bounds and commits a valid Stack. It deliberately fails on overflow. It does not test virtual keyboards, physical Safari, subjective fun or every long-text state. Those remain separate manual acceptance gates.

`session-daily.mjs` is a local-only disposable-account regression. It tests a restored HttpOnly session, transient identity failures, second-tab/refresh behavior, ten-question Daily completion with a mid-run refresh, archive access and expired-session UI. It requires the credentials backend and a prepared Daily challenge. Browser state stays in memory and must not be uploaded as evidence. It does not substitute for real elapsed-hour tests or physical mobile Safari.
