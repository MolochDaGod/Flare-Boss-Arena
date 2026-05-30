---
name: JSDoc block-comment `*/` pitfall
description: A `*/` sequence inside a JSDoc/block comment terminates the comment early and produces a cascade of confusing TS syntax errors.
---

# JSDoc / block-comment `*/` pitfall

Any literal `*/` inside a `/* ... */` (or `/** ... */`) comment **closes the
comment at that point**, even if it appears mid-sentence. The remaining comment
text is then parsed as code, producing a misleading cascade of TS errors far
from the real cause (e.g. `TS1109 Expression expected`, `type predicate only
allowed in return type`, `Unterminated regular expression literal`).

**Concrete trigger seen here:** documenting glob-style bone patterns like
`upperarm.*/hand.*/foot.*` inside a JSDoc — the `.*/` contains `*/` and silently
ended the comment block.

**Why:** TS reports the *downstream* parse failure, not the early comment
termination, so the error line points at real code that is actually fine.

**How to apply:** When TS throws a burst of nonsensical syntax errors clustered
right after a doc comment, suspect a stray `*/` in the comment text above. Don't
write regex/glob patterns containing `*/` in comments — reword (e.g. use commas:
`upperarm, hand, foot, ...`) or escape the slash.
