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
