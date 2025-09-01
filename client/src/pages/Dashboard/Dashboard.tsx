import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  ConfirmationNumber,
  People,
  TrendingUp,
  Schedule,
  CheckCircle,
  Warning,
  Error,
  Add,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from 'react-query';
import { analyticsAPI, ticketsAPI, usersAPI } from '../../services/api';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Live analytics overview (premium/admin)
  const { data: overviewData } = useQuery(
    ['analytics-overview'],
    () => analyticsAPI.getOverview(),
    { refetchOnWindowFocus: false }
  );

  // Critical tickets count (as "urgent")
  const { data: criticalData } = useQuery(
    ['tickets-critical-count'],
    () => ticketsAPI.getAll({ priority: 'critical', page: 1, limit: 1 }),
    { refetchOnWindowFocus: false }
  );

  // Active agents count
  const { data: agentsData } = useQuery(
    ['agents-active-count'],
    () => usersAPI.getAll({ role: 'agent', isActive: true, page: 1, limit: 1 }),
    { refetchOnWindowFocus: false }
  );

  const overview = overviewData?.data?.overview || {};
  const urgentTickets = criticalData?.data?.pagination?.total || 0;
  const activeAgents = agentsData?.data?.pagination?.total || 0;

  const stats = {
    totalTickets: overview.totalTickets || 0,
    openTickets: overview.openTickets || 0,
    resolvedTickets: overview.resolvedTickets || 0,
    urgentTickets,
    totalUsers: undefined as unknown as number,
    activeAgents,
    avgResolutionTime: `${Math.round((overviewData?.data?.resolutionTime?.avgResolutionTime || 0) * 10) / 10}h`,
    slaCompliance: overview.slaCompliance || 0,
  };

  const recentTickets = [
    {
      id: 'TKT-000123',
      title: 'Server connectivity issues',
      status: 'open',
      priority: 'high',
      assignee: 'John Doe',
      createdAt: '2 hours ago',
    },
    {
      id: 'TKT-000122',
      title: 'Email configuration problem',
      status: 'in_progress',
      priority: 'medium',
      assignee: 'Jane Smith',
      createdAt: '4 hours ago',
    },
    {
      id: 'TKT-000121',
      title: 'Database backup failed',
      status: 'resolved',
      priority: 'urgent',
      assignee: 'Mike Johnson',
      createdAt: '1 day ago',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'error';
      case 'in_progress':
        return 'warning';
      case 'resolved':
        return 'success';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Welcome back, {user?.firstName}! 👋
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/tickets/create')}
          sx={{ px: 3 }}
        >
          New Ticket
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <ConfirmationNumber />
                </Avatar>
                <Typography variant="h6" color="text.secondary">
                  Total Tickets
                </Typography>
              </Box>
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                {stats.totalTickets}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {/* Placeholder for growth metric */}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                  <Warning />
                </Avatar>
                <Typography variant="h6" color="text.secondary">
                  Open Tickets
                </Typography>
              </Box>
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                {stats.openTickets}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stats.urgentTickets} urgent
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                  <CheckCircle />
                </Avatar>
                <Typography variant="h6" color="text.secondary">
                  Resolved
                </Typography>
              </Box>
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                {stats.resolvedTickets}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg: {stats.avgResolutionTime}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                  <People />
                </Avatar>
                <Typography variant="h6" color="text.secondary">
                  Active Agents
                </Typography>
              </Box>
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                {stats.activeAgents}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {/* Could show total users when needed */}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* SLA Compliance */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            SLA Compliance
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="h4" sx={{ mr: 2, fontWeight: 'bold' }}>
              {stats.slaCompliance}%
            </Typography>
            <Chip
              label={stats.slaCompliance >= 95 ? 'On Track' : 'Needs Attention'}
              color={stats.slaCompliance >= 95 ? 'success' : 'warning'}
              size="small"
            />
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, Math.max(0, stats.slaCompliance))}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Target: 95% | Current: {stats.slaCompliance}%
          </Typography>
        </CardContent>
      </Card>

      {/* Recent Tickets */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Recent Tickets
                </Typography>
                <Button
                  variant="text"
                  onClick={() => navigate('/tickets')}
                  size="small"
                >
                  View All
                </Button>
              </Box>
              <List>
                {recentTickets.map((ticket, index) => (
                  <React.Fragment key={ticket.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <ConfirmationNumber />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                              {ticket.id}
                            </Typography>
                            <Typography variant="body2">
                              {ticket.title}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Chip
                              label={ticket.status}
                              size="small"
                              color={getStatusColor(ticket.status) as any}
                            />
                            <Chip
                              label={ticket.priority}
                              size="small"
                              color={getPriorityColor(ticket.priority) as any}
                            />
                            <Typography variant="caption" color="text.secondary">
                              • {ticket.assignee} • {ticket.createdAt}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < recentTickets.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate('/tickets/create')}
                  startIcon={<Add />}
                >
                  Create Ticket
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate('/tickets')}
                  startIcon={<ConfirmationNumber />}
                >
                  View Tickets
                </Button>
                {['admin', 'manager'].includes(user?.role || '') && (
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate('/users')}
                    startIcon={<People />}
                  >
                    Manage Users
                  </Button>
                )}
                {['premium', 'enterprise'].includes(user?.subscription || '') && (
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate('/analytics')}
                    startIcon={<TrendingUp />}
                  >
                    View Analytics
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 