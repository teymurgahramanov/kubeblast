import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Jobs from './components/Jobs';
import Users from './components/Users';
import PrivateRoute from './components/PrivateRoute';
import AddUser from './components/AddUser';
import FormEditUser from './components/EditUser';
import AddJobForm from './components/AddJob';
import Profile from './components/Profile';
import './App.css';

const AdminRoute = ({ children }) => {
  const isAdmin = sessionStorage.getItem('user_role') === 'admin';
  return isAdmin ? children : <Navigate to="/jobs" />;
};

const App = () => {
  const [addUser, setAddUser] = useState(false);
  const [addJob, setAddJob] = useState(false);

  const isAuthenticated = () => {
    return !!sessionStorage.getItem('access_token');
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
        
        {/* Jobs route with conditional rendering for adding and listing */}
        <Route
          path="/jobs"
          element={
            <PrivateRoute>
              <Jobs />
            </PrivateRoute>
          }
        />
        
        {/* Users route */}
        <Route
          path="/users"
          element={
            <AdminRoute>
              <Users setAddUser={setAddUser} />
            </AdminRoute>
          }
        />

        {/* Edit user route */}
        <Route
          path="/users/:username"
          element={
              <FormEditUser />
          }
        />

        {/* Profile route */}
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />
      </Routes>

      {/* Add User Modal */}
      {addUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              width: '90%',
              maxWidth: 600,
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '2rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            <AddUser onClose={() => setAddUser(false)} />
          </div>
        </div>
      )}
    </Router>
  );
};

export default App;
