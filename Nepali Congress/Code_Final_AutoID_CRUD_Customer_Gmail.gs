/**
 * MARIN GAUNPALIKA - COMPLETE SINGLE API BACKEND
 * Features:
 * - One /exec API URL
 * - Auto IDs for Application, Comment and Ward
 * - 7 separate Ward sheets
 * - Search / Load / Edit / Update / Delete
 * - Gmail notification after successful submit
 */

const SHEETS = {
  comments: 'Comments',
  applications: 'News',
  users: 'Users'
};

const WARD_SHEETS = {
  '1': 'Ward No. 1',
  '2': 'Ward No. 2',
  '3': 'Ward No. 3',
  '4': 'Ward No. 4',
  '5': 'Ward No. 5',
  '6': 'Ward No. 6',
  '7': 'Ward No. 7'
};

/*
 * IMPORTANT:
 * Put the Gmail address that should receive every submission here.
 * You can also leave this blank and set Script Property ADMIN_NOTIFICATION_EMAIL.
 */
const ADMIN_NOTIFICATION_EMAIL = '';

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'ping') return json({success:true, message:'API Online'});
  return json({success:true, message:'Marin API is online'});
}

function doPost(e) {
  try {
    const data = parseRequest(e);
    const action = String(data.action || '').trim();

    switch (action) {
      case 'ping': return json({success:true, message:'API Online'});
      case 'login': return json(login(data));

      case 'addComment': return json(addComment(data));
      case 'searchComments': requireAdmin(data); return json(searchRecords(SHEETS.comments, data.query, data));
      case 'getComments': return json(getRecords(SHEETS.comments, data));
      case 'updateComment': requireAdmin(data); return json(updateComment(data));
      case 'deleteComment': requireAdmin(data); return json(deleteComment(data));
      case 'replyComment': requireAdmin(data); return json(replyComment(data));

      case 'addApplication': return json(addApplication(data));
      case 'searchApplications': requireAdmin(data); return json(searchRecords(SHEETS.applications, data.query, data));
      case 'getApplications': return json(getRecords(SHEETS.applications, data));
      case 'updateApplication': requireAdmin(data); return json(updateApplication(data));
      case 'deleteApplication': requireAdmin(data); return json(deleteApplication(data));

      case 'addWard': return json(addWard(data));
      case 'searchWards': requireAdmin(data); return json(searchAllWards(data.query, data));
      case 'getWards': return json(getAllWards(data));
      case 'updateWard': requireAdmin(data); return json(updateWard(data));
      case 'deleteWard': requireAdmin(data); return json(deleteWard(data));

      default: return json({success:false, message:'Invalid action: ' + action});
    }
  } catch (err) {
    return json({success:false, message:String(err.message || err)});
  }
}

function parseRequest(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (_) {}
  }
  return e.parameter || {};
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet(name) {
  const sh = ss().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}

/* ================= AUTH ================= */

function login(data) {
  const username = String(data.username || '').trim();
  const password = String(data.password || '');
  if (!username || !password) return {success:false, message:'Username and password required'};

  const rows = getSheetRows(SHEETS.users);
  const found = rows.find(r =>
    String(valueCI(r,'Username')).trim() === username &&
    String(valueCI(r,'Password')) === password
  );
  if (!found) return {success:false, message:'Invalid username or password'};

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(
    'auth_' + token,
    JSON.stringify({username:username, role:valueCI(found,'Role') || 'admin'}),
    21600
  );

  return {success:true, username:username, token:token, role:valueCI(found,'Role') || 'admin'};
}

function requireAdmin(data) {
  const token = String(data.token || '');
  if (!token) throw new Error('Admin login required');
  const raw = CacheService.getScriptCache().get('auth_' + token);
  if (!raw) throw new Error('Session expired. Please login again.');
  return JSON.parse(raw);
}

/* ================= AUTO ID ================= */

function nextId(prefix) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const key = 'SEQ_' + prefix;
    const props = PropertiesService.getScriptProperties();
    const n = Number(props.getProperty(key) || '0') + 1;
    props.setProperty(key, String(n));
    const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
    return prefix + '-' + date + '-' + ('000000' + n).slice(-6);
  } finally {
    lock.releaseLock();
  }
}

