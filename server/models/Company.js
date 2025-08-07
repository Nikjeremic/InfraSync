const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true
  },
  industry: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  logo: {
    type: String,
    default: ''
  },
  primaryColor: {
    type: String,
    default: '#1976d2'
  },
  secondaryColor: {
    type: String,
    default: '#dc004e'
  },
  settings: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'en'
    },
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY'
    },
    timeFormat: {
      type: String,
      default: '12h'
    },
    currency: {
      type: String,
      default: 'USD'
    },
    workingHours: {
      start: {
        type: String,
        default: '09:00'
      },
      end: {
        type: String,
        default: '17:00'
      }
    },
    slaSettings: {
      defaultResponseTime: {
        type: Number,
        default: 1440 // 24 hours in minutes
      },
      defaultResolutionTime: {
        type: Number,
        default: 2880 // 48 hours in minutes
      }
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true
    },
    features: [{
      type: String,
      enum: [
        'unlimited_tickets',
        'advanced_analytics',
        'custom_fields',
        'automation',
        'integrations',
        'api_access',
        'white_label',
        'priority_support'
      ]
    }]
  },
  stats: {
    totalUsers: {
      type: Number,
      default: 0
    },
    totalTickets: {
      type: Number,
      default: 0
    },
    activeTickets: {
      type: Number,
      default: 0
    },
    avgResolutionTime: {
      type: Number,
      default: 0
    },
    customerSatisfaction: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Generate slug from name before saving
companySchema.pre('save', function(next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Also handle slug generation for findOneAndUpdate and updateOne
companySchema.pre(['findOneAndUpdate', 'updateOne'], function(next) {
  const update = this.getUpdate();
  if (update.name && !update.slug) {
    update.slug = update.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Update stats when tickets are created/updated
companySchema.methods.updateStats = async function() {
  const Ticket = mongoose.model('Ticket');
  const User = mongoose.model('User');

  const [totalTickets, activeTickets, totalUsers, usersWithInheritedSubscription] = await Promise.all([
    Ticket.countDocuments({ company: this._id }),
    Ticket.countDocuments({ company: this._id, status: { $in: ['open', 'in_progress'] } }),
    User.countDocuments({ company: this._id, isActive: true }),
    User.countDocuments({ 
      company: this._id, 
      isActive: true,
      $or: [
        { subscription: 'free' },
        { subscription: { $exists: false } }
      ]
    })
  ]);

  this.stats.totalTickets = totalTickets;
  this.stats.activeTickets = activeTickets;
  this.stats.totalUsers = totalUsers;
  this.stats.usersWithInheritedSubscription = usersWithInheritedSubscription;

  // Calculate average resolution time
  const resolvedTickets = await Ticket.find({
    company: this._id,
    status: 'resolved',
    resolvedAt: { $exists: true }
  });

  if (resolvedTickets.length > 0) {
    const totalTime = resolvedTickets.reduce((sum, ticket) => {
      return sum + (ticket.resolvedAt - ticket.createdAt);
    }, 0);
    this.stats.avgResolutionTime = Math.round(totalTime / resolvedTickets.length / (1000 * 60 * 60)); // in hours
  }

  return this.save();
};

// Check if company has access to premium features
companySchema.methods.hasPremiumAccess = function() {
  return ['premium', 'enterprise'].includes(this.subscription.plan);
};

// Check if subscription is active
companySchema.methods.isSubscriptionActive = function() {
  if (!this.subscription.endDate) return true;
  return new Date() < this.subscription.endDate;
};

// Get company settings with defaults
companySchema.methods.getSettings = function() {
  return {
    ...this.settings,
    primaryColor: this.primaryColor,
    secondaryColor: this.secondaryColor
  };
};

// Indexes for better performance
companySchema.index({ name: 1 });
companySchema.index({ isActive: 1 });
companySchema.index({ 'subscription.plan': 1 });

module.exports = mongoose.model('Company', companySchema); 