# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the Baci e-commerce platform.

## What are ADRs?

Architecture Decision Records document important architectural decisions made during the project's development. Each ADR explains:
- **Context:** Why was this decision needed?
- **Decision:** What did we decide to do?
- **Consequences:** What are the positive and negative outcomes?
- **Alternatives:** What other options were considered?

## Why ADRs?

ADRs help:
- **AI assistants** understand the reasoning behind code structure
- **New developers** quickly understand architectural choices
- **Future maintainers** avoid repeating past mistakes
- **Decision makers** track the evolution of the system

## Format

Each ADR follows this structure:
```markdown
# ADR XXX: Title

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Context
What is the issue we're trying to solve?

## Decision
What did we decide to do?

## Consequences
### Positive
- Good things that result from this decision

### Negative
- Challenges or trade-offs we accept

## Alternatives Considered
What other options were evaluated?

## Implementation Notes
Practical guidance for implementing this decision

## AI Context
Specific guidance for AI assistants working with this decision
```

## Index of ADRs

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](./001-business-type-journey-architecture.md) | Business Type Journey Architecture | Proposed | 2025-10-31 |

## Creating a New ADR

1. Copy an existing ADR as a template
2. Number it sequentially (002, 003, etc.)
3. Fill in all sections
4. Add it to the index above
5. Reference it in code comments where relevant