/* ================= EMAIL ================= */

function getAdminEmail() {
  return String(
    ADMIN_NOTIFICATION_EMAIL ||
    PropertiesService.getScriptProperties().getProperty('ADMIN_NOTIFICATION_EMAIL') ||
    ''
  ).trim();
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

function sendSubmissionEmail(type, id, data, sheetName) {
  const adminEmail = getAdminEmail();
  const applicantEmail = String(
    data.Email || data.email || data['send to gmail'] || ''
  ).trim();

  const subject = '[' + type + '] Submission received - ' + id;
  const lines = [
    'Your submission has been received successfully.',
    '',
    'Submission Type: ' + type,
    'Reference ID: ' + id,
    'Status: ' + String(data.Status || 'Pending'),
    'Sheet: ' + sheetName,
    '',
    'Please save your Reference ID for future Search, Edit, Update or Delete requests.'
  ];
  const body = lines.join('\n');

  let customerEmailSent = false;
  let customerEmailProvided = isEmail(applicantEmail);
  let adminEmailSent = false;
  const errors = [];

  try {
    if (customerEmailProvided) {
      MailApp.sendEmail({
        to: applicantEmail,
        subject: subject,
        body: body
      });
      customerEmailSent = true;
    }
  } catch (err) {
    errors.push('Customer email: ' + String(err.message || err));
    console.error('Customer email error: ' + err);
  }

  try {
    if (isEmail(adminEmail)) {
      MailApp.sendEmail({
        to: adminEmail,
        subject: '[Admin Copy] ' + subject,
        body: body + '\n\nSubmitted details:\n' + Object.keys(data)
          .filter(k => ['action','token','password'].indexOf(String(k).toLowerCase()) === -1)
          .map(k => k + ': ' + String(data[k] == null ? '' : data[k]))
          .join('\n')
      });
      adminEmailSent = true;
    }
  } catch (err) {
    errors.push('Admin email: ' + String(err.message || err));
    console.error('Admin email error: ' + err);
  }

  return {
    sent: customerEmailSent || adminEmailSent,
    customerEmailProvided: customerEmailProvided,
    customerEmailSent: customerEmailSent,
    adminEmailSent: adminEmailSent,
    errors: errors
  };
}
/* ================= COMMENTS ================= */

function addComment(data) {
  const sh = sheet(SHEETS.comments);
  ensureHeaders(sh, commentHeaders());
  const id = nextId('CMT');

  const row = Object.assign({}, data, {
    'Auto ID': id,
    id: id,
    Date: data.Date || today(),
    Time: data.Time || timeNow(),
    Status: data.Status || 'Pending'
  });

  appendObject(sh, row);
  const email = sendSubmissionEmail('Comment / Grievance', id, row, SHEETS.comments);

  return {
    success:true,
    message:'Comment submitted successfully',
    id:id,
    autoId:id,
    row:sh.getLastRow(),
    emailSent:email.sent,
    customerEmailProvided:email.customerEmailProvided,
    customerEmailSent:email.customerEmailSent,
    adminEmailSent:email.adminEmailSent
  };
}

function updateComment(data) {
  const row = findRow(SHEETS.comments, data, ['Auto ID','id']);
  updateObjectAtRow(sheet(SHEETS.comments), row, data,
    ['action','token','username','adminAction','row','sheet','Auto ID','id']);
  return {success:true, message:'Comment updated', row:row};
}

function deleteComment(data) {
  const row = findRow(SHEETS.comments, data, ['Auto ID','id']);
  sheet(SHEETS.comments).deleteRow(row);
  return {success:true, message:'Comment deleted'};
}

function replyComment(data) {
  const row = findRow(SHEETS.comments, data, ['Auto ID','id']);
  updateObjectAtRow(sheet(SHEETS.comments), row, {
    'Admin Reply': data.reply || '',
    Status: data.Status || 'Replied'
  }, []);
  return {success:true, message:'Reply saved'};
}

/* ================= APPLICATIONS ================= */

function addApplication(data) {
  const sh = sheet(SHEETS.applications);
  ensureHeaders(sh, applicationHeaders());
  const id = nextId('APP');

  const row = Object.assign({}, data, {
    'Auto ID': id,
    Timestamp: data.Timestamp || new Date(),
    Status: data.Status || 'Pending'
  });

  appendObject(sh, row);
  const email = sendSubmissionEmail('Application', id, row, SHEETS.applications);

  return {
    success:true,
    message:'Application submitted successfully',
    id:id,
    autoId:id,
    row:sh.getLastRow(),
    emailSent:email.sent,
    customerEmailProvided:email.customerEmailProvided,
    customerEmailSent:email.customerEmailSent,
    adminEmailSent:email.adminEmailSent
  };
}

function updateApplication(data) {
  const row = findRow(SHEETS.applications, data, ['row','Auto ID','Timestamp']);
  updateObjectAtRow(sheet(SHEETS.applications), row, data,
    ['action','token','username','adminAction','row','sheet','Auto ID','id']);
  return {success:true, message:'Application updated', row:row};
}

function deleteApplication(data) {
  const row = findRow(SHEETS.applications, data, ['row','Auto ID','Timestamp']);
  sheet(SHEETS.applications).deleteRow(row);
  return {success:true, message:'Application deleted'};
}

/* ================= 7 WARD SHEETS ================= */

function normalizeWardNo(v) {
  const m = String(v || '').match(/[1-7]/);
  return m ? m[0] : '';
}

function wardSheetName(data) {
  const no = normalizeWardNo(
    data['Ward No.'] || data.WardNo || data.wardNo || data.ward || data['Ward Number']
  );
  if (!no || !WARD_SHEETS[no]) throw new Error('Please select Ward No. 1 to Ward No. 7');
  return WARD_SHEETS[no];
}

function wardSheetNameFromRecord(data) {
  if (data.sheet && Object.values(WARD_SHEETS).indexOf(String(data.sheet)) !== -1) {
    return String(data.sheet);
  }
  return wardSheetName(data);
}

function addWard(data) {
  const sheetName = wardSheetName(data);
  const sh = sheet(sheetName);
  ensureHeaders(sh, wardHeaders());
  const id = nextId('WRD');

  const row = Object.assign({}, data, {
    'Auto ID': id,
    'Ward No.': normalizeWardNo(data['Ward No.'] || data.WardNo || data.wardNo || data.ward)
  });

  appendObject(sh, row);
  const email = sendSubmissionEmail('Ward Record', id, row, sheetName);

  return {
    success:true,
    message:'Ward record submitted successfully',
    id:id,
    autoId:id,
    wardNo:row['Ward No.'],
    sheet:sheetName,
    row:sh.getLastRow(),
    emailSent:email.sent,
    customerEmailProvided:email.customerEmailProvided,
    customerEmailSent:email.customerEmailSent,
    adminEmailSent:email.adminEmailSent
  };
}

function updateWard(data) {
  const sheetName = wardSheetNameFromRecord(data);
  const row = findRow(sheetName, data, ['row','Auto ID','C.N','Name']);
  updateObjectAtRow(sheet(sheetName), row, data,
    ['action','token','username','adminAction','row','sheet','Auto ID','id']);
  return {success:true, message:'Ward record updated', sheet:sheetName, row:row};
}

function deleteWard(data) {
  const sheetName = wardSheetNameFromRecord(data);
  const row = findRow(sheetName, data, ['row','Auto ID','C.N','Name']);
  sheet(sheetName).deleteRow(row);
  return {success:true, message:'Ward record deleted', sheet:sheetName};
}

function getAllWards(data) {
  let rows = [], errors = [], searchedSheets = [];
  Object.keys(WARD_SHEETS).forEach(no => {
    const sheetName = WARD_SHEETS[no];
    searchedSheets.push(sheetName);
    try {
      rows = rows.concat(getSheetRows(sheetName).map(r => {
        r.sheet = sheetName;
        r['Ward No.'] = String(r['Ward No.'] || no);
        return r;
      }));
    } catch (err) {
      errors.push(sheetName + ': ' + String(err.message || err));
    }
  });

  const q = String((data && data.query) || '').trim();
  if (q) rows = searchArray(rows, q, Number((data && data.limit) || 500));

  return {
    success:true,
    rows:rows.slice(0, Number((data && data.limit) || 500)),
    total:rows.length,
    searchedSheets:searchedSheets,
    errors:errors
  };
}

function searchAllWards(query, data) {
  return getAllWards(Object.assign({}, data || {}, {query:query || ''}));
}

/* ================= SEARCH ================= */

function getRecords(sheetName, data) {
  let rows = getSheetRows(sheetName);
  if (data && data.query) rows = searchArray(rows, data.query, Number(data.limit || 500));
  return {success:true, rows:rows.slice(0, Number((data && data.limit) || 500))};
}

function searchRecords(sheetName, query, data) {
  const rows = getSheetRows(sheetName);
  return {
    success:true,
    rows:searchArray(rows, query || '', Number((data && data.limit) || 500))
  };
}

function searchArray(rows, query, limit) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return rows.slice(0, limit);
  return rows.filter(r =>
    Object.keys(r).some(k =>
      String(r[k] == null ? '' : r[k]).toLowerCase().indexOf(q) !== -1
    )
  ).slice(0, limit);
}

