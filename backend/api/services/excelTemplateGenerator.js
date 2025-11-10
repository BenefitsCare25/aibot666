import ExcelJS from 'exceljs';

/**
 * Generate Excel template for Quick Questions
 * Returns a buffer that can be sent as download
 */
export async function generateQuickQuestionsTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Quick Questions Template');

  // Set column widths
  worksheet.columns = [
    { key: 'no', width: 8 },
    { key: 'question', width: 60 },
    { key: 'answer', width: 80 }
  ];

  // Add title and instructions
  worksheet.mergeCells('A1:C1');
  worksheet.getCell('A1').value = 'QUICK QUESTIONS TEMPLATE';
  worksheet.getCell('A1').font = { bold: true, size: 16 };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A2:C2');
  worksheet.getCell('A2').value = 'Instructions: Use the format below to organize your questions by category.';
  worksheet.getCell('A2').font = { italic: true, size: 10 };

  worksheet.addRow([]);

  // Example Category 1: Benefit Coverage
  const benefitHeaderRow = worksheet.addRow(['No', 'Benefit Coverage', 'Answer']);
  benefitHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  benefitHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };

  worksheet.addRow([
    1,
    'How do I check my coverage balance?',
    'You can check your coverage balance by logging into the portal and navigating to the Benefits section.'
  ]);

  worksheet.addRow([
    2,
    'What is the claim limit?',
    'The claim limit varies by plan. Please refer to your policy document for specific limits.'
  ]);

  worksheet.addRow([
    3,
    'How long is the referral valid?',
    'Referral letters are typically valid for 6 months from the date of issue.'
  ]);

  worksheet.addRow([]); // Empty row between categories

  // Example Category 2: Letter of Guarantee
  const logHeaderRow = worksheet.addRow(['No', 'Letter of Guarantee (LOG)', 'Answer']);
  logHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  logHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF70AD47' }
  };

  worksheet.addRow([
    1,
    'How do I request for a Letter of Guarantee?',
    'To request a LOG, please provide your referral letter, pre-admission letter, and cost estimate form.'
  ]);

  worksheet.addRow([]); // Empty row between categories

  // Example Category 3: Portal Matters
  const portalHeaderRow = worksheet.addRow(['No', 'Portal Matters', 'Answer']);
  portalHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  portalHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFC000' }
  };

  worksheet.addRow([
    1,
    'How do I submit claims?',
    'Log in to the portal, go to New Claims, select the date, and choose Claim Category: Insurance.'
  ]);

  worksheet.addRow([
    2,
    'I cannot log in, what should I do?',
    'Click on "First Time Login/Forgot your password" to reset your password.'
  ]);

  worksheet.addRow([
    3,
    'How do I update my contact details?',
    'Please email us at helpdesk@inspro.com.sg with your updated contact information.'
  ]);

  worksheet.addRow([]); // Empty row

  // Add instructions at the bottom
  worksheet.addRow([]);
  const instructionsRow = worksheet.addRow(['', 'HOW TO USE THIS TEMPLATE:', '']);
  instructionsRow.font = { bold: true, size: 12 };

  worksheet.addRow(['', '1. Category Headers: Create a row with "No" in column A, your category name in column B, and "Answer" in column C', '']);
  worksheet.addRow(['', '2. Question Rows: Number each question in column A, write the question in column B, and the answer in column C', '']);
  worksheet.addRow(['', '3. You can add as many categories and questions as needed', '']);
  worksheet.addRow(['', '4. Leave empty rows between categories for better readability (optional)', '']);
  worksheet.addRow(['', '5. Available category icons: benefit/coverage (shield), log/guarantee (document), portal/system (computer), claim (clipboard)', '']);

  // Apply borders to example data
  for (let row = 4; row <= 15; row++) {
    for (let col = 1; col <= 3; col++) {
      const cell = worksheet.getRow(row).getCell(col);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
  }

  // Wrap text for better readability
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Generate Excel template for Knowledge Base
 * Returns a buffer that can be sent as download
 */
export async function generateKnowledgeBaseTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Knowledge Base Template');

  // Set column widths
  worksheet.columns = [
    { key: 'title', width: 40 },
    { key: 'content', width: 80 },
    { key: 'category', width: 20 },
    { key: 'subcategory', width: 20 }
  ];

  // Add title and instructions
  worksheet.mergeCells('A1:D1');
  worksheet.getCell('A1').value = 'KNOWLEDGE BASE TEMPLATE';
  worksheet.getCell('A1').font = { bold: true, size: 16 };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A2:D2');
  worksheet.getCell('A2').value = 'Instructions: Fill in the columns below with your knowledge base entries. First row is the header.';
  worksheet.getCell('A2').font = { italic: true, size: 10 };

  worksheet.addRow([]);

  // Header row
  const headerRow = worksheet.addRow(['Title', 'Content', 'Category', 'Subcategory']);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };

  // Example rows
  worksheet.addRow([
    'Medical Benefits Policy',
    'All employees are covered for medical expenses up to $50,000 per year. This includes hospitalization, outpatient treatment, and specialist consultations. Pre-approval is required for procedures exceeding $5,000.',
    'benefits',
    'medical'
  ]);

  worksheet.addRow([
    'Dental Coverage Guidelines',
    'Dental coverage includes routine checkups, cleanings, and basic dental work. Maximum annual limit is $1,500. Cosmetic procedures are not covered unless medically necessary.',
    'benefits',
    'dental'
  ]);

  worksheet.addRow([
    'Claim Submission Process',
    'To submit a claim:\n1. Log in to the portal\n2. Navigate to New Claims section\n3. Select the claim date\n4. Upload supporting documents\n5. Submit for processing\n\nClaims are typically processed within 5-7 business days.',
    'claims',
    'reimbursement'
  ]);

  worksheet.addRow([
    'Letter of Guarantee Requirements',
    'To request a Letter of Guarantee (LOG), you must provide:\n- Valid referral letter from your GP\n- Pre-admission letter from hospital\n- Cost estimate form\n- Employee ID card\n\nLOG requests should be submitted at least 3 working days before admission.',
    'procedures',
    'log'
  ]);

  worksheet.addRow([
    'Escalation Procedure',
    'If your issue is not resolved within 48 hours:\n1. Contact your HR representative\n2. Provide case reference number\n3. Escalate to Benefits Manager if needed\n4. Final escalation to Director of HR\n\nAll escalations are tracked and reviewed weekly.',
    'policies',
    'escalation'
  ]);

  worksheet.addRow([
    'Portal Password Reset',
    'If you forgot your password:\n1. Click "Forgot Password" on login page\n2. Enter your registered email\n3. Check your inbox for reset link\n4. Create a new password (minimum 8 characters)\n\nFor first-time users, click "First Time Login" instead.',
    'procedures',
    'portal'
  ]);

  worksheet.addRow([]); // Empty row

  // Add instructions at the bottom
  const instructionsRow = worksheet.addRow(['HOW TO USE THIS TEMPLATE:', '', '', '']);
  instructionsRow.font = { bold: true, size: 12 };

  worksheet.addRow(['1. Title (Column A): Short, descriptive title for the knowledge entry (Required)', '', '', '']);
  worksheet.addRow(['2. Content (Column B): Detailed information, policies, or procedures (Required)', '', '', '']);
  worksheet.addRow(['3. Category (Column C): Main category like benefits, claims, policies, procedures, escalations', '', '', '']);
  worksheet.addRow(['4. Subcategory (Column D): Optional subcategory like medical, dental, portal, etc.', '', '', '']);
  worksheet.addRow(['5. First row (row 4) is the header and will be skipped during import', '', '', '']);
  worksheet.addRow(['6. You can use \\n in content for line breaks', '', '', '']);
  worksheet.addRow(['7. If category is left blank, it will default to "general"', '', '', '']);

  // Apply borders to example data
  for (let row = 4; row <= 10; row++) {
    for (let col = 1; col <= 4; col++) {
      const cell = worksheet.getRow(row).getCell(col);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
  }

  // Wrap text for better readability
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
