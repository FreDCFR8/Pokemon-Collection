# Performance

## Status

Phase 0 draft.

## Primary target

The primary performance target is iPhone Safari.

Desktop performance is important, but mobile behavior decides architecture.

## Principles

- Avoid loading large card sets all at once.
- Avoid rendering large lists without pagination or virtualization.
- Avoid unbounded image loading.
- Keep UI responsive during search and filtering.
- Measure before optimizing.
- Do not patch performance problems without root-cause analysis.

## Known risks from previous experience

Functional lessons only:

- Pokédex views can become slow when too many cards render at once.
- Binder-style layouts are heavy and must be delayed.
- Card images are performance-sensitive on iPhone.
- Search, sets, and collection views need limits.

No previous implementation may be reused.

## Required strategies

### Lists

Large lists must use one of:

- pagination
- incremental loading
- virtualization
- server-side filtering

### Images

Card images must use:

- lazy loading
- explicit dimensions where possible
- appropriate image size
- predictable placeholders

### Data loading

Data access must be scoped:

- never fetch all cards by default
- filter and paginate by user intent
- separate reference data from user-owned state

### Measurements

Performance strategy must define measurements before optimization.

Candidate metrics:

- initial render time
- route transition time
- search response time
- list render count
- image load behavior
- Supabase query duration

## Binder rule

Binder may not be implemented until core modules are stable and performance constraints are known.
