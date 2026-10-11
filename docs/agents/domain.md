# Domain Docs

How engineering skills should read domain documents from the active Matt Pocock alignment root.

## Before exploring

- Read `CONTEXT-MAP.md` at the alignment root for stable entry points.
- Read `CONTEXT.md` when the map identifies one root domain. Read the relevant `domains/<domain>/CONTEXT.md` files when it identifies multiple domains.
- Read `docs/adr/index.md` and the ADRs that affect the current area.

If a linked domain document does not exist, proceed silently. The `/domain-modeling` skill creates it when terms or decisions are resolved.

## File structure

For a single-context project, keep `CONTEXT.md` at the root and ADRs under `docs/adr/`. For a multi-context project, keep domain files under `domains/<domain>/CONTEXT.md` and ADRs under `docs/adr/`.

## Use the glossary

Use domain terms as `CONTEXT.md` defines them. If a concept is missing, reconsider the term or record the gap for `/domain-modeling`.

## Flag ADR conflicts

If your output conflicts with an ADR, name the ADR and explain the conflict. Do not silently override it.
