import { getCurrentUserToken } from './authService';

const API_URL = 'https://aistory-backend.onrender.com/api';

export interface PaymentRequest {
  planId: string;
}

export interface PaymentResponse {
  success: boolean;
  payUrl: string;
  qrData?: string;
  transferInfo?: {
    accountNumber: string;
    accountName: string;
    bankName: string;
    amount: number;
    content: string;
  };
  paymentId: string;
  expiredAt: string;
  error?: string;
}

export interface PaymentStatus {
  success: boolean;
  payment: {
    _id: string;
    status: string;
    price: number;
    createdAt: string;
    expiredAt: string;
  };
  isExpired: boolean;
}

class PaymentService {
  /**
   * Create a new payment for subscription
   */
  async createPayment(planId: string): Promise<PaymentResponse> {
    try {
      const token = getCurrentUserToken();
      if (!token) {
        throw new Error('Vui lòng đăng nhập để thực hiện thanh toán');
      }

      const response = await fetch(`${API_URL}/payment/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ planId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Không thể tạo thanh toán');
      }

      return data;
    } catch (error) {
      console.error('Payment creation error:', error);
      throw error;
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      const response = await fetch(`${API_URL}/payment/status/${paymentId}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Payment status check failed:', data);
        throw new Error(data.error || 'Không thể kiểm tra trạng thái thanh toán');
      }

      return data;
    } catch (error) {
      console.error('Payment status check error:', error);
      throw error;
    }
  }

  /**
   * NEW: Check if payment was completed via webhook (real-time notification)
   */
  async checkPaymentCompletion(paymentId: string): Promise<{ completed: boolean; completionInfo?: any }> {
    try {
      const response = await fetch(`${API_URL}/payment/check-completion/${paymentId}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Payment completion check failed:', data);
        throw new Error(data.error || 'Không thể kiểm tra completion status');
      }

      return data;
    } catch (error) {
      console.error('Payment completion check error:', error);
      throw error;
    }
  }

  /**
   * Debug payment status with detailed info
   */
  async debugPaymentStatus(paymentId: string): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/payment/debug/${paymentId}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Không thể debug thanh toán');
      }

      return data;
    } catch (error) {
      console.error('Payment debug error:', error);
      throw error;
    }
  }

  /**
   * Check PayOS payment status by order code
   */
  async checkPayOSPaymentStatus(orderCode: string): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/payment/check-payos/${orderCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Không thể kiểm tra trạng thái PayOS');
      }

      return data;
    } catch (error) {
      console.error('PayOS status check error:', error);
      throw error;
    }
  }

  /**
   * NEW APPROACH: Direct webhook notification detection
   */
  async processPayment(paymentData: PaymentResponse, onPaymentSuccess?: () => void): Promise<boolean> {
    return new Promise((resolve, reject) => {
      console.log('🚀 Starting NEW webhook-direct payment monitoring for:', paymentData.paymentId);
      
      // Open payment window
      const paymentWindow = window.open(
        paymentData.payUrl,
        'payment',
        'width=800,height=600,scrollbars=yes,resizable=yes'
      );

      if (!paymentWindow) {
        reject(new Error('Không thể mở cửa sổ thanh toán. Vui lòng cho phép popup và thử lại.'));
        return;
      }

      let checkCount = 0;
      let isResolved = false;
      const maxChecks = 180; // 3 minutes at 1-second intervals

      // NEW: Use direct webhook completion check
      const webhookCheckInterval = setInterval(async () => {
        if (isResolved) {
          clearInterval(webhookCheckInterval);
          return;
        }

        checkCount++;
        
        try {
          // Check for webhook completion notification FIRST
          const completionCheck = await this.checkPaymentCompletion(paymentData.paymentId);
          console.log(`🔍 Webhook completion check #${checkCount}:`, completionCheck);
          
          if (completionCheck.completed) {
            // WEBHOOK COMPLETION DETECTED!
            isResolved = true;
            clearInterval(webhookCheckInterval);
            
            console.log('🎉 WEBHOOK COMPLETION DETECTED! Processing immediately...');
            
            // Force close everything
            if (!paymentWindow.closed) {
              console.log('🪟 Force closing payment window...');
              paymentWindow.close();
            }
            
            // Remove modal
            const modal = document.querySelector('.fixed.inset-0.bg-black');
            if (modal) {
              console.log('🗂️ Force removing payment modal...');
              modal.remove();
            }
            
            // Call success callback
            console.log('✅ Calling success callback for webhook completion...');
            if (onPaymentSuccess) {
              try {
                await onPaymentSuccess();
                console.log('✅ Webhook success callback completed');
              } catch (callbackError) {
                console.warn('⚠️ Webhook success callback error:', callbackError);
              }
            }
            
            resolve(true);
            return;
          }
          
          // Fallback: Also check regular status for expired payments
          const status = await this.checkPaymentStatus(paymentData.paymentId);
          if (status.isExpired) {
            isResolved = true;
            clearInterval(webhookCheckInterval);
            if (!paymentWindow.closed) {
              paymentWindow.close();
            }
            console.warn('⚠️ Payment expired');
            reject(new Error('Thanh toán đã hết hạn'));
            return;
          }

          // Check if user closed window (they might complete payment elsewhere)
          if (paymentWindow.closed && checkCount > 5) {
            console.log('🪟 User closed window, doing final webhook checks...');
            
            // Give webhook extra time to process (up to 30 seconds)
            let finalChecks = 0;
            const maxFinalChecks = 30;
            
            const finalCheckInterval = setInterval(async () => {
              finalChecks++;
              const finalCompletionCheck = await this.checkPaymentCompletion(paymentData.paymentId);
              console.log(`🔍 Final webhook check #${finalChecks}/${maxFinalChecks}:`, finalCompletionCheck);
              
              if (finalCompletionCheck.completed) {
                clearInterval(finalCheckInterval);
                clearInterval(webhookCheckInterval);
                isResolved = true;
                
                // Remove modal if exists
                const lateModal = document.querySelector('.fixed.inset-0.bg-black');
                if (lateModal) lateModal.remove();
                
                if (onPaymentSuccess) {
                  try {
                    await onPaymentSuccess();
                  } catch (error) {
                    console.warn('Final success callback error:', error);
                  }
                }
                resolve(true);
                return;
              }
              
              if (finalChecks >= maxFinalChecks) {
                clearInterval(finalCheckInterval);
                clearInterval(webhookCheckInterval);
                isResolved = true;
                console.warn('⚠️ No webhook completion detected after window close');
                resolve(false);
                return;
              }
            }, 1000);
            
            return;
          }

          // Global timeout
          if (checkCount >= maxChecks) {
            isResolved = true;
            clearInterval(webhookCheckInterval);
            if (!paymentWindow.closed) {
              paymentWindow.close();
            }
            console.warn('⚠️ Webhook monitoring timeout');
            reject(new Error('Thanh toán đã hết thời gian chờ'));
            return;
          }

        } catch (error) {
          console.error('💥 Webhook monitoring error:', error);
          
          // Continue unless too many errors
          if (checkCount > 60 && checkCount % 10 === 0) {
            console.warn(`Too many errors in webhook monitoring: ${error.message}`);
          }
          
          if (checkCount > maxChecks / 2) {
            isResolved = true;
            clearInterval(webhookCheckInterval);
            reject(new Error('Lỗi nghiêm trọng khi theo dõi webhook'));
            return;
          }
        }
      }, 1000); // Check every 1 second

