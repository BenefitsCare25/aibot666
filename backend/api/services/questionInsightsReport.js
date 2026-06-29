import ExcelJS from 'exceljs';

const HEADER_FILL = 'FF1F4B7A';
const SUBHEADER_FILL = 'FF4472C4';
const ESCALATION_FILL = 'FFC0392B';

/**
 * Generate an HR-facing Excel report of chatbot question insights.
 * Built from the same data the dashboard shows (text-matching clusters).
 *
 * @param {Object} params
 * @param {string} params.companyName  Display name of the company
 * @param {string} [params.startDate]  ISO start of the reporting period
 * @param {string} [params.endDate]    ISO end of the reporting period
 * @param {string} params.generatedAt ISO timestamp the report was generated
 * @param {Object} params.quality     Output of getQualityAnalytics()
 * @returns {Promise<Buffer>} xlsx buffer
 */
export async function generateQuestionInsightsReport({ companyName, startDate, endDate, generatedAt, quality }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AI Chatbot';
  workbook.created = generatedAt ? new Date(generatedAt) : undefined;

  const summary = quality?.summary || {};
  const repeated = quality?.repeatedQuestions || [];
  const topics = quality?.topicDistribution || [];
  const unanswered = quality?.unansweredClusters || [];
  const categories = quality?.escalationCategories || [];
  const negative = quality?.recentNegativeFeedback || [];

  buildOverviewSheet(workbook, { companyName, startDate, endDate, generatedAt, summary });
  buildTopicsSheet(workbook, topics);
  buildTopQuestionsSheet(workbook, repeated);
  buildUnansweredSheet(workbook, unanswered);
  buildCategoriesSheet(workbook, categories);
  buildNegativeFeedbackSheet(workbook, negative);

  return workbook.xlsx.writeBuffer();
}

function buildOverviewSheet(workbook, { companyName, startDate, endDate, generatedAt, summary }) {
  const sheet = workbook.addWorksheet('Overview');
  sheet.columns = [{ width: 34 }, { width: 26 }];

  sheet.mergeCells('A1:B1');
  const title = sheet.getCell('A1');
  title.value = 'Chatbot Question Insights';
  title.font = { bold: true, size: 16 };

  sheet.mergeCells('A2:B2');
  sheet.getCell('A2').value = companyName || 'All companies';
  sheet.getCell('A2').font = { size: 11, color: { argb: 'FF6B7280' } };

  addRow(sheet, ['Reporting period', formatPeriod(startDate, endDate)]);
  addRow(sheet, ['Generated', formatDateTime(generatedAt)]);
  sheet.addRow([]);

  const metricsHeader = sheet.addRow(['Metric', 'Value']);
  styleHeaderRow(metricsHeader, HEADER_FILL);

  const rows = [
    ['Total questions asked', summary.totalQuestions ?? 0],
    ['AI answers given', summary.totalAnswers ?? 0],
    ['Escalated to a human', summary.escalations ?? 0],
    ['Escalation rate', formatPercent(summary.escalationRate)],
    ['Escalations resolved', formatPercent(summary.resolutionRate)],
    ['Answers rated by users', summary.ratedAnswers ?? 0],
    ['Liked (thumbs up)', summary.positiveFeedback ?? 0],
    ['Disliked (thumbs down)', summary.negativeFeedback ?? 0],
    ['Avg. response time', formatMs(summary.averageLatencyMs)]
  ];
  rows.forEach(row => addBorderedRow(sheet, row));

  sheet.eachRow(row => row.eachCell(cell => {
    cell.alignment = { vertical: 'middle', wrapText: true };
  }));
}

