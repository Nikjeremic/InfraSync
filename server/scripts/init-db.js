const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Company = require('../models/Company');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`📦 MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const createTestCompany = async () => {
  try {
    // Check if test company already exists
    const existingCompany = await Company.findOne({ name: 'Test Company' });
    
    if (existingCompany) {
      console.log('✅ Test company already exists');
      return existingCompany;
    }

    // Create test company
    const testCompany = new Company({
      name: 'Test Company',
      slug: 'test-company',
      description: 'A test company for demonstration purposes',
      industry: 'Technology',
      website: 'https://testcompany.com',
      email: 'info@testcompany.com',
      phone: '+1-555-0000',
      subscription: {
        plan: 'enterprise',
        isActive: true,
        features: [
          'unlimited_tickets',
          'advanced_analytics',
          'custom_fields',
          'automation',
          'integrations',
          'api_access',
          'white_label',
          'priority_support'
        ]
      },
      isActive: true,
      createdBy: '000000000000000000000000' // Temporary ID, will be updated
    });

    await testCompany.save();
    console.log('✅ Test company created successfully');
    return testCompany;
  } catch (error) {
    console.error('❌ Error creating test company:', error.message);
  }
};

const createAdminUser = async (company) => {
  try {
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@infrasync.com' });
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      return existingAdmin;
    }

    // Create admin user
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@infrasync.com',
      password: 'admin123',
      role: 'admin',
      subscription: 'enterprise',
      company: company?._id,
      permissions: [
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
      ],
      isActive: true
    });

    await adminUser.save();
    console.log('✅ Admin user created successfully');
    console.log('Email: admin@infrasync.com');
    console.log('Password: admin123');
    return adminUser;
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  }
};

const createTestUsers = async (company) => {
  try {
    // Create agent user
    const existingAgent = await User.findOne({ email: 'agent@infrasync.com' });
    if (!existingAgent) {
      const agentUser = new User({
        firstName: 'John',
        lastName: 'Agent',
        email: 'agent@infrasync.com',
        password: 'agent123',
        role: 'agent',
        subscription: 'premium',
        company: company?._id,
        permissions: [
          'create_tickets',
          'edit_tickets',
          'view_analytics',
          'custom_fields'
        ],
        isActive: true
      });
      await agentUser.save();
      console.log('✅ Agent user created successfully');
    }

    // Create regular user
    const existingUser = await User.findOne({ email: 'user@infrasync.com' });
    if (!existingUser) {
      const regularUser = new User({
        firstName: 'Jane',
        lastName: 'User',
        email: 'user@infrasync.com',
        password: 'user123',
        role: 'user',
        subscription: 'free',
        company: company?._id,
        permissions: [
          'create_tickets'
        ],
        isActive: true
      });
      await regularUser.save();
      console.log('✅ Regular user created successfully');
    }

    console.log('\n📋 Test Users:');
    console.log('Agent - Email: agent@infrasync.com, Password: agent123');
    console.log('User - Email: user@infrasync.com, Password: user123');
  } catch (error) {
    console.error('❌ Error creating test users:', error.message);
  }
};

const initDatabase = async () => {
  try {
    await connectDB();
    
    // Create test company first
    const company = await createTestCompany();
    
    // Create admin user with company reference
    const adminUser = await createAdminUser(company);
    
    // Update company with admin user as creator
    if (company && adminUser) {
      company.createdBy = adminUser._id;
      await company.save();
    }
    
    // Create test users with company reference
    await createTestUsers(company);
    
    console.log('\n🎉 Database initialization completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
};

initDatabase(); 