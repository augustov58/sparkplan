/**
 * EXAMPLE: Testing React Components
 *
 * This file demonstrates how to test React components using React Testing Library.
 * It's a reference for writing tests for CircuitDesign, LoadCalculator, OneLineDiagram, etc.
 *
 * Key patterns:
 * - Mock custom hooks that components use
 * - Test user interactions (clicks, form inputs)
 * - Test conditional rendering (loading, error states)
 * - Test integration with hooks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock custom hooks
vi.mock('@/hooks/usePanels', () => ({
  usePanels: vi.fn()
}));

vi.mock('@/hooks/useCircuits', () => ({
  useCircuits: vi.fn()
}));

// Import after mocking
import { usePanels } from '@/hooks/usePanels';
import { useCircuits } from '@/hooks/useCircuits';

// ============================================================================
// EXAMPLE COMPONENT (for demonstration)
// ============================================================================

/**
 * Example component that we're testing
 * (In real tests, import from actual component file)
 */
function ExamplePanelManager() {
  const { panels, loading, error, createPanel } = usePanels('project-123');
  const [panelName, setPanelName] = useState('');
  const [voltage, setVoltage] = useState(480);

  if (loading) return <div>Loading panels...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createPanel({
      name: panelName,
      voltage: voltage,
      phase: 3,
      project_id: 'project-123'
    });
    setPanelName('');  // Clear form
  };

  return (
    <div>
      <h1>Panel Manager</h1>

      <form onSubmit={handleSubmit}>
        <label htmlFor="panelName">Panel Name:</label>
        <input
          id="panelName"
          type="text"
          value={panelName}
          onChange={(e) => setPanelName(e.target.value)}
          placeholder="Enter panel name"
        />

        <label htmlFor="voltage">Voltage:</label>
        <select
          id="voltage"
          value={voltage}
          onChange={(e) => setVoltage(Number(e.target.value))}
        >
          <option value={120}>120V</option>
          <option value={208}>208V</option>
          <option value={240}>240V</option>
          <option value={480}>480V</option>
        </select>

        <button type="submit">Create Panel</button>
      </form>

      <div data-testid="panels-list">
        {panels.length === 0 ? (
          <p>No panels yet. Create one above.</p>
        ) : (
          <ul>
            {panels.map(panel => (
              <li key={panel.id}>
                {panel.name} - {panel.voltage}V {panel.phase}φ
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Component Testing Example', () => {
  // Sample test data
  const mockPanels = [
    { id: '1', name: 'MDP', voltage: 480, phase: 3 },
    { id: '2', name: 'LP', voltage: 480, phase: 3 }
  ];

  // ============================================================================
  // SETUP: Reset mocks before each test
  // ============================================================================

  beforeEach(() => {
    vi.clearAllMocks();

    // Default happy path mock
    (usePanels as any).mockReturnValue({
      panels: mockPanels,
      loading: false,
      error: null,
      createPanel: vi.fn().mockResolvedValue(undefined)
    });
  });

  // ============================================================================
  // HELPER: Render with Router (if component uses routing)
  // ============================================================================

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  // ============================================================================
  // PATTERN 1: Testing Rendering
  // ============================================================================

  describe('rendering', () => {
    it('should render component with title', () => {
      render(<ExamplePanelManager />);

      expect(screen.getByText('Panel Manager')).toBeInTheDocument();
    });

    it('should display panels list', () => {
      render(<ExamplePanelManager />);

      // Check both panels are rendered
      expect(screen.getByText(/MDP/)).toBeInTheDocument();
      expect(screen.getByText(/LP/)).toBeInTheDocument();
      expect(screen.getByText(/480V 3φ/)).toBeInTheDocument();
    });

    it('should show empty state when no panels', () => {
      (usePanels as any).mockReturnValue({
        panels: [],
        loading: false,
        error: null,
        createPanel: vi.fn()
      });

      render(<ExamplePanelManager />);

      expect(screen.getByText('No panels yet. Create one above.')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // PATTERN 2: Testing Loading and Error States
  // ============================================================================

  describe('loading and error states', () => {
    it('should show loading state', () => {
      (usePanels as any).mockReturnValue({
        panels: [],
        loading: true,
        error: null,
        createPanel: vi.fn()
      });

      render(<ExamplePanelManager />);

      expect(screen.getByText('Loading panels...')).toBeInTheDocument();
      expect(screen.queryByText('Panel Manager')).not.toBeInTheDocument();
    });

    it('should show error state', () => {
      (usePanels as any).mockReturnValue({
        panels: [],
        loading: false,
        error: 'Failed to fetch panels',
        createPanel: vi.fn()
      });

      render(<ExamplePanelManager />);

      expect(screen.getByText('Error: Failed to fetch panels')).toBeInTheDocument();
      expect(screen.queryByText('Panel Manager')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // PATTERN 3: Testing Form Interactions
  // ============================================================================

  describe('form interactions', () => {
    it('should update input value when typed', () => {
      render(<ExamplePanelManager />);

      const input = screen.getByLabelText('Panel Name:') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'New Panel' } });

      expect(input.value).toBe('New Panel');
    });

    it('should update select value when changed', () => {
      render(<ExamplePanelManager />);

      const select = screen.getByLabelText('Voltage:') as HTMLSelectElement;

      fireEvent.change(select, { target: { value: '208' } });

      expect(select.value).toBe('208');
    });

    it('should call createPanel when form submitted', async () => {
      const createPanelMock = vi.fn().mockResolvedValue(undefined);

      (usePanels as any).mockReturnValue({
        panels: mockPanels,
        loading: false,
        error: null,
        createPanel: createPanelMock
      });

      render(<ExamplePanelManager />);

      // Fill form
      const nameInput = screen.getByLabelText('Panel Name:');
      fireEvent.change(nameInput, { target: { value: 'Test Panel' } });

      const voltageSelect = screen.getByLabelText('Voltage:');
      fireEvent.change(voltageSelect, { target: { value: '208' } });

      // Submit form
      const submitButton = screen.getByText('Create Panel');
      fireEvent.click(submitButton);

      // Assert hook function called with correct data
      await waitFor(() => {
        expect(createPanelMock).toHaveBeenCalledWith({
          name: 'Test Panel',
          voltage: 208,
          phase: 3,
          project_id: 'project-123'
        });
      });
    });

    it('should clear form after successful submission', async () => {
      render(<ExamplePanelManager />);

      const nameInput = screen.getByLabelText('Panel Name:') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Test Panel' } });

      const submitButton = screen.getByText('Create Panel');
      fireEvent.click(submitButton);

      // Wait for async operation
      await waitFor(() => {
        expect(nameInput.value).toBe('');  // Form cleared
      });
    });
  });

  // ============================================================================
  // PATTERN 4: Testing User Events (Click, Hover, Focus)
  // ============================================================================

  describe('user events', () => {
    it('should handle button click', () => {
      render(<ExamplePanelManager />);

      const button = screen.getByText('Create Panel');

      // Button should be enabled
      expect(button).not.toBeDisabled();

      // Click button
      fireEvent.click(button);

      // Additional assertions based on expected behavior
    });

    it('should handle form submission via Enter key', async () => {
      const createPanelMock = vi.fn();

      (usePanels as any).mockReturnValue({
        panels: mockPanels,
        loading: false,
        error: null,
        createPanel: createPanelMock
      });

      render(<ExamplePanelManager />);

      const nameInput = screen.getByLabelText('Panel Name:');
      fireEvent.change(nameInput, { target: { value: 'Test' } });

      // Submit via Enter key
      fireEvent.submit(screen.getByRole('form'));  // Or fireEvent.keyPress(nameInput, { key: 'Enter' })

      await waitFor(() => {
        expect(createPanelMock).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // PATTERN 5: Testing Accessibility
  // ============================================================================

  describe('accessibility', () => {
    it('should have accessible form labels', () => {
      render(<ExamplePanelManager />);

      // getByLabelText ensures labels are properly associated
      expect(screen.getByLabelText('Panel Name:')).toBeInTheDocument();
      expect(screen.getByLabelText('Voltage:')).toBeInTheDocument();
    });

    it('should have accessible button', () => {
      render(<ExamplePanelManager />);

      const button = screen.getByRole('button', { name: 'Create Panel' });
      expect(button).toBeInTheDocument();
    });

    it('should have proper ARIA attributes', () => {
      render(<ExamplePanelManager />);

      const panelsList = screen.getByTestId('panels-list');
      expect(panelsList).toBeInTheDocument();
    });
  });

  // ============================================================================
  // PATTERN 6: Testing Conditional Rendering
  // ============================================================================

  describe('conditional rendering', () => {
    it('should show empty state when no panels', () => {
      (usePanels as any).mockReturnValue({
        panels: [],
        loading: false,
        error: null,
        createPanel: vi.fn()
      });

      render(<ExamplePanelManager />);

      expect(screen.getByText(/No panels yet/)).toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('should show panels list when panels exist', () => {
      render(<ExamplePanelManager />);

      expect(screen.queryByText(/No panels yet/)).not.toBeInTheDocument();
      expect(screen.getByRole('list')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // PATTERN 7: Testing Multiple Hooks Integration
  // ============================================================================

  describe('integration with multiple hooks', () => {
    it('should work with both usePanels and useCircuits', () => {
      const mockCircuits = [
        { id: '1', circuitNumber: 1, panel_id: '1' }
      ];

      (useCircuits as any).mockReturnValue({
        circuits: mockCircuits,
        loading: false,
        error: null,
        createCircuit: vi.fn()
      });

      // Component would use both hooks
      // Test that both data sources render correctly
    });
  });

  // ============================================================================
  // PATTERN 8: Testing Async Operations
  // ============================================================================

  describe('async operations', () => {
    it('should handle async createPanel success', async () => {
      const createPanelMock = vi.fn().mockResolvedValue(undefined);

      (usePanels as any).mockReturnValue({
        panels: mockPanels,
        loading: false,
        error: null,
        createPanel: createPanelMock
      });

      render(<ExamplePanelManager />);

      const nameInput = screen.getByLabelText('Panel Name:');
      fireEvent.change(nameInput, { target: { value: 'Async Panel' } });

      fireEvent.click(screen.getByText('Create Panel'));

      // Wait for async operation
      await waitFor(() => {
        expect(createPanelMock).toHaveBeenCalled();
      });
    });

    it('should handle async createPanel failure', async () => {
      const createPanelMock = vi.fn().mockRejectedValue(new Error('Database error'));

      (usePanels as any).mockReturnValue({
        panels: mockPanels,
        loading: false,
        error: null,
        createPanel: createPanelMock
      });

      render(<ExamplePanelManager />);

      const nameInput = screen.getByLabelText('Panel Name:');
      fireEvent.change(nameInput, { target: { value: 'Failing Panel' } });

      fireEvent.click(screen.getByText('Create Panel'));

      // In real component, error would be displayed
      await waitFor(() => {
        expect(createPanelMock).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // PATTERN 9: Snapshot Testing (use sparingly)
  // ============================================================================

  describe('snapshot testing', () => {
    it('should match snapshot', () => {
      const { container } = render(<ExamplePanelManager />);

      // Snapshot test - use sparingly, brittle tests
      expect(container).toMatchSnapshot();
    });
  });
});

// ============================================================================
// KEY TAKEAWAYS
// ============================================================================

/**
 * 1. Mock custom hooks at module level (vi.mock('@/hooks/...'))
 * 2. Use screen queries (getByText, getByLabelText, getByRole)
 * 3. fireEvent for user interactions
 * 4. waitFor for async operations
 * 5. Test loading, error, and success states
 * 6. Test accessibility (labels, roles, ARIA)
 * 7. Test form inputs and submissions
 * 8. Use data-testid for elements without good text/label
 * 9. Avoid implementation details (test behavior, not state)
 * 10. Prefer integration tests over isolated unit tests
 */

/**
 * COMMON QUERIES (React Testing Library):
 *
 * getByText(text)              - Find by visible text
 * getByLabelText(label)        - Find input by label (accessibility!)
 * getByRole(role)              - Find by ARIA role (button, link, etc.)
 * getByPlaceholderText(text)   - Find input by placeholder
 * getByTestId(id)              - Find by data-testid attribute (last resort)
 * getByAltText(text)           - Find image by alt text
 *
 * queryBy* - Returns null instead of throwing (for negation tests)
 * findBy* - Async version (waits for element to appear)
 */

/**
 * AVOID THESE ANTI-PATTERNS:
 *
 * ❌ Testing implementation details (state, props)
 * ❌ Snapshot testing everything (brittle, hard to maintain)
 * ❌ Testing styles (use visual regression tests instead)
 * ❌ Mocking everything (test real integrations when possible)
 * ❌ Not testing accessibility (labels, roles)
 */
