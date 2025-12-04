# Testing Strategy
## NEC Pro Compliance Application

**Last Updated**: 2025-12-03
**Current Coverage**: ~20% (calculation services only)
**Target Coverage**: 75%
**Framework**: Vitest 4.0.14 + React Testing Library

---

## Table of Contents

1. [Testing Pyramid](#testing-pyramid)
2. [Current Test Coverage](#current-test-coverage)
3. [Unit Testing Strategy](#unit-testing-strategy)
4. [Integration Testing Strategy](#integration-testing-strategy)
5. [Mocking Patterns](#mocking-patterns)
6. [Writing Tests for Custom Hooks](#writing-tests-for-custom-hooks)
7. [Component Testing Guide](#component-testing-guide)
8. [Coverage Goals](#coverage-goals)

---

## Testing Pyramid

```
                    E2E Tests
                   /         \
                  /  (Future) \
                 /______________\
                /                \
               /  Integration     \
              /    Tests           \
             /     (Planned)        \
            /_______________________ \
           /                          \
          /      Unit Tests            \
         /   (Current: calculations)   \
        /________________________________\
```

### Layer Breakdown

**Unit Tests** (Foundation):
- **Purpose**: Test individual functions in isolation
- **Speed**: Very fast (<1ms per test)
- **Coverage target**: 100% for calculation services, 80% for utilities
- **Current**: 11/11 passing (calculation services only)

**Integration Tests** (Middle):
- **Purpose**: Test multiple components/hooks working together
- **Speed**: Fast (10-100ms per test)
- **Coverage target**: 80% for custom hooks, 60% for components
- **Current**: NOT IMPLEMENTED

**E2E Tests** (Top):
- **Purpose**: Test complete user workflows
- **Speed**: Slow (1-10 seconds per test)
- **Coverage target**: Critical user paths only
- **Current**: NOT IMPLEMENTED

---

## Current Test Coverage

### ✅ What's Tested (11 tests, 100% passing)

**File**: `/tests/calculations.test.ts`

#### Load Calculations (5 tests)
```typescript
describe('Load Calculations', () => {
  it('calculates dwelling load per NEC 220.82') // ✅ PASSING
  it('applies lighting demand factors per NEC Table 220.42') // ✅ PASSING
  it('applies range demand factors per NEC Table 220.55') // ✅ PASSING
  it('applies 125% continuous load factor') // ✅ PASSING
  it('calculates commercial load per NEC 220.40') // ✅ PASSING
});
```

#### Conductor Sizing (3 tests)
```typescript
describe('Conductor Sizing', () => {
  it('sizes conductors with temperature correction') // ✅ PASSING
  it('applies bundling adjustment factors') // ✅ PASSING
  it('selects correct conductor size from NEC Table 310.16') // ✅ PASSING
});
```

#### Breaker Sizing (2 tests)
```typescript
describe('Breaker Sizing', () => {
  it('selects next standard breaker size per NEC 240.6(A)') // ✅ PASSING
  it('applies 125% factor for continuous loads') // ✅ PASSING
});
```

#### Voltage Drop (1 test)
```typescript
describe('Voltage Drop', () => {
  it('calculates voltage drop using AC impedance method') // ✅ PASSING
});
```

### ❌ What's NOT Tested

**Custom Hooks** (0% coverage):
- `usePanels`, `useCircuits`, `useTransformers`, `useLoads`, `useProjects`
- Real-time subscriptions
- Optimistic updates
- Error handling

**Components** (0% coverage):
- `OneLineDiagram`, `CircuitDesign`, `LoadCalculator`, etc.
- User interactions
- Rendering logic

**Database Logic** (0% coverage):
- RLS policies
- Triggers
- Constraints

---

## Unit Testing Strategy

### What to Unit Test

**✅ Pure functions** (no side effects):
- Calculation services (`/services/calculations/`)
- Utility functions (`/lib/utils/`)
- Type guards (`isPanel`, `isValidVoltage`)

**✅ Business logic**:
- NEC compliance checks
- Validation rules
- Formatting functions

**❌ Don't unit test**:
- React components (use integration tests)
- Database queries (use integration tests with test DB)
- External API calls (mock at integration level)

### Unit Test Template

```typescript
// /tests/myCalculation.test.ts
import { describe, it, expect } from 'vitest';
import { myCalculation } from '@/services/calculations/myCalculation';

describe('My Calculation', () => {
  describe('NEC compliance', () => {
    it('should apply 125% continuous load factor per NEC 215.2(A)(1)', () => {
      const result = myCalculation({
        loadAmps: 80,
        isContinuous: true
      });

      expect(result.adjustedAmps).toBe(100);  // 80 * 1.25
      expect(result.necReference).toBe('NEC 215.2(A)(1)');
    });

    it('should not apply factor for non-continuous loads', () => {
      const result = myCalculation({
        loadAmps: 80,
        isContinuous: false
      });

      expect(result.adjustedAmps).toBe(80);  // No factor
    });
  });

  describe('edge cases', () => {
    it('should handle zero load', () => {
      const result = myCalculation({ loadAmps: 0, isContinuous: true });
      expect(result.adjustedAmps).toBe(0);
    });

    it('should throw error for negative load', () => {
      expect(() => {
        myCalculation({ loadAmps: -10, isContinuous: true });
      }).toThrow('Load must be positive');
    });
  });

  describe('boundary conditions', () => {
    it('should handle maximum safe load (10000A)', () => {
      const result = myCalculation({ loadAmps: 10000, isContinuous: true });
      expect(result.adjustedAmps).toBe(12500);  // 10000 * 1.25
    });
  });
});
```

### Running Unit Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-run on file change)
npm test -- --watch

# Run specific test file
npm test calculations.test.ts

# Run tests with coverage report
npm test -- --coverage
```

---

## Integration Testing Strategy

### What to Integration Test

**Custom Hooks** (high priority):
- CRUD operations (create, read, update, delete)
- Real-time subscription behavior
- Optimistic updates
- Error handling

**Component Integration** (medium priority):
- Component + hook interaction
- Multi-component workflows
- Form submission → database update

### Integration Test Setup

**Mock Supabase Client**:

```typescript
// /tests/setup.ts
import { vi } from 'vitest';

// Mock Supabase client
export const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => Promise.resolve({ data: null, error: null })),
    delete: vi.fn(() => Promise.resolve({ data: null, error: null }))
  })),
  channel: vi.fn(() => ({
    on: vi.fn(() => ({
      subscribe: vi.fn(() => ({
        unsubscribe: vi.fn()
      }))
    }))
  }))
};

// Mock module
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));
```

---

## Mocking Patterns

### Mocking Supabase Client

**Pattern**: Mock at module level, reset between tests

```typescript
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { supabase } from '@/lib/supabase';

// Mock Supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn()
  }
}));

