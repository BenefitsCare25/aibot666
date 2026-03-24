import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { supabase } from '../../../config/supabase.js';
import { requireSuperAdmin } from '../../middleware/authMiddleware.js';
import { sendAutomationEmail } from '../../services/emailAutomationService.js';
import { safeErrorDetails } from '../../utils/response.js';

const router = express.Router();
router.use(requireSuperAdmin);

// Multer setup
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

// ─── Shared Excel parsing helper ────────────────────────────────────────────

function getCellText(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.text) return v.text.trim();
  if (typeof v === 'object' && v.richText) return v.richText.map(r => r.text).join('').trim();
  // Fallback: use hyperlink text if value is empty-ish object
  if (typeof v === 'object' && cell.hyperlink) {
    return cell.hyperlink.replace(/^mailto:/i, '').trim();
  }
  return String(v).trim();
}

async function parseExcelWorkbook(filePath) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheetNames = workbook.worksheets.map(ws => ws.name);
  const worksheet = workbook.getWorksheet('Email Automation') || workbook.worksheets[0];
  if (!worksheet) throw new Error('No worksheet found in file');

  // Build header map
  const headers = {};
  const rawHeaders = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    const label = cell.value?.toString().trim() || '';
    rawHeaders.push({ col, label });
    headers[label.toLowerCase()] = col;
  });

  // Column mapping — includes common typos and aliases
  const colMap = {
    portalName:     headers['portal name']       || headers['portal_name']      || headers['portal'],
    listingType:    headers['listing type']       || headers['listing_type']     || headers['type'],
    recipientEmail: headers['recipient email']    || headers['recipent email']   || headers['recipient_email'] || headers['recipent_email'] || headers['email'] || headers['to'],
    ccList:         headers['cc list']            || headers['cc_list']          || headers['cc'],
    recipientName:  headers['recipient name']     || headers['recipient_name']   || headers['name'],
    bodyContent:    headers['body email content'] || headers['body_content']     || headers['body content']    || headers['body'],
    subject:        headers['email subject']      || headers['subject'],
    recurringDay:   headers['recurring day']      || headers['recurring_day'],
    scheduledDate:  headers['scheduled date']     || headers['scheduled_date'],
    sendTime:       headers['send time']          || headers['send_time']        || headers['time'],
  };

  // Validation: required columns
  const REQUIRED = ['recipientEmail', 'recipientName', 'bodyContent', 'subject'];
  const errors = REQUIRED
    .filter(k => !colMap[k])
    .map(k => `Required column not found: "${k.replace(/([A-Z])/g, ' $1').trim()}"`);

  const warnings = [];
  if (!colMap.portalName) warnings.push('No "Portal Name" column found — portal_name will be empty');

  // Parse rows
  const records = [];
  worksheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const portalName     = colMap.portalName     ? getCellText(row.getCell(colMap.portalName))     : '';
    const recipientEmail = colMap.recipientEmail ? getCellText(row.getCell(colMap.recipientEmail)) : '';
    const recipientName  = colMap.recipientName  ? getCellText(row.getCell(colMap.recipientName))  : '';
    const bodyContent    = colMap.bodyContent    ? getCellText(row.getCell(colMap.bodyContent))    : '';
    const subject        = colMap.subject        ? getCellText(row.getCell(colMap.subject))        : '';

    // Skip completely empty rows
    if (!portalName && !recipientEmail && !recipientName && !subject) return;

    const rawDay = colMap.recurringDay ? getCellText(row.getCell(colMap.recurringDay)) : '';
    const rawTime = colMap.sendTime ? getCellText(row.getCell(colMap.sendTime)) : '';

    records.push({
      portal_name:     portalName  || null,
      listing_type:    colMap.listingType   ? getCellText(row.getCell(colMap.listingType))  || null : null,
      recipient_email: recipientEmail || null,
      cc_list:         colMap.ccList        ? getCellText(row.getCell(colMap.ccList))       || null : null,
      recipient_name:  recipientName || null,
      body_content:    bodyContent   || null,
      subject:         subject       || null,
      recurring_day:   rawDay ? parseInt(rawDay) || null : null,
      scheduled_date:  colMap.scheduledDate ? getCellText(row.getCell(colMap.scheduledDate)) || null : null,
      send_time:       rawTime || '08:00',
      is_active:       true,
    });
  });

  return { sheetNames, usedSheet: worksheet.name, rawHeaders, colMap, errors, warnings, records };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('email_automations')
    .select('*')
    .order('portal_name');
  if (error) return res.status(500).json({ success: false, error: 'Failed to fetch records', details: safeErrorDetails(error) });
  res.json({ success: true, data });
});

