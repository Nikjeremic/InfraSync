const express = require('express');
const { body, validationResult, query } = require('express-validator');
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Company = require('../models/Company');
const { auth, requireRole, requirePermission } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createNotification } = require('./notifications');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer storage and limits
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${unique}-${safeOriginal}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// @route   GET /api/tickets
// @desc    Get all tickets with filtering and pagination
// @access  Private
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
  query('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  query('category').optional().isIn(['technical', 'billing', 'feature_request', 'bug_report', 'general']),
  query('assignee').optional().isMongoId(),
  query('search').optional().isString(),
  query('company').optional().isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      page = 1,
      limit = 20,
      status,
      priority,
      category,
      assignee,
      search,
      company,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (assignee) filter.assignee = assignee;
    if (company) filter.company = company;

    // Search functionality
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { ticketNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const tickets = await Ticket.find(filter)
      .populate('reporter', 'firstName lastName email')
      .populate('assignee', 'firstName lastName email')
      .populate('company', 'name')
      .populate('escalatedTo', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Update SLA status for each ticket
    for (let ticket of tickets) {
      if (ticket.status !== 'closed' && ticket.status !== 'resolved') {
        const now = new Date();
        const elapsedHours = (now - new Date(ticket.sla.startTime)) / (1000 * 60 * 60);
        ticket.sla.isBreached = elapsedHours > ticket.sla.targetTime;
      }
    }

    const total = await Ticket.countDocuments(filter);

    res.json({
      tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tickets/:id/attachments
// @desc    Upload attachment to ticket (max 2MB)
// @access  Private
router.post('/:id/attachments', auth, upload.single('file'), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const fileMeta = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`,
      uploadedBy: req.user.id,
    };

    ticket.attachments.push(fileMeta);
    await ticket.save();

    res.status(201).json(fileMeta);
  } catch (error) {
    console.error('Upload attachment error:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Max 2MB' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tickets/:id
// @desc    Get ticket by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('reporter', 'firstName lastName email')
      .populate('assignee', 'firstName lastName email')
      .populate('company', 'name')
      .populate('escalatedTo', 'firstName lastName email')
      .populate('watchers', 'firstName lastName email')
      .populate('timeEntries.user', 'firstName lastName email')
      .populate('internalNotes.author', 'firstName lastName email')
      .populate('relatedTickets', 'ticketNumber title status priority')
      .populate('escalationHistory.escalatedTo', 'firstName lastName email');

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Update SLA status
    if (ticket.status !== 'closed' && ticket.status !== 'resolved') {
      const now = new Date();
      const elapsedHours = (now - ticket.sla.startTime) / (1000 * 60 * 60);
      ticket.sla.isBreached = elapsedHours > ticket.sla.targetTime;
    }

    res.json(ticket);
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tickets
// @desc    Create a new ticket
// @access  Private (Admin, Manager, Agent, User)
router.post('/', auth, requireRole(['admin', 'manager', 'agent', 'user']), [
  body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('priority').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('category').isIn(['technical', 'billing', 'feature_request', 'bug_report', 'general']).withMessage('Invalid category'),
  body('assignee').optional().isMongoId().withMessage('Invalid assignee ID'),
  body('company').isMongoId().withMessage('Invalid company ID')
], async (req, res) => {
  try {
    console.log('Received ticket data:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      priority,
      category,
      assignee,
      company
    } = req.body;

    // Check if company exists
    const companyExists = await Company.findById(company);
    if (!companyExists) {
      return res.status(400).json({ message: 'Company not found' });
    }

    // Role-based restrictions
    const userRole = req.user.role;
    
    // Only admins and managers can assign tickets to others
    if (assignee && !['admin', 'manager'].includes(userRole)) {
      return res.status(403).json({ message: 'Only admins and managers can assign tickets to others' });
    }
    
    // Check if assignee exists and is an agent
    if (assignee) {
      const assigneeExists = await User.findById(assignee);
      if (!assigneeExists || !['agent', 'manager', 'admin'].includes(assigneeExists.role)) {
        return res.status(400).json({ message: 'Invalid assignee' });
      }
    }
    
    // Non-admin users must be associated with a company
    if (userRole !== 'admin') {
      if (!req.user.company) {
        return res.status(403).json({ 
          message: 'You must be associated with a company to create tickets' 
        });
      }
      
      // Non-admin users can only create tickets for their own company
      if (req.user.company.toString() !== company) {
        return res.status(403).json({ 
          message: 'You can only create tickets for your own company' 
        });
      }
    }

    const ticket = new Ticket({
      title,
      description,
      priority,
      category,
      assignee,
      reporter: req.user.id,
      company
    });

    await ticket.save();

    // Populate ticket for response
    await ticket.populate('reporter', 'firstName lastName email');
    await ticket.populate('assignee', 'firstName lastName email');
    await ticket.populate('company', 'name');

    // Create auto-comment for ticket creation
    const Comment = require('../models/Comment');
    const creationComment = new Comment({
      ticket: ticket._id,
      author: req.user.id,
      content: `**Ticket Created:** Ticket created by ${req.user.firstName} ${req.user.lastName}`,
      isInternal: false
    });
    await creationComment.save();

    // Create notification for assignee
    if (assignee) {
      await createNotification(assignee, 'ticket_assigned', 'New ticket assigned', `You have been assigned to ticket ${ticket.ticketNumber}`, { ticketId: ticket._id });
    }

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tickets/:id
// @desc    Update a ticket
// @access  Private
router.put('/:id', auth, [
  body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']).withMessage('Invalid status'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('category').optional().isIn(['technical', 'billing', 'feature_request', 'bug_report', 'general']).withMessage('Invalid category'),
  body('assignee').optional().isMongoId().withMessage('Invalid assignee ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check permissions for different types of updates
    const isStatusUpdate = req.body.status !== undefined;
    const isOtherUpdate = req.body.priority !== undefined || 
                         req.body.category !== undefined || 
                         req.body.assignee !== undefined;
    
    // For status updates (like closing tickets), check if user can close
    if (isStatusUpdate && !ticket.canUserClose(req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Not authorized to change ticket status' });
    }
    
    // For other updates, check if user can edit
    if (isOtherUpdate && !ticket.canUserEdit(req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Not authorized to edit this ticket' });
    }

    // Track changes for auto-comments
    const changes = [];
    
    // Handle status changes
    if (req.body.status && req.body.status !== ticket.status) {
      changes.push(`Status changed from ${ticket.status} to ${req.body.status}`);
      
      // Special handling for resolved/closed status
      if (req.body.status === 'resolved' || req.body.status === 'closed') {
        changes.push(`Ticket ${req.body.status} by ${req.user.firstName} ${req.user.lastName}`);
      }
    }
    
    // Handle priority changes
    if (req.body.priority && req.body.priority !== ticket.priority) {
      changes.push(`Priority changed from ${ticket.priority} to ${req.body.priority}`);
    }
    
    // Handle category changes
    if (req.body.category && req.body.category !== ticket.category) {
      changes.push(`Category changed from ${ticket.category} to ${req.body.category}`);
    }
    
    // Handle assignee changes
    if (req.body.assignee !== undefined && req.body.assignee !== ticket.assignee?.toString()) {
      if (req.body.assignee) {
        const assigneeExists = await User.findById(req.body.assignee);
        if (!assigneeExists || !['agent', 'manager', 'admin'].includes(assigneeExists.role)) {
          return res.status(400).json({ message: 'Invalid assignee' });
        }

        // Create notification for new assignee
        await createNotification(req.body.assignee, 'ticket_assigned', 'Ticket assigned to you', `You have been assigned to ticket ${ticket.ticketNumber}`, { ticketId: ticket._id });
        
        changes.push(`Ticket assigned to ${assigneeExists.firstName} ${assigneeExists.lastName}`);
      } else {
        changes.push('Ticket unassigned');
      }
    }

    // Update only allowed fields
    const updateData = {};
    if (req.body.status) updateData.status = req.body.status;
    if (req.body.priority) updateData.priority = req.body.priority;
    if (req.body.category) updateData.category = req.body.category;
    if (req.body.assignee !== undefined) updateData.assignee = req.body.assignee || null;

    const updatedTicket = await Ticket.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('reporter', 'firstName lastName email')
    .populate('assignee', 'firstName lastName email')
    .populate('company', 'name');

    // Create auto-comments for changes
    if (changes.length > 0) {
      const Comment = require('../models/Comment');
      const changeMessage = changes.join(', ');
      
      const autoComment = new Comment({
        ticket: req.params.id,
        author: req.user.id,
        content: `**System Update:** ${changeMessage}`,
        isInternal: false
      });
      
      await autoComment.save();
    }

    res.json(updatedTicket);
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/tickets/:id
// @desc    Delete a ticket
// @access  Private (Admin/Manager only)
router.delete('/:id', auth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tickets/:id/time-entries
// @desc    Add time entry to ticket
// @access  Private
router.post('/:id/time-entries', auth, [
  body('description').trim().isLength({ min: 3 }).withMessage('Description must be at least 3 characters'),
  body('startTime').isISO8601().withMessage('Invalid start time'),
  body('endTime').optional().isISO8601().withMessage('Invalid end time'),
  body('duration').optional().isInt({ min: 0 }).withMessage('Duration must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const { description, startTime, endTime, duration } = req.body;

    const timeEntry = {
      description,
      startTime: new Date(startTime),
      user: req.user.id,
      isActive: false
    };

    if (endTime) {
      timeEntry.endTime = new Date(endTime);
      timeEntry.duration = duration || Math.round((timeEntry.endTime - timeEntry.startTime) / (1000 * 60));
    }

    ticket.timeEntries.push(timeEntry);
    ticket.actualTime = ticket.timeEntries.reduce((total, entry) => total + (entry.duration || 0), 0);
    await ticket.save();

    await ticket.populate('timeEntries.user', 'firstName lastName email');
    
    res.json(ticket.timeEntries[ticket.timeEntries.length - 1]);
  } catch (error) {
    console.error('Add time entry error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tickets/:id/start-tracking
// @desc    Start time tracking for a ticket
// @access  Private
router.post('/:id/start-tracking', auth, [
  body('description').trim().isLength({ min: 3 }).withMessage('Description must be at least 3 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    await ticket.startTimeTracking(req.user.id, req.body.description);
    await ticket.populate('timeEntries.user', 'firstName lastName email');

    res.json({ message: 'Time tracking started', activeEntry: ticket.activeTimeEntry });
  } catch (error) {
    console.error('Start tracking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tickets/:id/stop-tracking
// @desc    Stop time tracking for a ticket
// @access  Private
router.post('/:id/stop-tracking', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    await ticket.stopTimeTracking();
    await ticket.populate('timeEntries.user', 'firstName lastName email');

    res.json({ message: 'Time tracking stopped', totalTime: ticket.actualTime });
  } catch (error) {
    console.error('Stop tracking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tickets/:id/escalate
// @desc    Escalate a ticket
// @access  Private (Agent/Manager/Admin only)
router.post('/:id/escalate', auth, requireRole(['agent', 'manager', 'admin']), [
  body('reason').trim().isLength({ min: 5 }).withMessage('Reason must be at least 5 characters'),
  body('escalatedTo').isMongoId().withMessage('Invalid user ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const { reason, escalatedTo } = req.body;

    // Check if escalated user exists and is an agent/manager/admin
    const escalatedUser = await User.findById(escalatedTo);
    if (!escalatedUser || !['agent', 'manager', 'admin'].includes(escalatedUser.role)) {
      return res.status(400).json({ message: 'Invalid user for escalation' });
    }

    await ticket.escalate(escalatedTo, reason);

    // Create notification for escalated user
    await createNotification(escalatedTo, 'ticket_escalated', 'Ticket escalated to you', `Ticket ${ticket.ticketNumber} has been escalated to you`, { ticketId: ticket._id });

    res.json({ message: 'Ticket escalated successfully', escalationLevel: ticket.escalationLevel });
  } catch (error) {
    console.error('Escalate ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tickets/:id/watch
// @desc    Add user as watcher
// @access  Private
router.post('/:id/watch', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    await ticket.addWatcher(req.user.id);
    res.json({ message: 'Added as watcher' });
  } catch (error) {
    console.error('Add watcher error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/tickets/:id/watch
// @desc    Remove user as watcher
// @access  Private
router.delete('/:id/watch', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    await ticket.removeWatcher(req.user.id);
    res.json({ message: 'Removed as watcher' });
  } catch (error) {
    console.error('Remove watcher error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tickets/:id/internal-notes
// @desc    Add internal note to ticket
// @access  Private (Agent/Manager/Admin only)
router.post('/:id/internal-notes', auth, requireRole(['agent', 'manager', 'admin']), [
  body('content').trim().isLength({ min: 3 }).withMessage('Note content must be at least 3 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const note = {
      content: req.body.content,
      author: req.user.id,
      createdAt: new Date()
    };

    ticket.internalNotes.push(note);
    await ticket.save();

    await ticket.populate('internalNotes.author', 'firstName lastName email');
    
    res.json(ticket.internalNotes[ticket.internalNotes.length - 1]);
  } catch (error) {
    console.error('Add internal note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tickets/:id/reopen-request
// @desc    Request ticket reopen (for users only)
// @access  Private
router.post('/:id/reopen-request', auth, [
  body('reason').trim().isLength({ min: 10 }).withMessage('Reason must be at least 10 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check if user can request reopen
    if (!ticket.canUserRequestReopen(req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'You cannot request reopen for this ticket' });
    }

    await ticket.requestReopen(req.user.id, req.body.reason);
    
    // Populate user info for response
    await ticket.populate('reopenRequests.requestedBy', 'firstName lastName email');
    
    res.json({ 
      message: 'Reopen request submitted successfully',
      request: ticket.reopenRequests[ticket.reopenRequests.length - 1]
    });
  } catch (error) {
    console.error('Reopen request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tickets/:id/reopen-request/:requestId/approve
// @desc    Approve reopen request (admin only)
// @access  Private (Admin/Manager only)
router.put('/:id/reopen-request/:requestId/approve', auth, requireRole(['admin', 'manager']), [
  body('reviewNote').optional().trim()
], async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    await ticket.approveReopen(req.user.id, req.params.requestId, req.body.reviewNote || '');
    
    res.json({ 
      message: 'Ticket reopened successfully',
      ticket: {
        id: ticket._id,
        status: ticket.status,
        reopenRequests: ticket.reopenRequests
      }
    });
  } catch (error) {
    console.error('Approve reopen error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tickets/:id/reopen-request/:requestId/reject
// @desc    Reject reopen request (admin only)
// @access  Private (Admin/Manager only)
router.put('/:id/reopen-request/:requestId/reject', auth, requireRole(['admin', 'manager']), [
  body('reviewNote').optional().trim()
], async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    await ticket.rejectReopen(req.user.id, req.params.requestId, req.body.reviewNote || '');
    
    res.json({ 
      message: 'Reopen request rejected',
      ticket: {
        id: ticket._id,
        status: ticket.status,
        reopenRequests: ticket.reopenRequests
      }
    });
  } catch (error) {
    console.error('Reject reopen error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tickets/:id/reopen-requests
// @desc    Get reopen requests for a ticket
// @access  Private
router.get('/:id/reopen-requests', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('reopenRequests.requestedBy', 'firstName lastName email')
      .populate('reopenRequests.reviewedBy', 'firstName lastName email');
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.json({
      reopenRequests: ticket.reopenRequests,
      canRequestReopen: ticket.canUserRequestReopen(req.user.id, req.user.role)
    });
  } catch (error) {
    console.error('Get reopen requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tickets/reopen-requests/all
// @desc    Get all pending reopen requests (admin only)
// @access  Private (admin only)
router.get('/reopen-requests/all', auth, requireRole(['admin']), async (req, res) => {
  try {
    const tickets = await Ticket.find({
      'reopenRequests.status': 'pending'
    })
    .populate('reporter', 'firstName lastName email')
    .populate('assignee', 'firstName lastName email')
    .populate('company', 'name')
    .populate('reopenRequests.requestedBy', 'firstName lastName email')
    .sort({ updatedAt: -1 });

    // Flatten reopen requests with ticket info
    const allRequests = [];
    tickets.forEach(ticket => {
      ticket.reopenRequests
        .filter(req => req.status === 'pending')
        .forEach(request => {
          allRequests.push({
            ...request.toObject(),
            ticket: {
              _id: ticket._id,
              title: ticket.title,
              ticketNumber: ticket.ticketNumber,
              status: ticket.status,
              priority: ticket.priority
            }
          });
        });
    });

    res.json({ data: allRequests });
  } catch (error) {
    console.error('Error fetching all reopen requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tickets/reopen-request/:requestId/approve
// @desc    Approve reopen request by requestId (admin only)
// @access  Private (admin only)
router.put('/reopen-request/:requestId/approve', auth, requireRole(['admin']), [
  body('reviewNote').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { requestId } = req.params;
    const { reviewNote } = req.body;

    // Find ticket containing this reopen request
    const ticket = await Ticket.findOne({
      'reopenRequests._id': requestId
    }).populate('reporter', 'firstName lastName email');

    if (!ticket) {
      return res.status(404).json({ message: 'Reopen request not found' });
    }

    const request = ticket.reopenRequests.id(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Reopen request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    // Update request status
    request.status = 'approved';
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    if (reviewNote) request.reviewNote = reviewNote;

    // Reopen the ticket
    ticket.status = 'open';
    ticket.updatedAt = new Date();

    await ticket.save();

    // Create notification for requester
    await createNotification({
      user: request.requestedBy,
      type: 'ticket_reopened',
      title: 'Reopen Request Approved',
      message: `Your request to reopen ticket #${ticket.ticketNumber} has been approved.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
      relatedTicket: ticket._id
    });

    res.json({ message: 'Reopen request approved and ticket reopened' });
  } catch (error) {
    console.error('Error approving reopen request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tickets/reopen-request/:requestId/reject
// @desc    Reject reopen request by requestId (admin only)
// @access  Private (admin only)
router.put('/reopen-request/:requestId/reject', auth, requireRole(['admin']), [
  body('reviewNote').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { requestId } = req.params;
    const { reviewNote } = req.body;

    // Find ticket containing this reopen request
    const ticket = await Ticket.findOne({
      'reopenRequests._id': requestId
    });

    if (!ticket) {
      return res.status(404).json({ message: 'Reopen request not found' });
    }

    const request = ticket.reopenRequests.id(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Reopen request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    // Update request status
    request.status = 'rejected';
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    if (reviewNote) request.reviewNote = reviewNote;

    await ticket.save();

    // Create notification for requester
    await createNotification({
      user: request.requestedBy,
      type: 'reopen_rejected',
      title: 'Reopen Request Rejected',
      message: `Your request to reopen ticket #${ticket.ticketNumber} has been rejected.${reviewNote ? ` Reason: ${reviewNote}` : ''}`,
      relatedTicket: ticket._id
    });

    res.json({ message: 'Reopen request rejected' });
  } catch (error) {
    console.error('Error rejecting reopen request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tickets/:id/comments
// @desc    Get all comments for a ticket
// @access  Private
router.get('/:id/comments', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check if user can view this ticket
    if (!ticket.canUserView(req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const Comment = require('../models/Comment');
    const comments = await Comment.find({ ticket: req.params.id })
      .populate('author', 'firstName lastName email avatar')
      .sort({ createdAt: 1 });

    // Filter internal comments based on user role
    const filteredComments = comments.map(comment => {
      if (comment.isInternal && !['admin', 'manager', 'agent'].includes(req.user.role)) {
        return {
          ...comment.toObject(),
          content: '[Internal Comment - Not Visible]',
          isInternal: true
        };
      }
      return comment;
    });

    res.json({ comments: filteredComments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tickets/:id/comments
// @desc    Add a comment to a ticket (reply functionality)
// @access  Private
router.post('/:id/comments', auth, upload.single('file'), [
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Comment must be between 1 and 2000 characters'),
  body('isInternal').optional().isBoolean().withMessage('isInternal must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, isInternal = false } = req.body;

    // Check if ticket exists
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check if user can add comments to this ticket
    if (!ticket.canUserAddComments(req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only staff can create internal comments
    if (isInternal && !['admin', 'manager', 'agent'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only staff can create internal comments' });
    }

    const Comment = require('../models/Comment');
    const comment = new Comment({
      ticket: req.params.id,
      author: req.user.id,
      content,
      isInternal
    });

    if (req.file) {
      comment.attachments = [{
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`
      }];
    }

    await comment.save();
    await comment.populate('author', 'firstName lastName email avatar');

    // Update ticket status to 'in_progress' if it was 'open' and comment is from staff
    if (ticket.status === 'open' && ['admin', 'manager', 'agent'].includes(req.user.role)) {
      ticket.status = 'in_progress';
      await ticket.save();
      
      // Create auto-comment for status change
      const statusComment = new Comment({
        ticket: req.params.id,
        author: req.user.id,
        content: `**System Update:** Status changed from open to in_progress`,
        isInternal: false
      });
      await statusComment.save();
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error('Create comment error:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Max 2MB' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tickets/stats/overview
// @desc    Get ticket statistics overview
// @access  Private
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const { company } = req.query;
    const filter = company ? { company } : {};

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      breachedSLAs,
      totalTimeSpent
    ] = await Promise.all([
      Ticket.countDocuments(filter),
      Ticket.countDocuments({ ...filter, status: 'open' }),
      Ticket.countDocuments({ ...filter, status: 'in_progress' }),
      Ticket.countDocuments({ ...filter, status: 'resolved' }),
      Ticket.countDocuments({ ...filter, status: 'closed' }),
      Ticket.countDocuments({ ...filter, 'sla.isBreached': true }),
      Ticket.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$actualTime' } } }
      ])
    ]);

    res.json({
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      breachedSLAs,
      totalTimeSpent: totalTimeSpent[0]?.total || 0
    });
  } catch (error) {
    console.error('Get ticket stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 