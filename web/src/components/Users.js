import React, { useState, useEffect, useMemo } from 'react';
import axiosInstance from "../utils/axiosInstance";
import { Box, Typography, MenuItem, IconButton, Modal } from '@mui/material';
import { Link } from 'react-router-dom';
import { Edit, Delete } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import FormAddUser from "./AddUser";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState(5);
  const [openAddUser, setOpenAddUser] = useState(false); // Modal state

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

  const handleMenuOpen = (event, job_id) => {
    setAnchorEl(event.currentTarget);
    setSelectedJobId(job_id);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedJobId(null);
  };
  const columns = useMemo(() => [
    { field: "id", headerName: "ID", width: 50 },
    { field: "username", headerName: "Username", width: 250 },
    { field: "full_name", headerName: "Name", width: 250 },
    { field: "role", headerName: "Role", width: 170 },
    { field: "created_at", headerName: "Created At", width: 180 },
    { field: "updated_at", headerName: "Updated At", width: 180 },
    {
      field: "actions",
      headerName: "Actions",
      width: 120,
      renderCell: (params) => (
        <>
          <IconButton onClick={(event) => handleMenuOpen(event, params.row.id)}>
            <MoreVert />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl) && selectedJobId === params.row.id}
            onClose={handleMenuClose}
          >
          <MenuItem title="Edit this user">
            <IconButton component={Link} to={`/users/${params.row.username}`} color="primary">
              <Edit />
            </IconButton>
          </MenuItem>
          <MenuItem title="Delete this user">
            <IconButton onClick={() => deleteUser(params.row.username)} color="error">
              <Delete />
            </IconButton>
          </MenuItem>
               </Menu>
        </>
      ),
    },
  ], []);

  const deleteUser = async (username) => {
    console.log("Deleting user:", username);
  };

  const handleAddUser = () => {
    setOpenAddUser(true); // Open modal
  };

  const handleClose = () => {
    setOpenAddUser(false); // Close modal
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#14213D", padding: "20px" }}>
      <div className="container">
        <Typography variant="h3" component="h3" align="center" color="white">
          Users
        </Typography>
        {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
        <Box sx={{ height: 400, width: "100%" }}>
          <DataGrid
            sx={{ border: "1px solid", m: 2, boxShadow: 5, backgroundColor: "white" }}
            columns={columns}
            rows={rows}
            rowsPerPageOptions={[5, 10, 20]}
            pageSize={pageSize}
            onPageSizeChange={(newPageSize) => setPageSize(newPageSize)}
          />
        </Box>
        <Box textAlign="center" mt={2}>
          <Link
            style={{ color: "#fff", fontSize: "18px", cursor: "pointer" }}
            onClick={(e) => {
              e.preventDefault();
              handleAddUser();
            }}
          >
            Add New User
          </Link>
        </Box>
      </div>

      {/* Modal for adding user */}
      <Modal open={openAddUser} onClose={handleClose}>
        <div>
          <FormAddUser onAddUser={handleClose} />
        </div>
      </Modal>
    </div>
  );
};

export default Users;
