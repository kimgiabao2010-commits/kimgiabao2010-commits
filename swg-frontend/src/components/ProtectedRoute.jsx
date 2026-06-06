/**
 * ProtectedRoute.jsx — Route Guard cho Admin Dashboard
 * ====================================================
 * Nếu user chưa đăng nhập (isAuthenticated = false),
 * tự động redirect về /login — không render Dashboard.
 *
 * Dùng trong App.jsx:
 *   <ProtectedRoute>
 *     <Dashboard />
 *   </ProtectedRoute>
 */

import React from 'react';
import useAuthStore from '../store/authStore';
import Login from '../pages/Login';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Nếu chưa xác thực → hiển thị Login thay vì redirect URL
  // (vì app dùng state routing, không phải React Router)
  if (!isAuthenticated) {
    return <Login />;
  }

  return children;
};

export default ProtectedRoute;
