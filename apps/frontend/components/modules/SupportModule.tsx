
import React, { useState, useEffect } from 'react';
import ModuleContainer from '../ModuleContainer';
import InfoBox from '../InfoBox';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import { UserProfile } from '../../types';
import { 
  getSupportContent, 
  getFallbackSupportContent, 
  SupportContent,
  getFAQCategoryColor,
  getFAQCategoryName,
  getAnnouncementTypeColor
} from '../../services/supportService';
import { ExternalLink, ChevronDown, ChevronUp, Phone, Mail, MessageCircle, Clock } from 'lucide-react';

interface SupportModuleProps {
    currentUser: UserProfile | null;
}

const SupportModule: React.FC<SupportModuleProps> = ({ currentUser }) => {
  const [supportContent, setSupportContent] = useState<SupportContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [selectedFAQCategory, setSelectedFAQCategory] = useState<string>('all');

  useEffect(() => {
    fetchSupportContent();
  }, []);

  const fetchSupportContent = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await getSupportContent();
      
      if (response.success && response.data) {
        setSupportContent(response.data);
      } else {
        // Use fallback content if API fails
        console.warn('API failed, using fallback content:', response.error);
        setSupportContent(getFallbackSupportContent());
        setError('Sử dụng nội dung mặc định do không thể kết nối với server');
      }
    } catch (err) {
      console.error('Error loading support content:', err);
      setSupportContent(getFallbackSupportContent());
      setError('Lỗi khi tải nội dung hỗ trợ, hiển thị thông tin cơ bản');
    } finally {
      setLoading(false);
    }
  };

  const getContactIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'email': return <Mail size={18} />;
      case 'phone': return <Phone size={18} />;
      case 'telegram': 
      case 'zalo':
      case 'messenger': return <MessageCircle size={18} />;
      default: return <ExternalLink size={18} />;
    }
  };

  const handleFAQToggle = (faqId: string) => {
    setExpandedFAQ(expandedFAQ === faqId ? null : faqId);
  };

  const getFilteredFAQs = () => {
    if (!supportContent?.faqSection?.faqs) return [];
    
    if (selectedFAQCategory === 'all') {
      return supportContent.faqSection.faqs;
    }
    
    return supportContent.faqSection.faqs.filter(faq => faq.category === selectedFAQCategory);
  };

  const getFAQCategories = () => {
    if (!supportContent?.faqSection?.faqs) return [];
    
    const categories = [...new Set(supportContent.faqSection.faqs.map(faq => faq.category))];
    return categories;
  };

  if (loading) {
    return (
      <ModuleContainer title="📞 Trung Tâm Hỗ Trợ & Liên Hệ">
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner message="Đang tải nội dung hỗ trợ..." />
        </div>
      </ModuleContainer>
    );
  }

  if (!supportContent) {
    return (
      <ModuleContainer title="📞 Trung Tâm Hỗ Trợ & Liên Hệ">
        <ErrorAlert message="Không thể tải nội dung hỗ trợ" />
      </ModuleContainer>
    );
  }

  const primaryColorClass = supportContent.styling?.primaryColor || '#3B82F6';
  const accentColorClass = supportContent.styling?.accentColor || '#10B981';

  return (
    <ModuleContainer title={supportContent.supportTitle}>
      <div className="space-y-6">
        {/* Error notification */}
        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-yellow-600 text-sm">
                ⚠️ {error}
              </div>
            </div>
          </div>
        )}

        {/* Announcement */}
        {supportContent.announcement && (
          <div 
            className="p-4 rounded-lg border-l-4"
            style={{
              backgroundColor: `${getAnnouncementTypeColor(supportContent.announcement.type)}15`,
              borderLeftColor: getAnnouncementTypeColor(supportContent.announcement.type)
            }}
          >
            {supportContent.announcement.title && (
              <h4 className="font-semibold mb-2" style={{ color: getAnnouncementTypeColor(supportContent.announcement.type) }}>
                {supportContent.announcement.title}
              </h4>
            )}
            <p className="text-gray-700">{supportContent.announcement.message}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-gray-700 text-base leading-relaxed mb-6">
            {supportContent.supportDescription}
          </p>
          
          {/* Primary Contact */}
          <div 
            className="text-white p-6 rounded-lg shadow-lg text-center my-6"
            style={{ 
              background: `linear-gradient(135deg, ${primaryColorClass}, ${accentColorClass})` 
            }}
          >
            <p className="text-lg font-medium mb-1">Liên hệ {supportContent.contactInfo.primaryContact}:</p>
            <p className="text-3xl font-bold tracking-wider">{supportContent.contactInfo.contactValue}</p>
            <p className="text-xl font-medium mt-1">({supportContent.contactInfo.contactName})</p>
          </div>

          {/* Secondary Contacts */}
          {supportContent.contactInfo.secondaryContacts && supportContent.contactInfo.secondaryContacts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {supportContent.contactInfo.secondaryContacts.map((contact, index) => (
                <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <div className="mr-3 text-gray-600">
                    {getContactIcon(contact.type)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{contact.label}</p>
                    <p className="text-sm text-gray-600">{contact.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Support Hours */}
          {supportContent.supportHours && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                <Clock size={18} className="mr-2" />
                Giờ hỗ trợ ({supportContent.supportHours.timezone})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {supportContent.supportHours.schedule.map((schedule, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="capitalize">{schedule.dayOfWeek}:</span>
                    <span>{schedule.startTime} - {schedule.endTime}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Contact Guidelines */}
          {supportContent.contactGuidelines && (
            <InfoBox variant="info">
              <p className="font-semibold mb-1">{supportContent.contactGuidelines.title}</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {supportContent.contactGuidelines.guidelines
                  .filter(guideline => guideline.isActive)
                  .map((guideline, index) => (
                  <li key={index}>{guideline.text}</li>
                ))}
              </ul>
            </InfoBox>
          )}
        </div>

        {/* FAQ Section */}
        {supportContent.faqSection && supportContent.faqSection.faqs.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">{supportContent.faqSection.title}</h3>
            
            {/* FAQ Category Filter */}
            {getFAQCategories().length > 1 && (
              <div className="mb-6">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedFAQCategory('all')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedFAQCategory === 'all' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Tất cả
                  </button>
                  {getFAQCategories().map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedFAQCategory(category)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        selectedFAQCategory === category 
                          ? 'text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      style={selectedFAQCategory === category ? { backgroundColor: getFAQCategoryColor(category) } : {}}
                    >
                      {getFAQCategoryName(category)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* FAQ Items */}
            <div className="space-y-3">
              {getFilteredFAQs().map((faq) => (
                <div key={faq._id} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => handleFAQToggle(faq._id)}
                    className="w-full px-4 py-3 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <span 
                        className="inline-block w-2 h-2 rounded-full mr-3"
                        style={{ backgroundColor: getFAQCategoryColor(faq.category) }}
                      ></span>
                      <span className="font-medium text-gray-800">{faq.question}</span>
                    </div>
                    {expandedFAQ === faq._id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                  
                  {expandedFAQ === faq._id && (
                    <div className="px-4 pb-4 text-gray-700 leading-relaxed">
                      <div className="pt-2 border-t border-gray-100">
                        {faq.answer.split('\n').map((line, index) => (
                          <p key={index} className="mb-2 last:mb-0">{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        {supportContent.quickLinks && supportContent.quickLinks.links.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">{supportContent.quickLinks.title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {supportContent.quickLinks.links.map((link) => (
                <a
                  key={link._id}
                  href={link.url}
                  target={link.url.startsWith('http') ? '_blank' : '_self'}
                  rel={link.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                >
                  <span className="text-2xl mr-3">{link.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                      {link.title}
                    </h4>
                    {link.description && (
                      <p className="text-sm text-gray-600 mt-1">{link.description}</p>
                    )}
                  </div>
                  <ExternalLink size={16} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Footer Message */}
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-gray-700 text-base leading-relaxed">
            Chúng tôi luôn sẵn sàng lắng nghe và hỗ trợ bạn để có trải nghiệm tốt nhất với công cụ!
          </p>
        </div>
      </div>
    </ModuleContainer>
  );
};

export default SupportModule;
