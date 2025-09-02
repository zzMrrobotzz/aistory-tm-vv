const API_URL = import.meta.env.VITE_API_URL || 'https://aistory-backend.onrender.com/api';

/**
 * Online Status Service
 * Handles marking user as online and keeping activity tracking
 */
class OnlineService {
  private updateInterval: NodeJS.Timeout | null = null;
  private isActive = false;
  private isCleaningUp = false;

  /**
   * Start online tracking when user enters the tool
   */
  public startOnlineTracking() {
    if (this.isActive) return; // Already tracking
    
    this.isActive = true;
    
    // Immediately mark as online
    this.setUserOnline();
    
    // Update every 2 minutes to keep session alive
    this.updateInterval = setInterval(() => {
      this.setUserOnline();
    }, 2 * 60 * 1000); // 2 minutes
    
    console.log('🟢 Online tracking started');
  }

  /**
   * Stop online tracking
   */
  public stopOnlineTracking() {
    if (this.isCleaningUp || !this.updateInterval) {
      return; // Prevent double cleanup
    }
    
    this.isCleaningUp = true;
    
    try {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      this.isActive = false;
      console.log('🔴 Online tracking stopped');
    } catch (error) {
      console.error('Error during cleanup:', error);
    } finally {
      this.isCleaningUp = false;
    }
  }

  /**
   * Mark user as online via API call
   */
  private async setUserOnline() {
    try {
      const token = localStorage.getItem('userToken');
      if (!token) {
        console.warn('⚠️ No auth token found, stopping online tracking');
        this.stopOnlineTracking();
        return;
      }

      const response = await fetch(`${API_URL}/auth/set-online`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ User marked as online');
      } else {
        console.warn('⚠️ Failed to mark user online:', data.message);
      }

    } catch (error) {
      console.error('❌ Error setting user online:', error);
    }
  }

  /**
   * Check if tracking is active
   */
  public isTracking(): boolean {
    return this.isActive;
  }

  /**
   * Trigger online status when user performs an activity
   */
  public onUserActivity() {
    if (!this.isActive) {
      this.startOnlineTracking();
    } else {
      // Update immediately on activity
      this.setUserOnline();
    }
  }
}

// Export singleton instance
export const onlineService = new OnlineService();
export default onlineService;