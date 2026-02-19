// api/_sheets.js — Shared Google Sheets utilities
const { google } = require('googleapis');

function getClient() {
  // Handle both escaped \\n (from env UI) and real newlines
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '')
    .replace(/\\n/g, '\n');

  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth });
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const VISITORS_SHEET = 'Visitors';
const PEOPLE_SHEET = 'People';

async function getSheetData(sheetName) {
  const sheets = getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  const rows = response.data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

async function appendRow(sheetName, rowData) {
  const sheets = getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [rowData] },
  });
}

async function updateRowByColumn(sheetName, searchColumn, searchValue, updates) {
  const sheets = getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  const rows = response.data.values || [];
  if (rows.length < 2) throw new Error('Sheet is empty');
  const headers = rows[0];
  const colIdx = headers.indexOf(searchColumn);
  if (colIdx === -1) throw new Error(`Column "${searchColumn}" not found`);

  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][colIdx] || '') === searchValue) {
      targetRowIndex = i + 1; // Sheets rows are 1-indexed
      break;
    }
  }
  if (targetRowIndex === -1) throw new Error(`Row with ${searchColumn}=${searchValue} not found`);

  const data = [];
  for (const [key, value] of Object.entries(updates)) {
    const ci = headers.indexOf(key);
    if (ci !== -1) {
      // Handle columns beyond Z
      let colLetter;
      if (ci < 26) {
        colLetter = String.fromCharCode(65 + ci);
      } else {
        colLetter = String.fromCharCode(65 + Math.floor(ci / 26) - 1) + String.fromCharCode(65 + (ci % 26));
      }
      data.push({ range: `${sheetName}!${colLetter}${targetRowIndex}`, values: [[value]] });
    }
  }
  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: { valueInputOption: 'USER_ENTERED', data },
    });
  }
}

// CORS helper for all API handlers
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = {
  getSheetData,
  appendRow,
  updateRowByColumn,
  setCors,
  VISITORS_SHEET,
  PEOPLE_SHEET,
};
