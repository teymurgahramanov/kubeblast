import React from "react";
import { Navigate } from "react-router-dom";

const PrivateRoute = ({ children, requiredRole }) => {
  const accessToken = sessionStorage.getItem("access_token");
  const userRole = sessionStorage.getItem("user_role"); // Store role in sessionStorage after login

  if (!accessToken) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/jobs" replace />;
  }

  return children;
};

export default PrivateRoute;