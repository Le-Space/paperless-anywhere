# E — Le Space branding and the simple/technical switch

Read-only research, 2026-11-17. Nothing was modified.

## Part 1 — Branding

### 1.0 Verdict

- **A written style guide exists, and there are two of them.**
  1. **"Le Space Belege — Brand & Style Guide v1.0"** (6 pages, image-only PDF). This is the one the PWA follows
     (`pwa/src/lib/theme.css:2` names it). It is **not checked into any repo**; the only copy found is
     `(not in any repo; a local copy only) Le Space Belege — Brand & Style Guide v1.pdf`. Its machine-readable form is
     `sites/belege/src/styles.css` in Le-Space/landing (local: `Le-Space/landing: sites/belege/src/styles.css`, tracks origin/main, release 0.3.25, 2026-11-15).
  2. **"Le-Space Brand Style Guide"** (umbrella brand, older: dark "space" look, Signal Coral + Sync Cyan, Inter + JetBrains Mono).
     In the repo: `Le-Space/landing: docs/le-space-brand/Le-Space-Brand-Style-Guide.pdf`, source
     `docs/le-space-brand/build/build_styleguide.py`, summary `docs/le-space-brand/README.md`, tokens `packages/shared/src/tokens.css`.
     This is NOT the look of Paperless anywhere. The relaunch of le-space.de (`sites/le-space-next/src/styles.css:1-13`) itself
     moves to the Belege system (paper/night, Sora, IBM Plex Mono) and keeps only coral as the umbrella accent.
- Wording/tone rules are written down in `Le-Space/landing: AGENTS.md:10-53` and on page 06 of the Belege guide.
- No design-system / brand repo on GitHub (checked `gh repo list Le-Space` 48 repos, NiKrause; code search "Brand & Style Guide" hits only Le-Space/landing).
  `packages/brand` in Le-Space/simple-todo and `relay-button/docs/docusaurus/docs/reference/branding.md` are per-project, not the product brand.
- The PWA's theme.css **matches the Belege tokens in every shared colour**; drift is in type scale, missing tokens, and additions (list in 1.6).

### 1.1 Belege Brand & Style Guide v1 — what the PDF says (read page by page)

- **01 Cover**: signet (coin + receipt), "LE SPACE" spaced mono caps above the lowercase product name in Sora bold.
  Light: amber coin, ink receipt, on paper. Dark: lime coin, snow receipt, on night; "LE SPACE" in violet on dark.
- **02 Logo-System**: "Das Signet bleibt in beiden Modi gleich aufgebaut: Münze (Zahlung) und Bon (Beleg) greifen ineinander.
  Helle Fläche = Amber/Navy, dunkle Fläche = Lime/Snow." Clear space = 1/4 of signet height; minimum size 16 px.
  Monochrome variant for favicon/engraving: always ONE colour for the whole signet, never tint coin and receipt separately.
  Rules: do not distort, do not rotate, no shadows, no own colours, not on busy images.
- **03 Farben** ("Eine Palette, zwei Modi: Warmes Papier mit Amber am Tag, tiefes Night mit Lime in der Nacht. Violet ist der Krypto-Akzent."):

  | Light | Hex | Role | Dark | Hex | Role |
  |---|---|---|---|---|---|
  | Papier / paper | `#FAF6EE` | page background | Night / night | `#0B0E15` | page background |
  | Karte / surface | `#FFFFFF` | cards, tables, inputs | Panel / panel | `#161B26` | cards, tables, inputs |
  | Ink / ink | `#0F1B2D` | text, primary fills, receipt | Snow / snow | `#F4F6FB` | text, receipt |
  | Slate / slate | `#51606F` | secondary text, labels | Muted / muted | `#8A94A6` | secondary text, labels |
  | Linie / line | `#E3DCCB` | dividers, borders, grid | Linie / dline | `#2A3140` | dividers, borders, grid |
  | Amber / amber | `#FFB020` | accent: payment, CTA, highlights | Lime / lime | `#C6F24E` | accent: payment, CTA, highlights |
  | | | | Violet / violet | `#7C5CFF` | secondary accent: crypto, links in dark mode |

  Contrast: Ink/Paper 14.2:1, Snow/Night 15.8:1.
- **04 Typografie**: "Sora für alles Sichtbare, IBM Plex Mono für alles Gezählte." Sora = display, wordmark, UI, body.
  IBM Plex Mono = amounts, rates, accounts, hashes, code. Scale (size/line, px):

  | Step | Face | Size / line |
  |---|---|---|
  | Display | Sora Bold (700) | 64 / 68 |
  | H1 | Sora Bold (700) | 40 / 44 |
  | H2 | Sora Semibold (600) | 24 / 30 |
  | Body | Sora Regular (400) | 17 / 27 |
  | Data | IBM Plex Mono (400) | 14 / 22 |

  Section kicker ("STYLE GUIDE — 02", "LIGHT MODE"): mono/sans caps with wide tracking, in dark amber on paper, lime on night.
  The second line of a headline may be set in the accent (amber) at display size only.
- **05 Icons & UI-Elemente**: three fixed building blocks: dark-mode switch top right (round button, moon in light, sun in dark;
  "Der Zustand folgt zuerst dem System, dann der Wahl des Nutzers"), QR to the app URL (dark variant with snow modules),
  social row (ink rounded squares). **Header order**: logo left · navigation centred · right: language ("DE | EN" in mono), QR, dark mode, CTA.
  CTA = ink pill with paper text ("App öffnen"); in dark mode the colours mirror (lime pill, night text).
  Cards: white surface, 1 px line border, large radius.
- **06 Messaging DE/EN**: "Ton: klar, konkret, ohne Superlative. Du-Form auf Deutsch, 'you' auf Englisch."
  "Vermeiden: 'KI-Agent', 'revolutionär', 'mühelos' — sagen, was es tut: sammelt, matcht, versiegelt, exportiert."

The guide does not define: radii in numbers, spacing scale, shadows, status colours (ok/warn/danger), form controls. Those exist only in code.

### 1.2 Reference implementation: landing `sites/belege/src/styles.css` (origin/main) — tokens

```css
 14  :root {
 15    --bg: #faf6ee; /* paper */
 16    --surface: #ffffff; /* surface — cards, tables, inputs */
 17    --text: #0f1b2d; /* ink */
 18    --text-2: #51606f; /* slate */
 19    --line: #e3dccb;
 20    --accent: #ffb020; /* amber — payment, CTA, highlights */
 21    --accent-ink: #0f1b2d; /* text on the accent */
 22    --accent-2: #7c5cff; /* violet — crypto */
 23    --accent-2-ink: #ffffff;
 24    /* A readable accent for links and small labels on the page background:
 25       amber itself is 1.9:1 on paper, so text that must be amber-ish is darkened. */
 26    --accent-text: #8a5a00;
 27    --accent-2-text: #5b3fd6;
 28    --mark-coin: var(--accent);
 29    --mark-receipt: var(--text);
 30    --cta-bg: var(--text);
 31    --cta-text: var(--bg);
 32    --focus: #0f1b2d;
 33    --shadow: 0 1px 2px rgba(15, 27, 45, 0.06), 0 8px 24px rgba(15, 27, 45, 0.06);
 34  
 35    --font: 'Sora Variable', 'Sora', system-ui, -apple-system, 'Segoe UI', sans-serif;
 36    --mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace;
 37  
 38    /* Type scale from the guide: Display 64/68 · H1 40/44 · H2 24/30 · Body 17/27 · Data 14/22 */
 39    --fs-display: 64px;
 40    --lh-display: 68px;
 41    --fs-h1: 40px;
 42    --lh-h1: 44px;
 43    --fs-h2: 24px;
 44    --lh-h2: 30px;
 45    --fs-body: 17px;
 46    --lh-body: 27px;
 47    --fs-data: 14px;
 48    --lh-data: 22px;
 49  
 50    --max: 1120px;
 51    --gutter: 20px;
 52    --radius: 16px;
 53    --radius-sm: 10px;
 54  
 55    color-scheme: light;
 56  }
 57  
 58  :root[data-theme='dark'] {
 59    --bg: #0b0e15; /* night */
 60    --surface: #161b26; /* panel */
 61    --text: #f4f6fb; /* snow */
 62    --text-2: #8a94a6; /* muted */
 63    --line: #2a3140;
 64    --accent: #c6f24e; /* lime */
 65    --accent-ink: #0b0e15;
 66    --accent-2: #7c5cff; /* violet — crypto, links */
 67    --accent-2-ink: #ffffff;
 68    --accent-text: #c6f24e; /* lime on night: 14.9:1 */
 69    --accent-2-text: #a893ff; /* 7.4:1 on night */
 70    --mark-coin: var(--accent);
 71    --mark-receipt: var(--text);
 72    --cta-bg: var(--accent);
 73    --cta-text: var(--accent-ink);
 74    --focus: #c6f24e;
 75    --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 10px 30px rgba(0, 0, 0, 0.35);
 76    color-scheme: dark;
 77  }
```

