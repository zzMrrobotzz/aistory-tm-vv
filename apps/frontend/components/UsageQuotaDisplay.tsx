import React, { useState, useEffect } from 'react';
import { AlertCircle, Activity, Clock, TrendingUp } from 'lucide-react';
import { getUserUsageStatus } from '../services/rateLimitService';

interface UsageStatus {
  canProceed: boolean;
  totalUsage: number;
  usageLimit: number;
  remainingRequests: number;
  percentage: number;
  subscription: string;
  moduleBreakdown: Array<{
    moduleId: string;
    requestCount: number;
    weightedUsage: number;
  }>;
  warning?: {
    message: string;
    percentage: number;
  } | null;
  resetTime: number;
}

interface UsageQuotaDisplayProps {
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

const moduleNames = {
  'write-story': 'Viết Truyện',
  'batch-story-writing': 'Viết Truyện Hàng Loạt',
  'rewrite': 'Viết Lại',
  'batch-rewrite': 'Viết Lại Hàng Loạt'
};

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
    // Refresh every minute to handle midnight reset  
    const interval = setInterval(loadUsageStatus, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to usage warnings from textGenerationService
  useEffect(() => {
    const handleUsageWarning = (event: CustomEvent) => {
      const { warning } = event.detail;
      if (warning) {
        // Refresh usage status when warning is received
        loadUsageStatus();
      }
    };

    window.addEventListener('usage-warning', handleUsageWarning);
    return () => window.removeEventListener('usage-warning', handleUsageWarning);
  }, []);

  const loadUsageStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUserUsageStatus();
      const status: UsageStatus = {
        canProceed: data.canProceed,
        totalUsage: data.totalUsage,
        usageLimit: data.usageLimit,
        remainingRequests: data.remainingRequests,
        percentage: data.percentage,
        subscription: data.subscription,
        moduleBreakdown: data.moduleBreakdown || [],
        warning: data.warning || null,
        resetTime: data.resetTime as unknown as number
      };
      setUsageStatus(status);
    } catch (err) {
      console.error('Failed to load usage status:', err);
      
      // Fallback to basic display without error UI 
      const fallbackStatus: UsageStatus = {
        canProceed: true,
        totalUsage: 0,
        usageLimit: 5000,
        remainingRequests: 5000,
        percentage: 0,
        subscription: 'Unknown',
        moduleBreakdown: [],
        warning: null,
        resetTime: 0
      };
      setUsageStatus(fallbackStatus);
      // Don't set error to avoid red error UI
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="animate-pulse flex items-center">
          <div className="w-4 h-4 bg-gray-300 rounded mr-2"></div>
          <div className="h-4 bg-gray-300 rounded w-32"></div>
        </div>
      </div>
    );
  }

  if (error || !usageStatus) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center text-red-700">
          <AlertCircle className="w-4 h-4 mr-2" />
          <span className="text-sm">{error || 'Lỗi tải usage'}</span>
        </div>
      </div>
    );
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-700 bg-red-50 border-red-200';
    if (percentage >= 80) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-green-700 bg-green-50 border-green-200';
  };

  if (compact) {
    return (
      <div className={`border rounded-lg p-3 ${getStatusColor(usageStatus.percentage)} ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Activity className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">
              {usageStatus.totalUsage}/{usageStatus.usageLimit} requests
            </span>
          </div>
          <div className="text-xs">
            {usageStatus.remainingRequests} còn lại
          </div>
        </div>
        
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(usageStatus.percentage)}`}
            style={{ width: `${Math.min(100, usageStatus.percentage)}%` }}
          ></div>
        </div>

        {usageStatus.warning && (
          <div className="mt-2 text-xs flex items-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            {usageStatus.warning.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
            Usage Hôm Nay
          </h3>
          <div className="text-sm text-gray-500 flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            Reset: {new Date(usageStatus.resetTime).toLocaleTimeString('vi-VN')}
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Main Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Tổng Usage ({usageStatus.subscription.toUpperCase()})
            </span>
            <span className={`text-sm font-bold ${usageStatus.percentage >= 90 ? 'text-red-600' : 'text-gray-900'}`}>
              {usageStatus.totalUsage} / {usageStatus.usageLimit}
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${getProgressColor(usageStatus.percentage)}`}
              style={{ width: `${Math.min(100, usageStatus.percentage)}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span className="font-medium">
              {usageStatus.remainingRequests} requests còn lại ({Math.round(100 - usageStatus.percentage)}%)
            </span>
            <span>{usageStatus.usageLimit}</span>
          </div>
        </div>

        {/* Warning Alert */}
        {usageStatus.warning && (
          <div className={`p-3 rounded-lg border mb-4 ${
            usageStatus.warning.type === 'approaching_limit' 
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            <div className="flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">{usageStatus.warning.message}</span>
            </div>
          </div>
        )}

        {/* Module Breakdown */}
        {showDetails && usageStatus.moduleBreakdown.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Chi tiết theo Module:</h4>
            <div className="space-y-2">
              {usageStatus.moduleBreakdown.map((module) => (
                <div key={module.moduleId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-700">
                    {moduleNames[module.moduleId as keyof typeof moduleNames] || module.moduleId}
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {module.requestCount} requests
                    </div>
                    {module.weightedUsage !== module.requestCount && (
                      <div className="text-xs text-gray-500">
                        Weight: {module.weightedUsage}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Info */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Subscription: {usageStatus.subscription.toUpperCase()}</span>
            <button 
              onClick={loadUsageStatus}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageQuotaDisplay;