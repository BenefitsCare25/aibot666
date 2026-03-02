import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { supabase } from '../../../config/supabase.js';
import { requireSuperAdmin } from '../../middleware/authMiddleware.js';
import { sendAutomationEmail } from '../../services/emailAutomationService.js';

const router = express.Router();

// All routes in this router require super admin
router.use(requireSuperAdmin);

// Multer setup for Excel import
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `email-automation-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') return cb(null, true);
    cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

/**
 * GET /api/admin/email-automation
 */
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('email_automations')
    .select('*')
    .order('portal_name');

  if (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch records', details: error.message });
  }
  res.json({ success: true, data });
});

/**
 * POST /api/admin/email-automation
 */
router.post('/', async (req, res) => {
  const { portal_name, listing_type, recipient_email, cc_list, recipient_name,
          body_content, subject, recurring_day, scheduled_date, is_active } = req.body;

  if (!portal_name || !recipient_email || !recipient_name || !body_content || !subject) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const { data, error } = await supabase
    .from('email_automations')
    .insert({
      portal_name, listing_type, recipient_email, cc_list, recipient_name,
      body_content, subject,
      recurring_day: recurring_day || null,
      scheduled_date: scheduled_date || null,
      is_active: is_active !== false
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ success: false, error: 'Failed to create record', details: error.message });
  }
  res.status(201).json({ success: true, data });
});

/**
 * PUT /api/admin/email-automation/:id
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { portal_name, listing_type, recipient_email, cc_list, recipient_name,
          body_content, subject, recurring_day, scheduled_date, is_active } = req.body;

  if (!portal_name || !recipient_email || !recipient_name || !body_content || !subject) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const { data, error } = await supabase
    .from('email_automations')
    .update({
      portal_name, listing_type, recipient_email, cc_list, recipient_name,
      body_content, subject,
      recurring_day: recurring_day || null,
      scheduled_date: scheduled_date || null,
      is_active: is_active !== false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ success: false, error: 'Failed to update record', details: error.message });
  }
  if (!data) {
    return res.status(404).json({ success: false, error: 'Record not found' });
  }
  res.json({ success: true, data });
});

/**
 * DELETE /api/admin/email-automation/:id
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('email_automations')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete record', details: error.message });
  }
  res.json({ success: true });
});

/**
 * POST /api/admin/email-automation/:id/send
 * Immediate send regardless of schedule
 */
router.post('/:id/send', async (req, res) => {
  const { id } = req.params;
  const { data: record, error } = await supabase
    .from('email_automations')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !record) {
    return res.status(404).json({ success: false, error: 'Record not found' });
  }

  try {
    await sendAutomationEmail(record);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (err) {
    console.error('[EmailAutomation] Send failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to send email', details: err.message });
  }
});

/**
 * POST /api/admin/email-automation/import
 * Parse uploaded Excel file and create/upsert records
 */
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  try {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // Try to find "Email Automation" sheet first, else use first sheet
    const worksheet = workbook.getWorksheet('Email Automation') || workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ success: false, error: 'No worksheet found in file' });
    }

    // Read header row to map column positions
    const headerRow = worksheet.getRow(1);
    const headers = {};
    headerRow.eachCell((cell, colNumber) => {
      const val = cell.value?.toString().trim().toLowerCase() || '';
      headers[val] = colNumber;
    });

    // Helper to get cell text (handles hyperlink objects from ExcelJS)
    const getCellText = (row, colNum) => {
      if (!colNum) return '';
      const cell = row.getCell(colNum);
      if (!cell.value) return '';
      if (typeof cell.value === 'object' && cell.value.text) return cell.value.text.trim();
      if (typeof cell.value === 'object' && cell.value.richText) {
        return cell.value.richText.map(r => r.text).join('').trim();
      }
      return String(cell.value).trim();
    };

    console.log('[EmailAutomation] Detected headers:', JSON.stringify(headers));

    // Find column indexes by common header names
    const colRecipientEmail = headers['recipient email'] || headers['recipient_email'] || headers['email'];
    const colCcList = headers['cc list'] || headers['cc_list'] || headers['cc'];
    const colRecipientName = headers['recipient name'] || headers['recipient_name'] || headers['name'];
    const colBodyContent = headers['body email content'] || headers['body_content'] || headers['body content'] || headers['body'];
    const colSubject = headers['email subject'] || headers['subject'];
    const colPortalName = headers['portal name'] || headers['portal_name'] || headers['portal'];
    const colListingType = headers['listing type'] || headers['listing_type'] || headers['type'];
    const colRecurringDay = headers['recurring day'] || headers['recurring_day'];
    const colScheduledDate = headers['scheduled date'] || headers['scheduled_date'];

    const records = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const portalName = getCellText(row, colPortalName);
      const recipientEmail = getCellText(row, colRecipientEmail);
      const recipientName = getCellText(row, colRecipientName);
      const bodyContent = getCellText(row, colBodyContent);
      const subject = getCellText(row, colSubject);

      if (!portalName && !recipientEmail) return; // Skip empty rows

      records.push({
        portal_name: portalName,
        listing_type: getCellText(row, colListingType) || null,
        recipient_email: recipientEmail,
        cc_list: getCellText(row, colCcList) || null,
        recipient_name: recipientName,
        body_content: bodyContent,
        subject,
        recurring_day: colRecurringDay ? parseInt(getCellText(row, colRecurringDay)) || null : null,
        scheduled_date: colScheduledDate ? getCellText(row, colScheduledDate) || null : null,
        is_active: true
      });
    });

    if (records.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid records found in file' });
    }

    // Fetch existing records by portal_name to decide insert vs update
    const portalNames = records.map(r => r.portal_name).filter(Boolean);
    const { data: existing } = await supabase
      .from('email_automations')
      .select('id, portal_name')
      .in('portal_name', portalNames);

    const existingMap = new Map((existing || []).map(r => [r.portal_name, r.id]));
    const toInsert = records.filter(r => !existingMap.has(r.portal_name));
    const toUpdate = records.filter(r => existingMap.has(r.portal_name));

    let inserted = 0, updated = 0;

    if (toInsert.length > 0) {
      const { error } = await supabase.from('email_automations').insert(toInsert);
      if (error) {
        return res.status(500).json({ success: false, error: 'Failed to insert records', details: error.message });
      }
      inserted = toInsert.length;
    }

    for (const record of toUpdate) {
      const id = existingMap.get(record.portal_name);
      const { error } = await supabase
        .from('email_automations')
        .update({ ...record, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error(`[EmailAutomation] Failed to update ${record.portal_name}:`, error.message);
      } else {
        updated++;
      }
    }

    res.json({ success: true, imported: inserted + updated, inserted, updated });
  } catch (err) {
    console.error('[EmailAutomation] Import error:', err);
    res.status(500).json({ success: false, error: 'Failed to parse Excel file', details: err.message });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

export default router;
