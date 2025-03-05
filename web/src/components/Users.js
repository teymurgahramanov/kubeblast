import React, { useState, useEffect, useMemo } from 'react';
import axiosInstance from "../utils/axiosInstance";
import { Box, Typography, IconButton, Modal, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { Edit, Delete } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import FormAddUser from "./AddUser";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState(5);
  const [openAddUser, setOpenAddUser] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      const token = sessionStorage.getItem('access_token');
      if (!token) {
        setError('Unauthorized: Please log in');
        return;
      }
      try {
        const response = await axiosInstance.get("/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(response.data);
      } catch (error) {
        setError('Error fetching Users: ' + (error.response?.data || error.message));
      }
    };
    fetchUsers();
  }, []);

  const rows = useMemo(() => users.map((user) => ({
    id: user.id || user.username,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    created_at: user.created_at,
    updated_at: user.updated_at
  })), [users]);

  const deleteUser = async (username) => {
    console.log("Deleting user:", username);
  };

  const handleAddUser = () => {
    setOpenAddUser(true);
  };

  const handleClose = () => {
    setOpenAddUser(false);
  };

  const columns = useMemo(() => [
    { field: "username", headerName: "Username", width: 250 },
    { field: "full_name", headerName: "Name", width: 250 },
    { field: "role", headerName: "Role", width: 170 },
    { field: "created_at", headerName: "Created At", width: 180 },
    {
      field: "actions",
      headerName: "Actions",
      width: 120,
      renderCell: (params) => (
        <>
          <IconButton component={Link} to={`/users/${params.row.username}`} color="primary">
            <Edit />
          </IconButton>
          <IconButton onClick={() => deleteUser(params.row.username)} color="error">
            <Delete />
          </IconButton>
        </>
      ),
    },
  ], []);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0D0630", padding: "20px" }}>
      <Typography variant="h3" align="center" color="white" gutterBottom>
        Users
      </Typography>
      <Box textAlign="left" mt={2}>
        <Button variant="contained" color="primary" onClick={handleAddUser}>
          Add New User
        </Button>
      </Box>
      {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
      <Box sx={{ height: 400, width: "100%" }}>
        <DataGrid
          sx={{
            border: "1px solid", 
            m: 2, 
            boxShadow: 5, 
            backgroundColor: "white",
            '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: "#18314F", color: "white" },
            '& .MuiDataGrid-row:nth-of-type(odd)': { backgroundColor: "#384E77", color: "white" },
          }}
          columns={columns}
          rows={rows}
          rowsPerPageOptions={[5, 10, 20]}
          pageSize={pageSize}
          onPageSizeChange={(newPageSize) => setPageSize(newPageSize)}
        />
      </Box>


      {/* Modal for adding user */}
      <Modal open={openAddUser} onClose={handleClose}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'white', padding: 3, borderRadius: 2 }}>
          <FormAddUser onAddUser={handleClose} />
        </Box>
      </Modal>
    </div>
  );
};

export default Users;