/* ================= SHEET HELPERS ================= */

function getSheetRows(sheetName) {
  const sh = sheet(sheetName);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return [];

  const values = sh.getRange(1,1,lastRow,lastCol).getValues();
  const headers = values[0].map(v => String(v).trim());

  return values.slice(1).map((row, i) => {
    const obj = {row:i+2};
    headers.forEach((h,j) => obj[h] = serializeValue(row[j]));
    return obj;
  });
}

function findRow(sheetName, data, keys) {
  const sh = sheet(sheetName);

  if (data.row && Number(data.row) >= 2) {
    const row = Number(data.row);
    if (row <= sh.getLastRow()) return row;
  }

  const rows = getSheetRows(sheetName);
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    const wanted = String(data[key] || '').trim();
    if (!wanted) continue;
    const found = rows.find(r =>
      String(valueCI(r,key) || '').trim() === wanted
    );
    if (found) return Number(found.row);
  }

  throw new Error('Record not found. Search and load the record first.');
}

function updateObjectAtRow(sh, row, data, skipKeys) {
  const lastCol = Math.max(1, sh.getLastColumn());
  const headers = sh.getRange(1,1,1,lastCol).getValues()[0].map(v => String(v).trim());

  headers.forEach((h, i) => {
    if (skipKeys.indexOf(h) !== -1) return;
    if (Object.prototype.hasOwnProperty.call(data, h)) {
      sh.getRange(row, i+1).setValue(data[h]);
    }
  });
}

