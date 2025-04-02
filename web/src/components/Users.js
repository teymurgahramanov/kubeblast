import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, Button, IconButton, Menu, MenuItem, Modal } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Delete, Edit, MoreVert, PersonAdd } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";
import Menuselect from "./Menuselect";
import EditUser from "./EditUser";
import ErrorMessage from './ErrorMessage';

const Users = ({ setAddUser }) => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const userRole = sessionStorage.getItem('user_role');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axiosInstance.get("/users", {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
      });
      setUsers(response.data);
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
    }
  };

  const handleMenuOpen = (event, username) => {
    setAnchorEl(event.currentTarget);
    setSelectedUserId(username);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedUserId(null);
  };

  const handleDeleteUser = async (username) => {
    try {
      await axiosInstance.delete(`/users/${username}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
      });
      setUsers(users.filter(user => user.username !== username));
      handleMenuClose();
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
    }
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
  };

  const handleUserUpdate = () => {
    fetchUsers();
    setSelectedUser(null);
  };

  const rows = users.map((user) => ({
    id: user.id,
    username: user.username,
    full_name: user.full_name || '',
    email: user.email || '',
    role: user.role,
    enabled: user.enabled,
  }));

  const columns = [
    { field: 'username', headerName: 'Username', width: 180, flex: 1 },
    { field: 'full_name', headerName: 'Full Name', width: 200, flex: 1 },
    { field: 'role', headerName: 'Role', width: 150, flex: 1 },
    {
      field: 'enabled',
      headerName: 'Status',
      width: 120,
      flex: 0.8,
      renderCell: (params) => (
        <Box sx={{
          backgroundColor: params.row.enabled ? '#D1FAE5' : '#FEE2E2',
          color: params.row.enabled ? '#065F46' : '#991B1B',
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}>
          {params.row.enabled ? 'Enabled' : 'Disabled'}
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      flex: 0.5,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            onClick={(event) => handleMenuOpen(event, params.row.username)}
            sx={{ 
              '&:hover': { 
                backgroundColor: 'var(--background-light)',
                color: 'var(--primary-color)'
              }
            }}
          >
            <MoreVert />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        px: 3,
        py: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Link to="/jobs" style={{ textDecoration: 'none' }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="KubeBlast"
            sx={{
              height: 48,
              width: 'auto',
              '&:hover': { opacity: 0.8 }
            }}
          />
        </Link>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Menuselect />
        </Box>
      </Box>

      <Box className="page-container fade-in">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            Users
          </Typography>
          <Button
            variant="contained"
            onClick={() => setAddUser(true)}
            startIcon={<PersonAdd />}
            sx={{
              backgroundColor: 'var(--primary-color)',
              '&:hover': { backgroundColor: 'var(--primary-dark)' },
              borderRadius: '8px',
              textTransform: 'none',
              px: 3
            }}
          >
            Add
          </Button>
        </Box>

        <ErrorMessage message={error} />

        <Box sx={{ 
          height: 'calc(100vh - 280px)',
          width: '100%',
          '& .status-cell': {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start'
          }
        }}>
          <DataGrid
            rows={rows}
            columns={columns}
            getRowId={(row) => row.username}
            hideFooter
            disableSelectionOnClick
            sx={{
              '& .MuiDataGrid-cell:focus': {
                outline: 'none'
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: 'var(--background-light)'
              }
            }}
          />
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          PaperProps={{
            sx: {
              mt: 1,
              '& .MuiMenuItem-root': {
                py: 1,
                gap: 1
              }
            }
          }}
        >
          <MenuItem 
            onClick={() => {
              const user = users.find(u => u.username === selectedUserId);
              setSelectedUser(user);
              handleMenuClose();
            }}
            sx={{ color: 'var(--primary-color)' }}
          >
            <Edit fontSize="small" />
            Edit
          </MenuItem>
          <MenuItem 
            onClick={() => handleDeleteUser(selectedUserId)}
            sx={{ color: 'var(--danger-color)' }}
          >
            <Delete fontSize="small" />
            Delete
          </MenuItem>
        </Menu>

        <Modal
          open={Boolean(selectedUser)}
          onClose={() => setSelectedUser(null)}
          aria-labelledby="edit-user-modal"
          sx={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)'
          }}
        >
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: 600,
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 2
          }}>
            {selectedUser && (
              <EditUser
                user={selectedUser}
                onClose={() => setSelectedUser(null)}
                onUpdate={handleUserUpdate}
              />
            )}
          </Box>
        </Modal>
      </Box>
    </Box>
  );
};

export default Users;
