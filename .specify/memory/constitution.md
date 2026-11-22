# Setlist Constitution

## Core Principles

### I. Simplicity First (YAGNI)

- Every feature MUST be built as the smallest change that satisfies its spec's acceptance criteria.
- Code, abstractions, configuration options, and dependencies MUST NOT be added for hypothetical
  future needs. Something is built when a current spec requires it, not before.
- A new runtime dependency MUST replace meaningfully more code or risk than it adds; prefer the
  platform (web standards, the browser, the framework already in use) over a new library.
- Indirection (layers, wrappers, generic helpers, plugin systems) MUST NOT be introduced until at
  least two concrete call sites need it.
- Any deviation MUST be recorded in the plan's Complexity Tracking table with the simpler
  alternative that was rejected and why.

Rationale: a small codebase is easier to change, test, and ship to every device. Complexity is
the cost most likely to slow the project down, so it has to earn its place.

### II. One Codebase, Every Screen (PWA)

- Setlist MUST ship as a single Progressive Web App serving desktop and mobile from one codebase;
  separate native apps or platform-specific forks are out of scope unless this constitution is
  amended.
- Layouts MUST be designed mobile-first and remain usable from small phone screens up to desktop
  widths, with touch and pointer/keyboard input both supported.
- The app MUST be installable from supported mobile and desktop browsers through a valid web app
  manifest. A service worker or offline caching is not required and MUST NOT be added unless a
  spec requires offline use.
- A feature is not done until it has been checked on both a mobile-sized and a desktop-sized
  viewport.

Rationale: the product promise is "available on web and mobile"; one responsive PWA keeps that
promise without multiplying the codebase, which also serves Principle I.

## Platform Constraints

- Target the current versions of the major evergreen browsers (Chrome, Safari including iOS
  Safari, Firefox, Edge). Features that rely on APIs missing from iOS Safari MUST degrade
  gracefully.
- The specific framework, hosting, and data storage choices are made in the first feature plan and
  recorded there; choosing them MUST follow Principle I.

## Development Workflow

- Work follows the Spec Kit flow: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`, one feature branch per spec.
- Each plan's Constitution Check MUST confirm both principles, and list any justified exceptions.
- Reviews MUST reject unjustified abstractions, unused code, and speculative options.

## Governance

- This constitution overrides other project practices where they conflict.
- Amendments are made by editing this file (via `/speckit-constitution`), stating the reason, and
  bumping the version: MAJOR for removing or redefining a principle, MINOR for adding a principle
  or section or materially expanding guidance, PATCH for wording and clarifications.
- Every plan and review checks compliance; exceptions are allowed only when written down with
  their justification.

**Version**: 1.1.0 | **Ratified**: 2026-11-22 | **Last Amended**: 2026-11-22
