const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['technical', 'billing', 'feature_request', 'bug_report', 'general'],
    default: 'general'
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  // Time tracking fields
  estimatedTime: {
    type: Number, // in minutes
    default: 0
  },
  actualTime: {
    type: Number, // in minutes
    default: 0
  },
  timeEntries: [{
    description: {
      type: String,
      required: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date
    },
    duration: {
      type: Number, // in minutes
      default: 0
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isActive: {
      type: Boolean,
      default: false
    }
  }],
  // SLA fields
  sla: {
    type: {
      type: String,
      enum: ['response', 'resolution'],
      default: 'resolution'
    },
    targetTime: {
      type: Number, // in hours
      default: 24
    },
    startTime: {
      type: Date,
      default: Date.now
    },
    endTime: {
      type: Date
    },
    isBreached: {
      type: Boolean,
      default: false
    }
  },
  // Escalation fields
  escalationLevel: {
    type: Number,
    default: 0
  },
  escalatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  escalationHistory: [{
    level: Number,
    escalatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // Related tickets
  relatedTickets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket'
  }],
  // Custom fields (for premium features)
  customFields: [{
    name: String,
    value: mongoose.Schema.Types.Mixed,
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'boolean', 'select']
    }
  }],
  // Tags for organization
  tags: [{
    type: String,
    trim: true
  }],
  // Watchers
  watchers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Resolution details
  resolution: {
    description: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date
  },
  // Internal notes (visible only to agents)
  internalNotes: [{
    content: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Due date
  dueDate: {
    type: Date
  },
  // Recurring ticket settings
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringSettings: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly']
    },
    interval: Number,
    endDate: Date
  },
  // Reopen request fields
  reopenRequests: [{
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewNote: String,
    requestedAt: {
      type: Date,
      default: Date.now
    },
    reviewedAt: Date
  }],
  // Ticket activity log
  activityLog: [{
    action: {
      type: String,
      enum: ['created', 'updated', 'status_changed', 'assigned', 'reopened', 'reopen_requested', 'closed'],
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    details: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Generate ticket number before saving
ticketSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      const lastTicket = await this.constructor.findOne({}, {}, { sort: { 'ticketNumber': -1 } });
      let nextNumber = 1;
      
      if (lastTicket && lastTicket.ticketNumber) {
        const lastNumber = parseInt(lastTicket.ticketNumber.replace('TICKET-', ''));
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
      
      this.ticketNumber = `TICKET-${nextNumber.toString().padStart(6, '0')}`;
    } catch (error) {
      console.error('Error generating ticket number:', error);
      this.ticketNumber = `TICKET-${Date.now().toString().padStart(6, '0')}`;
    }
  }
  next();
});

// Update SLA breach status
ticketSchema.methods.updateSLAStatus = function() {
  if (this.status === 'closed' || this.status === 'resolved') {
    this.sla.endTime = new Date();
    this.sla.isBreached = false;
  } else {
    const now = new Date();
    const elapsedHours = (now - this.sla.startTime) / (1000 * 60 * 60);
    this.sla.isBreached = elapsedHours > this.sla.targetTime;
  }
  return this.save();
};

// Add time entry
ticketSchema.methods.addTimeEntry = function(entry) {
  this.timeEntries.push(entry);
  this.actualTime = this.timeEntries.reduce((total, entry) => total + (entry.duration || 0), 0);
  return this.save();
};

// Start time tracking
ticketSchema.methods.startTimeTracking = function(userId, description) {
  // Stop any active time entries
  this.timeEntries.forEach(entry => {
    if (entry.isActive) {
      entry.endTime = new Date();
      entry.duration = Math.round((entry.endTime - entry.startTime) / (1000 * 60));
      entry.isActive = false;
    }
  });

  // Start new time entry
  const newEntry = {
    description,
    startTime: new Date(),
    user: userId,
    isActive: true
  };

  this.timeEntries.push(newEntry);
  return this.save();
};

// Stop time tracking
ticketSchema.methods.stopTimeTracking = function() {
  const activeEntry = this.timeEntries.find(entry => entry.isActive);
  if (activeEntry) {
    activeEntry.endTime = new Date();
    activeEntry.duration = Math.round((activeEntry.endTime - activeEntry.startTime) / (1000 * 60));
    activeEntry.isActive = false;
    this.actualTime = this.timeEntries.reduce((total, entry) => total + (entry.duration || 0), 0);
    return this.save();
  }
  return Promise.resolve(this);
};

// Escalate ticket
ticketSchema.methods.escalate = function(userId, reason) {
  this.escalationLevel += 1;
  this.escalatedTo = userId;
  this.escalationHistory.push({
    level: this.escalationLevel,
    escalatedTo: userId,
    reason
  });
  return this.save();
};

