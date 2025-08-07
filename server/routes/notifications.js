const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');

const router = express.Router();

// In-memory storage for notifications (in production, use Redis or database)
let notifications = [];

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const userNotifications = notifications
      .filter(notification => notification.userId === req.user._id.toString())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(userNotifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/notifications/mark-read
// @desc    Mark notifications as read
// @access  Private
router.post('/mark-read', auth, [
  body('notificationIds').isArray().withMessage('Notification IDs must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { notificationIds } = req.body;

    notifications = notifications.map(notification => {
      if (notificationIds.includes(notification.id) && notification.userId === req.user._id.toString()) {
        return { ...notification, read: true };
      }
      return notification;
    });

    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    notifications = notifications.filter(notification => 
      !(notification.id === notificationId && notification.userId === req.user._id.toString())
    );

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/notifications/clear-all
// @desc    Clear all user notifications
// @access  Private
router.post('/clear-all', auth, async (req, res) => {
  try {
    notifications = notifications.filter(notification => 
      notification.userId !== req.user._id.toString()
    );

    res.json({ message: 'All notifications cleared' });
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to create notifications
const createNotification = (userId, type, title, message, data = {}) => {
  const notification = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    userId,
    type,
    title,
    message,
    data,
    read: false,
    createdAt: new Date().toISOString()
  };

  notifications.push(notification);
  return notification;
};

// Export the helper function for use in other routes
module.exports = { router, createNotification }; 