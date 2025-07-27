// Payment Event Bus for communication between components
class PaymentEventBus {
  private listeners: { [key: string]: Array<() => void> } = {};

  on(event: string, callback: () => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: () => void) {
    if (!this.listeners[event]) return;
    
    const index = this.listeners[event].indexOf(callback);
    if (index > -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  emit(event: string) {
    if (!this.listeners[event]) return;
    
    this.listeners[event].forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error(`Error in payment event listener:`, error);
      }
    });
  }

  // Clear all listeners (useful for cleanup)
  clear() {
    this.listeners = {};
  }
}

export const paymentEventBus = new PaymentEventBus();

// Payment events
export const PAYMENT_EVENTS = {
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  SUBSCRIPTION_UPDATED: 'subscription_updated'
} as const;