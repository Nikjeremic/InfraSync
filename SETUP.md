# InfraSync Setup Instructions

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### 2. Installation Steps

```bash
# Clone the repository
git clone <repository-url>
cd InfraSync

# Install all dependencies
npm run install-all

# Configure environment
cd server
cp env.example .env
# Edit .env file with your configuration

# Start MongoDB (if using local)
mongod

# Start the application
npm run dev
```

### 3. Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 🔧 Configuration

### Environment Variables (.env)
```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/infrasync
JWT_SECRET=your-super-secret-jwt-key
CLIENT_URL=http://localhost:3000
```

### MongoDB Setup
1. **Local MongoDB:**
   ```bash
   # Install MongoDB
   sudo apt-get install mongodb
   
   # Start MongoDB service
   sudo systemctl start mongodb
   sudo systemctl enable mongodb
   ```

2. **MongoDB Atlas (Cloud):**
   - Create account at https://cloud.mongodb.com
   - Create new cluster
   - Get connection string
   - Update MONGO_URI in .env

## 👤 Default Users

After first run, you can create users through the registration page or directly in the database:

### Admin User
```javascript
{
  firstName: "Admin",
  lastName: "User",
  email: "admin@infrasync.com",
  password: "admin123",
  role: "admin",
  subscription: "enterprise"
}
```

### Test Users
```javascript
// Agent
{
  firstName: "John",
  lastName: "Agent",
  email: "agent@infrasync.com",
  password: "agent123",
  role: "agent",
  subscription: "premium"
}

// Regular User
{
  firstName: "Jane",
  lastName: "User",
  email: "user@infrasync.com",
  password: "user123",
  role: "user",
  subscription: "free"
}
```

## 🛠️ Development

### Available Scripts
```bash
# Install all dependencies
npm run install-all

# Start development servers
npm run dev

# Start only backend
npm run server

# Start only frontend
npm run client

# Build for production
npm run build
```

### Project Structure
```
InfraSync/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   └── types/          # TypeScript types
│   └── public/             # Static files
├── server/                 # Node.js backend
│   ├── config/             # Configuration files
│   ├── middleware/         # Express middleware
│   ├── models/             # MongoDB models
│   ├── routes/             # API routes
│   └── index.js            # Server entry point
└── README.md               # Project documentation
```

## 🔒 Security Features

- JWT authentication
- Password hashing with bcrypt
- Role-based access control
- Input validation
- Rate limiting
- CORS configuration
- Helmet security headers

## 📱 Features by Subscription Level

### Free Plan
- ✅ Create tickets
- ✅ View own tickets
- ✅ Basic notifications
- ✅ Profile management

### Basic Plan
- ✅ All Free features
- ✅ Edit tickets
- ✅ Advanced filtering
- ✅ Email notifications

### Premium Plan
- ✅ All Basic features
- ✅ Time tracking
- ✅ Advanced analytics
- ✅ Custom fields
- ✅ Performance metrics
- ✅ SLA monitoring

### Enterprise Plan
- ✅ All Premium features
- ✅ User management
- ✅ Data export
- ✅ Automation
- ✅ Integrations
- ✅ Advanced reporting

## 🚨 Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   # Kill process on port 5000
   sudo lsof -ti:5000 | xargs kill -9
   
   # Or change port in .env
   PORT=5001
   ```

2. **MongoDB connection failed:**
   ```bash
   # Check if MongoDB is running
   sudo systemctl status mongodb
   
   # Start MongoDB
   sudo systemctl start mongodb
   ```

3. **Node modules issues:**
   ```bash
   # Clear npm cache
   npm cache clean --force
   
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **TypeScript errors:**
   ```bash
   # Use legacy peer deps
   npm install --legacy-peer-deps
   ```

### Logs
- Backend logs: Check terminal where server is running
- Frontend logs: Check browser console
- MongoDB logs: `/var/log/mongodb/mongodb.log`

## 📞 Support

For issues and questions:
- Check the troubleshooting section above
- Review the README.md file
- Create an issue in the repository
- Contact: support@infrasync.com

## 🔄 Updates

To update the application:
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm run install-all

# Restart the application
npm run dev
```

---

**InfraSync** - Premium Helpdesk Solution 🚀 