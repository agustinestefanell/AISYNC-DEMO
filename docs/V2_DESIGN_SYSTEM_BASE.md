# AISync Demo V2 - Design System Base

Last updated: 2026-04-09
Status: Active visual reference for V2 base work

## Visual Principles

AISync V2 should communicate:
- control
- continuity
- traceability
- structure
- governance
- serious work

AISync V2 should avoid reading as:
- decorative dashboard
- startup UI template
- soft consumer chat product
- mixed-style prototype

## Core Visual Direction

- Desktop-first
- Compact but breathable
- Operationally legible
- Low-noise hierarchy
- One clear action color
- Context colors reserved for team or role identity

## Palette Rules

- Neutral surfaces and structured grays carry most of the interface.
- A single restrained action blue is used for primary actions and focus states.
- Manager, worker, and team colors remain contextual, not dominant.
- Saturated color should signal state or identity, never decoration.

## Typography Rules

Defined interface levels:
- Page title
- Section title
- Panel title
- Body
- Label
- Metadata
- Caption
- Button text

Rules:
- reduce unnecessary uppercase
- prefer readable weights over loud styling
- keep size steps tight and consistent
- preserve enough contrast for operational scanning

## Action Hierarchy

- Primary action: strong filled button with the system action color
- Secondary action: bordered neutral action
- Tertiary action: low-emphasis text-like action
- Metadata: low-contrast supporting information
- Context: panel headers, pills, and labels that orient but do not compete
- State: badges and chips that communicate status clearly

## Density Rules

- compact, not cramped
- mature, not oversized
- efficient, not tiny
- enough whitespace to separate decisions without making the UI airy or decorative

## Panel Rules

Base panel structure:
- header
- body
- optional footer
- actions grouped deliberately
- metadata grouped separately from actions

This pattern should support:
- main operational panels
- contextual lateral panels
- optional detail / inspector panels

## State Rules

Base states covered by the system:
- active
- selected
- hover
- focused
- disabled
- locked
- success
- warning
- danger
- neutral

Special rule:
- `Lock` must remain visually serious and operational, not cosmetic

## Scope Rule

This design system base prepares V2 for later shell and module redesign.

It does not, by itself:
- redesign Teams Map
- redesign Audit Log
- redesign Workspace
- redesign Documentation Mode
- change validated product logic
