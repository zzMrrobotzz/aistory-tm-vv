import React, { useState } from 'react';
import { Upload, message, Modal, Button, Input, Form, Card, Image, Popconfirm, Space } from 'antd';
import { UploadOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import CustomIcon from './CustomIcon';

interface CustomIconData {
  id: string;
  name: string;
  filename: string;
  url: string;
  uploadedAt: string;
  size: number;
}

interface IconUploaderProps {
  onIconSelect?: (iconData: CustomIconData) => void;
  showManagement?: boolean;
}

const IconUploader: React.FC<IconUploaderProps> = ({ onIconSelect, showManagement = true }) => {
  const [uploadedIcons, setUploadedIcons] = useState<CustomIconData[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  const [previewImage, setPreviewImage] = useState<string>('');
  const [previewVisible, setPreviewVisible] = useState(false);

  // Load existing icons from localStorage on component mount
  React.useEffect(() => {
    const savedIcons = localStorage.getItem('admin_custom_icons');
    if (savedIcons) {
      try {
        setUploadedIcons(JSON.parse(savedIcons));
      } catch (error) {
        console.error('Error loading saved icons:', error);
      }
    }
  }, []);

  // Save icons to localStorage whenever icons change
  const saveIconsToStorage = (icons: CustomIconData[]) => {
    localStorage.setItem('admin_custom_icons', JSON.stringify(icons));
    setUploadedIcons(icons);
  };

  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    
    // Validate file type
    const isValidType = file.type === 'image/svg+xml' || 
                       file.type === 'image/png' || 
                       file.type === 'image/jpeg' ||
                       file.type === 'image/webp';
    
    if (!isValidType) {
      message.error('Chỉ chấp nhận file SVG, PNG, JPG hoặc WebP!');
      onError(new Error('Invalid file type'));
      return;
    }

    // Validate file size (max 1MB)
    const isValidSize = file.size / 1024 / 1024 < 1;
    if (!isValidSize) {
      message.error('Kích thước file không được vượt quá 1MB!');
      onError(new Error('File too large'));
      return;
    }

    setUploading(true);

    try {
      // Convert file to base64 for local storage
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        
        // Get form values
        const { iconName } = form.getFieldsValue();
        
        const newIcon: CustomIconData = {
          id: `icon_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          name: iconName || file.name.replace(/\.[^/.]+$/, ""),
          filename: file.name,
          url: base64,
          uploadedAt: new Date().toISOString(),
          size: file.size
        };

        const updatedIcons = [...uploadedIcons, newIcon];
        saveIconsToStorage(updatedIcons);
        
        message.success(`Icon "${newIcon.name}" đã được upload thành công!`);
        form.resetFields();
        setIsModalVisible(false);
        onSuccess(newIcon);
      };

      reader.onerror = () => {
        message.error('Lỗi khi đọc file!');
        onError(new Error('File read error'));
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      message.error('Upload thất bại!');
      onError(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteIcon = (iconId: string) => {
    const updatedIcons = uploadedIcons.filter(icon => icon.id !== iconId);
    saveIconsToStorage(updatedIcons);
    message.success('Đã xóa icon!');
  };

  const handleIconSelect = (icon: CustomIconData) => {
    if (onIconSelect) {
      onIconSelect(icon);
      message.success(`Đã chọn icon "${icon.name}"`);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="icon-uploader">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">🎨 Quản Lý Icons Tùy Chỉnh</h3>
        <Button 
          type="primary" 
          onClick={() => setIsModalVisible(true)}
          icon={<UploadOutlined />}
        >
          Upload Icon Mới
        </Button>
      </div>

      {/* Icons Grid */}
      {uploadedIcons.length > 0 ? (
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          {uploadedIcons.map((icon) => (
            <Card
              key={icon.id}
              size="small"
              className="text-center hover:shadow-md transition-shadow cursor-pointer"
              actions={showManagement ? [
                <EyeOutlined 
                  key="preview"
                  onClick={() => {
                    setPreviewImage(icon.url);
                    setPreviewVisible(true);
                  }}
                />,
                <Button
                  key="select"
                  type="text"
                  size="small"
                  onClick={() => handleIconSelect(icon)}
                >
                  Chọn
                </Button>,
                <Popconfirm
                  key="delete"
                  title="Xóa icon này?"
                  description="Hành động này không thể hoàn tác."
                  onConfirm={() => handleDeleteIcon(icon.id)}
                  okText="Xóa"
                  cancelText="Hủy"
                >
                  <DeleteOutlined className="text-red-500" />
                </Popconfirm>
              ] : [
                <Button
                  key="select"
                  type="primary"
                  size="small"
                  onClick={() => handleIconSelect(icon)}
                >
                  Chọn
                </Button>
              ]}
            >
              <div className="flex flex-col items-center">
                <CustomIcon 
                  src={icon.url} 
                  alt={icon.name}
                  size={32}
                  className="mb-2"
                />
                <div className="text-xs font-medium truncate w-full" title={icon.name}>
                  {icon.name}
                </div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(icon.size)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-8">
          <div className="text-gray-500">
            <UploadOutlined className="text-4xl mb-2" />
            <p>Chưa có icon nào được upload</p>
            <p className="text-sm">Nhấn "Upload Icon Mới" để bắt đầu</p>
          </div>
        </Card>
      )}

      {/* Upload Modal */}
      <Modal
        title="📤 Upload Icon Mới"
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={() => {
            // Form submission will be handled by the upload component
          }}
        >
          <Form.Item
            label="Tên Icon"
            name="iconName"
            rules={[{ required: true, message: 'Vui lòng nhập tên icon!' }]}
          >
            <Input placeholder="Ví dụ: dashboard-icon, user-menu, etc." />
          </Form.Item>

          <Form.Item
            label="Chọn File"
            required
          >
            <Upload.Dragger
              name="iconFile"
              multiple={false}
              showUploadList={false}
              customRequest={handleUpload}
              accept=".svg,.png,.jpg,.jpeg,.webp"
              disabled={uploading}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">
                Nhấn hoặc kéo thả file vào đây để upload
              </p>
              <p className="ant-upload-hint">
                Hỗ trợ: SVG, PNG, JPG, WebP (tối đa 1MB)
                <br />
                <strong>Khuyến khích sử dụng SVG</strong> cho chất lượng tốt nhất
              </p>
            </Upload.Dragger>
          </Form.Item>

          <div className="text-center">
            <Button 
              type="default" 
              onClick={() => {
                setIsModalVisible(false);
                form.resetFields();
              }}
              className="mr-2"
            >
              Hủy
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Preview Modal */}
      <Modal
        title="Xem Trước Icon"
        open={previewVisible}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
      >
        <div className="text-center py-4">
          <Image
            src={previewImage}
            alt="Icon Preview"
            style={{ maxWidth: '100%', maxHeight: '400px' }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default IconUploader;