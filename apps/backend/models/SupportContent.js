const mongoose = require('mongoose');

const SupportContentSchema = new mongoose.Schema({
  // General Settings
  supportTitle: {
    type: String,
    default: '📞 Trung Tâm Hỗ Trợ & Liên Hệ'
  },
  supportDescription: {
    type: String,
    default: 'Nếu bạn cần hỗ trợ, giải đáp thắc mắc hoặc có bất kỳ yêu cầu nào liên quan đến Tool Viết Truyện AI Story - ALL IN ONE'
  },
  
  // Contact Information
  contactInfo: {
    primaryContact: {
      type: String,
      default: 'Zalo'
    },
    contactValue: {
      type: String,
      default: '0339933882'
    },
    contactName: {
      type: String,
      default: 'Đức Đại MMO'
    },
    secondaryContacts: [{
      type: {
        type: String, // 'email', 'telegram', 'facebook', 'phone'
        required: true
      },
      label: {
        type: String,
        required: true
      },
      value: {
        type: String,
        required: true
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }]
  },
  
  // FAQ Section
  faqSection: {
    isEnabled: {
      type: Boolean,
      default: true
    },
    title: {
      type: String,
      default: '❓ Câu Hỏi Thường Gặp'
    },
    faqs: [{
      question: {
        type: String,
        required: true
      },
      answer: {
        type: String,
        required: true
      },
      category: {
        type: String,
        enum: ['general', 'technical', 'billing', 'features', 'troubleshooting'],
        default: 'general'
      },
      priority: {
        type: Number,
        default: 0 // Higher number = higher priority
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }]
  },
  
  // Guidelines for contacting support
  contactGuidelines: {
    isEnabled: {
      type: Boolean,
      default: true
    },
    title: {
      type: String,
      default: 'Lưu ý khi liên hệ:'
    },
    guidelines: [{
      text: {
        type: String,
        required: true
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }]
  },
  
  // Support Hours
  supportHours: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    timezone: {
      type: String,
      default: 'Asia/Ho_Chi_Minh'
    },
    schedule: [{
      dayOfWeek: {
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        required: true
      },
      startTime: {
        type: String, // Format: "09:00"
        required: true
      },
      endTime: {
        type: String, // Format: "18:00"
        required: true
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }]
  },
  
  // Quick Links Section
  quickLinks: {
    isEnabled: {
      type: Boolean,
      default: true
    },
    title: {
      type: String,
      default: '🔗 Liên Kết Hữu Ích'
    },
    links: [{
      title: {
        type: String,
        required: true
      },
      url: {
        type: String,
        required: true
      },
      description: {
        type: String
      },
      icon: {
        type: String, // Emoji or CSS class
        default: '🔗'
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }]
  },
  
  // Announcement/Notice Section
  announcement: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      enum: ['info', 'warning', 'success', 'error'],
      default: 'info'
    },
    title: {
      type: String
    },
    message: {
      type: String
    },
    expiresAt: {
      type: Date // Auto-hide after this date
    }
  },
  
  // Styling Options
  styling: {
    primaryColor: {
      type: String,
      default: '#3B82F6' // Blue
    },
    accentColor: {
      type: String,
      default: '#10B981' // Teal
    },
    backgroundColor: {
      type: String,
      default: '#FFFFFF'
    }
  },
  
  // Meta Information
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdatedBy: {
    type: String, // Admin username who last updated
    default: 'system'
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
SupportContentSchema.index({ isActive: 1 });
SupportContentSchema.index({ 'faqSection.faqs.category': 1 });
SupportContentSchema.index({ 'faqSection.faqs.priority': -1 });

// Method to get active FAQs sorted by priority
SupportContentSchema.methods.getActiveFAQs = function(category = null) {
  let faqs = this.faqSection.faqs.filter(faq => faq.isActive);
  
  if (category) {
    faqs = faqs.filter(faq => faq.category === category);
  }
  
  return faqs.sort((a, b) => b.priority - a.priority);
};

// Method to get active contact methods
SupportContentSchema.methods.getActiveContacts = function() {
  return this.contactInfo.secondaryContacts.filter(contact => contact.isActive);
};

// Method to get active quick links
SupportContentSchema.methods.getActiveQuickLinks = function() {
  return this.quickLinks.links.filter(link => link.isActive);
};

// Static method to get or create default support content
SupportContentSchema.statics.getDefault = async function() {
  let supportContent = await this.findOne({ isActive: true });
  
  if (!supportContent) {
    // Create default support content
    supportContent = new this({
      // Default FAQ entries
      faqSection: {
        faqs: [
          {
            question: 'Làm thế nào để sử dụng các tính năng AI trong tool?',
            answer: 'Tool AI Story cung cấp nhiều module khác nhau như viết truyện, tóm tắt nội dung, tạo ảnh, text-to-speech. Bạn cần cài đặt API key trong phần Settings trước khi sử dụng.',
            category: 'features',
            priority: 10
          },
          {
            question: 'Tôi gặp lỗi khi tạo nội dung, phải làm sao?',
            answer: 'Hãy kiểm tra: 1) API key còn credits không, 2) Kết nối internet ổn định không, 3) Thử refresh trang và thực hiện lại. Nếu vẫn lỗi, liên hệ support.',
            category: 'troubleshooting',
            priority: 9
          },
          {
            question: 'Tool có hỗ trợ tiếng Việt không?',
            answer: 'Có, tool được thiết kế đặc biệt cho người Việt với giao diện và tính năng hoàn toàn tiếng Việt. Bạn có thể tạo nội dung bằng nhiều ngôn ngữ khác nhau.',
            category: 'general',
            priority: 8
          },
          {
            question: 'Làm thế nào để nâng cấp tài khoản?',
            answer: 'Truy cập trang Pricing để xem các gói subscription. Liên hệ support để được hỗ trợ thanh toán và kích hoạt gói premium.',
            category: 'billing',
            priority: 7
          }
        ]
      },
      
      // Default contact guidelines
      contactGuidelines: {
        guidelines: [
          { text: 'Vui lòng cung cấp thông tin chi tiết về vấn đề bạn gặp phải.' },
          { text: 'Nếu có thể, hãy kèm theo ảnh chụp màn hình hoặc video mô tả lỗi.' },
          { text: 'Thời gian phản hồi có thể từ vài phút đến vài giờ tùy thuộc vào số lượng yêu cầu.' }
        ]
      },
      
      // Default quick links
      quickLinks: {
        links: [
          {
            title: 'Hướng dẫn sử dụng',
            url: '/tutorials',
            description: 'Xem video hướng dẫn chi tiết các tính năng',
            icon: '📚'
          },
          {
            title: 'Cài đặt API Keys',
            url: '/settings',
            description: 'Hướng dẫn cấu hình API keys cho các dịch vụ AI',
            icon: '🔑'
          },
          {
            title: 'Bảng giá dịch vụ',
            url: '/pricing',
            description: 'Xem thông tin các gói subscription',
            icon: '💰'
          }
        ]
      }
    });
    
    await supportContent.save();
  }
  
  return supportContent;
};

module.exports = mongoose.model('SupportContent', SupportContentSchema);