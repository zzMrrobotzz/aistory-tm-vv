import React, { useState, useEffect } from 'react';
import { AlertCircle, Activity, Clock, TrendingUp } from 'lucide-react';
// Feature usage tracking instead of request counting
import featureUsageTracker from '../services/featureUsageTracker';

// Using simplified stats from featureUsageTracker
interface UsageStatus {
  current: number;
  dailyLimit: number;
  remaining: number;
  percentage: number;
  isBlocked: boolean;
  resetTime?: number;
}

interface UsageQuotaDisplayProps {
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

const UsageQuotaDisplay: React.FC<UsageQuotaDisplayProps> = ({ 
  compact = false, 
  showDetails = true,
  className = '' 
}) => {
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUsageStatus();
    // Refresh every 2 minutes to sync with backend 
    const interval = setInterval(loadUsageStatus, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadUsageStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const stats = await featureUsageTracker.getUsageStats();
      setUsageStatus({
        current: stats.current,
        dailyLimit: stats.dailyLimit,
        remaining: stats.remaining,
        percentage: stats.percentage,
        isBlocked: stats.isBlocked
      });
    } catch (err) {
      console.error('Error loading usage status:', err);
      // Fallback to local stats
      const localStats = featureUsageTracker.getUsageStatsSync();
      setUsageStatus({
        current: localStats.current,
        dailyLimit: localStats.dailyLimit,
        remaining: localStats.remaining,
        percentage: localStats.percentage,
        isBlocked: localStats.isBlocked
      });
      setError('Không thể đồng bộ với server, sử dụng dữ liệu local');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`p-4 border border-gray-200 rounded-lg bg-gray-50 ${className}`}>
        <div className="flex items-center space-x-2">
          <Activity className="animate-spin w-5 h-5 text-blue-600" />
          <span className="text-sm text-gray-600">Đang tải trạng thái sử dụng...</span>
        </div>
      </div>
    );
  }

  if (!usageStatus) {
    return (
      <div className={`p-4 border border-red-200 rounded-lg bg-red-50 ${className}`}>
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-600">
            {error || 'Không thể tải trạng thái sử dụng'}
          </span>
        </div>
      </div>
    );
  }

  const getStatusColor = () => {
    if (usageStatus.isBlocked) return 'red';
    if (usageStatus.percentage >= 80) return 'yellow';
    return 'green';
  };

  const statusColor = getStatusColor();
  const colorClasses = {
    red: {
      border: 'border-red-200',
      bg: 'bg-red-50',
      text: 'text-red-800',
      subtext: 'text-red-600',
      progress: 'bg-red-500'
    },
    yellow: {
      border: 'border-yellow-200', 
      bg: 'bg-yellow-50',
      text: 'text-yellow-800',
      subtext: 'text-yellow-600',
      progress: 'bg-yellow-500'
    },
    green: {
      border: 'border-green-200',
      bg: 'bg-green-50', 
      text: 'text-green-800',
      subtext: 'text-green-600',
      progress: 'bg-green-500'
    }
  };

  const colors = colorClasses[statusColor];

  if (compact) {
    return (
      <div className={`p-3 border ${colors.border} rounded-lg ${colors.bg} ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className={`w-4 h-4 ${colors.text}`} />
            <span className={`text-sm font-medium ${colors.text}`}>
              {usageStatus.current}/{usageStatus.dailyLimit} lượt sử dụng
            </span>
          </div>
          {usageStatus.isBlocked && (
            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
              Đã hết
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 border ${colors.border} rounded-lg ${colors.bg} ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Activity className={`w-5 h-5 ${colors.text}`} />
          <div>
            <h3 className={`font-medium ${colors.text}`}>
              Sử Dụng Hôm Nay
            </h3>
            <p className={`text-sm ${colors.subtext}`}>
              Tất cả tính năng AI
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${colors.text}`}>
            {usageStatus.current}/{usageStatus.dailyLimit}
          </div>
          <div className={`text-xs ${colors.subtext}`}>
            lượt sử dụng
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${colors.progress}`}
              style={{ width: `${Math.min(usageStatus.percentage, 100)}%` }}
            />
          </div>

          {/* Status info */}
          <div className="flex items-center justify-between text-sm">
            <div className={`flex items-center space-x-1 ${colors.subtext}`}>
              <TrendingUp className="w-4 h-4" />
              <span>
                {usageStatus.isBlocked 
                  ? 'Đã đạt giới hạn' 
                  : `Còn lại ${usageStatus.remaining} lượt`}
              </span>
            </div>
            <div className={`flex items-center space-x-1 ${colors.subtext}`}>
              <Clock className="w-4 h-4" />
              <span>Reset 00:00 ngày mai</span>
            </div>
          </div>

          {/* Warning message */}
          {usageStatus.isBlocked && (
            <div className="flex items-start space-x-2 p-3 bg-red-100 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700">
                <div className="font-medium">Đã đạt giới hạn hàng ngày</div>
                <div>Quota sẽ được reset vào 00:00 ngày mai (giờ VN).</div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start space-x-2 p-3 bg-orange-100 rounded-lg">
              <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-orange-700">
                {error}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UsageQuotaDisplay;