Further rules in the same file (path:line):
- body 17px/27px weight 400 (`:97-107`); h1 40/44 700 ls -0.015em (`:121-126`); h2 24/30 600 ls -0.01em (`:128-133`); h3 = body size, 600 (`:135-139`).
- links: `color: inherit`, underline in `--line`, offset 3px, hover underline currentColor (`:141-150`).
- focus: `2px solid var(--focus)`, offset 3px, radius 4px (`:152-156`).
- `.data`/`code`: mono 14/22 (`:163-169`).
- layout: `--max: 1120px`, `.container` padding `0 var(--gutter)` (20px, 16px ≤720px) (`:172-177`); `.section` padding 72px 0 with top border line, 52px on phones (`:179-182, :262-264`); `.section-head` max 720px, margin-bottom 40px (`:184-187`).
- `.kicker`: mono 12/18, letter-spacing 0.18em, uppercase, `--accent-text`, margin-bottom 14px (`:189-198`).
- `.card`: `background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius)` (16px) — no shadow by default (`:212-216`).
- phone scale ≤720px: display 40/44, h1 30/36, h2 22/28, gutter 16px (`:251-260`); ≤330px (Galaxy Fold cover): hyphens auto (`:238-249`).
- Dark mode is `:root[data-theme='dark']` set by a theme store (system first, then the visitor's choice in localStorage; `packages/shared/src/theme.js`, `sites/belege/src/lib/ThemeToggle.svelte:1-8`).

Buttons on the Belege site (components, not global):
- primary CTA: pill `border-radius: 999px`, `background: var(--cta-bg); color: var(--cta-text)`, weight 600, hover `filter: brightness(1.08)`;
  hero height 52px padding 0 24px (`sites/belege/src/lib/Hero.svelte:109-127`), header height 44px padding 0 20px font 15px (`Header.svelte:142-154`).
- secondary: same pill, `border: 1px solid var(--line); background: var(--surface); color: var(--text)`, hover border `--text-2` (`Hero.svelte:129-137`).
- round icon button (theme, QR): 44×44, `border-radius: 50%`, 1px line border, surface background, text colour (`ThemeToggle.svelte:31-44`).
- global `button { font: inherit; color: inherit; }` only (`styles.css:158-161`) — the site does NOT style bare `<button>`.

### 1.3 Tone of voice (where written)

`Le-Space/landing: AGENTS.md`:
- `:8` every user-facing string in German and English, "edit both or neither".
- `:15-17` English is British English (-ise), institutional tone.
- `:19-33` German address per site: le-space.de, local-first, **belege and yoga speak "du"**; lora is address-free. Belege: "clear, concrete, no superlatives; it says what the product does — collects, matches, seals, exports — never 'AI agent'".
- `:35-39` banned words: Game-Changer, revolutionary, unleash, limitless, disrupt, Reward (→ Vergütung), Mittelsmänner (→ Intermediäre), "Accounts" in German (→ Konten), "Strom" for the grid. **No exclamation marks in marketing copy.**
- `:46-50` "Honesty is part of the register": claims state their limits in the same breath.
- `:52-53` repo artefacts in English.
- `:57-58` copy lives in data files, never hard-coded in components.
- `:92-131` time/date convention: calendar days in the page language; moments in the reader's locale with the zone named, UTC on hover; build stamps take the commit instant.
- `:133-142` page-QR convention: app-like pages carry a QR icon in the top-right control group, generated locally, white plaque in both themes.
- Belege guide p.06 (above) and `sites/belege/src/locales.js:1-8`.

Paperless anywhere itself: German speaks **du** (`pwa/src/lib/i18n/app.js:10,16,18`; "Sie" appears only as the pronoun "they"), the product name is always "Paperless anywhere", never "paperless" alone (`pwa/src/lib/Logo.svelte:4-5`). The PWA repo has no AGENTS.md/CLAUDE.md with wording rules; `docs/` has none either.

Note: Le-Space/simple-todo's escrow01 German uses **Sie** (`apps/escrow01/src/lib/i18n/de.json:272`) — a tutorial exception, not the product voice.

### 1.4 PWA `pwa/src/lib/theme.css` — full token list, verbatim (lines 1-71)

```css
  1  /*
  2   * The look of Le Space Belege (Brand & Style Guide v1), as on belege.le-space.de:
  3   * warm paper with amber by day, deep night with lime at night. The mode follows
  4   * the system. Fonts are self-hosted (@fontsource), nothing is loaded from elsewhere.
  5   *
  6   * Amber and lime are fills with ink/night text on them, never text on the page
  7   * background; --accent-text is the readable variant for small labels.
  8   */
  9  :root {
 10  	--bg: #faf6ee; /* paper */
 11  	--surface: #ffffff; /* cards, inputs */
 12  	--surface-2: #f3eee2; /* quiet panels inside a card */
 13  	--text: #0f1b2d; /* ink */
 14  	--text-2: #51606f; /* slate */
 15  	--line: #e3dccb;
 16  	--accent: #ffb020; /* amber */
 17  	--accent-ink: #0f1b2d;
 18  	--accent-text: #8a5a00;
 19  	--accent-2-text: #5b3fd6; /* violet, links */
 20  	--mark-coin: var(--accent);
 21  	--mark-receipt: var(--text);
 22  	--cta-bg: var(--text);
 23  	--cta-text: var(--bg);
 24  	--ok: #1f7a3d;
 25  	--ok-bg: #e6f3e9;
 26  	--warn: #8a5a00;
 27  	--warn-bg: #fff3d6;
 28  	--danger: #b3261e;
 29  	--danger-bg: #fdecea;
 30  	--focus: #0f1b2d;
 31  	--shadow: 0 1px 2px rgba(15, 27, 45, 0.06), 0 8px 24px rgba(15, 27, 45, 0.06);
 32  
 33  	--font: 'Sora Variable', 'Sora', system-ui, -apple-system, 'Segoe UI', sans-serif;
 34  	--mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace;
 35  	--radius: 16px;
 36  	--radius-sm: 10px;
 37  	--gutter: 20px;
 38  	color-scheme: light;
 39  }
 40  
 41  @media (prefers-color-scheme: dark) {
 42  	:root {
 43  		--bg: #0b0e15; /* night */
 44  		--surface: #161b26; /* panel */
 45  		--surface-2: #1d2331;
 46  		--text: #f4f6fb; /* snow */
 47  		--text-2: #8a94a6; /* muted */
 48  		--line: #2a3140;
 49  		--accent: #c6f24e; /* lime */
 50  		--accent-ink: #0b0e15;
 51  		--accent-text: #c6f24e;
 52  		--accent-2-text: #a893ff;
 53  		--cta-bg: var(--accent);
 54  		--cta-text: var(--accent-ink);
 55  		--ok: #7fd99a;
 56  		--ok-bg: #16281d;
 57  		--warn: #ffc65c;
 58  		--warn-bg: #2b2414;
 59  		--danger: #ff8a80;
 60  		--danger-bg: #2e1715;
 61  		--focus: #c6f24e;
 62  		--shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 10px 30px rgba(0, 0, 0, 0.35);
 63  		color-scheme: dark;
 64  	}
 65  }
 66  
 67  @media (max-width: 720px) {
 68  	:root {
 69  		--gutter: 16px;
 70  	}
 71  }
```

Rest of theme.css (global element rules):
- `body` 16px / 1.6 (`:83-91`); `h1,h2,h3` ls -0.01em, lh 1.25 (`:93-98`); `h2` 1.25rem 600 (`:100-103`); `h3` 1rem 600 (`:105-108`).
- `a { color: var(--accent-2-text); text-underline-offset: 3px }` — violet links (`:110-113`).
- `code, pre, .data` mono 0.875rem (`:115-120`); focus 2px `--focus`, offset 2px, radius 4px (`:122-126`).
- **bare `button`** = CTA pill: `color: var(--cta-text); background: var(--cta-bg); border: 1px solid var(--cta-bg); border-radius: 999px` (`:128-136`); disabled opacity 0.45 (`:138-141`).
- `input, textarea, select`: surface, 1px line, `--radius-sm`, padding 0.5rem 0.65rem (`:143-152`); radio/checkbox `accent-color: var(--text)` (`:154-158`).
- `fieldset` border `--line` (`:164-166`); `dialog` surface/text (`:168-171`).

Fonts: `@fontsource-variable/sora` 5.2.8 (variable, all weights), `@fontsource/ibm-plex-mono` 5.2.7 weights 400 and 500 only
(`pwa/package.json:21-22`, `pwa/src/routes/+layout.svelte:3-5`). Self-hosted, nothing loaded from elsewhere.
Weights in use: 400 body, 500 (mono `.n`), 600 headings/CTA/summary, 700 logo name and price.

`pwa/src/app.html:11-12`: theme-color `#faf6ee` (light) / `#0b0e15` (dark), `lang="de"`.
`pwa/static/manifest.webmanifest`: name/short_name "Paperless anywhere", background_color and theme_color `#faf6ee`, display standalone, start_url `/app/`, icons 192/512 maskable + favicon.svg.

### 1.5 PWA logo and landing styles

`pwa/src/lib/Logo.svelte`:
- the Belege signet (coin + receipt, "style guide 02") with "LE SPACE" and the product name beside it; "Colours come from the tokens; never tinted apart" (`:2-5`).
- viewBox 0 0 100 100; coin = circle cx36 cy38 r27 stroke-width 17, stroke `--mark-coin` (accent); receipt = rounded square with window (evenodd), fill `--mark-receipt` (text) (`:16-25, :51-52`).
- default size 36px; gap 0.3×size (`:12, :49`).
- `.prefix` "LE SPACE": mono, 0.24×size, letter-spacing 0.32em, `--text-2` (`:57`). (The guide shows it violet in dark mode; the PWA and the Belege site keep it text-2.)
- `.name`: weight 700, 0.62×size, ls -0.03em (`:58`); `.sub`: 0.3×size, `--text-2` (`:59`).

`pwa/src/lib/landing/Landing.svelte` `<style>` (line numbers within the style block, which starts near line 284):
- page width 1040px, padding `0 var(--gutter)`; sticky header ≥981px with full-bleed `--bg` and a 1px line below.
- nav links 0.9rem `--text-2`, hover `--text`; nav hidden ≤980px.
- language chip `.lang`: mono 0.75rem, padding 0.25rem 0.55rem, transparent, 1px line, pill; `.lang.on` = cta-bg/cta-text.
- section padding 3.5rem 0 1rem; h2 1.75rem; `.lead` 1.1rem `--text-2`, max 46rem.
- `.kicker`: `--accent-text`, uppercase, letter-spacing 0.12em.
- h1 `clamp(2rem, 5vw, 3.4rem)`, lh 1.08, ls -0.03em, max 22ch; rotating word in `--accent-text`.
- `.cta`: `padding: 0.85rem 1.5rem; border-radius: 999px; background: var(--cta-bg); color: var(--cta-text); font-weight: 600`, hover brightness(1.08).
- cards (`.points li, .cards li, .steps li`): surface, 1px line, `--radius`, padding 1.25rem, **`box-shadow: var(--shadow)`**; `.points li` has `border-top: 4px solid var(--accent)`.
- plans: surface, 1px line, radius, padding 1.5rem; featured plan `border: 2px solid var(--accent)`; `.price` 2.4rem 700 ls -0.03em.
- FAQ `details`: surface, 1px line, radius, padding 0.9rem 1.1rem; summary 600.
- footer: top border line, `--text-2`, 0.85rem.

`pwa/src/lib/landing/TrustBox.svelte` (SVG diagram box): rect rx 12, fill surface, stroke line 1.5; tones `.ok` (ok-bg/ok), `.warn` (warn-bg/warn), `.outer` (surface-2, dashed text-2);
kicker mono 11px uppercase ls 0.06em in `--accent-text`; title 14.5px 600; text 12.5px `--text-2`; key dots: image = warn, data = ok, vault = `--accent-2-text` (`:23-36`).

### 1.6 Drift: PWA theme.css vs landing `sites/belege/src/styles.css`

Identical (hex for hex): `--bg, --surface, --text, --text-2, --line, --accent, --accent-ink, --accent-text, --accent-2-text, --mark-coin, --mark-receipt, --cta-bg, --cta-text, --focus, --shadow, --font, --mono, --radius (16), --radius-sm (10), --gutter (20/16)` in both modes.

Differences:
1. **Dark-mode mechanism**: PWA `@media (prefers-color-scheme: dark)` only, no toggle (`theme.css:41`); landing `:root[data-theme='dark']` + round toggle that follows the system first and then the user's choice (guide p.05 requires the switch in the header, far right).
2. **Type scale missing in the PWA**: no `--fs-*/--lh-*` tokens. Body is 16px/1.6 (guide: 17/27). h2 is 1.25rem=20px global, 1.75rem=28px on the landing page (guide: H2 24/30, H1 40/44). h1 is a clamp 32–54px with lh 1.08 (guide: H1 40/44, Display 64/68). Heading lh 1.25 and ls -0.01em for all (guide/landing: h1 -0.015em).
3. **Missing tokens**: `--accent-2` (#7c5cff violet fill) and `--accent-2-ink` (#fff); `--max` (landing 1120px; PWA hard-codes 1040px).
4. **PWA additions not in the guide or the landing**: `--surface-2` (#f3eee2 / #1d2331), status set `--ok #1f7a3d/#7fd99a`, `--ok-bg #e6f3e9/#16281d`, `--warn #8a5a00/#ffc65c`, `--warn-bg #fff3d6/#2b2414`, `--danger #b3261e/#ff8a80`, `--danger-bg #fdecea/#2e1715`. Needed by an app; they are the PWA's own invention and undocumented.
5. **Links**: PWA links are violet (`--accent-2-text`), landing links inherit the text colour with a line-coloured underline. The guide names violet for "Krypto, Links im Dark Mode" only.
6. **Bare `button`**: PWA makes every `<button>` a filled CTA pill globally; the landing styles buttons per component (primary/secondary/round). In the PWA every secondary button has to undo the global rule — there is no secondary/ghost button token or class.
7. **Focus offset** 2px (PWA) vs 3px (landing).
8. **Cards**: PWA landing cards carry `--shadow`; the Belege `.card` has none (border only).
9. **Kicker**: PWA letter-spacing 0.12em, inherits the font (Sora); landing mono 12/18 at 0.18em.
10. **Manifest**: single `theme_color` (#faf6ee) — fine, the manifest cannot be per-scheme; app.html handles both.
11. No QR button and no dark-mode toggle in the PWA header (guide p.05 / AGENTS.md "Page-QR convention" for app-like pages).

### 1.7 Umbrella "Le-Space Brand Style Guide" (for reference; not the product look)

Source `Le-Space/landing: docs/le-space-brand/README.md:73-93`, `build/build_styleguide.py:24-39, :188-190, :437-446, :464-465`, tokens `packages/shared/src/tokens.css:2-86`.
- Core: Deep Space `#0B0E15` (bg), Nebula `#141926` (cards), Horizon `#232B3D` (borders), Starlight `#EDF1F8` (headings), Stardust `#A8B3C7` (body), Signal Coral `#FF6B5B` (primary accent, local node), Sync Cyan `#58C7F3` (links, peers).
- Layers: Identity `#3EDC97`, Data `#FFC24B`, Sync `#58C7F3`, Infrastructure `#A78BFA`, Archive `#FF6B5B`. Light mode: Ink `#141B2E`, Coral `#E8503F`, Cyan `#0E86C4`.
- Fonts: JetBrains Mono (wordmark, code, labels), Inter (headlines, body, UI). Scale: Display Inter Bold clamp 40–64/1.05, H1 40/1.1, H2 28/1.2, H3 SemiBold 20/1.3, Body 16/1.6, Small 14/1.5, Eyebrow JB Mono Bold 13 caps +8%, Code 14/1.55.
- Components: radius 10px cards, 8px buttons, 1px Horizon border; primary = coral, secondary = Nebula + border, tertiary = cyan text link.
- Tonality: "direkt, konkret und technisch ehrlich — Du-Ansprache, kurze Sätze, keine Marketing-Superlative."
- Shared background `#0B0E15` is the one colour both systems have in common (Belege "night" = "Deep Space").

## Part 2 — The simple/technical switch in simple-todo

Repo: Le-Space/simple-todo (monorepo; NiKrause/simple-todo is archived). Local: `a checkout of Le-Space/simple-todo` (main c9d6c16, 2026-10-21; the switch files are unchanged on origin/main 5fa9b8c, 2026-11-12). `a local checkout` is the old single-app checkout on branch delegation01 and has no such switch.
The switch lives only in the chapter **`apps/escrow01`** (plus a local, non-persisted variant inside the shared consent dialog `packages/ui/src/ConsentModal.svelte`).

### 2.1 Store — `apps/escrow01/src/lib/technical-view.js` (whole file)

```js
  1  import { writable } from 'svelte/store';
  2  
  3  /**
  4   * Whether the page shows its technical explanations (escrow01).
  5   *
  6   * One switch for the whole page. The header has it, and the consent dialog has
  7   * the same button: somebody presenting to experts turns it on once, and every
  8   * budget step then carries its detailed explanation next to the plain one —
  9   * including after a reload, which a presentation does not always avoid.
 10   */
 11  export const TECHNICAL_VIEW_STORAGE_KEY = 'simpleTodo.technicalView';
 12  
 13  /**
 14   * @typedef {Pick<Storage, 'getItem' | 'setItem'>} ViewStorage
 15   */
 16  
 17  /**
 18   * The browser's storage, or null where there is none.
 19   *
 20   * A function rather than a value: with site data blocked, Safari and Firefox
 21   * throw on the property access itself, not only on `getItem`.
 22   *
 23   * @returns {ViewStorage | null}
 24   */
 25  function browserStorage() {
 26  	try {
 27  		return typeof localStorage === 'undefined' ? null : localStorage;
 28  	} catch {
 29  		return null;
 30  	}
 31  }
 32  
 33  /**
 34   * @param {{ storage?: () => ViewStorage | null, key?: string }} [options]
 35   *   `storage` is asked on every read and write, so a test can hand in one that
 36   *   fails and the page can survive one that starts failing.
 37   */
 38  export function createTechnicalView({
 39  	storage = browserStorage,
 40  	key = TECHNICAL_VIEW_STORAGE_KEY
 41  } = {}) {
 42  	/** @returns {boolean} */
 43  	function read() {
 44  		try {
 45  			return storage()?.getItem(key) === 'true';
 46  		} catch {
 47  			// Unreadable storage: start simple, the safe default for everyone else.
 48  			return false;
 49  		}
 50  	}
 51  
 52  	/** @param {boolean} value */
 53  	function persist(value) {
 54  		try {
 55  			storage()?.setItem(key, value ? 'true' : 'false');
 56  		} catch {
 57  			// Blocked or full: the choice holds for this page and no longer.
 58  		}
 59  	}
 60  
 61  	const { subscribe, set } = writable(read());
 62  	let current = false;
 63  	subscribe((value) => (current = value));
 64  
 65  	return {
 66  		subscribe,
 67  		/** @param {boolean} value */
 68  		set(value) {
 69  			const next = value === true;
 70  			set(next);
 71  			persist(next);
 72  		},
 73  		toggle() {
 74  			const next = !current;
 75  			set(next);
 76  			persist(next);
 77  		}
 78  	};
 79  }
 80  
 81  export const technicalView = createTechnicalView();
```

### 2.2 Toggle — `apps/escrow01/src/lib/TechnicalToggle.svelte` (whole file)

```svelte
  1  <script>
  2  	// The switch between the simple and the technical view (escrow01). One
  3  	// component for both places it sits, the consent dialog and the page header,
  4  	// so the two read the same and switch the same page-wide setting.
  5  	import { _ } from '$lib/i18n/index.js';
  6  	import { technicalView } from './technical-view.js';
  7  
  8  	/** The consent dialog keeps the test id it always had. */
  9  	export let testid = 'technical-toggle';
 10  </script>
 11  
 12  <!-- Named after the view it switches to, as the consent dialog always did. -->
 13  <button
 14  	type="button"
 15  	on:click={() => technicalView.toggle()}
 16  	data-testid={testid}
 17  	data-technical={$technicalView}
 18  	class="rounded-md border border-border px-2 py-1 text-xs text-faint hover:text-text"
 19  >
 20  	{$technicalView ? $_('consent.simple') : $_('consent.technical')}
 21  </button>
```

### 2.3 Where it sits

- **Page header, top right**, last of three small controls: `<LanguageSwitcher /> <PageQr /> <TechnicalToggle />` — `apps/escrow01/src/routes/+page.svelte:687-691`. Comment at `:638-641`: "What stays on screen on every tab: the app, the network's state as a dot, the language and the technical view — the switches somebody presenting reaches for while they talk."
- **Consent dialog** (first screen): the same button, bound to the same store — `+page.svelte:620` `bind:technical={$technicalView}`; the dialog's own button at `packages/ui/src/ConsentModal.svelte:296-304` (`technical = !technical`, prop default `false`, `:87`).
- Look: a small outlined text button (`rounded-md border px-2 py-1 text-xs text-faint`), **labelled with the view it switches TO** (shows "Technical" while simple, "Simple" while technical). Not a segmented control, no icon, no aria-pressed; state is exposed as `data-technical`.

### 2.4 Persistence and default

- localStorage key **`simpleTodo.technicalView`**, values `'true'` / `'false'` (`technical-view.js:11, :45, :55`).
- **Default: simple** (`false`) — also when storage is unreadable ("start simple, the safe default for everyone else", `:47-48`).
- Storage is accessed through a function, wrapped in try/catch on both read and write (Safari/Firefox throw on the property access with site data blocked, `:20-31`); storage is injectable for tests (`technical-view.spec.js`).

### 2.5 How components consume it

Always **conditional rendering on the store**, additive: the simple sentence is always there, the technical layer appears next to it. No CSS class on `<body>`, no separate component trees, no route.
- `TechnicalExplanation.svelte:42` — `{#if $technicalView && content}` renders a violet-edged `<details>` block tagged "Technical"/"Technisch" (`:44-55`), with sections, code and evidence links. Dropped in wherever a step happens: `BalanceCard.svelte:63`, `AddTodoForm.svelte:226-227`, `AuditorView.svelte:91,109,132`, `BudgetNotices.svelte:122,152,193,220`, `BudgetRowNote.svelte:42`, `+page.svelte:892`.
- `P2PStatusNav.svelte:85-87` — the same component picks a different text: `statusLabel = $technicalView ? technicalStatus(...) : $_('network.simple.' + networkState)`; `:91` different "busy" logic; `:321` `data-view={$technicalView ? 'technical' : 'simple'}` (for tests, not for CSS); `:334` step list and `:378` network details (`peer id, multiaddrs`) only `{#if $technicalView}`.
- `+page.svelte:939` — the build stamp row only in the technical view.
- `ConsentModal.svelte:311-313` — build version only when technical.

### 2.6 Labels

| key | de | en | file:line |
|---|---|---|---|
| `consent.technical` (button, while simple) | Technisch | Technical | `apps/escrow01/src/lib/i18n/de.json:278`, `en.json:278` |
| `consent.simple` (button, while technical) | Einfach | Simple | `de.json:279`, `en.json:279` |
| `technical.tag` (badge on each block) | Technisch | Technical | `de.json:68`, `en.json:68` |
| `technical.documentedIn` | Belegt in | Documented in | `de.json:69`, `en.json:69` |

### 2.7 Does it transfer to the Svelte 5 runes PWA?

Yes, nearly unchanged, and the PWA already has half of it.

- escrow01 runs on Svelte 5 (`"svelte": "^5.0.0"`) in legacy syntax (`export let`, `$:`, `on:click`); the store is a plain `svelte/store` writable. The PWA (Svelte 5.37.2, runes) already uses `svelte/store` for its language (`pwa/src/lib/i18n/index.js:10`), so `technical-view.js` can be copied as is and read as `$technicalView` in runes components. A runes-native version is a `.svelte.js` module with `let on = $state(read())` and an exported object with a getter and `toggle()`; neither is better for testability, the injected-storage factory is the part worth keeping.
- The toggle needs only `onclick` instead of `on:click` and `$t.…` instead of `$_()`; Tailwind classes must be replaced by the PWA's own CSS (the PWA has no Tailwind).
- **The PWA already has a simple/advanced switch**: `pwa/src/routes/app/+page.svelte:190-208` — `let tab = $state('simple')`, key **`paperless-anywhere.tab`**, values `'simple' | 'advanced'`, default simple, try/catch around storage; rendered as a two-button `role="tablist"` (`:343-346`), labels `tabs: { label: 'Ansicht', simple: 'Übersicht', advanced: 'Erweitert' }` / `{ label: 'View', simple: 'Overview', advanced: 'Advanced' }` (`pwa/src/lib/i18n/app.js:49, :184`). It is passed down as a prop (`<Lifecycle {simple} …>`, `:370`; `Lifecycle.svelte:1153-1154` `class:simple` + `{#if simple}`) and hides a whole section (`<section class="card tech" id="technisch" hidden={simple || …}>`, `:374-378`).
- Difference in kind: the PWA's switch is **page-local state in one route, passed by props, and swaps whole panels** (two views of the app); escrow01's is a **global store any component imports, and adds a layer next to the simple text**. For a redesign that wants one app-wide "simple / technical" setting, lift the PWA's `tab` into a module like `technical-view.js` (keep the existing key so nobody's choice is lost, or migrate it), import it where needed instead of prop-drilling, and place the control in the header's control group next to the language switch, as escrow01 does.
- Two things not to copy: the button labelled only with the *other* view (state is invisible; a two-segment control with `aria-pressed`/`role="tab"` as the PWA already has is clearer), and `hidden=` on sections that hold required state is fine but conditional rendering must not unmount components that feed data (the PWA comment at `:374-377` says the tech section is rendered while hidden because its balances feed the overview's warnings).
- SvelteKit static/prerender: reading localStorage at module load is safe in escrow01 only because of the `typeof localStorage === 'undefined'` guard; keep it, the PWA is prerendered.
