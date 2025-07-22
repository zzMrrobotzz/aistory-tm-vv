import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { register } from '../../services/authService';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const { username, email, password } = formData;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const result = await register({ username, email, password });
      console.log('Registration result:', result);
      
      if (result.token) {
        setSuccess(result.msg || 'Đăng ký thành công! Đang chuyển hướng...');
        setTimeout(() => {
          // Force full page reload to update authentication state  
          window.location.replace('/');
        }, 1500);
      } else {
        setError('Đăng ký thất bại - không nhận được token');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="px-8 py-6 mt-4 text-left bg-white shadow-lg rounded-lg">
        <h3 className="text-2xl font-bold text-center">Create an account</h3>
        {error && <div className="mt-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}
        {success && <div className="mt-2 p-3 bg-green-100 border border-green-400 text-green-700 rounded">{success}</div>}
        <form onSubmit={onSubmit}>
          <div className="mt-4">
            <div>
              <label className="block" htmlFor="username">Username</label>
              <input
                type="text"
                placeholder="Username"
                name="username"
                value={username}
                onChange={onChange}
                required
                className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div className="mt-4">
              <label className="block" htmlFor="email">Email</label>
              <input
                type="email"
                placeholder="Email"
                name="email"
                value={email}
                onChange={onChange}
                required
                className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div className="mt-4">
              <label className="block">Password</label>
              <input
                type="password"
                placeholder="Password"
                name="password"
                value={password}
                onChange={onChange}
                required
                minLength={6}
                className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div className="flex items-baseline justify-between">
              <button 
                disabled={loading}
                className={`px-6 py-2 mt-4 text-white rounded-lg w-full ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-900'}`}
              >
                {loading ? 'Đang đăng ký...' : 'Register'}
              </button>
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Đã có tài khoản?{' '}
                <Link to="/login" className="text-blue-600 hover:underline">
                  Đăng nhập ngay
                </Link>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register; 