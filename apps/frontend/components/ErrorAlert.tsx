
import React from 'react';

interface ErrorAlertProps {
  message: string;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md my-4" role="alert">
      <p className="font-bold">Lỗi</p>
      <p className="whitespace-pre-wrap">{message}</p>
    </div>
  );
};

export default ErrorAlert;