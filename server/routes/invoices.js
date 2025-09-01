const express = require('express');
const { body, validationResult } = require('express-validator');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const Ticket = require('../models/Ticket');
const Company = require('../models/Company');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

function formatCurrency(amount, currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function getCustomerRoundedHoursFromTicket(ticket) {
  const totalMinutes = (ticket.actualTime || 0);
  const totalHours = Math.ceil(totalMinutes / 60);
  return Math.max(1, totalHours);
}

function generateInvoicePdf({ invoiceNumber, ticket, company, rate, currency, taxPercent }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', (d) => chunks.push(d));

  const roundedHours = getCustomerRoundedHoursFromTicket(ticket);
  const subtotal = rate * roundedHours;
  const tax = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
  const total = subtotal + tax;

  // Header
  doc.fontSize(20).text('Invoice', { align: 'right' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Invoice No: ${invoiceNumber}`, { align: 'right' });
  doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });

  // From / To
  doc.moveDown(1);
  doc.fontSize(12).text('From:', { underline: true });
  doc.fontSize(10).text(process.env.INVOICE_FROM_NAME || 'InfraSync');
  doc.text(process.env.INVOICE_FROM_ADDRESS || 'Address');
  doc.text(process.env.INVOICE_FROM_EMAIL || 'no-reply@infrasync.com');

  doc.moveDown(0.5);
  doc.fontSize(12).text('Bill To:', { underline: true });
  doc.fontSize(10).text(company?.name || ticket.company?.name || 'Customer');
  if (company?.email) doc.text(company.email);

  // Line items
  doc.moveDown(1);
  doc.fontSize(12).text('Details', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Ticket: ${ticket.ticketNumber} - ${ticket.title}`);
  doc.text(`Description: ${ticket.description}`);
  doc.text(`Rounded Hours: ${roundedHours}h`);
  doc.text(`Rate: ${formatCurrency(rate, currency)} / hour`);

  // Totals
  doc.moveDown(1);
  doc.fontSize(12).text('Summary', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Subtotal: ${formatCurrency(subtotal, currency)}`);
  doc.text(`Tax (${taxPercent}%): ${formatCurrency(tax, currency)}`);
  doc.text(`Total: ${formatCurrency(total, currency)}`);

  doc.end();
  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function sendEmailWithAttachment({ to, subject, text, buffer, filename }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.INVOICE_FROM_EMAIL || process.env.SMTP_USER,
    to,
    subject,
    text,
    attachments: [
      { filename, content: buffer }
    ]
  });
}

// POST /api/invoices
router.post('/', auth, requireRole(['admin', 'manager']), [
  body('ticketId').isMongoId().withMessage('ticketId is required'),
  body('rate').isFloat({ min: 0 }).withMessage('rate must be >= 0'),
  body('currency').isString().isLength({ min: 3, max: 3 }).withMessage('currency must be ISO 4217'),
  body('taxPercent').optional().isFloat({ min: 0, max: 100 }),
  body('recipientEmail').optional().isEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let { ticketId, rate, currency, taxPercent = 0, recipientEmail } = req.body;

    const ticket = await Ticket.findById(ticketId)
      .populate('company', 'name email billing')
      .lean();
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Company info (if exists)
    let company = null;
    if (ticket.company?._id) {
      company = await Company.findById(ticket.company._id).lean();
      if ((rate === undefined || rate === null) && company?.billing?.hourlyRate) {
        rate = company.billing.hourlyRate;
      }
      if ((!currency || currency.length !== 3) && company?.billing?.currency) {
        currency = company.billing.currency;
      }
    }

    if (rate === undefined || rate === null) {
      return res.status(400).json({ message: 'Rate is required (no company default available)' });
    }

    if (!currency || currency.length !== 3) {
      return res.status(400).json({ message: 'Currency is required (no company default available)' });
    }

    // Invoice number naive
    const invoiceNumber = `INV-${Date.now()}`;

    const pdfBuffer = await generateInvoicePdf({ invoiceNumber, ticket, company, rate: Number(rate), currency, taxPercent: Number(taxPercent) });

    const toEmail = recipientEmail || company?.email || process.env.FALLBACK_INVOICE_EMAIL;
    if (!toEmail) {
      return res.status(400).json({ message: 'No recipient email provided or available' });
    }

    await sendEmailWithAttachment({
      to: toEmail,
      subject: `Invoice ${invoiceNumber} for ${ticket.ticketNumber}`,
      text: `Please find attached the invoice ${invoiceNumber} for ticket ${ticket.ticketNumber}.`,
      buffer: pdfBuffer,
      filename: `${invoiceNumber}.pdf`
    });

    res.json({ message: 'Invoice generated and sent', invoiceNumber });
  } catch (err) {
    console.error('Invoice generation error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 