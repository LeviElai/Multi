# Interactive browser QA
Start Next and the game service against an isolated test database. Install Playwright in your browser-testing environment, then run `node tests/browser/mobile-viewport.mjs` with QA_BASE pointing to the frontend. QA_SCREENSHOTS must be an existing writable directory. CHROMIUM_PATH optionally selects an installed Chromium; CHROMIUM_NO_SANDBOX=1 is only for isolated root-run test containers.

The script navigates all eleven practice games at seven widths, checks control bounds and commits a valid Stack. It deliberately fails on overflow. It does not test virtual keyboards, physical Safari, subjective fun or every long-text state. Those remain separate manual acceptance gates.
