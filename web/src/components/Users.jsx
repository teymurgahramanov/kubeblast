import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, Button, IconButton, Menu, MenuItem, Modal, TextField } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Delete, Edit, MoreVert, PersonAdd, Person } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";

import Menuselect from "./Menuselect";
import EditUser from "./EditUser";
import ErrorMessage from './ErrorMessage';
import AddUser from "./AddUser";

const Users = ({ setAddUser }) => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [addUser, setAddUserState] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [timezone, setTimezone] = useState('UTC');

  const fetchUsers = async () => {
    try {
      const response = await axiosInstance.get("/users", {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      setUsers(response.data);
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
    }
  };

  useEffect(() => {
    fetchUsers();

    const fetchAppStats = async () => {
      try {
        const response = await axiosInstance.get('/stats/app');
        if (response.data?.TIMEZONE) setTimezone(response.data.TIMEZONE);
      } catch {
        // Keep UTC as the display fallback when app settings are unavailable.
      }
    };
    fetchAppStats();
  }, []);

  const handleAddUserClose = () => {
    setAddUserState(false);
    fetchUsers();
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
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      setUsers(users.filter(user => user.username !== username));
      handleMenuClose();
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
    }
  };



  const handleUserUpdate = () => {
    fetchUsers();
    setSelectedUser(null);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Never';
    const hasTimezone = /Z$/i.test(dateString) || /[+-]\d\d:?\d\d$/.test(dateString);
    const normalized = hasTimezone ? dateString : `${dateString}Z`;

    try {
      const date = new Date(normalized);
      if (Number.isNaN(date.getTime())) return dateString;
      return date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZone: timezone || 'UTC',
      });
    } catch {
      return dateString;
    }
  };

  const rows = users.map((user) => ({
    id: user.id,
    username: user.username,
    full_name: user.full_name || '',
    email: user.email || '',
    role: user.role,
    method: user.method ?? user.mehod ?? '',
    enabled: user.enabled,
    last_login: user.last_login || null,
  }));

  const visibleRows = useMemo(() => {
    const text = (searchText || '').toLowerCase().trim();
    return rows.filter((row) => {
      const username = String(row.username || '').toLowerCase();
      return !text || username.includes(text);
    });
  }, [rows, searchText]);

  const EmptyState = () => (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      py: 8,
      px: 2,
      textAlign: 'center',
    }}>
      <Person sx={{ 
        fontSize: 64,
        color: 'var(--text-secondary)',
        mb: 2,
        opacity: 0.5
      }} />
      <Typography variant="h6" sx={{ 
        color: 'var(--text-secondary)',
        fontWeight: 600
      }}>
        There's nothing here yet
      </Typography>
    </Box>
  );

  const columns = [
    { field: 'username', headerName: 'Username', width: 180, flex: 1 },
    { field: 'full_name', headerName: 'Full Name', width: 200, flex: 1 },
    { field: 'role', headerName: 'Role', width: 150, flex: 1 },
    { field: 'method', headerName: 'Method', width: 130, flex: 0.8 },
    {
      field: 'last_login',
      headerName: 'Last Login',
      width: 220,
      flex: 1.2,
      valueFormatter: (value) => formatDateTime(value),
    },
    {
      field: 'enabled',
      headerName: 'Status',
      width: 120,
      flex: 0.8,
      renderCell: (params) => {
        const statusColors = params.row.enabled 
          ? { bg: '#BBF7D0', text: '#047857', border: '#86EFAC' } // enabled: lighter green
          : { bg: '#FCA5A5', text: '#7F1D1D', border: '#EF4444' }; // disabled: bright red
        
        return (
          <Box sx={{
            backgroundColor: statusColors.bg,
            color: statusColors.text,
            borderRadius: '6px',
            px: 2,
            py: 0.75,
            fontSize: '0.8125rem',
            fontWeight: 700,
            width: 'fit-content',
            minWidth: '90px',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}>
            {params.row.enabled ? 'Enabled' : 'Disabled'}
          </Box>
        );
      }
    },
    {
      field: 'actions',
      headerName: '',
      sortable: false,
      width: 100,
      flex: 0.5,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            onClick={(event) => handleMenuOpen(event, params.row.username)}
            size="small"
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
        backgroundColor: 'background.paper',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        px: 3,
        py: 1,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center'
      }}>
        <Link to="/jobs" style={{ textDecoration: 'none', justifySelf: 'start' }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="KubeBlast"
            sx={{
              height: 36,
              width: 'auto',
              '&:hover': { opacity: 0.8 }
            }}
          />
        </Link>
        <Typography variant="h6" sx={{ fontWeight: 600, textAlign: 'center' }}>
          Users
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifySelf: 'end' }}>
          <Menuselect />
        </Box>
      </Box>

      <Box className="page-container fade-in">
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
          <Button
            variant="contained"
            onClick={() => setAddUser(true)}
            startIcon={<PersonAdd />}
            sx={{
              background: 'linear-gradient(135deg, #326CE5 0%, #1e40af 100%)',
              boxShadow: 'none',
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              px: 2.2,
              '&:hover': { background: 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)' },
            }}
          >
            Add
          </Button>
        </Box>

        {/* Filters */}
        <Box
          sx={{
            mb: 2,
            backgroundColor: 'background.paper',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
            p: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 2,
            alignItems: 'center'
          }}
        >
          <TextField
            size="small"
            label="Search username"
            placeholder="Enter username"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            variant="outlined"
          />
        </Box>

        <ErrorMessage message={error} />

        <Box sx={{ 
          height: 'calc(100vh - 280px)',
          width: '100%',
          backgroundColor: 'background.paper',
          borderRadius: '12px',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
          overflow: 'hidden',
          '& .MuiDataGrid-root': {
            border: 'none',
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid var(--border-color)',
              '&:focus': {
                outline: 'none',
              },
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: 'var(--background-light)',
              borderBottom: '2px solid var(--border-color)',
              '& .MuiDataGrid-columnHeader': {
                '&:focus': {
                  outline: 'none',
                },
                '&:focus-within': {
                  outline: 'none',
                },
                '&:not(:last-child)': {
                  borderRight: 'none',
                },
                '& .MuiDataGrid-columnSeparator': {
                  display: 'none',
                },
              },
            },
            '& .MuiDataGrid-row': {
              '&:hover': {
                backgroundColor: 'var(--background-light)',
              },
              '&:nth-of-type(even)': {
                backgroundColor: 'transparent',
              },
            },
            '& .MuiDataGrid-overlay': {
              background: 'transparent',
            },
          },
        }}>
          {visibleRows.length === 0 ? (
            <EmptyState />
          ) : (
            <DataGrid
              rows={visibleRows}
              columns={columns}
              getRowId={(row) => row.username}
              hideFooter
              rowSelection={false}
              disableColumnMenu
              autoHeight
              getRowHeight={() => 'auto'}
              sx={{
                '& .MuiDataGrid-row.Mui-selected': {
                  backgroundColor: 'transparent !important'
                },
                '& .MuiDataGrid-row.Mui-selected:hover': {
                  backgroundColor: 'var(--background-light) !important'
                },
                '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
                  outline: 'none'
                },
                '& .MuiDataGrid-cell': {
                  py: 2,
                },
                '& .MuiDataGrid-columnHeader': {
                  py: 2,
                  fontWeight: 600,
                },
              }}
            />
          )}
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          slotProps={{
            paper: {
              sx: {
                mt: 1,
                '& .MuiMenuItem-root': {
                  py: 1,
                  gap: 1
                }
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

        <Modal open={Boolean(selectedUser)} onClose={() => setSelectedUser(null)}>
          <Box sx={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '92%', maxWidth: 640,
            bgcolor: 'background.paper',
            boxShadow: '0 25px 60px rgba(0,0,0,0.22)',
            borderRadius: '16px', outline: 'none',
            border: '1px solid var(--border-color)',
            p: 4.5,
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

        <Modal open={Boolean(addUser)} onClose={handleAddUserClose}>
          <Box sx={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '92%', maxWidth: 640,
            bgcolor: 'background.paper',
            boxShadow: '0 25px 60px rgba(0,0,0,0.22)',
            borderRadius: '16px', outline: 'none',
            border: '1px solid var(--border-color)',
            p: 4.5,
          }}>
            <AddUser onClose={handleAddUserClose} />
          </Box>
        </Modal>
      </Box>
    </Box>
  );
};

export default Users;
