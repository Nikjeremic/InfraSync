const express = require('express');
const { body, validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/comments/ticket/:ticketId
// @desc    Get all comments for a ticket
// @access  Private
router.get('/ticket/:ticketId', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check if user has access to this ticket
    const canAccess = req.user.role === 'admin' || 
                     req.user.company?.toString() === ticket.company.toString() ||
                     ticket.reporter?.toString() === req.user.id ||
                     ticket.assignee?.toString() === req.user.id;

    if (!canAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const comments = await Comment.find({ ticket: req.params.ticketId })
      .populate('author', 'firstName lastName email avatar')
      .sort({ createdAt: 1 })
      .lean();

    // Filter internal comments based on user role
    const filteredComments = comments.map(comment => {
      if (comment.isInternal && !['admin', 'manager', 'agent'].includes(req.user.role)) {
        return {
          ...comment,
          content: '[Internal comment - not visible to customers]',
          author: {
            firstName: 'System',
            lastName: '',
            email: 'system@infrasync.com',
            avatar: ''
          }
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

// @route   POST /api/comments
// @desc    Add a comment to a ticket
// @access  Private
router.post('/', auth, [
  body('ticketId').isMongoId().withMessage('Invalid ticket ID'),
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Comment must be between 1 and 2000 characters'),
  body('isInternal').optional().isBoolean().withMessage('isInternal must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ticketId, content, isInternal = false } = req.body;

    // Check if ticket exists
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check if user has access to this ticket using the new canUserView method
    if (!ticket.canUserView(req.user.id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only staff can create internal comments
    if (isInternal && !['admin', 'manager', 'agent'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only staff can create internal comments' });
    }

    const comment = new Comment({
      ticket: ticketId,
      author: req.user.id,
      content,
      isInternal
    });

    await comment.save();
    await comment.populate('author', 'firstName lastName email avatar');

    // Update ticket status to 'in_progress' if it was 'open'
    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
      await ticket.save();
      
      // Create auto-comment for status change
      const statusComment = new Comment({
        ticket: ticketId,
        author: req.user.id,
        content: `**System Update:** Status changed from open to in_progress`,
        isInternal: false
      });
      await statusComment.save();
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/comments/:id
// @desc    Update a comment
// @access  Private
router.put('/:id', auth, [
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Comment must be between 1 and 2000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user can edit this comment
    if (comment.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only edit your own comments' });
    }

    comment.content = req.body.content;
    await comment.save();
    await comment.populate('author', 'firstName lastName email avatar');

    res.json(comment);
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/comments/:id
// @desc    Delete a comment
// @access  Private (Admin or comment author)
router.delete('/:id', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user can delete this comment
    if (comment.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }

    await Comment.findByIdAndDelete(req.params.id);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 