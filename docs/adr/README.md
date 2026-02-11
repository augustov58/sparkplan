# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the SparkPlan application. ADRs document significant architectural decisions made during development, including context, alternatives considered, and consequences.

---

## What is an ADR?

An **Architecture Decision Record** (ADR) is a document that captures an important architectural decision along with its context and consequences. ADRs help:

- **Preserve context**: Future developers understand why decisions were made
- **Enable evaluation**: Teams can revisit decisions when circumstances change
- **Improve onboarding**: New team members quickly understand architectural choices
- **Facilitate LLM handoff**: AI assistants can understand the "why" behind code patterns

---

## ADR Index

### Active ADRs

| ADR | Title | Date | Status |
|-----|-------|------|--------|
| [ADR-001](./001-optimistic-ui-updates.md) | Optimistic UI Updates with Real-Time Sync | 2025-12-03 | Accepted |
| [ADR-002](./002-custom-hooks-over-react-query.md) | Custom Hooks Over React Query | 2025-12-03 | Accepted |
| [ADR-003](./003-supabase-realtime-state-management.md) | Supabase Real-Time for State Management | 2025-12-03 | Accepted |
| [ADR-004](./004-hash-router-for-github-pages.md) | HashRouter for GitHub Pages Compatibility | 2025-12-03 | Accepted |
| [ADR-005](./005-panel-hierarchy-discriminated-union.md) | Panel Hierarchy via Discriminated Union | 2025-12-03 | Accepted |
| [ADR-006](./006-one-line-diagram-monolith.md) | OneLineDiagram as 1614-Line Monolith | 2025-12-03 | Accepted |

### Deprecated ADRs

(None yet)

### Superseded ADRs

(None yet)

---

## ADR Lifecycle

```
Proposed → Accepted → (Optional) Deprecated/Superseded
```

- **Proposed**: Decision under consideration
- **Accepted**: Decision approved and implemented
- **Deprecated**: No longer recommended but may still exist in code
- **Superseded**: Replaced by another ADR

---

## When to Write an ADR

Write an ADR when making decisions about:

### Architecture & Design
- State management approach
- Routing strategy
- Component organization
- Data flow patterns

### Technology Choices
- Library selection (e.g., React Query vs custom hooks)
- Database choice
- Build tool configuration
- Hosting platform

### Standards & Conventions
- TypeScript patterns
- Error handling approach
- Testing strategy
- Code organization

### Trade-offs
- Performance vs simplicity
- Bundle size vs developer experience
- Real-time vs polling

---

## How to Write an ADR

1. **Copy the template**: `cp template.md 00X-your-decision.md`
2. **Fill in the sections**: Use template as guide
3. **Be specific**: Include code examples, metrics, timeline
4. **List alternatives**: Show what else was considered
5. **Document consequences**: Both positive and negative
6. **Update this README**: Add entry to ADR Index table

---

## ADR Naming Convention

```
NNN-kebab-case-title.md
```

- **NNN**: 3-digit sequence number (001, 002, 003, ...)
- **kebab-case-title**: Short, descriptive title in lowercase with hyphens
- **Examples**:
  - `001-optimistic-ui-updates.md`
  - `002-custom-hooks-over-react-query.md`
  - `025-add-web-worker-for-calculations.md`

---

## Reviewing Decisions

**Schedule**: Review ADRs annually or when:
- Technology landscape changes significantly
- Team composition changes
- Product requirements shift
- Performance issues arise

**Process**:
1. Re-read ADR context and consequences
2. Evaluate if decision still makes sense
3. Options:
   - **Keep**: Decision still valid, no changes needed
   - **Update**: Minor adjustments to consequences or notes
   - **Deprecate**: No longer recommended, document why
   - **Supersede**: Create new ADR replacing this one

---

## References

- [ADR organization by Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR tools and templates](https://adr.github.io/)
- [When to write ADRs (Joel Parker Henderson)](https://github.com/joelparkerhenderson/architecture-decision-record)

---

## Template

See [`template.md`](./template.md) for the standard ADR format.
