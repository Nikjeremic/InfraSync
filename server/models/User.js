const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'agent', 'user', 'manager'],
    default: 'user'
  },
  subscription: {
    type: String,
    enum: ['free', 'basic', 'premium', 'enterprise'],
    default: 'free'
  },
  subscriptionExpires: {
    type: Date
  },
  avatar: {
    type: String,
    default: ''
  },
  department: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  loginCount: {
    type: Number,
    default: 0
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  apiKey: {
    type: String
  },
  permissions: [{
    type: String,
    enum: [
      'create_tickets',
      'edit_tickets',
      'delete_tickets',
      'view_analytics',
      'manage_users',
      'manage_settings',
      'export_data',
      'custom_fields',
      'automation',
      'integrations'
    ]
  }]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Get full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Get effective subscription (from user or inherited from company)
userSchema.methods.getEffectiveSubscription = async function() {
  if (this.subscription && this.subscription !== 'free') {
    return this.subscription;
  }
  
  if (this.company) {
    const Company = mongoose.model('Company');
    const company = await Company.findById(this.company);
    if (company && company.subscription && company.subscription.plan) {
      return company.subscription.plan;
    }
  }
  
  return 'free';
};

// Check if user has premium features
userSchema.methods.hasPremiumAccess = async function() {
  const effectiveSubscription = await this.getEffectiveSubscription();
  return ['premium', 'enterprise'].includes(effectiveSubscription);
};

// Check if subscription is active
userSchema.methods.isSubscriptionActive = function() {
  if (!this.subscriptionExpires) return true;
  return new Date() < this.subscriptionExpires;
};

// Check permission
userSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission) || this.role === 'admin';
};

// JSON serialization
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.apiKey;
  return user;
};

module.exports = mongoose.model('User', userSchema); 