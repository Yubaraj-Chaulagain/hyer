/**
 * FAR FACE ATTENDANCE PRO - 20 GATE CENTRAL ATTENDANCE API
 *
 * This version keeps the same JSONP API structure and adds:
 * - Type (ENTRY / OUT)
 * - Gate (1-20)
 * - attendanceToday action for TODAY ATTENDANCE
 *
 * Deploy as Web App:
 * Execute as: Me
 * Who has access: Anyone
 *
 * IMPORTANT:
 * After replacing this code, create a NEW deployment or update the
 * existing deployment so the /exec URL serves this version.
 */

const EMPLOYEE_SHEET = 'Employees';
const ATTENDANCE_SHEET = 'Attendance';

function doGet(e) {
  try {
    const p = (e && e.parameter) ? e.parameter : {};
    const action = p.action || '';
    let result;

    if (action === 'employees') {
      result = { success: true, employees: getEmployees() };

    } else if (action === 'saveEmployee') {
      const data = parsePayload(p.data);
      result = saveEmployee(data);

    } else if (action === 'attendance') {
      const data = parsePayload(p.data);
      result = saveAttendance(data);

    } else if (action === 'attendanceToday') {
      const data = parsePayload(p.data);
      result = { success: true, attendance: getAttendanceToday(data.date || '') };

    } else if (action === 'deleteEmployee') {
      const data = parsePayload(p.data);
      result = deleteEmployee(data.id);

    } else {
      result = {
        success: true,
        message: 'FAR Face Attendance Pro API is working.',
        actions: ['employees', 'saveEmployee', 'attendance', 'attendanceToday', 'deleteEmployee']
      };
    }

    return output(result, p.callback || '');

  } catch (err) {
    return output(
      { success: false, error: String(err) },
      e && e.parameter ? e.parameter.callback : ''
    );
  }
}

function doPost(e) {
  try {
    const data = e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};

    const action = data.action || '';
    let result;

    if (action === 'employee' || action === 'registerEmployee' || action === 'saveEmployee') {
      result = saveEmployee(data.data || data);

    } else if (action === 'attendance') {
      result = saveAttendance(data.data || data);

    } else if (action === 'attendanceToday') {
      const payload = data.data || data;
      result = { success: true, attendance: getAttendanceToday(payload.date || '') };

    } else if (action === 'deleteEmployee') {
      result = deleteEmployee((data.data || data).id);

    } else {
      result = { success: false, error: 'Unknown action: ' + action };
    }

    return output(result, '');

  } catch (err) {
    return output({ success: false, error: String(err) }, '');
  }
}

function parsePayload(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch (err) {
    throw new Error('Invalid request data: ' + err.message);
  }
}

function output(data, callback) {
  const json = JSON.stringify(data);

  if (callback) {
    const safe = String(callback).replace(/[^a-zA-Z0-9_$]/g, '');

    return ContentService
      .createTextOutput(safe + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function saveEmployee(data) {
  const sheet = getEmployeeSheet();
  const id = String(data.id || '').trim();

  if (!id) {
    return { success: false, error: 'Employee ID is required.' };
  }

  const row = [
    id,
    String(data.name || '').trim(),
    String(data.trade || '').trim(),
    String(data.company || '').trim(),
    String(data.department || '').trim(),
    String(data.nationality || '').trim(),
    String(data.phone || '').trim(),
    String(data.site || '').trim(),
    String(data.joiningDate || '').trim(),
    String(data.photo || data.photoUrl || '').trim(),
    String(data.faceDescriptor || '').trim(),
    String(data.registeredAt || new Date().toISOString())
  ];

  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();

    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim().toLowerCase() === id.toLowerCase()) {
        const targetRow = i + 2;
        sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);

        return {
          success: true,
          action: 'updated',
          row: targetRow,
          employee: employeeObject(row)
        };
      }
    }
  }

  sheet.appendRow(row);

  return {
    success: true,
    action: 'created',
    row: sheet.getLastRow(),
    employee: employeeObject(row)
  };
}

function getEmployees() {
  const sheet = getEmployeeSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 12).getValues();

  return values
    .filter(r => String(r[0] || '').trim() !== '')
    .map(employeeObject);
}

