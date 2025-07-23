import React, { useState, useEffect } from 'react';
import { History, Trash2, Clock, Copy } from 'lucide-react';
import { HistoryStorage, HistoryItem } from '../utils/historyStorage';

interface HistoryPanelProps {
  moduleKey: string;
  onSelectHistory: (content: string) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ moduleKey, onSelectHistory }) => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [moduleKey]);

  const loadHistory = () => {
    const items = HistoryStorage.getHistory(moduleKey);
    setHistoryItems(items);
  };

  const handleDeleteItem = (itemId: string) => {
    HistoryStorage.deleteHistoryItem(moduleKey, itemId);
    loadHistory();
  };

  const handleClearAll = () => {
    if (confirm('Bạn có chắc muốn xóa tất cả lịch sử?')) {
      HistoryStorage.clearHistory(moduleKey);
      loadHistory();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  };

  if (historyItems.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer border-b hover:bg-gray-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-blue-600" />
          <span className="font-medium text-gray-700">Lịch sử gần đây</span>
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
            {historyItems.length}
          </span>
        </div>
        <div className="text-gray-400">
          {isOpen ? '−' : '+'}
        </div>
      </div>

      {isOpen && (
        <div className="p-3">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-500">5 bài viết gần nhất</span>
            {historyItems.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-red-600 hover:text-red-800 flex items-center space-x-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Xóa tất cả</span>
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {historyItems.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-gray-900 mb-1 truncate">
                      {item.title}
                    </h4>
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {truncateContent(item.content)}
                    </p>
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDate(item.createdAt)}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      onClick={() => onSelectHistory(item.content)}
                      className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                      title="Sử dụng lại"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                      title="Xóa"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;