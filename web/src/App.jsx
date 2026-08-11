import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Jobs from './components/Jobs';
import JobDetail from './components/JobDetail';
import Users from './components/Users';
import PrivateRoute from './components/PrivateRoute';
import { getUserRole } from './utils/auth';
import FormEditUser from './components/EditUser';

import Profile from './components/Profile';
import Settings from './components/Settings';
import ApiDocs from './components/ApiDocs';
import './App.css';

const AdminRoute = ({ children }) => {
  const isAdmin = getUserRole() === 'admin';
  return isAdmin ? children : <Navigate to="/jobs" />;
};

const App = () => {
  const isAuthenticated = () => {
    return !!localStorage.getItem('access_token');
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/" 
          element={
            isAuthenticated() ? 
            <Navigate to="/jobs" /> : 
            <Navigate to="/login" />
          } 
        />
        
        <Route
          path="/jobs"
          element={
            <PrivateRoute>
              <Jobs />
            </PrivateRoute>
          }
        />

        <Route
          path="/jobs/:jobId"
          element={
            <PrivateRoute>
              <JobDetail />
            </PrivateRoute>
          }
        />
        
        <Route
          path="/users"
          element={
            <AdminRoute>
              <Users />
            </AdminRoute>
          }
        />

        <Route
          path="/users/:username"
          element={
              <FormEditUser />
          }
        />

        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          }
        />

        <Route
          path="/api-docs"
          element={
            <PrivateRoute>
              <ApiDocs />
            </PrivateRoute>
          }
        />
      </Routes>

    </Router>
  );
};

export default App;