// Add watcher
ticketSchema.methods.addWatcher = function(userId) {
  if (!this.watchers.includes(userId)) {
    this.watchers.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Remove watcher
ticketSchema.methods.removeWatcher = function(userId) {
  this.watchers = this.watchers.filter(watcher => watcher.toString() !== userId.toString());
  return this.save();
};

// Virtual for total time spent
ticketSchema.virtual('totalTimeSpent').get(function() {
  return this.timeEntries.reduce((total, entry) => total + (entry.duration || 0), 0);
});

// Virtual for active time entry
ticketSchema.virtual('activeTimeEntry').get(function() {
  return this.timeEntries.find(entry => entry.isActive);
});

// Request ticket reopen
ticketSchema.methods.requestReopen = function(userId, reason) {
  const reopenRequest = {
    requestedBy: userId,
    reason: reason,
    status: 'pending',
    requestedAt: new Date()
  };
  
  this.reopenRequests.push(reopenRequest);
  
  // Add to activity log
  this.activityLog.push({
    action: 'reopen_requested',
    user: userId,
    details: `Reopen requested: ${reason}`,
    timestamp: new Date()
  });
  
  return this.save();
};

// Approve reopen request
ticketSchema.methods.approveReopen = function(adminId, requestId, reviewNote = '') {
  const request = this.reopenRequests.id(requestId);
  if (request && request.status === 'pending') {
    request.status = 'approved';
    request.reviewedBy = adminId;
    request.reviewNote = reviewNote;
    request.reviewedAt = new Date();
    
    // Change status back to open
    this.status = 'open';
    
    // Add to activity log
    this.activityLog.push({
      action: 'reopened',
      user: adminId,
      details: `Ticket reopened by admin: ${reviewNote}`,
      timestamp: new Date()
    });
    
    return this.save();
  }
  return Promise.reject(new Error('Invalid reopen request'));
};

// Reject reopen request
ticketSchema.methods.rejectReopen = function(adminId, requestId, reviewNote = '') {
  const request = this.reopenRequests.id(requestId);
  if (request && request.status === 'pending') {
    request.status = 'rejected';
    request.reviewedBy = adminId;
    request.reviewNote = reviewNote;
    request.reviewedAt = new Date();
    
    // Add to activity log
    this.activityLog.push({
      action: 'status_changed',
      user: adminId,
      details: `Reopen request rejected: ${reviewNote}`,
      timestamp: new Date()
    });
    
    return this.save();
  }
  return Promise.reject(new Error('Invalid reopen request'));
};

// Check if user can close ticket
ticketSchema.methods.canUserClose = function(userId, userRole) {
  // Admin and managers can always close tickets
  if (['admin', 'manager'].includes(userRole)) {
    return true;
  }
  
  // Agents can close tickets if assigned
  if (userRole === 'agent') {
    return this.assignee?.toString() === userId.toString();
  }
  
  // Users can close their own tickets if they're open or in_progress
  if (userRole === 'user') {
    return this.reporter.toString() === userId.toString() && 
           ['open', 'in_progress'].includes(this.status);
  }
  
  return false;
};

// Check if user can edit ticket
ticketSchema.methods.canUserEdit = function(userId, userRole) {
  // Admin and managers can always edit
  if (['admin', 'manager'].includes(userRole)) {
    return true;
  }
  
  // Agents can edit if assigned or if ticket is open/in_progress
  if (userRole === 'agent') {
    return this.assignee?.toString() === userId.toString() || 
           ['open', 'in_progress'].includes(this.status);
  }
  
  // Users cannot edit tickets (only close them)
  if (userRole === 'user') {
    return false;
  }
  
  return false;
};

// Check if user can view ticket
ticketSchema.methods.canUserView = function(userId, userRole) {
  // Admin and managers can always view
  if (['admin', 'manager'].includes(userRole)) {
    return true;
  }
  
  // Agents can view if assigned or if ticket is open/in_progress
  if (userRole === 'agent') {
    return this.assignee?.toString() === userId.toString() || 
           ['open', 'in_progress'].includes(this.status);
  }
  
  // Users can always view their own tickets regardless of status
  if (userRole === 'user') {
    return this.reporter.toString() === userId.toString();
  }
  
  return false;
};

// Check if user can add comments
ticketSchema.methods.canUserAddComments = function(userId, userRole) {
  // Admin and managers can always add comments
  if (['admin', 'manager'].includes(userRole)) {
    return true;
  }
  
  // Agents can add comments if assigned or if ticket is open/in_progress
  if (userRole === 'agent') {
    return this.assignee?.toString() === userId.toString() || 
           ['open', 'in_progress'].includes(this.status);
  }
  
  // Users can add comments to their own tickets if they're not resolved
  if (userRole === 'user') {
    return this.reporter.toString() === userId.toString() && 
           this.status !== 'resolved';
  }
  
  return false;
};

// Check if user can request reopen
ticketSchema.methods.canUserRequestReopen = function(userId, userRole) {
  // Only users can request reopen for their own closed tickets
  if (userRole === 'user') {
    return this.reporter.toString() === userId.toString() && 
           this.status === 'closed';
  }
  return false;
};

// Indexes
ticketSchema.index({ status: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ assignee: 1 });
ticketSchema.index({ company: 1 });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ 'sla.isBreached': 1 });

module.exports = mongoose.model('Ticket', ticketSchema); 