import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Autocomplete
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Cancel
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { ticketsAPI, usersAPI, companiesAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const CreateTicket: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'general',
    assignee: '',
    company: '',
    estimatedTime: '',
    dueDate: '',
    tags: [] as string[]
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Fetch users and companies
  const { data: usersData } = useQuery(
    'users',
    () => usersAPI.getAll(),
    { refetchOnWindowFocus: false }
  );

  const { data: companiesData } = useQuery(
    'companies',
    () => companiesAPI.getAll(),
    { refetchOnWindowFocus: false }
  );

  // Create ticket mutation
  const createTicketMutation = useMutation(
    (ticketData: any) => ticketsAPI.create(ticketData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tickets']);
        toast.success('Ticket created successfully');
        navigate('/tickets');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to create ticket');
      },
    }
  );

  const users = usersData?.data?.users || [];
  const companies = companiesData?.data?.companies || [];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.company) {
      newErrors.company = 'Company is required';
    }

    if (formData.estimatedTime && isNaN(Number(formData.estimatedTime))) {
      newErrors.estimatedTime = 'Estimated time must be a number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const submitData = {
      ...formData,
      estimatedTime: formData.estimatedTime ? parseInt(formData.estimatedTime) : 0,
      dueDate: formData.dueDate || undefined,
      tags: formData.tags.filter(tag => tag.trim())
    };

    createTicketMutation.mutate(submitData);
  };

  const handleCancel = () => {
    navigate('/tickets');
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleCancel}
          sx={{ mr: 2 }}
        >
          Back to Tickets
        </Button>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Create New Ticket
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Title */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  error={!!errors.title}
                  helperText={errors.title}
                  required
                />
              </Grid>

              {/* Description */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  error={!!errors.description}
                  helperText={errors.description}
                  required
                />
              </Grid>

              {/* Priority and Category */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    label="Priority"
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    label="Category"
                  >
                    <MenuItem value="technical">Technical</MenuItem>
                    <MenuItem value="billing">Billing</MenuItem>
                    <MenuItem value="feature_request">Feature Request</MenuItem>
                    <MenuItem value="bug_report">Bug Report</MenuItem>
                    <MenuItem value="general">General</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Company and Assignee */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!errors.company}>
                  <InputLabel>Company</InputLabel>
                  <Select
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    label="Company"
                    required
                  >
                    {companies.map((company: any) => (
                      <MenuItem key={company._id} value={company._id}>
                        {company.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.company && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                      {errors.company}
                    </Typography>
                  )}
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Assignee</InputLabel>
                  <Select
                    value={formData.assignee}
                    onChange={(e) => handleInputChange('assignee', e.target.value)}
                    label="Assignee"
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {users
                      .filter((u: any) => ['agent', 'manager', 'admin'].includes(u.role))
                      .map((user: any) => (
                        <MenuItem key={user._id} value={user._id}>
                          {user.firstName} {user.lastName}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Estimated Time and Due Date */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Estimated Time (minutes)"
                  type="number"
                  value={formData.estimatedTime}
                  onChange={(e) => handleInputChange('estimatedTime', e.target.value)}
                  error={!!errors.estimatedTime}
                  helperText={errors.estimatedTime}
                  placeholder="e.g., 120 for 2 hours"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Due Date"
                  type="datetime-local"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>

              {/* Tags */}
              <Grid item xs={12}>
                <Autocomplete
                  multiple
                  freeSolo
                  options={[]}
                  value={formData.tags}
                  onChange={(event, newValue) => {
                    handleInputChange('tags', newValue);
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option}
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Tags"
                      placeholder="Add tags..."
                    />
                  )}
                />
              </Grid>

              {/* Submit Buttons */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<Cancel />}
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<Save />}
                    disabled={createTicketMutation.isLoading}
                  >
                    {createTicketMutation.isLoading ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        Creating...
                      </>
                    ) : (
                      'Create Ticket'
                    )}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CreateTicket; 