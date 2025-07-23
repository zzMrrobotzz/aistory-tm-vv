import React, { useState, useEffect } from 'react';
import { Check, Crown, Zap, AlertCircle } from 'lucide-react';
import { paymentService } from '../../services/paymentService';
import SubscriptionStatus from '../SubscriptionStatus';

interface Package {
  _id: string;
  planId: string;
  name: string;
  description: string;
  price: number;
  durationMonths?: number; // Backward compatibility
  durationType?: 'days' | 'months';
  durationValue?: number;
  isPopular: boolean;
  isActive: boolean;
}

const Pricing: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await fetch(`https://aistory-backend.onrender.com/api/packages?t=${timestamp}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const data = await response.json();
      if (data.success) {
        // Sort packages: trial packages first, then monthly, then lifetime
        const sortedPackages = data.packages.sort((a: Package, b: Package) => {
          // Trial packages first
          if (a.durationType === 'days' && b.durationType !== 'days') return -1;
          if (b.durationType === 'days' && a.durationType !== 'days') return 1;
          
          // If both are trial packages, sort by duration
          if (a.durationType === 'days' && b.durationType === 'days') {
            return (a.durationValue || 0) - (b.durationValue || 0);
          }
          
          // Monthly packages before lifetime
          const aMonths = a.durationValue || a.durationMonths || 1;
          const bMonths = b.durationValue || b.durationMonths || 1;
          
          if (aMonths >= 999 && bMonths < 999) return 1;
          if (bMonths >= 999 && aMonths < 999) return -1;
          
          // Sort by price
          return a.price - b.price;
        });
        
        setPackages(sortedPackages);
      }
    } catch (error) {
      console.error('Failed to fetch packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const formatDuration = (pkg: Package) => {
    // New duration system
    if (pkg.durationType === 'days') {
      return `${pkg.durationValue} ngày`;
    }
    
    // New months system or backward compatibility
    const months = pkg.durationValue || pkg.durationMonths || 1;
    
    if (months >= 999) return 'Vĩnh viễn';
    if (months === 1) return '1 tháng';
    if (months === 3) return '3 tháng';
    if (months === 12) return '1 năm';
    return `${months} tháng`;
  };

  const handleSelectPackage = async (packageData: Package) => {
    setSelectedPackage(packageData._id);
    setError(null);
    setProcessing(true);
    
    try {
      console.log('Creating payment for package:', packageData.planId);
      
      // Create payment
      const paymentData = await paymentService.createPayment(packageData.planId);
      
      if (paymentData.success) {
        // Show payment modal with QR and transfer info
        paymentService.showPaymentModal(paymentData);
        
        // Optional: Process payment in popup window
        try {
          const paymentCompleted = await paymentService.processPayment(paymentData);
          
          if (paymentCompleted) {
            alert(`✅ Thanh toán thành công cho gói ${packageData.name}!\n\nVui lòng tải lại trang để cập nhật trạng thái subscription.`);
            window.location.reload();
          } else {
            alert('❌ Thanh toán chưa hoàn tất. Vui lòng kiểm tra và thử lại.');
          }
        } catch (paymentError: any) {
          console.warn('Payment monitoring error:', paymentError.message);
          // Still show success message since payment modal is displayed
          alert('Vui lòng hoàn thành thanh toán trong cửa sổ đã mở và tải lại trang để cập nhật trạng thái.');
        }
      } else {
        throw new Error(paymentData.error || 'Không thể tạo thanh toán');
      }
    } catch (error: any) {
      console.error('Payment creation error:', error);
      setError(error.message || 'Có lỗi xảy ra khi tạo thanh toán. Vui lòng thử lại.');
    } finally {
      setProcessing(false);
      setSelectedPackage(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Chọn gói phù hợp với bạn
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Truy cập không giới hạn vào bộ công cụ AI viết truyện chuyên nghiệp
          </p>
          
          {/* Error message */}
          {error && (
            <div className="mt-6 max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}
          
          {/* Processing message */}
          {processing && (
            <div className="mt-6 max-w-md mx-auto bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-blue-700">Đang tạo thanh toán...</span>
              </div>
            </div>
          )}
        </div>

        {/* Subscription Status */}
        <div className="max-w-md mx-auto mb-12">
          <SubscriptionStatus />
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Free Plan */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Miễn phí</h3>
              <div className="text-4xl font-bold text-gray-900 mb-2">
                0₫
              </div>
              <p className="text-gray-600">Dùng thử các tính năng cơ bản</p>
            </div>
            
            <ul className="space-y-3 mb-8">
              <li className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-3" />
                <span>Xem trước giao diện</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-3" />
                <span>Tính năng cơ bản</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-3" />
                <span>Cần API key riêng</span>
              </li>
            </ul>
            
            <button 
              className="w-full py-3 px-6 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              disabled
            >
              Gói hiện tại
            </button>
          </div>

          {/* Paid Plans */}
          {packages.map((pkg) => (
            <div 
              key={pkg._id}
              className={`bg-white rounded-2xl shadow-lg p-8 border-2 relative ${
                pkg.isPopular 
                  ? 'border-blue-500 transform scale-105' 
                  : 'border-gray-200'
              }`}
            >
              {pkg.isPopular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center">
                    <Crown className="h-4 w-4 mr-1" />
                    Phổ biến
                  </div>
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  {formatPrice(pkg.price)}
                </div>
                <p className="text-gray-600">{formatDuration(pkg)}</p>
                <p className="text-sm text-gray-500 mt-2">{pkg.description}</p>
                <div className="text-xs text-gray-400 mt-1">Mã gói: {pkg.planId || 'N/A'}</div>
                <div className="text-xs text-gray-400 mt-1">Trạng thái: {pkg.isActive === false ? 'Ngừng' : 'Đang hoạt động'}</div>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Tất cả 15 AI Tools không giới hạn</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>AI GPT-4, Claude, Gemini Pro</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Text-to-Speech cao cấp</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Tạo ảnh AI không giới hạn</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Sử dụng API key riêng</span>
                </li>
                {/* Special features based on package type */}
                {((pkg.durationValue || pkg.durationMonths) >= 999) && (
                  <li className="flex items-center">
                    <Zap className="h-5 w-5 text-yellow-500 mr-3" />
                    <span className="font-semibold text-yellow-600">
                      Truy cập trọn đời
                    </span>
                  </li>
                )}
                {pkg.durationType === 'days' && (
                  <li className="flex items-center">
                    <Zap className="h-5 w-5 text-blue-500 mr-3" />
                    <span className="font-semibold text-blue-600">
                      Dùng thử không cam kết
                    </span>
                  </li>
                )}
              </ul>
              
              <button 
                onClick={() => handleSelectPackage(pkg)}
                disabled={processing || selectedPackage === pkg._id}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                  pkg.isPopular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                } ${
                  processing || selectedPackage === pkg._id 
                    ? 'opacity-50 cursor-not-allowed' 
                    : ''
                }`}
              >
                {processing && selectedPackage === pkg._id ? 'Đang xử lý...' : 'Chọn gói này'}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ or additional info */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Tại sao chọn AI Story Tool?
          </h3>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">AI Tiên tiến</h4>
              <p className="text-gray-600">
                Sử dụng các mô hình AI mới nhất từ OpenAI, Google, Anthropic
              </p>
            </div>
            <div className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Dễ sử dụng</h4>
              <p className="text-gray-600">
                Giao diện thân thiện, không cần kinh nghiệm kỹ thuật
              </p>
            </div>
            <div className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Crown className="h-6 w-6 text-purple-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Chuyên nghiệp</h4>
              <p className="text-gray-600">
                Công cụ toàn diện cho writers, marketers, content creators
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;