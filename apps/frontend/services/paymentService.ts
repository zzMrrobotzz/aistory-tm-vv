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
   * LATEST APPROACH: Server-Sent Events (SSE) for real-time webhook notifications
   */
  async processPayment(paymentData: PaymentResponse, onPaymentSuccess?: () => void): Promise<boolean> {
    return new Promise((resolve, reject) => {
      console.log('🚀 Starting SSE-based payment monitoring for:', paymentData.paymentId);
      
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

      let isResolved = false;
      let eventSource: EventSource | null = null;

      // Setup SSE connection
      try {
        const sseUrl = `${API_URL}/payment/stream-completion/${paymentData.paymentId}`;
        eventSource = new EventSource(sseUrl);
        console.log('📡 SSE connection established:', sseUrl);

        eventSource.onopen = () => {
          console.log('✅ SSE connection opened');
        };

        eventSource.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 SSE message received:', data);

            if (data.type === 'completed') {
              // PAYMENT COMPLETED VIA SSE!
              console.log('🎉 PAYMENT COMPLETED VIA SSE! Processing immediately...');
              
              if (!isResolved) {
                isResolved = true;
                
                // Close SSE connection
                if (eventSource) {
                  eventSource.close();
                  eventSource = null;
                }
                
                // Close payment window
                if (!paymentWindow.closed) {
                  console.log('🪟 Closing payment window...');
                  paymentWindow.close();
                }
                
                // Remove modal
                const modal = document.querySelector('.fixed.inset-0.bg-black');
                if (modal) {
                  console.log('🗂️ Removing payment modal...');
                  modal.remove();
                }
                
                // Call success callback
                console.log('✅ Calling success callback...');
                if (onPaymentSuccess) {
                  try {
                    await onPaymentSuccess();
                    console.log('✅ Success callback completed');
                  } catch (callbackError) {
                    console.warn('⚠️ Success callback error:', callbackError);
                  }
                }
                
                resolve(true);
              }
            } else if (data.type === 'connected') {
              console.log('🔗 SSE connected for payment:', data.paymentId);
            } else if (data.type === 'heartbeat') {
              console.log('💓 SSE heartbeat received');
            } else if (data.type === 'error') {
              console.error('❌ SSE error:', data.message);
            }
          } catch (parseError) {
            console.error('❌ Error parsing SSE message:', parseError, event.data);
          }
        };

        eventSource.onerror = (error) => {
          console.error('❌ SSE connection error:', error);
          if (!isResolved) {
            console.log('🔄 SSE error, falling back to polling...');
            // Continue to fallback polling below
          }
        };

      } catch (sseError) {
        console.error('❌ Failed to establish SSE:', sseError);
        // Continue to fallback polling
      }

      // Fallback polling mechanism (in case SSE fails)
      let pollCount = 0;
      const maxPolls = 300; // 5 minutes at 1-second intervals

      const fallbackPolling = setInterval(async () => {
        if (isResolved) {
          clearInterval(fallbackPolling);
          return;
        }

        pollCount++;
        
        try {
          // Check payment status as fallback
          const status = await this.checkPaymentStatus(paymentData.paymentId);
          
          if (status.payment.status === 'completed') {
            console.log('✅ Payment completed detected via fallback polling');
            
            if (!isResolved) {
              isResolved = true;
              clearInterval(fallbackPolling);
              
              // Close SSE if still open
              if (eventSource) {
                eventSource.close();
                eventSource = null;
              }
              
              // Close window and modal
              if (!paymentWindow.closed) {
                paymentWindow.close();
              }
              
              const modal = document.querySelector('.fixed.inset-0.bg-black');
              if (modal) {
                modal.remove();
              }
              
              // Call success callback
              if (onPaymentSuccess) {
                try {
                  await onPaymentSuccess();
                } catch (callbackError) {
                  console.warn('Fallback success callback error:', callbackError);
                }
              }
              
              resolve(true);
            }
            return;
          }
          
          if (status.isExpired) {
            if (!isResolved) {
              isResolved = true;
              clearInterval(fallbackPolling);
              
              if (eventSource) {
                eventSource.close();
                eventSource = null;
              }
              
              if (!paymentWindow.closed) {
                paymentWindow.close();
              }
              
              reject(new Error('Thanh toán đã hết hạn'));
            }
            return;
          }

          // Handle window closure
          if (paymentWindow.closed && pollCount > 5) {
            console.log('🪟 Payment window closed, extending polling...');
            
            // Continue polling for another 30 seconds
            if (pollCount > maxPolls - 30) {
              if (!isResolved) {
                isResolved = true;
                clearInterval(fallbackPolling);
                
                if (eventSource) {
                  eventSource.close();
                  eventSource = null;
                }
                
                resolve(false);
              }
            }
            return;
          }

          // Global timeout
          if (pollCount >= maxPolls) {
            if (!isResolved) {
              isResolved = true;
              clearInterval(fallbackPolling);
              
              if (eventSource) {
                eventSource.close();
                eventSource = null;
              }
              
              if (!paymentWindow.closed) {
                paymentWindow.close();
              }
              
              reject(new Error('Thanh toán đã hết thời gian chờ'));
            }
          }

        } catch (error) {
          console.error('❌ Fallback polling error:', error);
          
          if (pollCount > maxPolls / 2) {
            if (!isResolved) {
              isResolved = true;
              clearInterval(fallbackPolling);
              
              if (eventSource) {
                eventSource.close();
                eventSource = null;
              }
              
              reject(new Error('Lỗi khi theo dõi thanh toán'));
            }
          }
        }
      }, 2000); // Fallback polling every 2 seconds

      // Ultimate cleanup
      const cleanup = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        clearInterval(fallbackPolling);
      };

      // Cleanup on page unload
      window.addEventListener('beforeunload', cleanup);
      
      // Ultimate timeout
      setTimeout(() => {
        if (!isResolved) {
          console.log('⏰ Ultimate timeout reached');
          isResolved = true;
          cleanup();
          
          if (!paymentWindow.closed) {
            paymentWindow.close();
          }
          
          reject(new Error('Thanh toán đã hết thời gian chờ'));
        }
      }, 5 * 60 * 1000); // 5 minutes
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