function employeeObject(row) {
  return {
    id: String(row[0] || ''),
    name: String(row[1] || ''),
    trade: String(row[2] || ''),
    company: String(row[3] || ''),
    department: String(row[4] || ''),
    nationality: String(row[5] || ''),
    phone: String(row[6] || ''),
    site: String(row[7] || ''),
    joiningDate: formatDateValue(row[8]),
    photo: String(row[9] || ''),
    faceDescriptor: String(row[10] || ''),
    registeredAt: String(row[11] || '')
  };
}
function saveAttendance(data) {
  const lock = LockService.getScriptLock();

  try {
    // एकै समयमा आएको दोस्रो request लाई रोक्छ
    lock.waitLock(15000);

    const sheet = getAttendanceSheet();

    const date = String(data.date || '').trim();
    const id = String(data.id || '').trim();
    const type = String(data.type || '').trim().toUpperCase();
    const gate = String(data.gate || '').trim();

    if (!date || !id || !type) {
      return {
        success: false,
        error: 'Attendance requires date, Employee ID and Type.'
      };
    }

    if (type !== 'ENTRY' && type !== 'OUT') {
      return {
        success: false,
        error: 'Invalid attendance type: ' + type
      };
    }

    /*
     * IMPORTANT:
     * Duplicate check happens while the script lock is active.
     * Therefore, two devices cannot save the same attendance simultaneously.
     */
    const duplicate = findAttendance_(date, id, type);

    if (duplicate) {
      return {
        success: true,
        duplicate: true,
        saved: false,
        message:
          'Already scanned: ' + id + ' - ' + type + ' on ' + date,
        row: duplicate.row
      };
    }

    const row = [
      date,                                      // A Date
      String(data.time || ''),                  // B Time
      id,                                       // C Employee ID
      String(data.name || ''),                 // D Name
      String(data.status || ''),               // E Status
      String(data.photo || ''),                // F Photo URL
      String(data.trade || ''),                // G Trade
      String(data.company || ''),              // H Company
      String(data.department || ''),           // I Department
      String(data.nationality || ''),          // J Nationality
      String(data.phone || ''),                // K Phone
      String(data.site || ''),                 // L Site
      String(data.joiningDate || ''),          // M Joining Date
      String(data.matchDistance || ''),        // N Face Match Distance
      type,                                     // O Type
      gate,                                     // P Gate
      new Date()                                // Q Saved At
    ];

    sheet.appendRow(row);
    SpreadsheetApp.flush();

    return {
      success: true,
      saved: true,
      duplicate: false,
      row: sheet.getLastRow(),
      id: id,
      type: type,
      gate: gate,
      message: 'Attendance saved successfully.'
    };

  } catch (err) {
    return {
      success: false,
      saved: false,
      error: 'Attendance save error: ' + err.message
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      // Lock release error safely ignored
    }
  }
}

function getAttendanceToday(date) {
  const sheet = getAttendanceSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const lastCol = Math.max(sheet.getLastColumn(), 17);
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const result = [];

  values.forEach(function(r) {
    const rowDate = normalizeSheetDate_(r[0]);
    if (String(rowDate) !== String(date)) return;
    if (!String(r[2] || '').trim()) return;

    // New format:
    // A Date, B Time, C ID, D Name, E Status, F Photo,
    // G Trade, H Company, I Department, J Nationality, K Phone,
    // L Site, M Joining Date, N Match Distance, O Type, P Gate, Q Saved At
    //
    // For older rows, Type/Gate may be empty.
    let type = String(r[14] || '').trim().toUpperCase();
    let gate = String(r[15] || '').trim();

    // Backward compatibility with older Attendance sheets:
    // If columns O/P are absent, do not guess ENTRY/OUT.
    result.push({
      date: rowDate,
      time: formatTimeValue_(r[1]),
      id: String(r[2] || ''),
      name: String(r[3] || ''),
      status: String(r[4] || ''),
      photo: String(r[5] || ''),
      trade: String(r[6] || ''),
      company: String(r[7] || ''),
      department: String(r[8] || ''),
      nationality: String(r[9] || ''),
      phone: String(r[10] || ''),
      site: String(r[11] || ''),
      joiningDate: formatDateValue(r[12]),
      matchDistance: r[13] === '' ? '' : Number(r[13]),
      type: type,
      gate: gate,
      savedAt: r[16] ? String(r[16]) : ''
    });
  });

  return result;
}

function findAttendance_(date, id, type) {
  const sheet = getAttendanceSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  const lastCol = Math.max(sheet.getLastColumn(), 17);
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const rowDate = normalizeSheetDate_(r[0]);
    const rowId = String(r[2] || '').trim();
    const rowType = String(r[14] || '').trim().toUpperCase();

    if (
      String(rowDate) === String(date) &&
      rowId.toLowerCase() === String(id).toLowerCase() &&
      rowType === String(type).toUpperCase()
    ) {
      return { row: i + 2 };
    }
  }

  return null;
}

function deleteEmployee(id) {
  const sheet = getEmployeeSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return { success: false, error: 'No employees found.' };
  }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();

  for (let i = 0; i < ids.length; i++) {
    if (
      String(ids[i][0]).trim().toLowerCase() ===
      String(id || '').trim().toLowerCase()
    ) {
      sheet.deleteRow(i + 2);
      return { success: true, message: 'Employee deleted successfully.' };
    }
  }

  return { success: false, error: 'Employee ID not found.' };
}

function getEmployeeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(EMPLOYEE_SHEET);

  if (!sheet) sheet = ss.insertSheet(EMPLOYEE_SHEET);

  const headers = [
    'Employee ID', 'Full Name', 'Trade', 'Company', 'Department',
    'Nationality', 'Phone / WhatsApp', 'Site / Project', 'Joining Date',
    'Photo URL', 'Face Descriptor', 'Registered At'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  return sheet;
}

function getAttendanceSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ATTENDANCE_SHEET);

  if (!sheet) sheet = ss.insertSheet(ATTENDANCE_SHEET);

  const headers = [
    'Date', 'Time', 'Employee ID', 'Name', 'Status', 'Photo URL',
    'Trade', 'Company', 'Department', 'Nationality', 'Phone', 'Site',
    'Joining Date', 'Face Match Distance', 'Type', 'Gate', 'Saved At'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  return sheet;
}

function normalizeSheetDate_(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  }

  return String(value).trim().slice(0, 10);
}

function formatDateValue(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  }

  return String(value);
}

function formatTimeValue_(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'HH:mm:ss'
    );
  }

  return String(value);
}