function appendObject(sh, data) {
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(v => String(v).trim());
  sh.appendRow(headers.map(h =>
    Object.prototype.hasOwnProperty.call(data,h) ? data[h] : ''
  ));
}

function ensureHeaders(sh, required) {
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1,1,1,required.length).setValues([required]);
    return;
  }

  const existing = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]
    .map(v => String(v).trim());
  const missing = required.filter(h => existing.indexOf(h) === -1);

  if (missing.length) {
    sh.getRange(1,existing.length+1,1,missing.length).setValues([missing]);
  }
}

function valueCI(obj, key) {
  const wanted = String(key).toLowerCase();
  const actual = Object.keys(obj).find(k => String(k).toLowerCase() === wanted);
  return actual ? obj[actual] : '';
}

function serializeValue(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  return v == null ? '' : v;
}

/* ================= HEADERS ================= */

function commentHeaders() {
  return [
    'Auto ID','id','Date','Time','Name','Address','Mobile','Email',
    'Category','Subject','Message/Comment','Attachment','Status','Admin Reply'
  ];
}

function applicationHeaders() {
  return [
    'Auto ID','Timestamp','Full Name','Contact','Address','position','To','To-line 2',
    'Subject','Types','Chalani No.','Chalani Date','Darta No.','Darta Date',
    'Status','Details','Attachment','Download','send to gmail','send to Whatsapp'
  ];
}

function wardHeaders() {
  return [
    'Auto ID','Ward No.','C.N','Name','Address','Family Members','Male','Female',
    'Voters','Phone','Email','Whatsapp','Working Male','Working Female',
    'Unemployed Male','Unemployed Female','Economic Status','Income Source',
    '18+ Age Group','Complaint / Grievance'
  ];
}

function today() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function timeNow() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
}