      // Ultimate timeout after 5 minutes
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          clearInterval(webhookCheckInterval);
          if (!paymentWindow.closed) {
            paymentWindow.close();
          }
          reject(new Error('Thanh toán đã hết thời gian chờ'));
        }
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Show payment modal with QR code and transfer info
   */
  showPaymentModal(paymentData: PaymentResponse): void {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">Thanh toán đơn hàng</h3>
        
        ${paymentData.qrData ? `
          <div class="text-center mb-4">
            <div class="bg-gray-100 p-4 rounded-lg inline-block">
              <div class="text-sm text-gray-600 mb-2">Quét mã QR để thanh toán</div>
              <div class="w-32 h-32 bg-white border-2 border-gray-300 flex items-center justify-center">
                QR Code
              </div>
            </div>
          </div>
        ` : ''}
        
        ${paymentData.transferInfo ? `
          <div class="border rounded-lg p-4 mb-4">
            <h4 class="font-semibold mb-2">Thông tin chuyển khoản</h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">Ngân hàng:</span>
                <span class="font-medium">${paymentData.transferInfo.bankName}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Số tài khoản:</span>
                <span class="font-medium">${paymentData.transferInfo.accountNumber}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Chủ tài khoản:</span>
                <span class="font-medium">${paymentData.transferInfo.accountName}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Số tiền:</span>
                <span class="font-medium text-red-600">${paymentData.transferInfo.amount.toLocaleString()} VNĐ</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Nội dung:</span>
                <span class="font-medium">${paymentData.transferInfo.content}</span>
              </div>
            </div>
          </div>
        ` : ''}
        
        <div class="flex space-x-2">
          <button 
            onclick="window.open('${paymentData.payUrl}', '_blank')"
            class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
          >
            Thanh toán ngay
          </button>
          <button 
            onclick="this.closest('.fixed').remove()"
            class="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
          >
            Đóng
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Auto remove modal after 15 minutes
    setTimeout(() => {
      if (document.body.contains(modal)) {
        modal.remove();
      }
    }, 15 * 60 * 1000);
  }
}

export const paymentService = new PaymentService();