describe('usePanels hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();  // Reset mocks between tests
  });

  it('should fetch panels on mount', async () => {
    // Setup mock response
    const mockPanels = [
      { id: '1', name: 'MDP', voltage: 480 }
    ];

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockPanels,
            error: null
          })
        })
      })
    });

    // Test hook
    const { result } = renderHook(() => usePanels('project-123'));

    // Wait for async fetch
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Assert
    expect(result.current.panels).toEqual(mockPanels);
    expect(supabase.from).toHaveBeenCalledWith('panels');
  });
});
```

### Mocking Gemini AI Service

**Pattern**: Mock entire service module

```typescript
import { vi } from 'vitest';

// Mock Gemini service
vi.mock('@/services/geminiService', () => ({
  validateLoadCalculation: vi.fn().mockResolvedValue(
    'Load calculation is valid per NEC 220.82'
  ),
  generateOneLineDescription: vi.fn().mockResolvedValue(
    'Electrical system: 480V 3-phase service with step-down transformers'
  ),
  askNecAssistant: vi.fn().mockResolvedValue(
    'Per NEC Article 215, feeder conductors must be sized...'
  )
}));

// In test
it('should display AI validation result', async () => {
  render(<LoadCalculator />);

  fireEvent.click(screen.getByText('Validate with AI'));

  await waitFor(() => {
    expect(screen.getByText(/Load calculation is valid/)).toBeInTheDocument();
  });
});
```

### Mocking Real-Time Subscriptions

**Pattern**: Mock subscription with manual trigger

```typescript
let subscriptionCallback: Function | null = null;

