
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// import AdminApp from './admin/AdminApp'; // Statically importing this caused the crash

// Lazy load the AdminApp so it doesn't affect the main app's startup
const AdminApp = React.lazy(() => import('./admin/AdminApp'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const path = window.location.pathname;

// Simple routing based on path
if (path.startsWith('/admin')) {
  root.render(
    <React.StrictMode>
      <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center text-xl font-semibold">Đang tải trang Admin...</div>}>
        <AdminApp />
      </Suspense>
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}