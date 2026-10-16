# Design skills in this repository — how to use them

Added 2026-09-30 at the owner's request. Any Claude Code session opened on this
repository (ours, the website session, Ishbek's team) finds them automatically
in `.claude/skills/` and uses them when working on an interface. They can also
be called by name:

| Command | When |
|---|---|
| `/impeccable audit <screen>` | Technical review of a screen: accessibility, performance, RTL, platform. A report only; nothing changes |
| `/impeccable critique <screen>` | UX review with a score |
| `/impeccable polish` · `harden` · `clarify` · `layout` · `typeset` · … | Targeted fixes (full list in `impeccable/SKILL.md`) |
| `design-taste-frontend` | Landing pages and redesigns that don't look templated (the website more than the app) |
| `emil-design-eng` | Micro-interactions, animation and fine polish |

**How they were used on the app (2026-09-30):**
1. `impeccable audit` scored the ordering journey 9/20.
2. The P0 and P1 fixes then followed `craft-floor.md` before every UI edit.
3. Every fix got a test that was checked by breaking it on purpose.

The report is summarised in `docs/HANDOVER.md`.

**Advisory mode, no scripts.** This copy has no `scripts/` folder, and
`impeccable/SKILL.md` says never to download or run its binary or `npx
impeccable`. The `live`, `generate`, `hooks`, `doctor` and `pin` commands are
therefore unavailable. No file here runs anything; they are guidance only.

**Licences:** each folder keeps its original `LICENSE.txt` (`impeccable` also
has `NOTICE.md`). The changes from upstream are listed below.

---

# web-design-skills

Three third-party open-source skills, bundled for Almond's website work.

| Skill | What it does | Source | License |
|---|---|---|---|
| `emil-design-eng` | UI polish, component feel, animation decisions (Emil Kowalski's design-engineering approach) | github.com/emilkowalski/skills @ d16ebe6 | MIT |
| `impeccable` | Design critique, audit, polish, typography, layout, color, motion, UX copy, responsive, hardening | github.com/pbakaus/impeccable @ 40f990f | Apache-2.0 (see NOTICE.md) |
| `design-taste-frontend` | Landing pages and redesigns that don't look templated | github.com/Leonxlnx/taste-skill @ ce26fc2 | MIT |

Each skill folder carries its original LICENSE.

## Changes from upstream (29/9/2026)

- **emil-design-eng:** none.
- **design-taste-frontend:** image-generation tools are offered, not used automatically (some are paid); customer-logo walls only for real, confirmed customers or partners.
- **impeccable (advisory mode):**
  - Shipped without the `scripts/` folder (its launcher downloads and runs a binary, and it runs `npx` packages).
  - Removed the reference files for `live`, `generate`, `hooks` and `doctor`, which depend entirely on those scripts.
  - Added a package note to SKILL.md: skip the launcher, never download or run it, and ask before using paid image tools.
  - Removed one sentence from reference/init.md (treating system-prompt context as proving nothing).
  - Removed one sentence from reference/new-work.md (using the least-sandboxed shell path).
  - Modified files carry a notice at the top.

---

# The app skills — added 2026-10-16

Owner, 2026-10-16: «ما افضل السكلز لعمل تطبيق يشبه تطبيق دنكن دونتس … ومثل
ستاربكس … حتى يكون التطبيق احترافي مش مبين ai وله بصمه الموند». Seven more
skills, for the members' app (Expo SDK 56, React Native) rather than the
website. Each was fetched, read in full, licence-checked and copied by one
agent, then checked on disk by a second agent; both checks passed.

| Skill | What it gives the app | Load it when |
|---|---|---|
| `expo-design-system` | One token theme (colour, spacing, type, radius, shadow, motion), the component contract, and an audit of 20 named "native slop" tells of AI-generated apps | Changing tokens or shared components, or auditing a screen that looks generic |
| `expo-native-ui` | Platform styling: Apple HIG and Material 3, semantic colours with dark mode, native controls, blur, safe areas, tabular numbers, a screen checklist | Building or restyling any screen |
| `expo-animation` | Motion decided in order: whether, which thread, which properties, spring or timing, gesture hand-off, reduced motion. Reanimated, Gesture Handler, `expo-haptics`, with recipes | Press feedback, sheets, transitions, haptics, reward moments |
| `expo-router` | Native headers, tabs, form sheets, search bars, link previews | Headers, tabs, sheets, modals |
| `react-native-best-practices` (Callstack) | Smoothness: FPS, startup, re-renders, lists, animations, bundle size | A screen that stutters, a slow start, a long list |
| `frontend-design` (Anthropic) | An aesthetic direction before code, and the choices that read as templated defaults | Shaping a new screen's look. Web-oriented: apply the thinking, not the CSS |
| `ui-ux-pro-max` | A searchable library: styles, colour palettes, font pairings, UX guidelines, with a React Native stack file | Choosing a palette or a font pairing; read the CSVs in `data/` directly |

| Skill | Source | Licence |
|---|---|---|
| `expo-design-system`, `expo-native-ui`, `expo-animation`, `expo-router` | github.com/expo/skills @ 927dd7c | MIT (`expo-animation` also MIT, Emil Kowalski) |
| `react-native-best-practices` | github.com/callstackincubator/agent-skills @ 59e9d17 | MIT |
| `frontend-design` | github.com/anthropics/skills @ dbd4588 | Apache-2.0 |
| `ui-ux-pro-max` | github.com/nextlevelbuilder/ui-ux-pro-max-skill @ 56ea9cf | MIT |

**Order of use for an app screen:** `impeccable critique` (what is wrong) →
`expo-design-system` (tokens first, then components) → `expo-native-ui` (the
screen) → `expo-animation` (the moments) → `react-native-best-practices` (it
stays smooth) → `impeccable polish`. `craft-floor.md` is still read before any
UI edit.

**The brand wins.** These skills are generic. Where one conflicts with
`CLAUDE.md` (Arabic first, RTL, Latin digits, black and white with the one
warm accent the owner approved on 2026-10-16, no false promises), `CLAUDE.md`
wins. A palette from `ui-ux-pro-max` is a reference, never a replacement for
Almond's tokens in `packages/shared/src/theme`.

## Changes from upstream (16/10/2026)

Every modified file carries a notice right after its YAML front matter (the
front matter must stay first for the skill to load). Unmodified files are
byte for byte.

- **All four Expo skills:**
  - Removed the "Submitting Feedback" section, which ran
    `npx --yes submit-expo-feedback@latest` and sent data to Expo.
  - Did not copy the telemetry skill `expo-skill-feedback`, the plugin's hooks
    (they ran a telemetry script on every skill use), its MCP registration, or
    the `agents/openai.yaml` files.
  - Dropped `expo-native-ui/references/webgpu-three.md`, a 3D guide that
    installed packages with `--legacy-peer-deps` and rewrote
    `metro.config.js`.
- **`react-native-best-practices`:**
  - Replaced unpinned download-and-run commands with "Not run here" notes:
    `npx source-map-explorer`, `expo-atlas`, `bundle-stats`,
    `react-compiler-healthcheck@latest`, `create-react-native-library@latest`.
  - Removed advice to wire a debug inspector into release builds.
  - Removed instructions to upload app binaries or images to third parties
    (Emerge Tools, TinyPNG); doing so is the owner's decision.
  - Gated third-party binaries (Flashlight, AOSP's alignment script,
    `agent-device`) behind the owner's approval.
  - Did not copy the TV, brownfield and library skills.
- **`ui-ux-pro-max`:**
  - Did not ship the Python search script or the `--persist` feature that
    wrote files into the project. An agent greps the CSVs instead.
  - Left out the shadcn, Nuxt UI and Vue stack files, which told the agent to
    run unpinned `npx` scaffolders.
  - The notice flags version drift: its Next.js rows target 16 and Tailwind
    4.3; Almond runs Next.js 15.5 and Tailwind 3.4.
- **`frontend-design`:** none. The theme-factory skill from the same
  repository was read and not copied: it themes slides and HTML artifacts, not
  an app.
