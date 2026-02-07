/**
 * Data Refresh Event System
 *
 * Simple pub/sub for notifying components when data changes outside their control
 * (e.g., when chatbot tools modify circuits/panels directly via Supabase)
 */

type RefreshEventType = 'circuits' | 'panels' | 'feeders' | 'meter_stacks' | 'meters' | 'all';
type RefreshCallback = () => void;

class DataRefreshEmitter {
  private listeners: Map<RefreshEventType, Set<RefreshCallback>> = new Map();

  /**
   * Subscribe to data refresh events
   * @returns Unsubscribe function
   */
  subscribe(eventType: RefreshEventType, callback: RefreshCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Emit a refresh event to notify subscribers
   */
  emit(eventType: RefreshEventType): void {
    // Notify specific listeners
    this.listeners.get(eventType)?.forEach(callback => callback());

    // Also notify 'all' listeners for any event
    if (eventType !== 'all') {
      this.listeners.get('all')?.forEach(callback => callback());
    }
  }

  /**
   * Emit refresh for multiple event types
   */
  emitMultiple(eventTypes: RefreshEventType[]): void {
    const notified = new Set<RefreshCallback>();

    for (const eventType of eventTypes) {
      this.listeners.get(eventType)?.forEach(callback => {
        if (!notified.has(callback)) {
          notified.add(callback);
          callback();
        }
      });
    }

    // Notify 'all' listeners once
    this.listeners.get('all')?.forEach(callback => {
      if (!notified.has(callback)) {
        callback();
      }
    });
  }
}

// Singleton instance
export const dataRefreshEvents = new DataRefreshEmitter();

// Convenience function for chatbot tools
export function notifyDataRefresh(types: RefreshEventType | RefreshEventType[] = 'circuits'): void {
  if (Array.isArray(types)) {
    dataRefreshEvents.emitMultiple(types);
  } else {
    dataRefreshEvents.emit(types);
  }
}
