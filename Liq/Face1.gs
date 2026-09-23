/**
 * ============================================================
 * FAR FACE ATTENDANCE PRO - 20 GATE API
 * ENTRY / OUT / TODAY ATTENDANCE
 * ============================================================
 *
 * Google Sheet:
 *   Employees
 *   Attendance
 *
 * Attendance columns:
 * Date | Time | Type | Gate | Employee ID | Name | Status |
 * Photo URL | Trade | Company | Department | Nationality |
 * Phone | Site | Joining Date | Face Match Distance | Saved At
 *
 * Deploy:
 * Execute as: Me
 * Who has access: Anyone
 * Use /exec URL
 * ============================================================
 */

const EMPLOYEE_SHEET = 'Employees';
const ATTENDANCE_SHEET = 'Attendance';

const EMPLOYEE_HEADERS = [
  'Employee ID',
  'Full Name',
  'Trade',
  'Company',
  'Department',
  'Nationality',
  'Phone / WhatsApp',
  'Site / Project',
  'Joining Date',
  'Photo URL',
  'Face Descriptor',
  'Registered At'
];

const ATTENDANCE_HEADERS = [
  'Date',
  'Time',
  'Type',
  'Gate',
  'Employee ID',
  'Name',
  'Status',
  'Photo URL',
  'Trade',
  'Company',
  'Department',
  'Nationality',
  'Phone',
  'Site',
  'Joining Date',
  'Face Match Distance',
  'Saved At'
];


/* ============================================================
   GET API
   ============================================================ */

function doGet(e) {

  try {

    const p = (e && e.parameter) ? e.parameter : {};
    const action = p.action || '';

    let result;

    if (action === 'employees') {

      result = {
        success: true,
        employees: getEmployees()
      };

    }

    else if (action === 'saveEmployee') {

      const data = parsePayload(p.data);

      result = saveEmployee(data);

    }

    else if (action === 'attendance') {

      const data = parsePayload(p.data);

      result = saveAttendance(data);

    }

    else if (action === 'todayAttendance') {

      result = {
        success: true,
        attendance: getTodayAttendance()
      };

    }

    else if (action === 'deleteEmployee') {

      const data = parsePayload(p.data);

      result = deleteEmployee(data.id);

    }

    else {

      result = {
        success: true,
        message: 'FAR Face Attendance Pro 20-Gate API is working.',
        actions: [
          'employees',
          'saveEmployee',
          'attendance',
          'todayAttendance',
          'deleteEmployee'
        ]
      };

    }

    return output(
      result,
      p.callback || ''
    );

  }

  catch (err) {

    return output(
      {
        success: false,
        error: String(err)
      },
      e && e.parameter
        ? e.parameter.callback
        : ''
    );

  }

}


/* ============================================================
   POST API
   ============================================================ */

function doPost(e) {

  try {

    const data =
      e &&
      e.postData &&
      e.postData.contents
        ? JSON.parse(e.postData.contents)
        : {};

    const action = data.action || '';

    let result;

    if (
      action === 'employee' ||
      action === 'registerEmployee' ||
      action === 'saveEmployee'
    ) {

      result = saveEmployee(
        data.data || data
      );

    }

    else if (action === 'attendance') {

      result = saveAttendance(data.data || data);

    }

    else if (action === 'todayAttendance') {

      result = {
        success: true,
        attendance: getTodayAttendance()
      };

    }

    else if (action === 'deleteEmployee') {

      result = deleteEmployee(
        (data.data || data).id
      );

    }

    else {

      result = {
        success: false,
        error: 'Unknown action: ' + action
      };

    }

    return output(result, '');

  }

  catch (err) {

    return output(
      {
        success: false,
        error: String(err)
      },
      ''
    );

  }

}


/* ============================================================
   JSON / JSONP
   ============================================================ */

function parsePayload(value) {

  if (!value) return {};

  try {

    return JSON.parse(value);

  }

  catch (err) {

    throw new Error(
      'Invalid request data: ' + err.message
    );

  }

}


