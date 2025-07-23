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
          'Authorization': `Bearer ${token}`
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
        throw new Error(data.error || 'Không thể kiểm tra trạng thái thanh toán');
      }

      return data;
    } catch (error) {
      console.error('Payment status check error:', error);
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
   * Open payment URL in new window and monitor payment completion
   */
  async processPayment(paymentData: PaymentResponse): Promise<boolean> {
    return new Promise((resolve, reject) => {
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

      // Monitor payment completion
      const checkInterval = setInterval(async () => {
        try {
          // Check if payment window is closed
          if (paymentWindow.closed) {
            clearInterval(checkInterval);
            
            // Check payment status
            const status = await this.checkPaymentStatus(paymentData.paymentId);
            
            if (status.payment.status === 'completed') {
              resolve(true);
            } else {
              resolve(false);
            }
            return;
          }

          // Check payment status periodically
          const status = await this.checkPaymentStatus(paymentData.paymentId);
          
          if (status.payment.status === 'completed') {
            clearInterval(checkInterval);
            paymentWindow.close();
            resolve(true);
            return;
          }

          if (status.isExpired) {
            clearInterval(checkInterval);
            paymentWindow.close();
            reject(new Error('Thanh toán đã hết hạn'));
            return;
          }

        } catch (error) {
          console.error('Payment monitoring error:', error);
        }
      }, 3000); // Check every 3 seconds

      // Timeout after 10 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!paymentWindow.closed) {
          paymentWindow.close();
        }
        reject(new Error('Thanh toán đã hết thời gian'));
      }, 10 * 60 * 1000);
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