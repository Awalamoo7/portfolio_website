---
title: "On Building Things That Last"
subtitle: "Why durability matters more than speed in software and in life"
date: 2026-02-15
tags: ["engineering", "philosophy"]
---

The best code I ever wrote was the code I didn't have to touch again. Not because it was clever — clever code is usually the first to break — but because it was simple enough to survive contact with reality.

There's a lesson in that, one that extends well beyond software. The things that last aren't the things that were built fastest or with the most advanced tools. They're the things built with enough care to anticipate the mess of the real world without trying to control it.

## The Temptation of Complexity

Every engineer knows the feeling: you see a problem, and your mind immediately reaches for the most sophisticated solution. A distributed system where a spreadsheet would do. A microservices architecture for an app with twelve users. We over-engineer because it feels productive, because complexity is legible as effort.

But effort isn't the same as value. The most valuable systems I've built were almost embarrassingly simple. A cron job. A flat file. A single database table with five columns.

## What Durability Actually Looks Like

Durable software has a few traits in common:

- **It's boring.** It uses well-understood patterns and avoids novelty for its own sake.
- **It's legible.** A new developer can read it and understand what it does within an hour.
- **It fails gracefully.** When something goes wrong (and it will), the failure mode is obvious and recoverable.
- **It's deletable.** You can remove it without the rest of the system collapsing.

These aren't exciting qualities. They don't make for good conference talks. But they're the qualities that separate systems that run for years from systems that get rewritten every eighteen months.

## Beyond Code

The same principles apply to writing, to relationships, to building a career. Do the simple thing well. Make it legible. Design for failure. And build something you won't have to rebuild next year.
