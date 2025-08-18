const express = require('express');
const { body, validationResult, query } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const { auth, requireRole, requirePermission } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users with filtering and pagination
// @access  Private (Admin/Manager only)
router.get('/', auth, requireRole(['admin', 'manager']), [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('role').optional().isIn(['admin', 'agent', 'user', 'manager']),
  query('subscription').optional().isIn(['free', 'basic', 'premium', 'enterprise']),
  query('search').optional().isString(),
  query('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      page = 1,
      limit = 20,
      role,
      subscription,
      search,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    if (role) filter.role = role;
    if (subscription) filter.subscription = subscription;
    if (isActive !== undefined) filter.isActive = isActive;

    // Search functionality
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .select('-password')
      .populate('company', 'name subscription')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Add effective subscription to each user
    for (let user of users) {
      if (user.subscription && user.subscription !== 'free') {
        user.effectiveSubscription = user.subscription;
      } else if (user.company && user.company.subscription && user.company.subscription.plan) {
        user.effectiveSubscription = user.company.subscription.plan;
        user.subscriptionSource = 'company';
      } else {
        user.effectiveSubscription = 'free';
        user.subscriptionSource = 'user';
      }
    }

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/for-tickets
// @desc    Get users for ticket assignment (role-based access)
// @access  Private
router.get('/for-tickets', auth, async (req, res) => {
  try {
    const userRole = req.user.role;
    
    let users;
    
    if (userRole === 'admin') {
      // Admin can see all agents, managers, and admins
      users = await User.find({ 
        role: { $in: ['agent', 'manager', 'admin'] },
        isActive: true 
      })
        .select('firstName lastName email role')
        .lean();
    } else if (userRole === 'manager') {
      // Managers can see agents and other managers
      users = await User.find({ 
        role: { $in: ['agent', 'manager'] },
        isActive: true 
      })
        .select('firstName lastName email role')
        .lean();
    } else {
      // Other users cannot assign tickets
      users = [];
    }

    res.json({ users });
  } catch (error) {
    console.error('Get users for tickets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/agents
// @desc    Get all agents for assignment
// @access  Private
router.get('/agents', auth, async (req, res) => {
  try {
    const agents = await User.find({ 
      role: { $in: ['agent', 'manager'] },
      isActive: true 
    })
      .select('firstName lastName email avatar department')
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    res.json(agents);
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users
// @desc    Create a new user
// @access  Private (Admin only)
router.post('/', auth, requireRole(['admin']), [
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['user', 'agent', 'manager', 'admin']).withMessage('Invalid role'),
  body('company').optional().isMongoId().withMessage('Invalid company ID'),
  body('subscription').optional().isIn(['free', 'basic', 'premium', 'enterprise']),
  body('permissions').optional().isArray(),
  body('isActive').optional().isBoolean()
], async (req, res) => {
      console.log('Received user creation request:', req.body);
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ 
          message: 'Validation failed',
          errors: errors.array() 
        });
      }

    const {
      firstName,
      lastName,
      email,
      password,
      role,
      company,
      subscription,
      permissions,
      isActive = true
    } = req.body;

    // Clean up empty strings
    const cleanCompany = company === '' ? undefined : company;
    const cleanSubscription = subscription === '' ? 'free' : subscription;

    console.log('Creating user with data:', {
      firstName,
      lastName,
      email,
      role,
      company: cleanCompany,
      subscription: cleanSubscription,
      isActive
    });

    // Check if user with same email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Check if company exists if provided
    if (cleanCompany) {
      const companyExists = await Company.findById(cleanCompany);
      if (!companyExists) {
        return res.status(400).json({ message: 'Company not found' });
      }
    }

    // If company is selected, set subscription to 'free' to inherit from company
    const effectiveSubscription = cleanCompany ? 'free' : cleanSubscription;

    const user = new User({
      firstName,
      lastName,
      email,
      password,
      role,
      company: cleanCompany,
      subscription: effectiveSubscription,
      permissions,
      isActive
    });

    await user.save();

    // Update company stats if user is assigned to a company
    if (cleanCompany) {
      const Company = mongoose.model('Company');
      const companyDoc = await Company.findById(cleanCompany);
      if (companyDoc) {
        await companyDoc.updateStats();
      }
    }

    // Populate company info
    await user.populate('company', 'name');

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    console.error('Create user error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      console.log('Validation errors:', validationErrors);
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationErrors 
      });
    }
    
    // Handle other errors
    console.log('Unexpected error:', error);
    return res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      console.log('Duplicate key error:', error);
      return res.status(400).json({ 
        message: 'User with this email already exists' 
      });
    }
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('company', 'name subscription')
      .lean();
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check permissions
    if (req.user.role === 'user' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Add effective subscription
    if (user.subscription && user.subscription !== 'free') {
      user.effectiveSubscription = user.subscription;
      user.subscriptionSource = 'user';
    } else if (user.company && user.company.subscription && user.company.subscription.plan) {
      user.effectiveSubscription = user.company.subscription.plan;
      user.subscriptionSource = 'company';
    } else {
      user.effectiveSubscription = 'free';
      user.subscriptionSource = 'user';
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Admin/Manager or self)
router.put('/:id', auth, [
  body('firstName').optional().trim().isLength({ min: 2 }),
  body('lastName').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'agent', 'user', 'manager']),
  body('company').optional().isMongoId().withMessage('Invalid company ID'),
  body('subscription').optional().isIn(['free', 'basic', 'premium', 'enterprise']),
  body('department').optional().trim(),
  body('phone').optional().trim(),
  body('timezone').optional().trim(),
  body('isActive').optional().isBoolean(),
  body('permissions').optional().isArray(),
  body('subscriptionExpires').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check permissions
    if (req.user.role === 'user' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only admins can change roles, subscriptions, and passwords
    if (req.body.role && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can change user roles' });
    }

    if (req.body.subscription && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can change subscriptions' });
    }

    if (req.body.password && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can change user passwords' });
    }

    // Check if company exists if provided
    if (req.body.company) {
      const companyExists = await Company.findById(req.body.company);
      if (!companyExists) {
        return res.status(400).json({ message: 'Company not found' });
      }
    }

    // Get old user data to check if company changed
    const oldUser = await User.findById(req.params.id);
    const oldCompanyId = oldUser?.company;

    // If password is being updated, we need to use save() to trigger pre('save') hook
    if (req.body.password) {
      oldUser.password = req.body.password;
      await oldUser.save();
      
      // Get updated user without password
      const user = await User.findById(req.params.id)
        .select('-password')
        .populate('company', 'name');
      
      // Update other fields if any
      if (Object.keys(req.body).some(key => key !== 'password')) {
        const updateData = { ...req.body };
        delete updateData.password; // Remove password from update data
        
        await User.findByIdAndUpdate(
          req.params.id,
          updateData,
          { new: true, runValidators: true }
        );
      }
      
      // Return updated user
      const updatedUser = await User.findById(req.params.id)
        .select('-password')
        .populate('company', 'name');
      
      // Update company stats if company changed
      if (oldCompanyId !== updatedUser.company?._id) {
        const Company = mongoose.model('Company');
        
        // Update old company stats
        if (oldCompanyId) {
          const oldCompany = await Company.findById(oldCompanyId);
          if (oldCompany) {
            await oldCompany.updateStats();
          }
        }
        
        // Update new company stats
        if (updatedUser.company?._id) {
          const newCompany = await Company.findById(updatedUser.company._id);
          if (newCompany) {
            await newCompany.updateStats();
          }
        }
      }
      
      return res.json(updatedUser);
    }

    // If no password update, use regular update
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password').populate('company', 'name');

    // Update company stats if company changed (only for non-password updates)
    if (oldCompanyId !== user.company?._id) {
      const Company = mongoose.model('Company');
      
      // Update old company stats
      if (oldCompanyId) {
        const oldCompany = await Company.findById(oldCompanyId);
        if (oldCompany) {
          await oldCompany.updateStats();
        }
      }
      
      // Update new company stats
      if (user.company?._id) {
        const newCompany = await Company.findById(user.company._id);
        if (newCompany) {
          await newCompany.updateStats();
        }
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user
// @access  Private (Admin only)
router.delete('/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting self
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Get user's company before deletion
    const userCompany = user.company;

    await User.findByIdAndDelete(req.params.id);

    // Update company stats if user was assigned to a company
    if (userCompany) {
      const Company = mongoose.model('Company');
      const company = await Company.findById(userCompany);
      if (company) {
        await company.updateStats();
      }
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/:id/activate
// @desc    Activate user
// @access  Private (Admin only)
router.post('/:id/activate', auth, requireRole(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = true;
    await user.save();

    res.json({ message: 'User activated successfully' });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/:id/deactivate
// @desc    Deactivate user
// @access  Private (Admin only)
router.post('/:id/deactivate', auth, requireRole(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = false;
    await user.save();

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/:id/deactivate
// @desc    Deactivate user
// @access  Private (Admin/Manager only)
router.post('/:id/deactivate', auth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deactivating self
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }

    user.isActive = false;
    await user.save();

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/:id/activate
// @desc    Activate user
// @access  Private (Admin/Manager only)
router.post('/:id/activate', auth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = true;
    await user.save();

    res.json({ message: 'User activated successfully' });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/:id/upgrade-subscription
// @desc    Upgrade user subscription (Premium feature)
// @access  Private (Admin only)
router.post('/:id/upgrade-subscription', auth, requireRole(['admin']), [
  body('subscription').isIn(['basic', 'premium', 'enterprise']).withMessage('Invalid subscription type'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 month')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subscription, duration } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate expiration date
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + duration);

    user.subscription = subscription;
    user.subscriptionExpires = expirationDate;

    // Add permissions based on subscription
    const permissions = [];
    if (subscription === 'basic') {
      permissions.push('create_tickets', 'edit_tickets');
    } else if (subscription === 'premium') {
      permissions.push('create_tickets', 'edit_tickets', 'view_analytics', 'custom_fields');
    } else if (subscription === 'enterprise') {
      permissions.push('create_tickets', 'edit_tickets', 'delete_tickets', 'view_analytics', 
                      'manage_users', 'manage_settings', 'export_data', 'custom_fields', 
                      'automation', 'integrations');
    }

    user.permissions = permissions;
    await user.save();

    res.json({ 
      message: 'Subscription upgraded successfully',
      user: {
        id: user._id,
        subscription: user.subscription,
        subscriptionExpires: user.subscriptionExpires,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Upgrade subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/stats/overview
// @desc    Get user statistics overview
// @access  Private (Admin/Manager only)
router.get('/stats/overview', auth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const premiumUsers = await User.countDocuments({ 
      subscription: { $in: ['premium', 'enterprise'] },
      isActive: true 
    });

    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const usersBySubscription = await User.aggregate([
      { $group: { _id: '$subscription', count: { $sum: 1 } } }
    ]);

    const recentUsers = await User.find()
      .select('firstName lastName email role subscription createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({
      totalUsers,
      activeUsers,
      premiumUsers,
      usersByRole,
      usersBySubscription,
      recentUsers
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 