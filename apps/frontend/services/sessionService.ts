// Note: Using browser native notifications instead of antd for better compatibility

const API_URL = import.meta.env.VITE_API_URL || 'https://aistory-backend.onrender.com/api';

/**
 * Session Management Service
 * Handles single session enforcement and session monitoring
 */
class SessionService {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private sessionCheckInterval: NodeJS.Timeout | null = null;
  private isSessionActive = false;
  private onSessionTerminated: (() => void) | null = null;

  /**
   * Initialize session monitoring
   */
  public initialize(onSessionTerminated?: () => void) {
    this.onSessionTerminated = onSessionTerminated || this.defaultSessionTerminatedHandler;
    this.startSessionMonitoring();
    this.startHeartbeat();
    this.isSessionActive = true;
    
    console.log('🔒 Single session monitoring initialized');
  }

  /**
   * Cleanup session monitoring
   */
  public cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
    
    this.isSessionActive = false;
    console.log('🔒 Session monitoring cleaned up');
  }

  /**
   * Start heartbeat to keep session alive
   */
  private startHeartbeat() {
    // Send heartbeat every 2 minutes
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 2 * 60 * 1000);
  }

  /**
   * Start session status monitoring
   */
  private startSessionMonitoring() {
    // Check session status every 30 seconds
    this.sessionCheckInterval = setInterval(() => {
      this.checkSessionStatus();
    }, 30 * 1000);
  }

  /**
   * Send heartbeat to server
   */
  private async sendHeartbeat() {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken || !this.isSessionActive) return;

      const response = await fetch(`${API_URL}/auth/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken
        }
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'SESSION_TERMINATED' || data.terminatedByNewLogin) {
          this.handleSessionTerminated('Tài khoản đã được đăng nhập từ thiết bị khác. Phiên này đã bị ngắt kết nối.');
        } else if (data.error === 'SESSION_NOT_FOUND') {
          this.handleSessionTerminated('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
        }
      }
    } catch (error) {
      console.warn('❌ Heartbeat failed:', error);
      // Don't terminate session on network errors
    }
  }

  /**
   * Check session status
   */
  private async checkSessionStatus() {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken || !this.isSessionActive) return;

      const response = await fetch(`${API_URL}/auth/session-status`, {
        method: 'GET',
        headers: {
          'x-session-token': sessionToken
        }
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.error === 'SESSION_TERMINATED' || data.terminatedByNewLogin) {
          this.handleSessionTerminated('Tài khoản đã được đăng nhập từ thiết bị khác. Bạn sẽ được chuyển về trang đăng nhập.');
        } else if (data.error === 'SESSION_EXPIRED') {
          this.handleSessionTerminated('Phiên đăng nhập đã hết hạn do không hoạt động. Vui lòng đăng nhập lại.');
        } else if (data.error === 'SESSION_NOT_FOUND') {
          this.handleSessionTerminated('Phiên đăng nhập không tồn tại. Vui lòng đăng nhập lại.');
        }
      }
    } catch (error) {
      console.warn('❌ Session status check failed:', error);
      // Don't terminate session on network errors
    }
  }

  /**
   * Handle session termination
   */
  private handleSessionTerminated(reason: string) {
    if (!this.isSessionActive) return; // Prevent multiple calls
    
    this.isSessionActive = false;
    this.cleanup();
    
    console.warn('🚪 Session terminated:', reason);
    
    // Clear local storage
    localStorage.removeItem('userToken');
    localStorage.removeItem('sessionToken');
    
    // Show notification using browser native API
    this.showNotification('Session Terminated', reason, 'error');
    
    // Call termination handler
    if (this.onSessionTerminated) {
      setTimeout(() => {
        this.onSessionTerminated!();
      }, 2000); // Give time for message to show
    }
  }

  /**
   * Default session termination handler
   */
  private defaultSessionTerminatedHandler() {
    // Redirect to login page
    window.location.replace('/login');
  }

  /**
   * Show notification using browser native API or fallback to console
   */
  private showNotification(title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    console.log(`${type.toUpperCase()}: ${title} - ${message}`);
    
    // Try to use browser notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'
      });
    } else {
      // Fallback to alert for important notifications
      if (type === 'error' || type === 'warning') {
        alert(`${title}: ${message}`);
      }
    }
  }

  /**
   * Check if session is active
   */
  public isActive(): boolean {
    return this.isSessionActive;
  }

  /**
   * Get current session info
   */
  public async getSessionInfo() {
    try {
      const token = localStorage.getItem('userToken');
      if (!token) return null;

      const response = await fetch(`${API_URL}/auth/active-session`, {
        method: 'GET',
        headers: {
          'x-auth-token': token
        }
      });

      const data = await response.json();
      
      if (data.success && data.hasActiveSession) {
        return data.sessionInfo;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get session info:', error);
      return null;
    }
  }

  /**
   * Force logout all sessions
   */
  public async forceLogoutAllSessions() {
    try {
      const token = localStorage.getItem('userToken');
      if (!token) return false;

      const response = await fetch(`${API_URL}/auth/force-logout`, {
        method: 'POST',
        headers: {
          'x-auth-token': token
        }
      });

      const data = await response.json();
      
      if (data.success) {
        this.showNotification('Success', data.message, 'success');
        return true;
      } else {
        this.showNotification('Error', data.message, 'error');
        return false;
      }
    } catch (error) {
      console.error('❌ Force logout failed:', error);
      this.showNotification('Error', 'Lỗi ngắt kết nối phiên đăng nhập', 'error');
      return false;
    }
  }

  /**
   * Show concurrent login warning dialog
   */
  public static showConcurrentLoginWarning(onProceed: () => void, onCancel: () => void) {
    // This would typically use a more sophisticated modal, but for now using confirm
    const proceed = window.confirm(
      'Tài khoản này đang được sử dụng ở thiết bị khác.\n\n' +
      'Nếu bạn tiếp tục đăng nhập, phiên đăng nhập cũ sẽ bị ngắt kết nối.\n\n' +
      'Bạn có muốn tiếp tục không?'
    );
    
    if (proceed) {
      onProceed();
    } else {
      onCancel();
    }
  }

  /**
   * Handle API response for session-related errors
   */
  public static handleApiResponse(response: any): boolean {
    if (response && response.error) {
      switch (response.error) {
        case 'SESSION_TERMINATED':
          sessionService.showNotification(
            'Session Terminated',
            response.message || 'Phiên đăng nhập đã bị ngắt kết nối',
            'error'
          );
          
          // Redirect to login after delay
          setTimeout(() => {
            window.location.replace('/login');
          }, 2000);
          return false;

        case 'SESSION_EXPIRED':
          sessionService.showNotification(
            'Session Expired',
            response.message || 'Phiên đăng nhập đã hết hạn',
            'warning'
          );
          
          // Redirect to login after delay
          setTimeout(() => {
            window.location.replace('/login');
          }, 2000);
          return false;

        case 'SESSION_REQUIRED':
        case 'SESSION_INVALID':
          sessionService.showNotification(
            'Session Invalid',
            response.message || 'Phiên đăng nhập không hợp lệ',
            'error'
          );
          
          // Redirect to login
          setTimeout(() => {
            window.location.replace('/login');
          }, 1000);
          return false;
      }
    }
    
    return true; // No session errors
  }
}

// Export singleton instance
export const sessionService = new SessionService();
export default sessionService;