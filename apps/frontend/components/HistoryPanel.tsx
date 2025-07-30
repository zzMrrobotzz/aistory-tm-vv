import React, { useState, useEffect } from 'react';
import { History, Trash2, Clock, Copy, Eye, Download } from 'lucide-react';
import { HistoryStorage, HistoryItem } from '../utils/historyStorage';
import { downloadUtils } from '../utils/downloadUtils';
import ArticleDetailModal from './ArticleDetailModal';

interface HistoryPanelProps {
  moduleKey: string;
  onSelectHistory: (content: string) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ moduleKey, onSelectHistory }) => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<HistoryItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [moduleKey]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setDropdownOpen(null);
    };

    if (dropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [dropdownOpen]);

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

  const handleViewArticle = (item: HistoryItem) => {
    setSelectedArticle(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedArticle(null);
  };

  const handleQuickDownload = (item: HistoryItem, format: 'txt' | 'word' | 'html') => {
    switch (format) {
      case 'txt':
        downloadUtils.downloadAsText({
          title: item.title,
          content: item.content,
          createdAt: item.createdAt,
          format: 'txt'
        });
        break;
      case 'word':
        downloadUtils.downloadAsWord({
          title: item.title,
          content: item.content,
          createdAt: item.createdAt,
          format: 'word'
        });
        break;
      case 'html':
        downloadUtils.downloadAsHtml({
          title: item.title,
          content: item.content,
          createdAt: item.createdAt,
          format: 'html'
        });
        break;
    }
    setDropdownOpen(null);
  };

  const handleCopyContent = async (content: string) => {
    const success = await downloadUtils.copyToClipboard(content);
    if (success) {
      alert('Đã sao chép nội dung!');
    } else {
      alert('Không thể sao chép. Vui lòng thử lại!');
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
                    
                    {/* Display quality stats if available */}
                    {item.metadata?.storyQualityStats && (
                      <div className="mb-2 p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded border border-purple-100">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-purple-700">🎯 Chất lượng:</span>
                          <span className="font-bold text-indigo-700">{item.metadata.storyQualityStats.overallQualityScore}%</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 mt-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Nhất quán:</span>
                            <span className="font-semibold text-purple-600">{item.metadata.storyQualityStats.consistencyScore}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Hoàn thiện:</span>
                            <span className="font-semibold text-pink-600">{item.metadata.storyQualityStats.completenessScore}%</span>
                          </div>
                        </div>
                        {/* Mini progress bar for overall quality */}
                        <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                          <div 
                            className="bg-indigo-600 h-1 rounded-full transition-all duration-300" 
                            style={{ width: `${item.metadata.storyQualityStats.overallQualityScore}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    
                    {/* Display word stats if available */}
                    {item.metadata?.wordStats && (
                      <div className="mb-2 p-2 bg-blue-50 rounded border border-blue-100">
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Từ gốc:</span>
                            <span className="font-semibold">{item.metadata.wordStats.originalWords.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">% thay đổi:</span>
                            <span className="font-semibold text-orange-600">{item.metadata.wordStats.changePercentage}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDate(item.createdAt)}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      onClick={() => onSelectHistory(item.content)}
                      className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                      title="Chọn làm nội dung"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleViewArticle(item)}
                      className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded"
                      title="Xem chi tiết & tải về"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleCopyContent(item.content)}
                      className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                      title="Sao chép nội dung"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    
                    {/* Quick Download Dropdown */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDropdownOpen(dropdownOpen === item.id ? null : item.id);
                        }}
                        className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded"
                        title="Tải về nhanh"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      
                      {dropdownOpen === item.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[120px]">
                          <button
                            onClick={() => handleQuickDownload(item, 'txt')}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <Download className="w-3 h-3 text-green-600" />
                            <span>TXT</span>
                          </button>
                          <button
                            onClick={() => handleQuickDownload(item, 'word')}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <Download className="w-3 h-3 text-blue-600" />
                            <span>Word</span>
                          </button>
                          <button
                            onClick={() => handleQuickDownload(item, 'html')}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center space-x-2 border-t"
                          >
                            <Download className="w-3 h-3 text-orange-600" />
                            <span>HTML</span>
                          </button>
                        </div>
                      )}
                    </div>
                    
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

      {/* Article Detail Modal */}
      <ArticleDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        article={selectedArticle}
      />
    </div>
  );
};

export default HistoryPanel;