function output(data, callback) {

  const json = JSON.stringify(data);

  if (callback) {

    const safe =
      String(callback)
        .replace(/[^a-zA-Z0-9_$]/g, '');

    return ContentService
      .createTextOutput(
        safe + '(' + json + ');'
      )
      .setMimeType(
        ContentService.MimeType.JAVASCRIPT
      );

  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(
      ContentService.MimeType.JSON
    );

}


/* ============================================================
   EMPLOYEE SAVE
   ============================================================ */

function saveEmployee(data) {

  const sheet = getEmployeeSheet();

  const id =
    String(data.id || '').trim();

  if (!id) {

    return {
      success: false,
      error: 'Employee ID is required.'
    };

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

    String(
      data.photo ||
      data.photoUrl ||
      ''
    ).trim(),

    String(
      data.faceDescriptor || ''
    ).trim(),

    String(
      data.registeredAt ||
      new Date().toISOString()
    )

  ];


  const lastRow =
    sheet.getLastRow();


  if (lastRow >= 2) {

    const ids =
      sheet
        .getRange(
          2,
          1,
          lastRow - 1,
          1
        )
        .getDisplayValues();


    for (
      let i = 0;
      i < ids.length;
      i++
    ) {

      if (
        String(ids[i][0])
          .trim()
          .toLowerCase()
        ===
        id.toLowerCase()
      ) {

        const targetRow =
          i + 2;

        sheet
          .getRange(
            targetRow,
            1,
            1,
            row.length
          )
          .setValues([row]);


        return {

          success: true,

          action: 'updated',

          row: targetRow,

          employee:
            employeeObject(row)

        };

      }

    }

  }


  sheet.appendRow(row);


  return {

    success: true,

    action: 'created',

    row:
      sheet.getLastRow(),

    employee:
      employeeObject(row)

  };

}


/* ============================================================
   GET EMPLOYEES
   ============================================================ */

function getEmployees() {

  const sheet =
    getEmployeeSheet();

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2)
    return [];


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        EMPLOYEE_HEADERS.length
      )
      .getValues();


  return values

    .filter(
      r =>
        String(r[0] || '').trim() !== ''
    )

    .map(employeeObject);

}


function employeeObject(row) {

  return {

    id:
      String(row[0] || ''),

    name:
      String(row[1] || ''),

    trade:
      String(row[2] || ''),

    company:
      String(row[3] || ''),

    department:
      String(row[4] || ''),

    nationality:
      String(row[5] || ''),

    phone:
      String(row[6] || ''),

    site:
      String(row[7] || ''),

    joiningDate:
      formatDateValue(row[8]),

    photo:
      String(row[9] || ''),

    faceDescriptor:
      String(row[10] || ''),

    registeredAt:
      String(row[11] || '')

  };

}


/* ============================================================
   ATTENDANCE SAVE
   ============================================================ */

function saveAttendance(data) {

  const sheet =
    getAttendanceSheet();


  const date =
    String(data.date || '').trim();

  const time =
    String(data.time || '').trim();

  const type =
    String(
      data.type ||
      data.attendanceType ||
      ''
    )
      .trim()
      .toUpperCase();

  const gate =
    String(
      data.gate ||
      data.gateName ||
      ''
    )
      .trim();


  const id =
    String(data.id || '').trim();


  const name =
    String(data.name || '').trim();


  if (!date)
    return {
      success: false,
      error: 'Date is required.'
    };


  if (!time)
    return {
      success: false,
      error: 'Time is required.'
    };


  if (
    type !== 'ENTRY' &&
    type !== 'OUT'
  ) {

    return {

      success: false,

      error:
        'Attendance Type must be ENTRY or OUT.'

    };

  }


  if (!gate)
    return {

      success: false,

      error:
        'Gate is required.'

    };


  if (!id)
    return {

      success: false,

      error:
        'Employee ID is required.'

    };


  /*
   * Duplicate protection:
   *
   * Same employee cannot send
   * same ENTRY / OUT repeatedly
   * at the same gate on same day.
   */

  const duplicate =
    findAttendanceDuplicate(
      date,
      id,
      type,
      gate
    );


  if (duplicate) {

    return {

      success: false,

      duplicate: true,

      message:
        name +
        ' already has ' +
        type +
        ' at ' +
        gate +
        ' today.'

    };

  }


  const row = [

    date,

    time,

    type,

    gate,

    id,

    name,

    String(data.status || ''),

    String(data.photo || ''),

    String(data.trade || ''),

    String(data.company || ''),

    String(data.department || ''),

    String(data.nationality || ''),

    String(data.phone || ''),

    String(data.site || ''),

    String(data.joiningDate || ''),

    String(data.matchDistance || ''),

    new Date()

  ];


  sheet.appendRow(row);


  return {

    success: true,

    row:
      sheet.getLastRow(),

    type: type,

    gate: gate,

    message:
      'Attendance ' +
      type +
      ' saved successfully.'

  };

}