function buildTopicsSheet(workbook, topics) {
  const sheet = workbook.addWorksheet('Questions by Topic');
  sheet.columns = [{ width: 28 }, { width: 14 }, { width: 12 }];

  const total = topics.reduce((sum, item) => sum + item.count, 0);
  const header = sheet.addRow(['Topic', 'Questions', 'Share']);
  styleHeaderRow(header, HEADER_FILL);

  if (topics.length === 0) {
    addBorderedRow(sheet, ['No classified questions in this period.', '', '']);
  } else {
    topics.forEach(item => {
      const share = total > 0 ? `${Math.round((item.count / total) * 100)}%` : '0%';
      addBorderedRow(sheet, [item.label, item.count, share]);
    });
  }
  wrapCells(sheet);
}

function buildTopQuestionsSheet(workbook, repeated) {
  const sheet = workbook.addWorksheet('Top Questions');
  sheet.columns = [{ width: 8 }, { width: 90 }, { width: 14 }];

  const header = sheet.addRow(['Rank', 'Question (most asked)', 'Times asked']);
  styleHeaderRow(header, SUBHEADER_FILL);

  if (repeated.length === 0) {
    addBorderedRow(sheet, ['', 'No repeated questions in this period.', '']);
  } else {
    repeated.forEach((item, index) => {
      addBorderedRow(sheet, [index + 1, item.question, item.count]);
    });
  }
  wrapCells(sheet);
}

function buildUnansweredSheet(workbook, unanswered) {
  const sheet = workbook.addWorksheet('Unanswered Questions');
  sheet.columns = [{ width: 8 }, { width: 70 }, { width: 24 }, { width: 14 }];

  const header = sheet.addRow(['Rank', 'Question the bot could not answer', 'Category', 'Times escalated']);
  styleHeaderRow(header, ESCALATION_FILL);

  if (unanswered.length === 0) {
    addBorderedRow(sheet, ['', 'No escalated question clusters in this period.', '', '']);
  } else {
    unanswered.forEach((item, index) => {
      addBorderedRow(sheet, [index + 1, item.question, item.category || 'Uncategorized', item.count]);
    });
  }
  wrapCells(sheet);
}

function buildCategoriesSheet(workbook, categories) {
  const sheet = workbook.addWorksheet('Escalation Categories');
  sheet.columns = [{ width: 40 }, { width: 16 }];

  const header = sheet.addRow(['Category', 'Escalations']);
  styleHeaderRow(header, SUBHEADER_FILL);

  if (categories.length === 0) {
    addBorderedRow(sheet, ['No escalations in this period.', '']);
  } else {
    categories.forEach(item => addBorderedRow(sheet, [item.label, item.count]));
  }
  wrapCells(sheet);
}

function buildNegativeFeedbackSheet(workbook, negative) {
  const sheet = workbook.addWorksheet('Negative Feedback');
  sheet.columns = [{ width: 90 }, { width: 40 }];

  const header = sheet.addRow(['Answer marked unhelpful', 'Reason given']);
  styleHeaderRow(header, ESCALATION_FILL);

  if (negative.length === 0) {
    addBorderedRow(sheet, ['No negative feedback in this period.', '']);
  } else {
    negative.forEach(item => addBorderedRow(sheet, [item.answer, item.reason || 'No reason supplied']));
  }
  wrapCells(sheet);
}

// ── helpers ──────────────────────────────────────────────

function addRow(sheet, values) {
  const row = sheet.addRow(values);
  row.getCell(1).font = { bold: true };
  return row;
}

function addBorderedRow(sheet, values) {
  const row = sheet.addRow(values);
  row.eachCell(cell => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  return row;
}

function styleHeaderRow(row, fillColor) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
  row.eachCell(cell => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
}

function wrapCells(sheet) {
  sheet.eachRow(row => row.eachCell(cell => {
    cell.alignment = { vertical: 'top', wrapText: true };
  }));
}

function formatPeriod(startDate, endDate) {
  if (!startDate && !endDate) return 'All time';
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toISOString().split('T')[0];
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function formatPercent(value) {
  return `${Number(value) || 0}%`;
}

function formatMs(value) {
  const ms = Number(value) || 0;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms} ms`;
}
