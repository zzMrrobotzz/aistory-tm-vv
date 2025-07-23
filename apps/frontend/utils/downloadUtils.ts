// Download utilities for articles and content
export interface DownloadOptions {
  title: string;
  content: string;
  createdAt: string;
  format: 'txt' | 'word' | 'html' | 'pdf';
}

export const downloadUtils = {
  // Download as plain text file
  downloadAsText: (options: DownloadOptions) => {
    const { title, content, createdAt } = options;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const dateStr = new Date(createdAt).toLocaleDateString('vi-VN').replace(/\//g, '-');
    const filename = `${title.replace(/[^a-zA-Z0-9\s]/g, '').trim()}_${dateStr}.txt`;
    
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // Download as Word document (HTML format)
  downloadAsWord: (options: DownloadOptions) => {
    const { title, content, createdAt } = options;
    
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

    // Create a structured HTML document for Word
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { 
            font-family: 'Times New Roman', serif; 
            line-height: 1.6; 
            margin: 40px; 
            color: #333;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .title { 
            font-size: 24px; 
            font-weight: bold; 
            margin-bottom: 10px; 
            color: #1a1a1a;
          }
          .date { 
            font-size: 14px; 
            color: #666; 
            font-style: italic;
          }
          .content { 
            font-size: 16px; 
            text-align: justify; 
            line-height: 1.8;
          }
          p { 
            margin-bottom: 15px; 
            text-indent: 20px;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #888;
            border-top: 1px solid #ccc;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${title}</div>
          <div class="date">Tạo ngày: ${formatDate(createdAt)}</div>
        </div>
        <div class="content">
          ${content.split('\n').map(paragraph => 
            paragraph.trim() ? `<p>${paragraph.trim()}</p>` : '<br>'
          ).join('')}
        </div>
        <div class="footer">
          Tạo bởi AI Story Tool - All In One
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const dateStr = new Date(createdAt).toLocaleDateString('vi-VN').replace(/\//g, '-');
    const filename = `${title.replace(/[^a-zA-Z0-9\s]/g, '').trim()}_${dateStr}.doc`;
    
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // Download as HTML file
  downloadAsHtml: (options: DownloadOptions) => {
    const { title, content, createdAt } = options;
    
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

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6; 
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
            background-color: #f9f9f9;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 3px solid #007acc;
            padding-bottom: 20px;
          }
          .title { 
            font-size: 28px; 
            font-weight: bold; 
            margin-bottom: 10px; 
            color: #1a1a1a;
          }
          .date { 
            font-size: 14px; 
            color: #666; 
            background: #f0f8ff;
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
          }
          .content { 
            font-size: 16px; 
            text-align: justify; 
            line-height: 1.8;
          }
          p { 
            margin-bottom: 15px; 
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #888;
            border-top: 1px solid #eee;
            padding-top: 20px;
          }
          @media print {
            body { background: white; }
            .container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="title">${title}</div>
            <div class="date">Tạo ngày: ${formatDate(createdAt)}</div>
          </div>
          <div class="content">
            ${content.split('\n').map(paragraph => 
              paragraph.trim() ? `<p>${paragraph.trim()}</p>` : '<br>'
            ).join('')}
          </div>
          <div class="footer">
            Tạo bởi AI Story Tool - All In One<br>
            <small>Xuất file lúc: ${new Date().toLocaleString('vi-VN')}</small>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const dateStr = new Date(createdAt).toLocaleDateString('vi-VN').replace(/\//g, '-');
    const filename = `${title.replace(/[^a-zA-Z0-9\s]/g, '').trim()}_${dateStr}.html`;
    
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // Copy content to clipboard
  copyToClipboard: async (content: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    }
  },

  // Get content statistics
  getContentStats: (content: string) => {
    const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
    const characterCount = content.length;
    const characterCountNoSpaces = content.replace(/\s/g, '').length;
    const paragraphCount = content.split('\n').filter(p => p.trim().length > 0).length;
    const averageWordsPerParagraph = paragraphCount > 0 ? Math.round(wordCount / paragraphCount) : 0;

    return {
      wordCount,
      characterCount,
      characterCountNoSpaces,
      paragraphCount,
      averageWordsPerParagraph,
      estimatedReadingTime: Math.ceil(wordCount / 250) // Average reading speed: 250 words per minute
    };
  }
};

export default downloadUtils;