const express = require('express');
const { query } = require('express-validator');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { auth, requirePermission, requirePremium } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/analytics/overview
// @desc    Get analytics overview
// @access  Private (Premium required)
router.get('/overview', auth, requirePremium, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filter = {};
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Basic ticket statistics
    const totalTickets = await Ticket.countDocuments(filter);
    const openTickets = await Ticket.countDocuments({ ...filter, status: 'open' });
    const inProgressTickets = await Ticket.countDocuments({ ...filter, status: 'in_progress' });
    const resolvedTickets = await Ticket.countDocuments({ ...filter, status: 'resolved' });
    const closedTickets = await Ticket.countDocuments({ ...filter, status: 'closed' });

    // Priority distribution
    const priorityStats = await Ticket.aggregate([
      { $match: filter },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    // Category distribution
    const categoryStats = await Ticket.aggregate([
      { $match: filter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Average resolution time
    const resolutionTimeStats = await Ticket.aggregate([
      { $match: { ...filter, resolvedAt: { $exists: true } } },
      {
        $addFields: {
          resolutionTime: {
            $divide: [
              { $subtract: ['$resolvedAt', '$createdAt'] },
              1000 * 60 * 60 // Convert to hours
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: '$resolutionTime' },
          minResolutionTime: { $min: '$resolutionTime' },
          maxResolutionTime: { $max: '$resolutionTime' }
        }
      }
    ]);

    // SLA breach statistics
    const slaBreached = await Ticket.countDocuments({ ...filter, 'sla.breached': true });
    const slaCompliance = totalTickets > 0 ? ((totalTickets - slaBreached) / totalTickets) * 100 : 0;

    // Time tracking statistics (Premium feature)
    const timeTrackingStats = await Ticket.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalTimeSpent: { $sum: '$totalTimeSpent' },
          avgTimePerTicket: { $avg: '$totalTimeSpent' },
          totalEstimatedTime: { $sum: '$estimatedTime' }
        }
      }
    ]);

    // Agent performance
    const agentStats = await Ticket.aggregate([
      { $match: { ...filter, assignee: { $exists: true } } },
      {
        $group: {
          _id: '$assignee',
          ticketCount: { $sum: 1 },
          resolvedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          avgResolutionTime: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'resolved'] },
                { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60] },
                null
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agent'
        }
      },
      { $unwind: '$agent' },
      {
        $project: {
          agentName: { $concat: ['$agent.firstName', ' ', '$agent.lastName'] },
          ticketCount: 1,
          resolvedCount: 1,
          avgResolutionTime: 1,
          resolutionRate: {
            $multiply: [
              { $divide: ['$resolvedCount', '$ticketCount'] },
              100
            ]
          }
        }
      },
      { $sort: { ticketCount: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      overview: {
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        closedTickets,
        slaBreached,
        slaCompliance: Math.round(slaCompliance * 100) / 100
      },
      priorityStats,
      categoryStats,
      resolutionTime: resolutionTimeStats[0] || {
        avgResolutionTime: 0,
        minResolutionTime: 0,
        maxResolutionTime: 0
      },
      timeTracking: timeTrackingStats[0] || {
        totalTimeSpent: 0,
        avgTimePerTicket: 0,
        totalEstimatedTime: 0
      },
      agentStats
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/analytics/trends
// @desc    Get ticket trends over time
// @access  Private (Premium required)
router.get('/trends', auth, requirePremium, [
  query('period').isIn(['daily', 'weekly', 'monthly']).withMessage('Invalid period'),
  query('startDate').isISO8601().withMessage('Invalid start date'),
  query('endDate').isISO8601().withMessage('Invalid end date')
], async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Generate date format based on period
    let dateFormat;
    let groupBy;
    
    switch (period) {
      case 'daily':
        dateFormat = '%Y-%m-%d';
        groupBy = { $dateToString: { format: dateFormat, date: '$createdAt' } };
        break;
      case 'weekly':
        dateFormat = '%Y-W%U';
        groupBy = { $dateToString: { format: dateFormat, date: '$createdAt' } };
        break;
      case 'monthly':
        dateFormat = '%Y-%m';
        groupBy = { $dateToString: { format: dateFormat, date: '$createdAt' } };
        break;
    }

    const trends = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: groupBy,
          totalTickets: { $sum: 1 },
          openTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          },
          resolvedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          closedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
          },
          urgentTickets: {
            $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(trends);
  } catch (error) {
    console.error('Analytics trends error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/analytics/performance
// @desc    Get agent performance metrics
// @access  Private (Premium required)
router.get('/performance', auth, requirePremium, async (req, res) => {
  try {
    const { startDate, endDate, agentId } = req.query;
    
    const filter = {};
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (agentId) {
      filter.assignee = agentId;
    }

    const performance = await Ticket.aggregate([
      { $match: { ...filter, assignee: { $exists: true } } },
      {
        $group: {
          _id: '$assignee',
          totalAssigned: { $sum: 1 },
          totalResolved: {
            $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] }
          },
          totalOpen: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          },
          totalInProgress: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
          },
          avgResolutionTime: {
            $avg: {
              $cond: [
                { $in: ['$status', ['resolved', 'closed']] },
                { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60] },
                null
              ]
            }
          },
          totalTimeSpent: { $sum: '$totalTimeSpent' },
          totalEstimatedTime: { $sum: '$estimatedTime' },
          slaBreaches: {
            $sum: { $cond: ['$sla.breached', 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agent'
        }
      },
      { $unwind: '$agent' },
      {
        $addFields: {
          resolutionRate: {
            $multiply: [
              { $divide: ['$totalResolved', '$totalAssigned'] },
              100
            ]
          },
          efficiency: {
            $cond: [
              { $gt: ['$totalEstimatedTime', 0] },
              { $multiply: [{ $divide: ['$totalEstimatedTime', '$totalTimeSpent'] }, 100] },
              0
            ]
          }
        }
      },
      {
        $project: {
          agentName: { $concat: ['$agent.firstName', ' ', '$agent.lastName'] },
          agentEmail: '$agent.email',
          agentDepartment: '$agent.department',
          totalAssigned: 1,
          totalResolved: 1,
          totalOpen: 1,
          totalInProgress: 1,
          avgResolutionTime: 1,
          totalTimeSpent: 1,
          totalEstimatedTime: 1,
          slaBreaches: 1,
          resolutionRate: 1,
          efficiency: 1
        }
      },
      { $sort: { totalAssigned: -1 } }
    ]);

    res.json(performance);
  } catch (error) {
    console.error('Performance analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/analytics/categories
// @desc    Get category-wise analytics
// @access  Private (Premium required)
router.get('/categories', auth, requirePremium, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filter = {};
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const categoryAnalytics = await Ticket.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          totalTickets: { $sum: 1 },
          openTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          },
          resolvedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          avgResolutionTime: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'resolved'] },
                { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60] },
                null
              ]
            }
          },
          totalTimeSpent: { $sum: '$totalTimeSpent' },
          urgentTickets: {
            $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] }
          },
          highPriorityTickets: {
            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          resolutionRate: {
            $multiply: [
              { $divide: ['$resolvedTickets', '$totalTickets'] },
              100
            ]
          }
        }
      },
      { $sort: { totalTickets: -1 } }
    ]);

    res.json(categoryAnalytics);
  } catch (error) {
    console.error('Category analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/analytics/export
// @desc    Export analytics data (Enterprise feature)
// @access  Private (Enterprise required)
router.get('/export', auth, requirePermission('export_data'), async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    const filter = {};
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const tickets = await Ticket.find(filter)
      .populate('requester', 'firstName lastName email')
      .populate('assignee', 'firstName lastName email')
      .lean();

    if (format === 'csv') {
      // Convert to CSV format
      const csvData = tickets.map(ticket => ({
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        requester: `${ticket.requester?.firstName} ${ticket.requester?.lastName}`,
        assignee: ticket.assignee ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}` : '',
        createdAt: ticket.createdAt,
        resolvedAt: ticket.resolvedAt,
        totalTimeSpent: ticket.totalTimeSpent,
        slaBreached: ticket.sla.breached
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.csv');
      
      // Simple CSV conversion
      const csv = [
        Object.keys(csvData[0]).join(','),
        ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
      ].join('\n');
      
      res.send(csv);
    } else {
      res.json(tickets);
    }
  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 