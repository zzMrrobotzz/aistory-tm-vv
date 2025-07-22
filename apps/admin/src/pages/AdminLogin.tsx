import React, { useState } from 'react';
import { Input, Button, message, Card } from 'antd';

const ADMIN_USER = 'admin';
const ADMIN_PASS = '123456';

const AdminLogin: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    setTimeout(() => {
      if (username === ADMIN_USER && password === ADMIN_PASS) {
        localStorage.setItem('admin_logged_in', '1');
        message.success('Đăng nhập thành công!');
        onLogin();
      } else {
        message.error('Sai tài khoản hoặc mật khẩu!');
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card title="Đăng nhập Admin" style={{ width: 350 }}>
        <Input
          placeholder="Tên đăng nhập"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="mb-3"
        />
        <Input.Password
          placeholder="Mật khẩu"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="mb-3"
        />
        <Button type="primary" block loading={loading} onClick={handleLogin}>
          Đăng nhập
        </Button>
      </Card>
    </div>
  );
};

export default AdminLogin; 