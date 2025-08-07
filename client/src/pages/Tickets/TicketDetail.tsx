import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  TextField,
  Avatar,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Delete,
  Send,
  Visibility,
  VisibilityOff,
  Assignment,
  Schedule,
  Business,
  Person
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { ticketsAPI, commentsAPI, usersAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface Comment {
  _id: string;
  content: string;
  author: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
  isInternal: boolean;
  createdAt: string;
}

const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [commentFilter, setCommentFilter] = useState<'all' | 'user' | 'system'>('all');
  const [editData, setEditData] = useState({
    status: '',
    priority: '',
    category: '',
    assignee: ''
  });

  // Fetch ticket details
  const { data: ticketData, isLoading: ticketLoading } = useQuery(
    ['ticket', id],
    () => ticketsAPI.getById(id!),
    { enabled: !!id }
  );

  // Fetch comments
  const { data: commentsData, isLoading: commentsLoading } = useQuery(
    ['comments', id],
    () => commentsAPI.getForTicket(id!),
    { enabled: !!id }
  );

  // Fetch users for assignment
  const { data: usersData } = useQuery(
    'users-for-tickets',
    () => usersAPI.getForTickets(),
    { enabled: !!id }
  );

  // Mutations
  const createCommentMutation = useMutation(
    (commentData: any) => commentsAPI.create(commentData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['comments', id]);
        setNewComment('');
        setIsInternal(false);
        toast.success('Comment added successfully');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to add comment');
      },
    }
  );

  const updateTicketMutation = useMutation(
    (data: any) => ticketsAPI.update(id!, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['ticket', id]);
        queryClient.invalidateQueries(['comments', id]);
        setShowEditDialog(false);
        toast.success('Ticket updated successfully');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update ticket');
      },
    }
  );

  const ticket = ticketData?.data;
  const comments = commentsData?.data?.comments || [];
  const users = usersData?.data?.users || [];

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    createCommentMutation.mutate({
      ticketId: id,
      content: newComment,
      isInternal
    });
  };

  const handleEditTicket = () => {
    if (ticket) {
      setEditData({
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        assignee: ticket.assignee?._id || ''
      });
      setShowEditDialog(true);
    }
  };

  const handleUpdateTicket = () => {
    // Check if there are actual changes
    const hasChanges = 
      editData.status !== ticket?.status ||
      editData.priority !== ticket?.priority ||
      editData.category !== ticket?.category ||
      editData.assignee !== (ticket?.assignee?._id || '');
    
    if (!hasChanges) {
      toast.error('No changes detected');
      return;
    }
    
    updateTicketMutation.mutate(editData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'default';
      case 'in_progress': return 'primary';
      case 'resolved': return 'success';
      case 'closed': return 'secondary';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  const canEditTicket = () => {
    if (!ticket || !user) return false;
    return user.role === 'admin' || 
           user.role === 'manager' || 
           ticket.assignee?._id === user.id ||
           ticket.reporter._id === user.id;
  };

  const canCreateInternalComments = () => {
    return ['admin', 'manager', 'agent'].includes(user?.role || '');
  };

  const filteredComments = comments.filter((comment: Comment) => {
    if (commentFilter === 'all') return true;
    if (commentFilter === 'user') return !comment.content.startsWith('**');
    if (commentFilter === 'system') return comment.content.startsWith('**');
    return true;
  });

  if (ticketLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!ticket) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Ticket not found</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/tickets')}
          sx={{ mr: 2 }}
        >
          Back to Tickets
        </Button>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
          {ticket.ticketNumber}
        </Typography>
        {canEditTicket() && (
          <Button
            variant="outlined"
            startIcon={<Edit />}
            onClick={handleEditTicket}
          >
            Edit Ticket
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Ticket Details */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                {ticket.title}
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {ticket.description}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip 
                  label={ticket.status.toUpperCase()} 
                  color={getStatusColor(ticket.status)}
                  size="small"
                />
                <Chip 
                  label={ticket.priority.toUpperCase()} 
                  color={getPriorityColor(ticket.priority)}
                  size="small"
                />
                <Chip 
                  label={ticket.category.replace('_', ' ').toUpperCase()} 
                  variant="outlined"
                  size="small"
                />
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Person sx={{ mr: 1, fontSize: 16 }} />
                    <Typography variant="body2" color="text.secondary">
                      Reporter: {ticket.reporter.firstName} {ticket.reporter.lastName}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Assignment sx={{ mr: 1, fontSize: 16 }} />
                    <Typography variant="body2" color="text.secondary">
                      Assignee: {ticket.assignee ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}` : 'Unassigned'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Business sx={{ mr: 1, fontSize: 16 }} />
                    <Typography variant="body2" color="text.secondary">
                      Company: {ticket.company.name}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Schedule sx={{ mr: 1, fontSize: 16 }} />
                    <Typography variant="body2" color="text.secondary">
                      Created: {new Date(ticket.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Comments ({filteredComments.length})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant={commentFilter === 'all' ? 'contained' : 'outlined'}
                    onClick={() => setCommentFilter('all')}
                  >
                    All
                  </Button>
                  <Button
                    size="small"
                    variant={commentFilter === 'user' ? 'contained' : 'outlined'}
                    onClick={() => setCommentFilter('user')}
                  >
                    User
                  </Button>
                  <Button
                    size="small"
                    variant={commentFilter === 'system' ? 'contained' : 'outlined'}
                    onClick={() => setCommentFilter('system')}
                  >
                    System
                  </Button>
                </Box>
              </Box>

              {/* Add Comment */}
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {canCreateInternalComments() && (
                      <Button
                        size="small"
                        startIcon={isInternal ? <VisibilityOff /> : <Visibility />}
                        onClick={() => setIsInternal(!isInternal)}
                                                 color={isInternal ? 'warning' : 'inherit'}
                        variant={isInternal ? 'contained' : 'outlined'}
                      >
                        {isInternal ? 'Internal' : 'Public'}
                      </Button>
                    )}
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={<Send />}
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || createCommentMutation.isLoading}
                  >
                    {createCommentMutation.isLoading ? 'Adding...' : 'Add Comment'}
                  </Button>
                </Box>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Comments List */}
              {commentsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress />
                </Box>
              ) : filteredComments.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No comments yet
                </Typography>
              ) : (
                <Box>
                  {filteredComments.map((comment: Comment) => (
                    <Box key={comment._id} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                        <Avatar sx={{ mr: 1, width: 32, height: 32 }}>
                          {comment.author.firstName[0]}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                                                     <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                             <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                               {comment.author.firstName} {comment.author.lastName}
                             </Typography>
                             {comment.isInternal && (
                               <Chip 
                                 label="Internal" 
                                 size="small" 
                                 color="warning" 
                                 sx={{ ml: 1 }}
                               />
                             )}
                             {comment.content.startsWith('**System Update:**') && (
                               <Chip 
                                 label="System" 
                                 size="small" 
                                 color="info" 
                                 sx={{ ml: 1 }}
                               />
                             )}
                             {comment.content.startsWith('**Ticket Created:**') && (
                               <Chip 
                                 label="Created" 
                                 size="small" 
                                 color="success" 
                                 sx={{ ml: 1 }}
                               />
                             )}
                             <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                               {new Date(comment.createdAt).toLocaleString()}
                             </Typography>
                           </Box>
                           <Typography 
                             variant="body2" 
                             sx={{ 
                               whiteSpace: 'pre-wrap',
                               ...(comment.content.startsWith('**') && {
                                 fontStyle: 'italic',
                                 color: 'text.secondary'
                               })
                             }}
                           >
                             {comment.content}
                           </Typography>
                        </Box>
                      </Box>
                      <Divider />
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Ticket Info
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Chip 
                  label={ticket.status.toUpperCase()} 
                  color={getStatusColor(ticket.status)}
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Priority
                </Typography>
                <Chip 
                  label={ticket.priority.toUpperCase()} 
                  color={getPriorityColor(ticket.priority)}
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Category
                </Typography>
                <Chip 
                  label={ticket.category.replace('_', ' ').toUpperCase()} 
                  variant="outlined"
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Assignee
                </Typography>
                <Typography variant="body2">
                  {ticket.assignee ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}` : 'Unassigned'}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Company
                </Typography>
                <Typography variant="body2">
                  {ticket.company.name}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Created
                </Typography>
                <Typography variant="body2">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </Typography>
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Activity
                </Typography>
                <Typography variant="body2">
                  {comments.length} comments
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Last updated: {new Date(ticket.updatedAt).toLocaleDateString()}
                </Typography>
                
                {/* Recent changes */}
                {comments.filter((c: Comment) => c.content.startsWith('**')).slice(0, 3).map((comment: Comment) => (
                  <Box key={comment._id} sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                      {comment.content.replace('**System Update:**', '').replace('**Ticket Created:**', '')}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Ticket Dialog */}
      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Ticket</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={editData.status}
                  onChange={(e) => setEditData(prev => ({ ...prev, status: e.target.value }))}
                  label="Status"
                >
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={editData.priority}
                  onChange={(e) => setEditData(prev => ({ ...prev, priority: e.target.value }))}
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
                  value={editData.category}
                  onChange={(e) => setEditData(prev => ({ ...prev, category: e.target.value }))}
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
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Assignee</InputLabel>
                <Select
                  value={editData.assignee}
                  onChange={(e) => setEditData(prev => ({ ...prev, assignee: e.target.value }))}
                  label="Assignee"
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {users.map((user: any) => (
                    <MenuItem key={user._id} value={user._id}>
                      {user.firstName} {user.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleUpdateTicket}
            disabled={updateTicketMutation.isLoading}
          >
            {updateTicketMutation.isLoading ? 'Updating...' : 'Update Ticket'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TicketDetail; 