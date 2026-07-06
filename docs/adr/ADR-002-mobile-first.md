# ADR-002: Mobile First

## Status

Draft

## Context

The primary target device is iPhone Safari. Desktop is secondary.

## Decision

All UX, layout, performance, and navigation decisions start from mobile.

Desktop behavior may extend the mobile architecture but may not force complexity into the mobile experience.

## Consequences

Positive:

- better experience for the intended usage
- fewer mobile regressions
- clearer performance limits

Negative:

- some desktop enhancements may be delayed
- dense data views require careful design
