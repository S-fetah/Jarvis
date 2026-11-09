---
name: api-from-docs
description: Build, extend, or integrate API endpoints and third-party API clients using official documentation instead of recall, while matching the project's existing structure and conventions. Use this whenever the user mentions an endpoint, route, controller, API client, SDK call, webhook, supplier/provider response, response parsing, or asks to "check the docs" for a library — even if they only say "add X to the API" without naming docs.
---

# API work, grounded in docs and in this repo

Two failure modes make model-written API code bad: invented SDK signatures, and code
that ignores how the rest of the project is written. This skill fixes both, cheaply.

## Context budget

Aim for **6 or fewer file reads** before writing code. Reading the whole repo is not
thoroughness, it is noise — the nearest sibling file already encodes the conventions.

## 1. Orient

- Locate the closest existing thing of the same kind (an existing route, client,
  service, or parser). Use targeted search (`rg -l`, list the routes/services folder),
  not recursive reads.
- Read **one** sibling end to end. That file is the template: naming, folder
  placement, validation, error shape, logging, return type, export style.
- Read the shared plumbing it imports (http wrapper, error class, shared types).
  Skim long files; you need signatures, not bodies.
- If three searches fail to turn up a sibling, stop and ask where this belongs
  rather than inventing a structure.

## 2. Ground every external call in documentation

Never write a third-party request from memory. Memory produces plausible parameter
names, which are worse than obviously wrong ones because they survive review.

- If a docs MCP (Context7 or similar) is available: resolve the library ID, then ask
  a **narrow** question — "create charge request parameters", not the library name.
- Otherwise fetch the official docs page. Prefer the version that matches the
  dependency pinned in the lockfile, not "latest".
- Extract only what the call needs: path, auth, required and optional params,
  response shape, error codes, pagination, rate limits. Skip tutorials and marketing.
- Leave a one-line comment above the call with the doc URL and version. It costs
  almost nothing and makes the code reviewable a year from now.
- On conflict: the **repo** wins on style and structure, the **docs** win on wire format.

## 3. Write the smallest correct thing

- Put the file where its siblings live. Mirror their shape.
- No new dependency without asking first.
- No new abstraction layer for a single caller. A helper earns its file on the
  second use, not the first.
- Validate at the boundary; keep the interior plain.
- Handle non-2xx, timeouts, and missing or renamed fields explicitly. Supplier
  payloads are unreliable — fall back and log, do not crash the request.
- Map supplier fields explicitly into your own shape. Never spread a raw external
  payload into a domain object; the schema will change under you.
- Comment only the non-obvious: a supplier quirk, a deliberate deviation from spec.
- Do not refactor code you were not asked to touch.

## 4. Prove it before saying it works

- State the exact request and response shape the code was written against.
- If the repo has tests, add one in the existing style. If not, add a small runnable
  example, matching how other examples in the repo are written.
- Run the project's typecheck and lint if they are configured.

## 5. Report

Keep it to three things:

```
Files touched:   <paths>
Doc source:      <url> (version X)
Needs your call: <assumptions, unverified fields, open questions>
```

Do not re-narrate code that is already visible in the diff.

## Anti-patterns

- Inventing a method or field name that "sounds right" instead of checking docs.
- Creating a new folder or layer for one file.
- Catching an error and returning an empty success.
- Rewriting nearby code to your preferred style while you are in there.
- Dumping the full docs page into context when three fields were needed.
