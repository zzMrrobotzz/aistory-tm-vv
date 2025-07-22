
import React from 'react';
import ModuleContainer from '../ModuleContainer';
import InfoBox from '../InfoBox';
import { UserProfile } from '../../types';

interface SupportModuleProps {
    currentUser: UserProfile | null;
}

const SupportModule: React.FC<SupportModuleProps> = ({ currentUser }) => {
  return (
    <ModuleContainer title="📞 Trung Tâm Hỗ Trợ & Liên Hệ">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="text-gray-700 text-base leading-relaxed mb-4">
          Nếu bạn cần hỗ trợ, giải đáp thắc mắc hoặc có bất kỳ yêu cầu nào liên quan đến 
          <strong> Tool Viết Truyện AI Story - ALL IN ONE</strong>, 
          vui lòng liên hệ với chúng tôi qua Zalo:
        </p>
        
        <div className="bg-gradient-to-r from-blue-500 to-teal-500 text-white p-6 rounded-lg shadow-lg text-center my-6">
          <p className="text-lg font-medium mb-1">Liên hệ Zalo:</p>
          <p className="text-3xl font-bold tracking-wider">0339933882</p>
          <p className="text-xl font-medium mt-1">(Đức Đại MMO)</p>
        </div>
        
        <InfoBox variant="info">
          <p className="font-semibold mb-1">Lưu ý khi liên hệ:</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>Vui lòng cung cấp thông tin chi tiết về vấn đề bạn gặp phải.</li>
            <li>Nếu có thể, hãy kèm theo ảnh chụp màn hình hoặc video mô tả lỗi.</li>
            <li>Thời gian phản hồi có thể từ vài phút đến vài giờ tùy thuộc vào số lượng yêu cầu.</li>
          </ul>
        </InfoBox>

        <p className="text-gray-700 text-base leading-relaxed mt-4">
          Chúng tôi luôn sẵn sàng lắng nghe và hỗ trợ bạn để có trải nghiệm tốt nhất với công cụ!
        </p>
      </div>
    </ModuleContainer>
  );
};

export default SupportModule;
