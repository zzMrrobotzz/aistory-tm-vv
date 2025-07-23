
import React from 'react';

const MainHeader: React.FC = () => {
  return (
    <header className="text-white p-8 text-center rounded-t-2xl shadow-lg" style={{background: '#7CFC00'}}>
      <h1 className="text-3xl md:text-4xl font-bold mb-3">
        Tool Viết Truyện AI Story - ALL IN ONE
      </h1>
      <p className="text-lg md:text-xl font-medium mt-2 opacity-90">
        Giải Pháp Viết Truyện Hoàn Hảo Số 1 Việt Nam - Sáng Tạo Bởi Đức Đại MMO
      </p>
      <p className="text-md md:text-lg mt-1 opacity-80">
        Đem Đến Phương Pháp Viết Truyện Hoàn Hảo Theo Ý Của Bạn - Nâng Tầm Trải Nghiệm Cuộc Sống.
      </p>
    </header>
  );
};

export default MainHeader;