/* ============================================================
   DUPLICATE CHECK
   ============================================================ */

function findAttendanceDuplicate(
  date,
  id,
  type,
  gate
) {

  const sheet =
    getAttendanceSheet();

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2)
    return false;


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        5
      )
      .getDisplayValues();


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const rowDate =
      String(values[i][0] || '')
        .trim();

    const rowType =
      String(values[i][2] || '')
        .trim()
        .toUpperCase();

    const rowGate =
      String(values[i][3] || '')
        .trim();

    const rowId =
      String(values[i][4] || '')
        .trim();


    if (

      rowDate === date &&

      rowId.toLowerCase()
      === id.toLowerCase() &&

      rowType === type &&

      rowGate.toLowerCase()
      === gate.toLowerCase()

    ) {

      return true;

    }

  }


  return false;

}


/* ============================================================
   TODAY ATTENDANCE
   ============================================================ */

function getTodayAttendance() {

  const sheet =
    getAttendanceSheet();

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2)
    return [];


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        ATTENDANCE_HEADERS.length
      )
      .getValues();


  const today =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );


  return values

    .filter(
      r =>
        String(r[0] || '')
        .trim()
        === today
    )

    .map(attendanceObject)

    .reverse();

}


function attendanceObject(row) {

  return {

    date:
      String(row[0] || ''),

    time:
      String(row[1] || ''),

    type:
      String(row[2] || ''),

    gate:
      String(row[3] || ''),

    id:
      String(row[4] || ''),

    name:
      String(row[5] || ''),

    status:
      String(row[6] || ''),

    photo:
      String(row[7] || ''),

    trade:
      String(row[8] || ''),

    company:
      String(row[9] || ''),

    department:
      String(row[10] || ''),

    nationality:
      String(row[11] || ''),

    phone:
      String(row[12] || ''),

    site:
      String(row[13] || ''),

    joiningDate:
      String(row[14] || ''),

    matchDistance:
      String(row[15] || ''),

    savedAt:
      String(row[16] || '')

  };

}


/* ============================================================
   DELETE EMPLOYEE
   ============================================================ */

function deleteEmployee(id) {

  const sheet =
    getEmployeeSheet();

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {

    return {

      success: false,

      error:
        'No employees found.'

    };

  }


  const ids =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        1
      )
      .getDisplayValues();


  for (
    let i = 0;
    i < ids.length;
    i++
  ) {

    if (

      String(ids[i][0])
        .trim()
        .toLowerCase()

      ===

      String(id || '')
        .trim()
        .toLowerCase()

    ) {

      sheet.deleteRow(i + 2);


      return {

        success: true,

        message:
          'Employee deleted successfully.'

      };

    }

  }


  return {

    success: false,

    error:
      'Employee ID not found.'

  };

}


/* ============================================================
   EMPLOYEE SHEET
   ============================================================ */

function getEmployeeSheet() {

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  let sheet =
    ss.getSheetByName(
      EMPLOYEE_SHEET
    );


  if (!sheet)
    sheet =
      ss.insertSheet(
        EMPLOYEE_SHEET
      );


  sheet
    .getRange(
      1,
      1,
      1,
      EMPLOYEE_HEADERS.length
    )
    .setValues([
      EMPLOYEE_HEADERS
    ]);


  sheet.setFrozenRows(1);


  return sheet;

}


/* ============================================================
   ATTENDANCE SHEET
   ============================================================ */

function getAttendanceSheet() {

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  let sheet =
    ss.getSheetByName(
      ATTENDANCE_SHEET
    );


  if (!sheet)
    sheet =
      ss.insertSheet(
        ATTENDANCE_SHEET
      );


  sheet
    .getRange(
      1,
      1,
      1,
      ATTENDANCE_HEADERS.length
    )
    .setValues([
      ATTENDANCE_HEADERS
    ]);


  sheet.setFrozenRows(1);


  return sheet;

}


/* ============================================================
   DATE FORMAT
   ============================================================ */

function formatDateValue(value) {

  if (!value)
    return '';


  if (
    Object.prototype.toString.call(value)
    === '[object Date]'
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );

  }


  return String(value);

}