beforeEach(() => {
  (supabase.channel as any).mockReturnValue({
    on: vi.fn((event, config, callback) => {
      subscriptionCallback = callback;  // Capture callback
      return {
        subscribe: vi.fn(() => ({
          unsubscribe: vi.fn()
        }))
      };
    })
  });
});

it('should refetch when subscription fires', async () => {
  const { result } = renderHook(() => usePanels('project-123'));

  // Initial load
  await waitFor(() => expect(result.current.loading).toBe(false));

  // Simulate database change (trigger subscription)
  subscriptionCallback!({ event: 'INSERT', new: { id: '2' } });

  // Should refetch
  await waitFor(() => {
    expect(supabase.from).toHaveBeenCalledTimes(2);  // Initial + refetch
  });
});
```

---

## Writing Tests for Custom Hooks

### Testing Pattern: `renderHook` + `waitFor`

**Library**: `@testing-library/react-hooks` or `@testing-library/react`

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { usePanels } from '@/hooks/usePanels';

describe('usePanels', () => {
  it('should create panel optimistically', async () => {
    const { result } = renderHook(() => usePanels('project-123'));

    // Wait for initial load
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Create panel
    const newPanel = { name: 'LP', voltage: 480, phase: 3 };
    await result.current.createPanel(newPanel);

    // Assert optimistic update (panel in state immediately)
    expect(result.current.panels).toContainEqual(
      expect.objectContaining({ name: 'LP' })
    );

    // Assert database called
    expect(supabase.from).toHaveBeenCalledWith('panels');
  });

  it('should handle create error', async () => {
    // Mock error response
    (supabase.from as any).mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'RLS policy violation' }
      })
    });

    const { result } = renderHook(() => usePanels('project-123'));

    await result.current.createPanel({ name: 'LP' });

    // Assert error state
    expect(result.current.error).toBe('RLS policy violation');
  });

  it('should unsubscribe on unmount', () => {
    const unsubscribeMock = vi.fn();

    (supabase.channel as any).mockReturnValue({
      on: vi.fn(() => ({
        subscribe: vi.fn(() => ({ unsubscribe: unsubscribeMock }))
      }))
    });

    const { unmount } = renderHook(() => usePanels('project-123'));

    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });
});
```

### Example: Complete Hook Test File

**File**: `/tests/usePanels.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePanels } from '@/hooks/usePanels';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase');

describe('usePanels', () => {
  const projectId = 'test-project-123';
  const mockPanels = [
    { id: '1', name: 'MDP', voltage: 480, phase: 3, project_id: projectId },
    { id: '2', name: 'LP', voltage: 480, phase: 3, project_id: projectId }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: successful fetch
    (supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: mockPanels, error: null })
        })
      })
    });

    // Default subscription mock
    (supabase.channel as any).mockReturnValue({
      on: () => ({
        subscribe: () => ({ unsubscribe: vi.fn() })
      })
    });
  });

  describe('fetching', () => {
    it('should fetch panels on mount', async () => {
      const { result } = renderHook(() => usePanels(projectId));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.panels).toEqual(mockPanels);
      expect(result.current.error).toBeNull();
    });

    it('should handle fetch error', async () => {
      (supabase.from as any).mockReturnValue({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({
              data: null,
              error: { message: 'Network error' }
            })
          })
        })
      });

      const { result } = renderHook(() => usePanels(projectId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.panels).toEqual([]);
    });
  });

  describe('creating', () => {
    it('should create panel optimistically', async () => {
      const { result } = renderHook(() => usePanels(projectId));

      await waitFor(() => expect(result.current.loading).toBe(false));

      const newPanel = {
        name: 'New Panel',
        voltage: 208,
        phase: 3,
        project_id: projectId
      };

      await result.current.createPanel(newPanel);

      // Optimistic update visible immediately
      expect(result.current.panels).toContainEqual(
        expect.objectContaining({ name: 'New Panel' })
      );
    });
  });

  describe('updating', () => {
    it('should update panel optimistically', async () => {
      const { result } = renderHook(() => usePanels(projectId));

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.updatePanel('1', { name: 'Updated MDP' });

      expect(result.current.panels[0].name).toBe('Updated MDP');
    });
  });

  describe('deleting', () => {
    it('should delete panel optimistically', async () => {
      const { result } = renderHook(() => usePanels(projectId));

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.deletePanel('1');

      expect(result.current.panels).not.toContainEqual(
        expect.objectContaining({ id: '1' })
      );
    });
  });
});
```

