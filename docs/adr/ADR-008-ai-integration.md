# ADR-008: AI Integration

## Status

Draft

## Context

The product vision includes an AI Assistant entry point, but AI functionality is not required for the first stable version.

AI introduces additional privacy, safety, cost, and architecture risks.

## Decision

AI Assistant will not be implemented in v1.

The navigation may reserve an AI entry point, but it must be inactive, hidden, or clearly marked as unavailable until a dedicated implementation phase is approved.

Any OpenAI integration requires a separate implementation plan covering:

- user data exposure
- prompt safety
- cost limits
- child-facing responses
- logging and retention expectations
- failure behavior
- abuse prevention

## Consequences

Positive:

- keeps v1 focused
- reduces privacy and security risk
- avoids early architectural coupling

Negative:

- AI functionality is delayed
- future AI flows require another design phase

## Enforcement

No OpenAI API client, prompts, AI routes, or AI runtime code may be added before this ADR is updated and approved for implementation.
