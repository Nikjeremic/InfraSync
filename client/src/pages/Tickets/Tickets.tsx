import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
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
  Fab,
  Tooltip,
  Badge,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Alert,
  CircularProgress,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add,
  Search,
  FilterList,
  PlayArrow,
  Stop,
  WatchLater,
  PriorityHigh,
  Assignment,
  Business,
  Schedule,
  TrendingUp,
  Warning,
  OpenInNew
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ticketsAPI, usersAPI, companiesAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface Ticket {
  _id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'technical' | 'billing' | 'feature_request' | 'bug_report' | 'general';
  reporter: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignee?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  company: {
    _id: string;
    name: string;
  };
  estimatedTime: number;
  actualTime: number;
  timeEntries: Array<{
    _id: string;
    description: string;
    startTime: string;
    endTime?: string;
    duration: number;
    user: {
      _id: string;
      firstName: string;
      lastName: string;
    };
    isActive: boolean;
  }>;
  sla: {
    type: 'response' | 'resolution';
    targetTime: number;
    startTime: string;
    endTime?: string;
    isBreached: boolean;
  };
  escalationLevel: number;
  escalatedTo?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  watchers: Array<{
    _id: string;
    firstName: string;
    lastName: string;
  }>;
  tags: string[];
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`ticket-tabpanel-${index}`}
      aria-labelledby={`ticket-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Tickets: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: '',
    assignee: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'general',
    assignee: '',
    company: ''
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  // Fetch tickets
  const { data: ticketsData, isLoading, error } = useQuery(
    ['tickets', filters],
    () => ticketsAPI.getAll(filters),
    {
      refetchOnWindowFocus: false,
    }
  );

  // Fetch users for assignee filter
  const { data: usersData } = useQuery(
    'users-for-tickets',
    () => usersAPI.getForTickets(),
    {
      refetchOnWindowFocus: false,
    }
  );

  // Fetch companies for ticket creation
  const { data: companiesData } = useQuery(
    'companies-for-tickets',
    () => companiesAPI.getForTickets(),
    {
      refetchOnWindowFocus: false,
    }
  );

  // Time tracking mutations
  const startTrackingMutation = useMutation(
    ({ ticketId, description }: { ticketId: string; description: string }) =>
      ticketsAPI.startTracking(ticketId, description),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tickets']);
        toast.success('Time tracking started');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to start tracking');
      },
    }
  );

  const stopTrackingMutation = useMutation(
    (ticketId: string) => ticketsAPI.stopTracking(ticketId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tickets']);
        toast.success('Time tracking stopped');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to stop tracking');
      },
    }
  );

  // Watch/unwatch mutations
  const watchMutation = useMutation(
    (ticketId: string) => ticketsAPI.watch(ticketId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tickets']);
        toast.success('Added as watcher');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to add watcher');
      },
    }
  );

  const unwatchMutation = useMutation(
    (ticketId: string) => ticketsAPI.unwatch(ticketId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tickets']);
        toast.success('Removed as watcher');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to remove watcher');
      },
    }
  );

  // Create ticket mutation
  const createTicketMutation = useMutation(
    (ticketData: any) => ticketsAPI.create(ticketData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tickets']);
        toast.success('Ticket created successfully');
        setShowTicketDialog(false);
        setTicketForm({
          title: '',
          description: '',
          priority: 'medium',
          category: 'general',
          assignee: '',
          company: ''
        });
        setFormErrors({});
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to create ticket');
      },
    }
  );

  const tickets = ticketsData?.data?.tickets || [];
  const users = usersData?.data?.users || [];
  const companies = companiesData?.data?.companies || [];

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      priority: '',
      category: '',
      assignee: '',
      search: ''
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'default';
      case 'in_progress':
        return 'primary';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'success';
      case 'medium':
        return 'warning';
      case 'high':
        return 'error';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <PriorityHigh color="error" />;
      case 'high':
        return <PriorityHigh color="warning" />;
      default:
        return null;
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const isWatching = (ticket: Ticket) => {
    return ticket.watchers.some(watcher => watcher._id === (user as any)?._id);
  };

  const hasActiveTimeEntry = (ticket: Ticket) => {
    return ticket.timeEntries.some(entry => entry.isActive);
  };

  const handleStartTracking = (ticket: Ticket) => {
    const description = prompt('Enter description for time tracking:');
    if (description) {
      startTrackingMutation.mutate({ ticketId: ticket._id, description });
    }
  };

  const handleStopTracking = (ticket: Ticket) => {
    stopTrackingMutation.mutate(ticket._id);
  };

  const handleWatchToggle = (ticket: Ticket) => {
    if (isWatching(ticket)) {
      unwatchMutation.mutate(ticket._id);
    } else {
      watchMutation.mutate(ticket._id);
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setTicketForm(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!ticketForm.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!ticketForm.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!ticketForm.company || ticketForm.company === '') {
      newErrors.company = 'Company is required';
    }



    // Role-based validation
    if (ticketForm.priority === 'high' && !canSetHighPriority()) {
      newErrors.priority = 'You cannot set high priority tickets';
    }

    if (ticketForm.priority === 'critical' && !canSetCriticalPriority()) {
      newErrors.priority = 'Only admins can set critical priority';
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateTicket = () => {
    if (!validateForm()) {
      return;
    }

    const submitData: any = {
      ...ticketForm
    };
    
    // Remove assignee property if it's empty
    if (!submitData.assignee) {
      delete submitData.assignee;
    }

    console.log('Submitting ticket data:', submitData);
    createTicketMutation.mutate(submitData);
  };

  const handleCloseDialog = () => {
    setShowTicketDialog(false);
    setTicketForm({
      title: '',
      description: '',
      priority: 'medium',
      category: 'general',
      assignee: '',
      company: ''
    });
    setFormErrors({});
  };

  // Set default company for regular users when dialog opens
  const handleOpenDialog = () => {
    const defaultCompany = shouldAutoFillCompany() ? getUserCompany() : '';
    setTicketForm(prev => ({
      ...prev,
      company: defaultCompany
    }));
    setShowTicketDialog(true);
  };

  // Role-based helper functions
  const canCreateTicket = () => {
    return ['admin', 'manager', 'agent', 'user'].includes(user?.role || '');
  };

  const canAssignTickets = () => {
    return ['admin', 'manager'].includes(user?.role || '');
  };

  const canSelectCompany = () => {
    return ['admin'].includes(user?.role || '');
  };

  const getUserCompany = () => {
    return user?.company || '';
  };

  const shouldAutoFillCompany = () => {
    return !['admin'].includes(user?.role || '');
  };

  const canSetHighPriority = () => {
    return ['admin', 'manager'].includes(user?.role || '');
  };

  const canSetCriticalPriority = () => {
    return ['admin'].includes(user?.role || '');
  };

  const filteredTickets = tickets.filter((ticket: Ticket) => {
    if (tabValue === 0) return ticket.status === 'open';
    if (tabValue === 1) return ticket.status === 'in_progress';
    if (tabValue === 2) return ticket.status === 'resolved';
    if (tabValue === 3) return ticket.status === 'closed';
    return true;
  });

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
          Failed to load tickets. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Tickets
        </Typography>
        {canCreateTicket() && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenDialog}
            sx={{ px: 3 }}
          >
            Create Ticket
          </Button>
        )}
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <TextField
              placeholder="Search tickets..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
              }}
              size="small"
              sx={{ minWidth: 200 }}
            />
            <Button
              startIcon={<FilterList />}
              onClick={() => setShowFilters(!showFilters)}
              variant={showFilters ? 'contained' : 'outlined'}
              size="small"
            >
              Filters
            </Button>
            {Object.values(filters).some(f => f !== '') && (
              <Button onClick={clearFilters} size="small">
                Clear
              </Button>
            )}
          </Box>

          {showFilters && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                    <MenuItem value="closed">Closed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filters.priority}
                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                    label="Priority"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    label="Category"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="technical">Technical</MenuItem>
                    <MenuItem value="billing">Billing</MenuItem>
                    <MenuItem value="feature_request">Feature Request</MenuItem>
                    <MenuItem value="bug_report">Bug Report</MenuItem>
                    <MenuItem value="general">General</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Assignee</InputLabel>
                  <Select
                    value={filters.assignee}
                    onChange={(e) => handleFilterChange('assignee', e.target.value)}
                    label="Assignee"
                  >
                    <MenuItem value="">All</MenuItem>
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
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                 <Tabs value={tabValue} onChange={handleTabChange}>
           <Tab label={`Open (${tickets.filter((t: Ticket) => t.status === 'open').length})`} />
           <Tab label={`In Progress (${tickets.filter((t: Ticket) => t.status === 'in_progress').length})`} />
           <Tab label={`Resolved (${tickets.filter((t: Ticket) => t.status === 'resolved').length})`} />
           <Tab label={`Closed (${tickets.filter((t: Ticket) => t.status === 'closed').length})`} />
         </Tabs>
      </Box>

      {/* Tickets List */}
      <Grid container spacing={3}>
                 {filteredTickets.map((ticket: Ticket) => (
          <Grid item xs={12} md={6} lg={4} key={ticket._id}>
            <Card sx={{ height: '100%', position: 'relative' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                                       <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                     <Typography 
                       variant="h6" 
                       component="h3" 
                       sx={{ fontWeight: 'bold', cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                       onClick={() => navigate(`/tickets/${ticket._id}`)}
                     >
                       {ticket.ticketNumber}
                     </Typography>
                     <OpenInNew sx={{ fontSize: 16, color: 'text.secondary', cursor: 'pointer' }} />
                   </Box>
                   <Typography 
                     variant="body1" 
                     sx={{ mb: 1, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                     onClick={() => navigate(`/tickets/${ticket._id}`)}
                   >
                     {ticket.title}
                   </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {getPriorityIcon(ticket.priority)}
                    <Chip
                      label={ticket.priority}
                      color={getPriorityColor(ticket.priority)}
                      size="small"
                    />
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip
                    label={ticket.status}
                    color={getStatusColor(ticket.status)}
                    size="small"
                  />
                  <Chip
                    label={ticket.category}
                    variant="outlined"
                    size="small"
                  />
                  {ticket.sla.isBreached && (
                    <Chip
                      icon={<Warning />}
                      label="SLA Breached"
                      color="error"
                      size="small"
                    />
                  )}
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <Assignment sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                    {ticket.assignee ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}` : 'Unassigned'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <Business sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                    {ticket.company.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <Schedule sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                    {formatTime(ticket.actualTime)} / {formatTime(ticket.estimatedTime)}
                  </Typography>
                </Box>

                {ticket.tags.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                                       {ticket.tags.map((tag: string, index: number) => (
                     <Chip
                       key={index}
                       label={tag}
                       size="small"
                       sx={{ mr: 0.5, mb: 0.5 }}
                     />
                   ))}
                  </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title={hasActiveTimeEntry(ticket) ? 'Stop tracking' : 'Start tracking'}>
                      <IconButton
                        size="small"
                        color={hasActiveTimeEntry(ticket) ? 'error' : 'primary'}
                        onClick={() => hasActiveTimeEntry(ticket) 
                          ? handleStopTracking(ticket) 
                          : handleStartTracking(ticket)
                        }
                      >
                        {hasActiveTimeEntry(ticket) ? <Stop /> : <PlayArrow />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={isWatching(ticket) ? 'Remove from watchlist' : 'Add to watchlist'}>
                      <IconButton
                        size="small"
                        color={isWatching(ticket) ? 'primary' : 'default'}
                        onClick={() => handleWatchToggle(ticket)}
                      >
                        <WatchLater />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredTickets.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No tickets found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create your first ticket to get started
          </Typography>
        </Box>
      )}

      {/* Create Ticket Dialog */}
      <Dialog
        open={showTicketDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Ticket</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              {/* Title */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={ticketForm.title}
                  onChange={(e) => handleFormChange('title', e.target.value)}
                  error={!!formErrors.title}
                  helperText={formErrors.title}
                  required
                />
              </Grid>

              {/* Description */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={ticketForm.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  error={!!formErrors.description}
                  helperText={formErrors.description}
                  required
                />
              </Grid>

              {/* Priority and Category */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!formErrors.priority}>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={ticketForm.priority}
                    onChange={(e) => handleFormChange('priority', e.target.value)}
                    label="Priority"
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    {canSetHighPriority() && (
                      <MenuItem value="high">High</MenuItem>
                    )}
                    {canSetCriticalPriority() && (
                      <MenuItem value="critical">Critical</MenuItem>
                    )}
                  </Select>
                  {formErrors.priority && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                      {formErrors.priority}
                    </Typography>
                  )}
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={ticketForm.category}
                    onChange={(e) => handleFormChange('category', e.target.value)}
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
                <FormControl fullWidth error={!!formErrors.company}>
                  <InputLabel>Company</InputLabel>
                  <Select
                    value={ticketForm.company}
                    onChange={(e) => handleFormChange('company', e.target.value)}
                    label="Company"
                    required
                  >
                    {canSelectCompany() ? (
                      // Admin can see all companies
                      companies.map((company: any) => (
                        <MenuItem key={company._id} value={company._id}>
                          {company.name}
                        </MenuItem>
                      ))
                    ) : (
                      // Other users can only see their own company
                      companies.map((company: any) => (
                        <MenuItem key={company._id} value={company._id}>
                          {company.name}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                  {formErrors.company && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                      {formErrors.company}
                    </Typography>
                  )}
                </FormControl>
              </Grid>

              {canAssignTickets() && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Assignee</InputLabel>
                    <Select
                      value={ticketForm.assignee}
                      onChange={(e) => handleFormChange('assignee', e.target.value)}
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
              )}


            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateTicket}
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
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Tickets; 