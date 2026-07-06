# ADR-004: Application Architecture

## Status

Draft

## Context

The project needs a maintainable frontend architecture that supports multiple features without creating large overlapping files.

## Decision

The recommended architecture is Vite + TypeScript + React with strict separation between UI, features, services, data access, and external clients.

## Consequences

Positive:

- type safety
- component structure
- maintainable feature boundaries
- better regression prevention

Negative:

- more setup than vanilla JavaScript
- requires discipline around boundaries
