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
  CircularProgress,
  List,
  ListItem,
  ListItemText
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
import { invoicesAPI } from '../../services/api';
import { attachmentsAPI } from '../../services/api';
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const [editData, setEditData] = useState({
    status: '',
    priority: '',
    category: '',
    assignee: ''
  });
  
  // Reopen request state
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  // Fetch ticket details
  const { data: ticketData, isLoading: ticketLoading } = useQuery(
    ['ticket', id],
    () => ticketsAPI.getById(id!),
    { enabled: !!id }
  );

  // Fetch comments
  const { data: commentsData, isLoading: commentsLoading } = useQuery(
    ['comments', id],
    () => ticketsAPI.getComments(id!),
    { enabled: !!id }
  );

  // Fetch users for assignment
  const { data: usersData } = useQuery(
    'users-for-tickets',
    () => usersAPI.getForTickets(),
    { enabled: !!id }
  );

  // Fetch reopen requests
  const { data: reopenRequestsData } = useQuery(
    ['reopen-requests', id],
    () => ticketsAPI.getReopenRequests(id!),
    { enabled: !!id }
  );

  // Mutations
  const createCommentMutation = useMutation(
    (commentData: any) => commentsAPI.create(commentData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['comments', id]);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to create comment');
      },
    }
  );

  // Reopen request mutations
  const requestReopenMutation = useMutation(
    (reason: string) => ticketsAPI.requestReopen(id!, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['reopen-requests', id]);
        queryClient.invalidateQueries(['ticket', id]);
        toast.success('Reopen request submitted successfully');
        setShowReopenDialog(false);
        setReopenReason('');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to submit reopen request');
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
  const attachments: any[] = ticket?.attachments || [];
  const comments = commentsData?.data?.comments || [];
  const users = usersData?.data?.users || [];
  const reopenRequests = reopenRequestsData?.data?.reopenRequests || [];
  const canRequestReopen = reopenRequestsData?.data?.canRequestReopen || false;

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const canCreateInternal = canCreateInternalComments();
    commentsAPI.create({ 
      ticketId: id!, 
      content: newComment, 
      isInternal: canCreateInternal ? isInternal : false, 
      file: pendingFile || undefined 
    }).then(() => {
      queryClient.invalidateQueries(['comments', id]);
      setNewComment('');
      setIsInternal(false);
      setPendingFile(null);
      toast.success('Comment added successfully');
    }).catch((error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add comment');
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

  const handleRequestReopen = () => {
    if (!reopenReason.trim()) {
      toast.error('Please provide a reason for reopening');
      return;
    }
    
    requestReopenMutation.mutate(reopenReason);
  };

  const handleCloseTicket = () => {
    if (user?.role === 'admin') {
      // Admin can close directly
      if (window.confirm('Are you sure you want to close this ticket?')) {
        updateTicketMutation.mutate({ status: 'closed' });
      }
    } else {
      // Others need explanation
      setShowCloseDialog(true);
    }
  };

  const handleCloseWithReason = () => {
    if (!closeReason.trim()) {
      toast.error('Please provide a reason for closing');
      return;
    }
    
    // Add close reason as comment (internal only if user is staff), then close
    const isStaff = ['admin', 'manager', 'agent'].includes(user?.role || '');
    ticketsAPI.addComment(id!, `**Ticket Closed:** ${closeReason}`, isStaff).then(() => {
      updateTicketMutation.mutate({ status: 'closed' });
      setShowCloseDialog(false);
      setCloseReason('');
    }).catch((error: any) => {
      toast.error(error.response?.data?.message || 'Failed to close ticket');
    });
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

  const canCloseTicket = () => {
    if (!ticket || !user) return false;
    
    // Admin and managers can always close tickets
    if (['admin', 'manager'].includes(user.role)) {
      return true;
    }
    
    // Agents can close tickets if assigned
    if (user.role === 'agent') {
      return ticket.assignee?._id === user.id;
    }
    
    // Users can close their own tickets if they're open or in_progress
    if (user.role === 'user') {
      return ticket.reporter._id === user.id && 
             ['open', 'in_progress'].includes(ticket.status);
    }
    
    return false;
  };

  const canEditTicket = () => {
    if (!ticket || !user) return false;
    
    // Admin and managers can always edit
    if (['admin', 'manager'].includes(user.role)) {
      return true;
    }
    
    // Agents can edit if assigned or if ticket is open/in_progress
    if (user.role === 'agent') {
      return ticket.assignee?._id === user.id || 
             ['open', 'in_progress'].includes(ticket.status);
    }
    
    // Users cannot edit tickets (only close them)
    if (user.role === 'user') {
      return false;
    }
    
    return false;
  };

  const canViewTicket = () => {
    if (!ticket || !user) return false;
    
    // Admin and managers can always view
    if (['admin', 'manager'].includes(user.role)) {
      return true;
    }
    
    // Agents can view if assigned or if ticket is open/in_progress
    if (user.role === 'agent') {
      return ticket.assignee?._id === user.id || 
             ['open', 'in_progress'].includes(ticket.status);
    }
    
    // Users can always view their own tickets regardless of status
    if (user.role === 'user') {
      return ticket.reporter._id === user.id;
    }
    
    return false;
  };

  const canAddComments = () => {
    if (!ticket || !user) return false;
    
    // Admin and managers can always add comments
    if (['admin', 'manager'].includes(user.role)) {
      return true;
    }
    
    // Agents can add comments if assigned or if ticket is open/in_progress
    if (user.role === 'agent') {
      return ticket.assignee?._id === user.id || 
             ['open', 'in_progress'].includes(ticket.status);
    }
    
    // Users can add comments to their own tickets if they're not resolved
    if (user.role === 'user') {
      return ticket.reporter._id === user.id && ticket.status !== 'resolved';
    }
    
    return false;
  };

  const canRequestReopenTicket = () => {
    if (!ticket || !user) return false;
    
    // Only users can request reopen for their own closed tickets
    if (user.role === 'user') {
      return ticket.reporter._id === user.id && ticket.status === 'closed';
    }
    
    return false;
  };

  const canCreateInternalComments = () => {
    return ['admin', 'manager', 'agent'].includes(user?.role || '');
  };



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
        {canRequestReopenTicket() && (
          <Button
            variant="outlined"
            color="warning"
            onClick={() => setShowReopenDialog(true)}
            sx={{ mr: 1 }}
          >
            Request Reopen
          </Button>
        )}
      </Box>


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

          {/* Quick Actions */}
          {(canCloseTicket() || ['admin', 'manager'].includes(user?.role || '')) && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Quick Actions
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {['admin', 'manager'].includes(user?.role || '') && (
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={handleEditTicket}
                  >
                    Edit Ticket
                  </Button>
                  )}
                  {canCloseTicket() && ticket.status !== 'closed' ? (
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={handleCloseTicket}
                    >
                      Close Ticket
                    </Button>
                  ) : user?.role === 'admin' && ticket.status === 'closed' && (
                    <Button
                      variant="outlined"
                      color="success"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to reopen this ticket?')) {
                          updateTicketMutation.mutate({ status: 'open' });
                        }
                      }}
                    >
                      Reopen Ticket
                    </Button>
                  )}
                  {['admin', 'manager'].includes(user?.role || '') && (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={async () => {
                        try {
                                                     const defaultRate = (ticket.company as any)?.billing?.hourlyRate ?? 50;
                           const defaultCurrency = ((ticket.company as any)?.billing?.currency ?? 'EUR').toUpperCase();
                           const rateStr = prompt('Enter hourly rate (e.g., 50):', String(defaultRate));
                           if (rateStr === null) return;
                           const rate = Number(rateStr);
                           if (Number.isNaN(rate) || rate < 0) {
                             toast.error('Invalid rate');
                             return;
                           }
                           const currency = (prompt('Enter currency (ISO, e.g., EUR):', defaultCurrency) || defaultCurrency).toUpperCase();
                          const taxStr = prompt('Enter tax percent (e.g., 20) or leave blank:', '');
                          const taxPercent = taxStr ? Number(taxStr) : 0;
                          const recipient = prompt('Recipient email (leave empty to use company email):', '') || undefined;
                          await invoicesAPI.createForTicket({ ticketId: id!, rate, currency, taxPercent, recipientEmail: recipient });
                          toast.success('Invoice generated and sent');
                        } catch (err: any) {
                          toast.error(err.response?.data?.message || 'Failed to generate invoice');
                        }
                      }}
                    >
                      Generate & Send Invoice
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Reopen Request Button */}
          {canRequestReopenTicket() && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Ticket Actions
                </Typography>
                <Button
                  fullWidth
                  variant="outlined"
                  color="warning"
                  onClick={() => setShowReopenDialog(true)}
                >
                  Request Reopen
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Comments ({comments.length})
                </Typography>
              </Box>

              {/* Add Comment */}
              {canAddComments() && (
                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Write a reply..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    sx={{ mb: 1 }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                      <input
                        id="comment-file-input"
                        type="file"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            toast.error('File too large. Max 2MB');
                            e.currentTarget.value = '';
                            return;
                          }
                          setPendingFile(file);
                        }}
                      />
                      <Button size="small" variant="outlined" onClick={() => document.getElementById('comment-file-input')?.click()}>
                        {pendingFile ? `Attached: ${pendingFile.name}` : 'Attach File (max 2MB)'}
                      </Button>
                    </Box>
                    <Button
                      variant="contained"
                      startIcon={<Send />}
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                    >
                      Reply
                    </Button>
                  </Box>
                </Box>
              )}

              <Divider sx={{ mb: 2 }} />

              {/* Comments List */}
              {commentsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress />
                </Box>
              ) : comments.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No comments yet
                </Typography>
              ) : (
                <Box>
                  {comments.map((comment: Comment) => (
                    <Box key={comment._id} sx={{ mb: 2 }}>
                      {comment.content.startsWith('**') ? (
                        // Sistem poruke - bez avatara, bele pozadine
                        <Box sx={{ 
                          p: 2, 
                          bgcolor: 'white', 
                          borderRadius: 1, 
                          border: '1px solid',
                          borderColor: 'grey.200'
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            {comment.content.startsWith('**System Update:**') && (
                              <Chip 
                                label="System" 
                                size="small" 
                                color="info" 
                                sx={{ mr: 1 }}
                              />
                            )}
                            {comment.content.startsWith('**Ticket Created:**') && (
                              <Chip 
                                label="Created" 
                                size="small" 
                                color="success" 
                                sx={{ mr: 1 }}
                              />
                            )}
                            {comment.content.startsWith('**Ticket Closed:**') && (
                              <Chip 
                                label="Closed" 
                                size="small" 
                                color="error" 
                                sx={{ mr: 1 }}
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
                              color: 'text.secondary',
                              fontStyle: 'italic',
                              fontSize: '0.875rem'
                            }}
                          >
                            {comment.content.replace('**System Update:**', '').replace('**Ticket Created:**', '').replace('**Ticket Closed:**', '')}
                          </Typography>
                        </Box>
                      ) : (
                        // Obične poruke - sa avatarom, sive pozadine
                        <Box sx={{ 
                          p: 2, 
                          bgcolor: 'grey.50', 
                          borderRadius: 1, 
                          border: '1px solid',
                          borderColor: 'grey.200'
                        }}>
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
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                  {new Date(comment.createdAt).toLocaleString()}
                                </Typography>
                              </Box>
                              <Typography 
                                variant="body2" 
                                sx={{ whiteSpace: 'pre-wrap' }}
                              >
                                {comment.content}
                              </Typography>
                              {/* Comment attachments */}
                              {(comment as any).attachments?.length > 0 && (
                                <Box sx={{ mt: 1 }}>
                                  {(comment as any).attachments.map((att: any) => (
                                    <Button
                                      key={att.filename}
                                      size="small"
                                      variant="outlined"
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      sx={{ mr: 1, mt: 0.5 }}
                                    >
                                      📎 {att.originalName || att.filename}
                                    </Button>
                                  ))}
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      )}
                      <Divider />
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>




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

      {/* Reopen Request Dialog */}
      <Dialog open={showReopenDialog} onClose={() => setShowReopenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Request Ticket Reopen</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please provide a detailed reason why you want this ticket to be reopened. 
            An admin will review your request.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Reason for reopening"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="Please explain why this ticket should be reopened..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowReopenDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="warning"
            onClick={handleRequestReopen}
            disabled={requestReopenMutation.isLoading}
          >
            {requestReopenMutation.isLoading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Close Ticket Dialog */}
      <Dialog open={showCloseDialog} onClose={() => setShowCloseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Close Ticket</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please provide a reason for closing this ticket.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Reason for closing"
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="Explain why this ticket is being closed..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCloseDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={handleCloseWithReason}
            disabled={updateTicketMutation.isLoading}
          >
            {updateTicketMutation.isLoading ? 'Closing...' : 'Close Ticket'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TicketDetail; 