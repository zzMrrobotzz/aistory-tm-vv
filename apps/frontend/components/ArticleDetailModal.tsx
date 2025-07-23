import React from 'react';
import { X, Download, Copy, FileText, Calendar, Globe } from 'lucide-react';
import { HistoryItem } from '../utils/historyStorage';
import { downloadUtils } from '../utils/downloadUtils';

interface ArticleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: HistoryItem | null;
}

const ArticleDetailModal: React.FC<ArticleDetailModalProps> = ({ isOpen, onClose, article }) => {
  if (!isOpen || !article) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copyToClipboard = async () => {
    if (!article.content) return;
    const success = await downloadUtils.copyToClipboard(article.content);
    if (success) {
      alert('Đã sao chép bài viết!');
    } else {
      alert('Không thể sao chép. Vui lòng thử lại!');
    }
  };

  const downloadAsText = () => {
    if (!article.content) return;
    downloadUtils.downloadAsText({
      title: article.title,
      content: article.content,
      createdAt: article.createdAt,
      format: 'txt'
    });
  };

  const downloadAsWord = () => {
    if (!article.content) return;
    downloadUtils.downloadAsWord({
      title: article.title,
      content: article.content,
      createdAt: article.createdAt,
      format: 'word'
    });
  };

  const downloadAsHtml = () => {
    if (!article.content) return;
    downloadUtils.downloadAsHtml({
      title: article.title,
      content: article.content,
      createdAt: article.createdAt,
      format: 'html'
    });
  };

  const contentStats = article ? downloadUtils.getContentStats(article.content) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 line-clamp-1">
                {article.title}
              </h2>
              <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(article.createdAt)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Stats */}
          <div className="px-6 py-3 bg-gray-50 border-b">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm text-gray-600">
              <span className="flex items-center space-x-1">
                <span className="font-medium">Số từ:</span>
                <span className="text-blue-600 font-semibold">{contentStats?.wordCount || 0}</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="font-medium">Ký tự:</span>
                <span className="text-green-600 font-semibold">{contentStats?.characterCount || 0}</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="font-medium">Đoạn văn:</span>
                <span className="text-orange-600 font-semibold">{contentStats?.paragraphCount || 0}</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="font-medium">Đọc:</span>
                <span className="text-red-600 font-semibold">{contentStats?.estimatedReadingTime || 0} phút</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="font-medium">Module:</span>
                <span className="text-purple-600 font-semibold capitalize">{article.module.replace('_', ' ')}</span>
              </span>
            </div>
          </div>

          {/* Article Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap text-gray-800 leading-relaxed text-justify">
                {article.content}
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Actions */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            Bài viết được tạo bởi AI Story Tool
          </div>
          
          <div className="flex items-center space-x-3 flex-wrap">
            <button
              onClick={copyToClipboard}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span>Sao chép</span>
            </button>
            
            <button
              onClick={downloadAsText}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>TXT</span>
            </button>
            
            <button
              onClick={downloadAsWord}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Word</span>
            </button>

            <button
              onClick={downloadAsHtml}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span>HTML</span>
            </button>
            
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArticleDetailModal;