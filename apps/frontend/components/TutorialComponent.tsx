import React, { useState, useEffect } from 'react';
import { PlayCircle, Eye, Clock, Tag, Search, Filter, BookOpen, Video, Star } from 'lucide-react';

interface Tutorial {
  _id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  category: string;
  tags: string[];
  orderIndex: number;
  thumbnail: string;
  duration: string;
  viewCount: number;
  createdAt: string;
}

interface TutorialCategory {
  key: string;
  name: string;
  count: number;
  totalViews: number;
}

const TutorialComponent: React.FC = () => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [categories, setCategories] = useState<TutorialCategory[]>([]);
  const [popularTutorials, setPopularTutorials] = useState<Tutorial[]>([]);
  const [recentTutorials, setRecentTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'popular' | 'recent'>('all');

  const fetchTutorials = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category: selectedCategory,
        limit: '20'
      });

      const response = await fetch(`https://aistory-backend.onrender.com/api/tutorials?${params}`);
      const data = await response.json();

      if (data.success) {
        setTutorials(data.tutorials);
      }
    } catch (error) {
      console.error('Error fetching tutorials:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('https://aistory-backend.onrender.com/api/tutorials/categories');
      const data = await response.json();

      if (data.success) {
        setCategories([
          { key: 'all', name: 'Tất Cả', count: data.categories.reduce((sum: number, cat: any) => sum + cat.count, 0), totalViews: 0 },
          ...data.categories
        ]);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchPopularTutorials = async () => {
    try {
      const response = await fetch('https://aistory-backend.onrender.com/api/tutorials/popular/top?limit=5');
      const data = await response.json();

      if (data.success) {
        setPopularTutorials(data.tutorials);
      }
    } catch (error) {
      console.error('Error fetching popular tutorials:', error);
    }
  };

  const fetchRecentTutorials = async () => {
    try {
      const response = await fetch('https://aistory-backend.onrender.com/api/tutorials/recent/latest?limit=5');
      const data = await response.json();

      if (data.success) {
        setRecentTutorials(data.tutorials);
      }
    } catch (error) {
      console.error('Error fetching recent tutorials:', error);
    }
  };

  const searchTutorials = async (query: string) => {
    if (!query.trim()) {
      fetchTutorials();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`https://aistory-backend.onrender.com/api/tutorials/search/${encodeURIComponent(query)}?limit=20`);
      const data = await response.json();

      if (data.success) {
        setTutorials(data.tutorials);
      }
    } catch (error) {
      console.error('Error searching tutorials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTutorialClick = async (tutorial: Tutorial) => {
    setSelectedTutorial(tutorial);
    
    // Increment view count
    try {
      await fetch(`https://aistory-backend.onrender.com/api/tutorials/${tutorial._id}`);
    } catch (error) {
      console.error('Error incrementing view count:', error);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchPopularTutorials();
    fetchRecentTutorials();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const debounceTimer = setTimeout(() => {
        searchTutorials(searchQuery);
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      fetchTutorials();
    }
  }, [selectedCategory, searchQuery]);

  const getCurrentTutorials = () => {
    switch (activeTab) {
      case 'popular':
        return popularTutorials;
      case 'recent':
        return recentTutorials;
      default:
        return tutorials;
    }
  };

  const TutorialCard: React.FC<{ tutorial: Tutorial }> = ({ tutorial }) => (
    <div 
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer overflow-hidden group"
      onClick={() => handleTutorialClick(tutorial)}
    >
      <div className="relative">
        <img
          src={tutorial.thumbnail}
          alt={tutorial.title}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-200"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder-video.jpg';
          }}
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
          <PlayCircle className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </div>
        {tutorial.duration && (
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
            {tutorial.duration}
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2 text-gray-800">
          {tutorial.title}
        </h3>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {tutorial.description}
        </p>
        
        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
          <div className="flex items-center">
            <Eye className="w-4 h-4 mr-1" />
            {tutorial.viewCount.toLocaleString()} lượt xem
          </div>
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            {new Date(tutorial.createdAt).toLocaleDateString('vi-VN')}
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {tutorial.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700"
            >
              <Tag className="w-3 h-3 mr-1" />
              {tag}
            </span>
          ))}
          {tutorial.tags.length > 3 && (
            <span className="text-xs text-gray-500">+{tutorial.tags.length - 3}</span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <BookOpen className="w-8 h-8 mr-3 text-blue-600" />
                Hướng Dẫn Sử Dụng
              </h1>
              <p className="text-gray-600 mt-2">
                Tìm hiểu cách sử dụng các tính năng của AI Story Creator
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Video className="w-6 h-6 text-blue-600" />
              <span className="text-sm text-gray-500">
                {tutorials.length} video hướng dẫn
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-1/4">
            {/* Search */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Tìm kiếm tutorial..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                <Filter className="w-4 h-4 mr-2" />
                Danh Mục
              </h3>
              <div className="space-y-2">
                {categories.map((category) => (
                  <button
                    key={category.key}
                    onClick={() => setSelectedCategory(category.key)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedCategory === category.key
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{category.name}</span>
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                        {category.count}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Popular Tutorials */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                <Star className="w-4 h-4 mr-2 text-yellow-500" />
                Phổ Biến
              </h3>
              <div className="space-y-3">
                {popularTutorials.slice(0, 3).map((tutorial) => (
                  <div 
                    key={tutorial._id}
                    className="flex cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                    onClick={() => handleTutorialClick(tutorial)}
                  >
                    <img
                      src={tutorial.thumbnail}
                      alt={tutorial.title}
                      className="w-16 h-12 object-cover rounded flex-shrink-0"
                    />
                    <div className="ml-3 flex-1">
                      <h4 className="text-sm font-medium text-gray-800 line-clamp-2">
                        {tutorial.title}
                      </h4>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <Eye className="w-3 h-3 mr-1" />
                        {tutorial.viewCount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:w-3/4">
            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex space-x-1">
                {[
                  { key: 'all', label: 'Tất Cả', icon: BookOpen },
                  { key: 'popular', label: 'Phổ Biến', icon: Star },
                  { key: 'recent', label: 'Mới Nhất', icon: Clock }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                      activeTab === tab.key
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <tab.icon className="w-4 h-4 mr-2" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tutorial Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
                    <div className="h-48 bg-gray-300"></div>
                    <div className="p-4">
                      <div className="h-4 bg-gray-300 rounded mb-2"></div>
                      <div className="h-3 bg-gray-300 rounded mb-3"></div>
                      <div className="flex justify-between">
                        <div className="h-3 bg-gray-300 rounded w-16"></div>
                        <div className="h-3 bg-gray-300 rounded w-20"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : getCurrentTutorials().length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {getCurrentTutorials().map((tutorial) => (
                  <TutorialCard key={tutorial._id} tutorial={tutorial} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Không tìm thấy tutorial nào
                </h3>
                <p className="text-gray-500">
                  {searchQuery 
                    ? `Không có kết quả cho "${searchQuery}"`
                    : 'Chưa có tutorial nào trong danh mục này'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {selectedTutorial && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">{selectedTutorial.title}</h2>
              <button
                onClick={() => setSelectedTutorial(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <div className="aspect-video mb-4">
                <iframe
                  src={`https://www.youtube.com/embed/${selectedTutorial.youtubeVideoId}?autoplay=1`}
                  title={selectedTutorial.title}
                  className="w-full h-full rounded-lg"
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                />
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Mô tả</h3>
                  <p className="text-gray-700">{selectedTutorial.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedTutorial.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t">
                  <div className="flex items-center">
                    <Eye className="w-4 h-4 mr-1" />
                    {(selectedTutorial.viewCount + 1).toLocaleString()} lượt xem
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {new Date(selectedTutorial.createdAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorialComponent;
