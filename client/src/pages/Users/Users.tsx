import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Person,
  Visibility,
  VisibilityOff,
  Business,
} from '@mui/icons-material';
import { usersAPI, companiesAPI } from '../../services/api';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  subscription: string;
  effectiveSubscription?: string;
  subscriptionSource?: 'user' | 'company';
  company?: {
    _id: string;
    name: string;
    subscription?: {
      plan: string;
    };
  };
  isActive: boolean;
  permissions: string[];
  createdAt: string;
}

interface Company {
  _id: string;
  name: string;
  isActive: boolean;
  subscription?: {
    plan: string;
  };
}

const Users: React.FC = () => {
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'user',
    company: '',
    subscription: 'free',
    permissions: [] as string[],
    isActive: true
  });

  console.log('Current formData:', formData);

  // Fetch users
  const { data: usersData, isLoading, error } = useQuery(
    'users',
    () => usersAPI.getAll(),
    {
      refetchOnWindowFocus: false,
    }
  );

  // Fetch companies for dropdown
  const { data: companiesData } = useQuery(
    'companies',
    () => companiesAPI.getAll(),
    {
      refetchOnWindowFocus: false,
    }
  );

  // Create user mutation
  const createUserMutation = useMutation(
    (userData: any) => usersAPI.create(userData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        toast.success('User created successfully!');
        handleCloseDialog();
      },
      onError: (error: any) => {
        console.error('Create user error:', error);
        const errorMessage = error.response?.data?.message || 
                            error.response?.data?.errors?.join(', ') || 
                            'Failed to create user';
        toast.error(errorMessage);
      },
    }
  );

  // Update user mutation
  const updateUserMutation = useMutation(
    ({ id, data }: { id: string; data: any }) => usersAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        toast.success('User updated successfully!');
        handleCloseDialog();
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update user');
      },
    }
  );

  // Delete user mutation
  const deleteUserMutation = useMutation(
    (id: string) => usersAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        toast.success('User deleted successfully!');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to delete user');
      },
    }
  );

  // Activate/Deactivate user mutation
  const toggleUserStatusMutation = useMutation(
    ({ id, isActive }: { id: string; isActive: boolean }) => 
      isActive ? usersAPI.activate(id) : usersAPI.deactivate(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        toast.success('User status updated successfully!');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update user status');
      },
    }
  );

  const users = usersData?.data?.users || [];
  const companies = companiesData?.data?.companies || [];

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: '',
        role: user.role,
        company: user.company?._id || '',
        subscription: user.effectiveSubscription || user.subscription,
        permissions: user.permissions || [],
        isActive: user.isActive
      });
    } else {
      setEditingUser(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'user',
        company: '',
        subscription: 'free',
        permissions: [],
        isActive: true
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
  };

  const handleSubmit = async () => {
    let submitData: any = { ...formData };
    
    // Clean up empty strings
    if (submitData.company === '') {
      delete submitData.company;
    }
    if (submitData.subscription === '') {
      submitData.subscription = 'free';
    }
    
    // Don't send password if it's empty (for updates)
    if (editingUser && !submitData.password) {
      const { password, ...dataWithoutPassword } = submitData;
      submitData = dataWithoutPassword;
    }

    console.log('Submitting user data:', submitData);

    if (editingUser) {
      updateUserMutation.mutate({
        id: editingUser._id,
        data: submitData
      });
    } else {
      createUserMutation.mutate(submitData);
    }
  };

  const handleDelete = (user: User) => {
    if (window.confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}?`)) {
      deleteUserMutation.mutate(user._id);
    }
  };

  const handleToggleStatus = (user: User) => {
    toggleUserStatusMutation.mutate({
      id: user._id,
      isActive: !user.isActive
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'manager':
        return 'warning';
      case 'agent':
        return 'info';
      default:
        return 'default';
    }
  };

  const getSubscriptionColor = (subscription: string) => {
    switch (subscription) {
      case 'enterprise':
        return 'error';
      case 'premium':
        return 'warning';
      case 'basic':
        return 'info';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load users. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Users
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{ px: 3 }}
        >
          Add User
        </Button>
      </Box>

      <Grid container spacing={3}>
        {users.map((user: User) => (
          <Grid item xs={12} md={6} lg={4} key={user._id}>
            <Card sx={{ height: '100%', position: 'relative' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <Person />
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="h2">
                      {user.firstName} {user.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {user.email}
                    </Typography>
                  </Box>
                  <IconButton 
                    size="small"
                    onClick={() => handleToggleStatus(user)}
                    disabled={toggleUserStatusMutation.isLoading}
                  >
                    {user.isActive ? <Visibility /> : <VisibilityOff />}
                  </IconButton>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip
                    label={user.role}
                    color={getRoleColor(user.role) as any}
                    size="small"
                  />
                  <Chip
                    label={user.effectiveSubscription || user.subscription}
                    color={getSubscriptionColor(user.effectiveSubscription || user.subscription) as any}
                    size="small"
                    title={user.subscriptionSource === 'company' ? 'Automatically inherited from company' : 'User subscription'}
                  />
                  <Chip
                    label={user.isActive ? 'Active' : 'Inactive'}
                    color={user.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                {user.company && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Business sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {user.company.name}
                      {user.subscriptionSource === 'company' && (
                        <span style={{ marginLeft: 8, fontSize: '0.75rem', opacity: 0.7 }}>
                          (auto-inherits subscription)
                        </span>
                      )}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => handleOpenDialog(user)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<Delete />}
                    onClick={() => handleDelete(user)}
                    disabled={deleteUserMutation.isLoading}
                  >
                    Delete
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Add/Edit User Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingUser ? 'Edit User' : 'Add New User'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingUser}
                helperText={editingUser ? 'Leave empty to keep current password' : ''}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <MenuItem value="user">User</MenuItem>
                  <MenuItem value="agent">Agent</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Company</InputLabel>
                <Select
                  value={formData.company}
                  onChange={(e) => {
                    const selectedCompany = companies.find((c: Company) => c._id === e.target.value);
                    setFormData({ 
                      ...formData, 
                      company: e.target.value,
                      subscription: selectedCompany?.subscription?.plan || 'free'
                    });
                  }}
                >
                  <MenuItem value="">No Company</MenuItem>
                  {companies.map((company: Company) => (
                    <MenuItem key={company._id} value={company._id}>
                      {company.name} ({company.subscription?.plan || 'free'})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Subscription</InputLabel>
                <Select
                  value={formData.subscription}
                  onChange={(e) => setFormData({ ...formData, subscription: e.target.value })}
                  disabled={!!formData.company}
                >
                  <MenuItem value="free">Free (inherits from company)</MenuItem>
                  <MenuItem value="basic">Basic</MenuItem>
                  <MenuItem value="premium">Premium</MenuItem>
                  <MenuItem value="enterprise">Enterprise</MenuItem>
                </Select>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {formData.company 
                    ? 'Subscription automatically set from selected company' 
                    : 'If set to "Free", user will inherit subscription from their company'
                  }
                </Typography>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Active User"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={
              !formData.firstName ||
              !formData.lastName ||
              !formData.email ||
              (!editingUser && !formData.password) ||
              createUserMutation.isLoading ||
              updateUserMutation.isLoading
            }
          >
            {createUserMutation.isLoading || updateUserMutation.isLoading ? (
              <CircularProgress size={20} />
            ) : (
              editingUser ? 'Update' : 'Create'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Users; 