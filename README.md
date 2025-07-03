```markdown
# vibesheet-20250703_142246  
**Universal JayZee Form-Filler (code-name: OmniForm Phantom)**  

> Chrome/Edge/Firefox (MV3) browser-extension **?** optional headless **CLI** that maps Google-Sheet rows to any web form, fills them in bulk while simulating human behaviour, bypasses CAPTCHAs and writes results/diagnostics back to the sheet ? all secrets stored AES-encrypted on device.

---

## 1. What is this?

Imagine Mail-Merge, but for **any** web form.

1. Scan the open page ? including shadow DOM & iframes ? and auto-rank unique CSS/XPath selectors.  
2. Match those selectors with Google-Sheet columns (AI-assisted) and save the mapping locally (encrypted).  
3. Click **Run**: the extension (or the headless CLI) iterates spreadsheet rows, types, clicks, pauses like a human, solves CAPTCHAs and appends success/error codes + screenshots back to the sheet.

Use-cases: mass account creation, lead-gen, QA test-data injection, browser RPA, etc.

---

## 2. Architecture (monorepo)

```
vibesheet/
?? extension/           # MV3, built by Vite
?  ?? src/
?  ?  ?? background.ts          # service-worker orchestrator
?  ?  ?? contentScript.ts       # scanner + filler
?  ?  ?? popup/ (React wizard)  # Scan ? Map ? Run UI
?  ?  ?? services/              # shared logic (DOM, crypto, Sheets?)
?  ?? manifest.json
?? cli/                 # Node 18 + Playwright
?  ?? runJob.ts         # entry point
?  ?? browserPool.ts    # parallel contexts
?  ?? configLoader.ts
?? shared/              # isomorphic utils (crypto, types)
?? config/              # default.ini, sampleMapping.csv
?? i18n/                # messages.pot
?? logs/                # rotated debug.log
?? tests/               # Jest + Playwright
?? .github/workflows/ci.yml
```

---

## 3. Features

* ? Deep DOM, shadow-DOM & iframe crawling with precision-ranking  
* ? AES-GCM selector vault & credential store  
* ? Google-Sheets OAuth-PKCE (read/write with retry)  
* ? Human-behaviour simulation (typing cadence, mouse jitter, waits)  
* ?? Pluggable CAPTCHA solving (2Captcha / Anti-Captcha)  
* ? Parallel multi-tab runs & Playwright pool for headless mode  
* ??? WCAG-AA React popup wizard (full keyboard navigation)  
* ? Encrypted audit log + screenshot archive (export JSON/CSV)  
* ? Internationalisation ready (.pot template provided)  
* ? CI/CD ? lint, test, build, publish (Chrome Web Store & npm)

---

## 4. Quick-Start

### 4.1 Prerequisites

* Node >= 18, npm (>= 9) **or** pnpm  
* Chrome/Edge/Firefox Canary with MV3 support (for dev-loading)  
* A Google Cloud project with **Google Sheets API** enabled

### 4.2 Clone & bootstrap

```bash
git clone https://github.com/<you>/vibesheet-20250703_142246.git
cd vibesheet-20250703_142246
npm install          # workspace bootstrap
npm run build        # builds extension + CLI
```

### 4.3 Load the extension (dev)

1. `chrome://extensions` ? `Load unpacked` ? select `extension/dist/` (after build).  
2. Grant requested permissions & set a **master password**; this encrypts the local vault.

### 4.4 Use the popup wizard

1. Open the target form page.  
2. Click the extension icon ? **Scan**.  
3. Connect your Google account (OAuth popup).  
4. Review/adjust the suggested column ? selector mapping.  
5. Hit **Run** ? watch the progress bar; results/screen-shots appear in your sheet.

### 4.5 Headless / CI usage

```bash
# config/myJob.yaml (example)
spreadsheetId: "1b3?"
sheetName: Leads
range: A2:Z
mappingFile: config/sampleMapping.csv
captcha:
  provider: 2captcha
  apiKey: $2CAPTCHA_KEY
parallel: 5

# run
npx omni-form run config/myJob.yaml            # local
gh workflow run ci.yml --ref main              # GitHub-Actions
```

