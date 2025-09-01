const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Company = require('../models/Company');
const User = require('../models/User');
const { auth, requireRole, requirePermission } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/companies/for-tickets
// @desc    Get companies for ticket creation (role-based access)
// @access  Private
router.get('/for-tickets', auth, async (req, res) => {
  try {
    const userRole = req.user.role;
    
    let companies;
    
    if (userRole === 'admin') {
      // Admin can see all companies
      companies = await Company.find({ isActive: true })
        .select('name _id')
        .lean();
    } else {
      // Other users can only see their own company
      if (!req.user.company) {
        return res.status(403).json({ 
          message: 'You must be associated with a company to create tickets' 
        });
      }
      
      companies = await Company.find({ 
        _id: req.user.company,
        isActive: true 
      })
        .select('name _id')
        .lean();
    }

    res.json({ companies });
  } catch (error) {
    console.error('Get companies for tickets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/companies
// @desc    Get all companies with filtering and pagination
// @access  Private (Admin only)
router.get('/', auth, requireRole(['admin']), [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('industry').optional().isString(),
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
      search,
      industry,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    if (industry) filter.industry = industry;
    if (isActive !== undefined) filter.isActive = isActive;

    // Search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const companies = await Company.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Company.countDocuments(filter);

    res.json({
      companies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/companies
// @desc    Create a new company
// @access  Private (Admin only)
router.post('/', auth, requireRole(['admin']), [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Company name must be between 2 and 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('industry').optional().trim(),
  body('website').optional().isURL().withMessage('Invalid website URL'),
  body('email').optional().isEmail().withMessage('Invalid email address'),
  body('phone').optional().trim(),
  body('address').optional().isObject(),
  body('primaryColor').optional().isHexColor().withMessage('Invalid primary color'),
  body('secondaryColor').optional().isHexColor().withMessage('Invalid secondary color'),
  body('subscription.plan').optional().isIn(['free', 'basic', 'premium', 'enterprise'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      description,
      industry,
      website,
      email,
      phone,
      address,
      primaryColor,
      secondaryColor,
      subscription
    } = req.body;

    // Check if company with same name already exists
    const existingCompany = await Company.findOne({ name });
    if (existingCompany) {
      return res.status(400).json({ message: 'Company with this name already exists' });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const company = new Company({
      name,
      slug,
      description,
      industry,
      website,
      email,
      phone,
      address,
      primaryColor,
      secondaryColor,
      subscription,
      createdBy: req.user._id
    });

    await company.save();
    await company.populate('createdBy', 'firstName lastName email');

    res.status(201).json(company);
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/companies/:id
// @desc    Get company by ID
// @access  Private (Admin or company member)
router.get('/:id', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email');

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Check if user has access to this company
    if (req.user.role !== 'admin' && req.user.company?.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(company);
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/companies/:id
// @desc    Update company
// @access  Private (Admin only)
router.put('/:id', auth, requireRole(['admin']), [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('industry').optional().trim(),
  body('website').optional().isURL(),
  body('email').optional().isEmail(),
  body('phone').optional().trim(),
  body('address').optional().isObject(),
  body('primaryColor').optional().isHexColor(),
  body('secondaryColor').optional().isHexColor(),
  body('isActive').optional().isBoolean(),
  body('subscription').optional().isObject(),
  body('billing').optional().isObject(),
  body('billing.hourlyRate').optional().isFloat({ min: 0 }),
  body('billing.currency').optional().isString().isLength({ min: 3, max: 3 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Check if name is being changed and if it conflicts
    if (req.body.name && req.body.name !== company.name) {
      const existingCompany = await Company.findOne({ name: req.body.name });
      if (existingCompany) {
        return res.status(400).json({ message: 'Company with this name already exists' });
      }
      
      // Generate new slug for the updated name
      req.body.slug = req.body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    const updatedCompany = await Company.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email');

    res.json(updatedCompany);
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/companies/:id
// @desc    Delete company
// @access  Private (Admin only)
router.delete('/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Check if company has users
    const userCount = await User.countDocuments({ company: req.params.id });
    if (userCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete company with active users. Please remove all users first.' 
      });
    }

    await Company.findByIdAndDelete(req.params.id);

    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/companies/:id/activate
// @desc    Activate company
// @access  Private (Admin only)
router.post('/:id/activate', auth, requireRole(['admin']), async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    company.isActive = true;
    await company.save();

    res.json({ message: 'Company activated successfully' });
  } catch (error) {
    console.error('Activate company error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/companies/:id/deactivate
// @desc    Deactivate company
// @access  Private (Admin only)
router.post('/:id/deactivate', auth, requireRole(['admin']), async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    company.isActive = false;
    await company.save();

    res.json({ message: 'Company deactivated successfully' });
  } catch (error) {
    console.error('Deactivate company error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/companies/:id/upgrade-subscription
// @desc    Upgrade company subscription
// @access  Private (Admin only)
router.post('/:id/upgrade-subscription', auth, requireRole(['admin']), [
  body('plan').isIn(['basic', 'premium', 'enterprise']).withMessage('Invalid subscription plan'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 month'),
  body('features').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { plan, duration, features = [] } = req.body;

    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Calculate end date
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + duration);

    company.subscription.plan = plan;
    company.subscription.endDate = endDate;
    company.subscription.features = features;
    company.subscription.isActive = true;

    await company.save();

    res.json({ 
      message: 'Subscription upgraded successfully',
      company: {
        id: company._id,
        name: company.name,
        subscription: company.subscription
      }
    });
  } catch (error) {
    console.error('Upgrade subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/companies/:id/stats
// @desc    Get company statistics
// @access  Private (Admin or company member)
router.get('/:id/stats', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Check if user has access to this company
    if (req.user.role !== 'admin' && req.user.company?.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update company stats
    await company.updateStats();

    res.json({
      company: company.name,
      stats: company.stats,
      subscription: company.subscription
    });
  } catch (error) {
    console.error('Get company stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 