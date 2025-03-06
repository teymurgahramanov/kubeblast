import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Jobs from './components/Jobs';
import Users from './components/Users';
import PrivateRoute from './components/PrivateRoute';
import FormAddUser from './components/AddUser';
import FormEditUser from './components/EditUser';
import AddJobForm from './components/AddJob';
import './App.css';
const App = () => {
  const [addUser, setAddUser] = useState(false);
  const [addJob, setAddJob] = useState(false);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Jobs route with conditional rendering for adding and listing */}
        <Route
          path="/jobs"
          element={
            <PrivateRoute>
              {addJob ? <AddJobForm setAddJob={setAddJob} /> : <Jobs setAddJob={setAddJob} />}
            </PrivateRoute>
          }
        />
        
        {/* Users route with conditional rendering for adding and listing */}
        <Route
          path="/users"
          element={
            <PrivateRoute >
              {addUser ? <FormAddUser setAddUser={setAddUser} /> : <Users setAddUser={setAddUser} />}
            </PrivateRoute>
          }
        />

        {/* Edit user route */}
        <Route
          path="/users/:username"
          element={
              <FormEditUser />
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