---

## 5. Installation (production)

### Browser extension (users)
The latest signed build is published to:

* Chrome Web Store ? **OmniForm Phantom**  
* Firefox Add-ons ? **OmniForm Phantom**

Simply install from the store. The extension auto-updates.

### CLI (power-users / CI)

```bash
npm i -g @omniform/phantom-cli      # published after CI
omni-form --help
```

---

## 6. Component Glossary

| Component | File / Dir | Purpose |
|-----------|------------|---------|
| **manifest.json** | extension/ | MV3 declaration, permissions |
| **background.ts** | extension/src | Orchestrates scanning & runs |
| **contentScript.ts** | ? | Injected scanner / filler |
| **DomScanner.ts** | services | Recursively harvests selectors |
| **SelectorVault.ts** | services | AES-GCM encrypt/decrypt + IndexedDB |
| **MappingEngine.ts** | services | Suggests & validates mappings |
| **GoogleSheetsService.ts** | services | OAuth-PKCE, rows CRUD |
| **FormFillerRunner.ts** | services | Executes per-row fills |
| **HumanSimulator.ts** | services | Key/mouse humanisation |
| **CaptchaHandler.ts** | services | Solves CAPTCHAs via drivers |
| **AuditLogger.ts** | services | Encrypted local logs & images |
| **popup/** | extension/src/popup | React wizard UI |
| **cli/runJob.ts** | cli/ | CLI entry |
| **cli/browserPool.ts** | cli/ | Parallel Playwright contexts |
| **tests/** | root | Jest + Playwright suite |
| **.github/workflows/ci.yml** | root | Lint ? Test ? Build ? Publish |

Full list in **/docs/components.md**.

---

## 7. Configuration

* `config/default.ini` ? base timeouts, captcha URL, log level  
* `config/sampleMapping.csv` ? example column?selector map  
* `config/*.yaml|json` ? headless job files (validated by `configLoader.ts`)  

Environment variables honoured by both extension & CLI:

| Variable | Meaning |
|----------|---------|
| `VIBESHEET_LOG_LEVEL` | debug / info / warn / error |
| `VIBESHEET_CAPTCHA_KEY` | default CAPTCHA API key |
| `VIBESHEET_MASTER_PASS` | override for vault master key (CLI only) |

---

## 8. Security Notes

* All selector maps, OAuth tokens and API keys are encrypted with **AES-256-GCM** using a key derived from your master password (PBKDF2-SHA-512).  
* Data never leaves your machine except:  
  1. Google Sheets API calls  
  2. (Optional) CAPTCHA provider API calls  
  3. (Optional) AI mapping service if user enables it  
* Audit logs are stored locally (`logs/`) and can be wiped from the settings page.

---

## 9. Development Scripts

```bash
npm run dev            # vite + HMR for extension UI
npm run build          # production build (extension + cli)
npm run lint           # eslint + stylelint + tsc
npm run test           # jest unit tests
npm run e2e            # playwright e2e headless
npm run format         # prettier write
```

Git hooks (husky) ensure tests & lints pass before commit.

---

## 10. Contributing

PRs and issues are welcome!

1. Fork & clone; create a feature branch.  
2. Make changes, add/adjust tests.  
3. `npm run test && npm run lint && npm run build`  
4. Submit pull-request following the **Conventional Commits** spec.

See `CONTRIBUTING.md` for coding-style, branch-plan and release process.

---

## 11. Roadmap / Ideas

* Safari MV3 port (WebExtension polyfill)  
* Desktop GUI (Electron/TAURI) for offline mapping  
* Native AI selector-mapping (Gemini/GPT-4 toggle)  
* Sheet triggers (= auto-run when new rows appear)  
* Self-hosted anti-CAPTCHA ML model  
* Enterprise remote-vault & team-sharing

---

## 12. License

Apache-2.0 ? 2024-present OmniForm Phantom authors.  
See `LICENSE`.

---

## 13. Acknowledgements

* `Playwright`, `React`, `Vite`, `Chrome MV3`, `Dexie`, `Jest`, `TypeScript`  
* Early beta testers from the **JayZee RPA** community

Happy form-filling! ?
```