---

## Component Testing Guide

### Testing Philosophy

**Prefer integration tests over isolated unit tests for components.**

**Why**: Components don't exist in isolation. Testing how they interact with hooks, context, and user events provides more value.

### Component Test Template

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import CircuitDesign from '@/components/CircuitDesign';

vi.mock('@/hooks/usePanels');
vi.mock('@/hooks/useCircuits');

describe('CircuitDesign', () => {
  it('should display panels list', () => {
    const mockPanels = [
      { id: '1', name: 'MDP', voltage: 480 }
    ];

    (usePanels as any).mockReturnValue({
      panels: mockPanels,
      loading: false,
      error: null
    });

    render(<CircuitDesign />);

    expect(screen.getByText('MDP')).toBeInTheDocument();
    expect(screen.getByText('480V')).toBeInTheDocument();
  });

  it('should create circuit when form submitted', async () => {
    const createCircuitMock = vi.fn();

    (useCircuits as any).mockReturnValue({
      circuits: [],
      createCircuit: createCircuitMock
    });

    render(<CircuitDesign />);

    // Fill form
    fireEvent.change(screen.getByLabelText('Circuit Number'), {
      target: { value: '1' }
    });
    fireEvent.change(screen.getByLabelText('Breaker Amps'), {
      target: { value: '20' }
    });

    // Submit
    fireEvent.click(screen.getByText('Create Circuit'));

    // Assert
    await waitFor(() => {
      expect(createCircuitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          circuitNumber: 1,
          breakerAmps: 20
        })
      );
    });
  });

  it('should show loading state', () => {
    (usePanels as any).mockReturnValue({
      panels: [],
      loading: true,
      error: null
    });

    render(<CircuitDesign />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    (usePanels as any).mockReturnValue({
      panels: [],
      loading: false,
      error: 'Failed to load panels'
    });

    render(<CircuitDesign />);

    expect(screen.getByText(/Failed to load panels/)).toBeInTheDocument();
  });
});
```

---

## Coverage Goals

### Target Coverage by Layer

| Layer | Current | Target | Priority |
|-------|---------|--------|----------|
| **Calculation Services** | 100% | 100% | ✅ DONE |
| **Custom Hooks** | 0% | 80% | 🔴 HIGH |
| **Components** | 0% | 60% | 🟡 MEDIUM |
| **Utilities** | 0% | 80% | 🟡 MEDIUM |
| **Overall** | ~20% | 75% | 🎯 GOAL |

### Coverage Thresholds (Vitest Config)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 70,
        statements: 75
      },
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.test.tsx'
      ]
    }
  }
});
```

### Viewing Coverage Report

```bash
# Generate coverage report
npm test -- --coverage

# Open HTML report
open coverage/index.html
```

---

## Test Organization

### File Structure

```
/tests/
  ├── calculations.test.ts       # ✅ Unit tests (calculations)
  ├── usePanels.test.ts          # ❌ Integration tests (hooks) - TODO
  ├── useCircuits.test.ts        # ❌ Integration tests (hooks) - TODO
  ├── CircuitDesign.test.tsx     # ❌ Component tests - TODO
  ├── OneLineDiagram.test.tsx    # ❌ Component tests - TODO
  ├── setup.ts                   # Test setup and mocks
  └── examples/                  # Example test patterns
      ├── hook-testing-example.test.ts
      └── component-testing-example.test.tsx
```

### Naming Conventions

- **Unit tests**: `functionName.test.ts`
- **Hook tests**: `useHookName.test.ts`
- **Component tests**: `ComponentName.test.tsx`

---

## Running Tests in CI/CD

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - run: npm install
      - run: npm test -- --coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## Summary

**Current State**: 11 tests (calculations only), 100% passing
**Target State**: 100+ tests across all layers, 75% coverage

**Immediate Priorities**:
1. Add hook tests (`usePanels`, `useCircuits`, `useTransformers`)
2. Add component integration tests (`CircuitDesign`, `LoadCalculator`)
3. Set up coverage thresholds in CI/CD

**Long-Term Goals**:
1. E2E tests for critical workflows (Playwright)
2. Visual regression tests (Percy, Chromatic)
3. Performance testing (React DevTools Profiler)