router.post('/', async (req, res) => {
  const { portal_name, listing_type, recipient_email, cc_list, recipient_name,
          body_content, subject, recurring_day, scheduled_date, send_time, is_active } = req.body;

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
      send_time: send_time || '08:00',
      is_active: is_active !== false
    })
    .select()
    .single();

  if (error) return res.status(500).json({ success: false, error: 'Failed to create record', details: safeErrorDetails(error) });
  res.status(201).json({ success: true, data });
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { portal_name, listing_type, recipient_email, cc_list, recipient_name,
          body_content, subject, recurring_day, scheduled_date, send_time, is_active } = req.body;

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
      send_time: send_time || '08:00',
      is_active: is_active !== false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ success: false, error: 'Failed to update record', details: safeErrorDetails(error) });
  if (!data) return res.status(404).json({ success: false, error: 'Record not found' });
  res.json({ success: true, data });
});

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('email_automations').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ success: false, error: 'Failed to delete record', details: safeErrorDetails(error) });
  res.json({ success: true });
});

router.post('/:id/send', async (req, res) => {
  const { data: record, error } = await supabase
    .from('email_automations').select('*').eq('id', req.params.id).single();
  if (error || !record) return res.status(404).json({ success: false, error: 'Record not found' });
  try {
    await sendAutomationEmail(record);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (err) {
    console.error('[EmailAutomation] Send failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to send email', details: safeErrorDetails(err) });
  }
});

// ─── Import: Preview (validate without inserting) ────────────────────────────

router.post('/import/preview', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  const filePath = req.file.path;
  try {
    const { sheetNames, usedSheet, rawHeaders, colMap, errors, warnings, records } =
      await parseExcelWorkbook(filePath);

    // Summarise which required/optional columns were detected
    const columnStatus = {
      portalName:     { found: !!colMap.portalName,     required: false },
      recipientEmail: { found: !!colMap.recipientEmail, required: true  },
      ccList:         { found: !!colMap.ccList,         required: false },
      recipientName:  { found: !!colMap.recipientName,  required: true  },
      bodyContent:    { found: !!colMap.bodyContent,    required: true  },
      subject:        { found: !!colMap.subject,        required: true  },
      recurringDay:   { found: !!colMap.recurringDay,   required: false },
      scheduledDate:  { found: !!colMap.scheduledDate,  required: false },
      sendTime:       { found: !!colMap.sendTime,       required: false },
    };

    res.json({
      success: true,
      sheetNames,
      usedSheet,
      rawHeaders,
      columnStatus,
      errors,
      warnings,
      totalRows: records.length,
      preview: records.slice(0, 3)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

// ─── Import: Commit ──────────────────────────────────────────────────────────

router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  const filePath = req.file.path;
  try {
    const { errors, records } = await parseExcelWorkbook(filePath);

    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.join('; ') });
    }
    if (records.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid records found in file' });
    }

    // Fetch existing to decide insert vs update
    const portalNames = records.map(r => r.portal_name).filter(Boolean);
    const { data: existing } = await supabase
      .from('email_automations')
      .select('id, portal_name')
      .in('portal_name', portalNames);

    const existingMap = new Map((existing || []).map(r => [r.portal_name, r.id]));
    const toInsert = records.filter(r => r.portal_name && !existingMap.has(r.portal_name));
    const toUpdate = records.filter(r => r.portal_name &&  existingMap.has(r.portal_name));
    // Records without portal_name always insert
    const noName = records.filter(r => !r.portal_name);

    let inserted = 0, updated = 0;

    const allInserts = [...toInsert, ...noName];
    if (allInserts.length > 0) {
      const { error } = await supabase.from('email_automations').insert(allInserts);
      if (error) return res.status(500).json({ success: false, error: 'Failed to insert records', details: safeErrorDetails(error) });
      inserted = allInserts.length;
    }

    for (const record of toUpdate) {
      const id = existingMap.get(record.portal_name);
      const { error } = await supabase
        .from('email_automations')
        .update({ ...record, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (!error) updated++;
      else console.error(`[EmailAutomation] Failed to update ${record.portal_name}:`, error.message);
    }

    res.json({ success: true, imported: inserted + updated, inserted, updated });
  } catch (err) {
    console.error('[EmailAutomation] Import error:', err);
    res.status(500).json({ success: false, error: 'Failed to parse Excel file', details: safeErrorDetails(err) });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

export default router;
