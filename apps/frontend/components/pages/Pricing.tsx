import React, { useState, useEffect } from 'react';
import { Check, Crown, Zap } from 'lucide-react';

interface Package {
  _id: string;
  planId: string;
  name: string;
  description: string;
  price: number;
  durationMonths: number;
  isPopular: boolean;
  isActive: boolean;
}

const Pricing: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const response = await fetch('https://aistory-backend.onrender.com/api/packages');
      const data = await response.json();
      if (data.success) {
        setPackages(data.packages);
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

  const formatDuration = (months: number) => {
    if (months >= 999) return 'Vĩnh viễn';
    if (months === 1) return '1 tháng';
    if (months === 3) return '3 tháng';
    if (months === 12) return '1 năm';
    return `${months} tháng`;
  };

  const handleSelectPackage = async (packageData: Package) => {
    setSelectedPackage(packageData._id);
    
    // Create payment URL (replace with actual payment integration)
    const paymentData = {
      planId: packageData.planId,
      amount: packageData.price,
      description: `Thanh toán ${packageData.name}`
    };
    
    console.log('Selected package:', paymentData);
    
    // TODO: Integrate with PayOS payment
    alert(`Đã chọn gói: ${packageData.name}\nGiá: ${formatPrice(packageData.price)}\n\nTính năng thanh toán sẽ được tích hợp sớm!`);
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
                    Phổ biến nhất
                  </div>
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  {formatPrice(pkg.price)}
                </div>
                <p className="text-gray-600">{formatDuration(pkg.durationMonths)}</p>
                <p className="text-sm text-gray-500 mt-2">{pkg.description}</p>
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
                {pkg.durationMonths >= 999 && (
                  <li className="flex items-center">
                    <Zap className="h-5 w-5 text-yellow-500 mr-3" />
                    <span className="font-semibold text-yellow-600">
                      Truy cập trọn đời
                    </span>
                  </li>
                )}
              </ul>
              
              <button 
                onClick={() => handleSelectPackage(pkg)}
                disabled={selectedPackage === pkg._id}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                  pkg.isPopular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                } ${
                  selectedPackage === pkg._id 
                    ? 'opacity-50 cursor-not-allowed' 
                    : ''
                }`}
              >
                {selectedPackage === pkg._id ? 'Đang xử lý...' : 'Chọn gói này'}
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