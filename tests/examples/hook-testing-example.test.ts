/**
 * EXAMPLE: Testing Custom Hooks
 *
 * This file demonstrates how to test custom React hooks that interact with Supabase.
 * It's a reference for writing tests for usePanels, useCircuits, useTransformers, etc.
 *
 * Key patterns:
 * - Mock Supabase client at module level
 * - Use renderHook from @testing-library/react
 * - Test async operations with waitFor
 * - Test optimistic updates
 * - Test real-time subscriptions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock the Supabase client module
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn()
  }
}));

// Import after mocking
import { supabase } from '@/lib/supabase';

// ============================================================================
// EXAMPLE HOOK (for demonstration)
// ============================================================================

/**
 * Example custom hook that we're testing
 * (In real tests, import from actual hook file)
 */
function useExampleResource(projectId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!projectId) return;

    const { data: result, error: fetchError } = await supabase
      .from('resources')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setData(result || []);
      setError(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const subscription = supabase
      .channel(`resources_${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'resources',
        filter: `project_id=eq.${projectId}`
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId]);

  const create = async (item: any) => {
    const temp = { ...item, id: 'temp-' + Date.now() };
    setData(prev => [...prev, temp]);

    const { error: insertError } = await supabase
      .from('resources')
      .insert(item);

    if (insertError) {
      setError(insertError.message);
    }
  };

  return { data, loading, error, create };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Custom Hook Testing Example', () => {
  const projectId = 'test-project-123';

  // Sample test data
  const mockData = [
    { id: '1', name: 'Item 1', project_id: projectId },
    { id: '2', name: 'Item 2', project_id: projectId }
  ];

  // ============================================================================
  // SETUP: Reset mocks before each test
  // ============================================================================

  beforeEach(() => {
    vi.clearAllMocks();  // Important: Reset all mock state

    // Default successful response
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockData,
            error: null
          })
        })
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null })
    });

    // Default subscription mock
    (supabase.channel as any).mockReturnValue({
      on: vi.fn().mockReturnValue({
        subscribe: vi.fn().mockReturnValue({
          unsubscribe: vi.fn()
        })
      })
    });
  });

  // ============================================================================
  // PATTERN 1: Testing Initial Data Fetch
  // ============================================================================

  describe('fetching data', () => {
    it('should start with loading state', () => {
      const { result } = renderHook(() => useExampleResource(projectId));

      // Initial state
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should fetch data on mount', async () => {
      const { result } = renderHook(() => useExampleResource(projectId));

      // Wait for async fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Assert data loaded
      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();

      // Verify Supabase called correctly
      expect(supabase.from).toHaveBeenCalledWith('resources');
    });

    it('should handle fetch errors', async () => {
      // Mock error response
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Network error' }
            })
          })
        })
      });

      const { result } = renderHook(() => useExampleResource(projectId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Assert error state
      expect(result.current.error).toBe('Network error');
      expect(result.current.data).toEqual([]);
    });
  });

  // ============================================================================
  // PATTERN 2: Testing Create Operations (Optimistic Updates)
  // ============================================================================

  describe('creating data', () => {
    it('should create item optimistically', async () => {
      const { result } = renderHook(() => useExampleResource(projectId));

      // Wait for initial fetch
      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialCount = result.current.data.length;

      // Create new item
      const newItem = { name: 'New Item', project_id: projectId };
      await result.current.create(newItem);

      // Optimistic update: item appears immediately
      expect(result.current.data.length).toBe(initialCount + 1);
      expect(result.current.data).toContainEqual(
        expect.objectContaining({ name: 'New Item' })
      );

      // Verify database called
      expect(supabase.from).toHaveBeenCalledWith('resources');
    });

    it('should handle create errors', async () => {
      // Mock error on insert
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockData, error: null })
          })
        }),
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'RLS policy violation' }
        })
      });

      const { result } = renderHook(() => useExampleResource(projectId));

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.create({ name: 'New Item' });

      // Error state set
      expect(result.current.error).toBe('RLS policy violation');
    });
  });

  // ============================================================================
  // PATTERN 3: Testing Real-Time Subscriptions
  // ============================================================================

  describe('real-time subscriptions', () => {
    it('should establish subscription on mount', () => {
      renderHook(() => useExampleResource(projectId));

      // Verify subscription created
      expect(supabase.channel).toHaveBeenCalledWith(`resources_${projectId}`);
    });

    it('should refetch when subscription fires', async () => {
      let subscriptionCallback: Function | null = null;

      // Capture subscription callback
      (supabase.channel as any).mockReturnValue({
        on: vi.fn((event, config, callback) => {
          subscriptionCallback = callback;
          return {
            subscribe: vi.fn().mockReturnValue({
              unsubscribe: vi.fn()
            })
          };
        })
      });

      renderHook(() => useExampleResource(projectId));

      // Wait for initial fetch
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledTimes(1);
      });

      // Simulate database change (trigger subscription)
      subscriptionCallback!({ event: 'INSERT', new: { id: '3' } });

      // Should trigger refetch
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledTimes(2);
      });
    });

    it('should unsubscribe on unmount', () => {
      const unsubscribeMock = vi.fn();

      (supabase.channel as any).mockReturnValue({
        on: vi.fn().mockReturnValue({
          subscribe: vi.fn().mockReturnValue({
            unsubscribe: unsubscribeMock
          })
        })
      });

      const { unmount } = renderHook(() => useExampleResource(projectId));

      expect(unsubscribeMock).not.toHaveBeenCalled();

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // PATTERN 4: Testing Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle undefined projectId', () => {
      const { result } = renderHook(() => useExampleResource(undefined as any));

      // Should not attempt to fetch
      expect(supabase.from).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(true);
    });

    it('should handle empty data array', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      });

      const { result } = renderHook(() => useExampleResource(projectId));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });
});

// ============================================================================
// KEY TAKEAWAYS
// ============================================================================

/**
 * 1. ALWAYS mock Supabase at module level (vi.mock('@/lib/supabase'))
 * 2. Use renderHook from @testing-library/react
 * 3. Use waitFor for async operations
 * 4. Reset mocks in beforeEach (vi.clearAllMocks())
 * 5. Test initial state, loading state, success state, error state
 * 6. Test optimistic updates appear immediately
 * 7. Capture subscription callbacks to test real-time behavior
 * 8. Verify cleanup (unsubscribe on unmount)
 */
