import React from "react";
import { Navigate } from "react-router-dom";
import { getAccessToken, getUserRole } from "../utils/auth";

const PrivateRoute = ({ children, requiredRole }) => {
  const accessToken = getAccessToken();
  const userRole = getUserRole();

  if (!accessToken) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/jobs" replace />;
  }

  return children;
};

export default PrivateRoute;