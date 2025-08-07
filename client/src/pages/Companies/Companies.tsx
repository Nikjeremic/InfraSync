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
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Business,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { companiesAPI } from '../../services/api';

interface Company {
  _id: string;
  name: string;
  description?: string;
  industry?: string;
  website?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  subscription: {
    plan: string;
    isActive: boolean;
  };
  stats: {
    totalUsers: number;
    totalTickets: number;
    activeTickets: number;
    usersWithInheritedSubscription?: number;
  };
  createdAt: string;
}

const Companies: React.FC = () => {
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    industry: '',
    website: '',
    email: '',
    phone: '',
    subscription: {
      plan: 'free',
      isActive: true
    }
  });

  // Fetch companies
  const { data: companiesData, isLoading, error } = useQuery(
    'companies',
    () => companiesAPI.getAll(),
    {
      refetchOnWindowFocus: false,
    }
  );

  // Create company mutation
  const createCompanyMutation = useMutation(
    (companyData: any) => companiesAPI.create(companyData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('companies');
        toast.success('Company created successfully!');
        handleCloseDialog();
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to create company');
      },
    }
  );

  // Update company mutation
  const updateCompanyMutation = useMutation(
    ({ id, data }: { id: string; data: any }) => companiesAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('companies');
        toast.success('Company updated successfully!');
        handleCloseDialog();
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update company');
      },
    }
  );

  // Delete company mutation
  const deleteCompanyMutation = useMutation(
    (id: string) => companiesAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('companies');
        toast.success('Company deleted successfully!');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to delete company');
      },
    }
  );

  const companies = companiesData?.data?.companies || [];

  const handleOpenDialog = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        name: company.name,
        description: company.description || '',
        industry: company.industry || '',
        website: company.website || '',
        email: company.email || '',
        phone: company.phone || '',
        subscription: {
          plan: company.subscription.plan,
          isActive: company.subscription.isActive
        }
      });
    } else {
      setEditingCompany(null);
      setFormData({
        name: '',
        description: '',
        industry: '',
        website: '',
        email: '',
        phone: '',
        subscription: { plan: 'free', isActive: true }
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCompany(null);
  };

  const handleSubmit = async () => {
    if (editingCompany) {
      updateCompanyMutation.mutate({
        id: editingCompany._id,
        data: formData
      });
    } else {
      createCompanyMutation.mutate(formData);
    }
  };

  const handleDelete = (company: Company) => {
    if (window.confirm(`Are you sure you want to delete ${company.name}?`)) {
      deleteCompanyMutation.mutate(company._id);
    }
  };

  const getSubscriptionColor = (plan: string) => {
    switch (plan) {
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
          Failed to load companies. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Companies
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{ px: 3 }}
        >
          Add Company
        </Button>
      </Box>

      <Grid container spacing={3}>
        {companies.map((company: Company) => (
          <Grid item xs={12} md={6} lg={4} key={company._id}>
            <Card sx={{ height: '100%', position: 'relative' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <Business />
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="h2">
                      {company.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {company.industry}
                    </Typography>
                  </Box>
                  <IconButton size="small">
                    {company.isActive ? <Visibility /> : <VisibilityOff />}
                  </IconButton>
                </Box>

                {company.description && (
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {company.description}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip
                    label={company.subscription.plan}
                    color={getSubscriptionColor(company.subscription.plan) as any}
                    size="small"
                  />
                  <Chip
                    label={company.isActive ? 'Active' : 'Inactive'}
                    color={company.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Users
                    </Typography>
                    <Typography variant="h6">
                      {company.stats.totalUsers}
                    </Typography>
                    {(company.stats.usersWithInheritedSubscription || 0) > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {company.stats.usersWithInheritedSubscription || 0} inherit subscription
                      </Typography>
                    )}
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Tickets
                    </Typography>
                    <Typography variant="h6">
                      {company.stats.totalTickets}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Active
                    </Typography>
                    <Typography variant="h6">
                      {company.stats.activeTickets}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => handleOpenDialog(company)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<Delete />}
                    onClick={() => handleDelete(company)}
                    disabled={deleteCompanyMutation.isLoading}
                  >
                    Delete
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Add/Edit Company Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingCompany ? 'Edit Company' : 'Add New Company'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Industry"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Website"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Subscription Plan</InputLabel>
                <Select
                  value={formData.subscription.plan}
                  onChange={(e) => setFormData({
                    ...formData,
                    subscription: { ...formData.subscription, plan: e.target.value, isActive: true }
                  })}
                >
                  <MenuItem value="free">Free</MenuItem>
                  <MenuItem value="basic">Basic</MenuItem>
                  <MenuItem value="premium">Premium</MenuItem>
                  <MenuItem value="enterprise">Enterprise</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={
              !formData.name ||
              createCompanyMutation.isLoading ||
              updateCompanyMutation.isLoading
            }
          >
            {createCompanyMutation.isLoading || updateCompanyMutation.isLoading ? (
              <CircularProgress size={20} />
            ) : (
              editingCompany ? 'Update' : 'Create'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Companies; 