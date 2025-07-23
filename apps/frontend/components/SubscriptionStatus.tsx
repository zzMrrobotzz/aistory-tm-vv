import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Crown, AlertTriangle, CheckCircle } from 'lucide-react';
import { getCurrentUserToken } from '../services/authService';

interface UserProfile {
  username: string;
  email: string;
  subscriptionType?: string;
  subscriptionExpiresAt?: string;
  remainingCredits: number;
  createdAt: string;
}

interface SubscriptionStatusProps {
  className?: string;
}

const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({ className = '' }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = getCurrentUserToken();
      if (!token) {
        setError('Vui lòng đăng nhập để xem thông tin subscription');
        setLoading(false);
        return;
      }

      const response = await fetch('https://aistory-backend.onrender.com/api/auth/me', {
        headers: {
          'x-auth-token': token
        }
      });

      if (!response.ok) {
        throw new Error('Không thể lấy thông tin user');
      }

      const data = await response.json();
      setUserProfile(data);
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      setError(error.message || 'Có lỗi xảy ra khi lấy thông tin user');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSubscriptionStatus = () => {
    if (!userProfile?.subscriptionExpiresAt) {
      return {
        status: 'free',
        message: 'Tài khoản miễn phí',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        icon: AlertTriangle
      };
    }

    const expiryDate = new Date(userProfile.subscriptionExpiresAt);
    const now = new Date();
    const timeLeft = expiryDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));

    if (expiryDate.getFullYear() >= 2099) {
      return {
        status: 'lifetime',
        message: 'Gói vĩnh viễn',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        icon: Crown
      };
    }

    if (timeLeft > 0) {
      if (daysLeft <= 7) {
        return {
          status: 'expiring',
          message: `Còn ${daysLeft} ngày`,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          icon: Clock
        };
      } else {
        return {
          status: 'active',
          message: `Còn ${daysLeft} ngày`,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          icon: CheckCircle
        };
      }
    } else {
      return {
        status: 'expired',
        message: 'Đã hết hạn',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        icon: AlertTriangle
      };
    }
  };

  const getSubscriptionName = (subscriptionType?: string) => {
    switch (subscriptionType) {
      case 'monthly_premium':
        return 'Gói Premium Tháng';
      case 'lifetime_premium':
        return 'Gói Vĩnh Viễn';
      case 'trial_3days':
        return 'Gói Dùng Thử 3 Ngày';
      case 'trial_7days':
        return 'Gói Dùng Thử 1 Tuần';
      default:
        return 'Không có gói';
    }
  };

  if (loading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="bg-gray-200 rounded-lg h-32"></div>
      </div>
    );
  }

  if (error || !userProfile) {
    return (
      <div className={`${className} bg-red-50 border border-red-200 rounded-lg p-4`}>
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error || 'Không thể lấy thông tin user'}</span>
        </div>
      </div>
    );
  }

  const subscriptionStatus = getSubscriptionStatus();
  const StatusIcon = subscriptionStatus.icon;

  return (
    <div className={`${className} bg-white rounded-lg shadow-md p-6 border`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Trạng thái tài khoản</h3>
        <div className={`flex items-center px-3 py-1 rounded-full ${subscriptionStatus.bgColor}`}>
          <StatusIcon className={`h-4 w-4 ${subscriptionStatus.color} mr-1`} />
          <span className={`text-sm font-medium ${subscriptionStatus.color}`}>
            {subscriptionStatus.message}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {/* User Info */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Tài khoản:</span>
          <span className="font-medium">{userProfile.username}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600">Email:</span>
          <span className="font-medium">{userProfile.email}</span>
        </div>

        {/* Subscription Info */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Gói hiện tại:</span>
          <span className="font-medium">{getSubscriptionName(userProfile.subscriptionType)}</span>
        </div>

        {/* Registration Date */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Ngày đăng ký:</span>
          <div className="flex items-center">
            <Calendar className="h-4 w-4 text-gray-400 mr-1" />
            <span className="font-medium">{formatDate(userProfile.createdAt)}</span>
          </div>
        </div>

        {/* Expiry Date */}
        {userProfile.subscriptionExpiresAt && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Ngày hết hạn:</span>
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-gray-400 mr-1" />
              <span className={`font-medium ${subscriptionStatus.color}`}>
                {formatDate(userProfile.subscriptionExpiresAt)}
              </span>
            </div>
          </div>
        )}

        {/* Credits */}
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-gray-600">Credits còn lại:</span>
          <span className="font-bold text-blue-600">
            {userProfile.remainingCredits?.toLocaleString() || 0}
          </span>
        </div>
      </div>

      {/* Action buttons based on status */}
      <div className="mt-4 pt-4 border-t">
        {subscriptionStatus.status === 'free' && (
          <button
            onClick={() => window.location.href = '/pricing'}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Nâng cấp tài khoản
          </button>
        )}

        {subscriptionStatus.status === 'expiring' && (
          <button
            onClick={() => window.location.href = '/pricing'}
            className="w-full py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            Gia hạn subscription
          </button>
        )}

        {subscriptionStatus.status === 'expired' && (
          <button
            onClick={() => window.location.href = '/pricing'}
            className="w-full py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Kích hoạt lại tài khoản
          </button>
        )}

        {subscriptionStatus.status === 'active' && (
          <button
            onClick={fetchUserProfile}
            className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Làm mới thông tin
          </button>
        )}

        {subscriptionStatus.status === 'lifetime' && (
          <div className="text-center py-2">
            <span className="text-sm text-yellow-600 font-medium">
              🎉 Bạn đã có truy cập vĩnh viễn!
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionStatus;