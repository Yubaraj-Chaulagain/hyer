/**
 * MARIN GAUNPALIKA - COMPLETE SINGLE API BACKEND
 * One Web App /exec URL handles Comments, Applications, Ward records and Admin actions.
 * Put this entire code into Code.gs, save, then Deploy > Manage deployments > Edit/New version.
 */

const SHEETS = {
  comments: 'Comments',
  applications: 'News',
  wards: 'Ward',
  users: 'Users'
};

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
      case 'searchWards': requireAdmin(data); return json(searchRecords(SHEETS.wards, data.query, data));
      case 'getWards': return json(getRecords(SHEETS.wards, data));
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
    const raw = e.postData.contents;
    try { return JSON.parse(raw); } catch (_) {}
  }
  return e.parameter || {};
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet(name) {
  const sh = ss().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}

function login(data) {
  const username = String(data.username || '').trim();
  const password = String(data.password || '');
  if (!username || !password) return {success:false, message:'Username and password required'};

  const rows = getSheetRows(SHEETS.users);
  const found = rows.find(r =>
    String(valueCI(r, 'Username')).trim() === username &&
    String(valueCI(r, 'Password')) === password
  );

  if (!found) return {success:false, message:'Invalid username or password'};

  const token = Utilities.getUuid();
  const cache = CacheService.getScriptCache();
  cache.put('auth_' + token, JSON.stringify({
    username: username,
    role: valueCI(found, 'Role') || 'admin'
  }), 21600);

  return {success:true, username:username, token:token, role:valueCI(found, 'Role') || 'admin'};
}

function requireAdmin(data) {
  const token = String(data.token || '');
  if (!token) throw new Error('Admin login required');
  const raw = CacheService.getScriptCache().get('auth_' + token);
  if (!raw) throw new Error('Session expired. Please login again.');
  return JSON.parse(raw);
}

function addComment(data) {
  const sh = sheet(SHEETS.comments);
  ensureHeaders(sh, ['id','Date','Time','Name','Address','Mobile','Email','Category','Subject','Message/Comment','Attachment','Status','Admin Reply']);
  const id = 'CMT-' + Utilities.getUuid().slice(0,8).toUpperCase();
  const row = Object.assign({}, data, {
    id:id,
    Date:data.Date || today(),
    Time:data.Time || timeNow(),
    Status:data.Status || 'Pending'
  });
  appendObject(sh, row);
  return {success:true, message:'Comment submitted successfully', id:id};
}

function updateComment(data) {
  const row = findRow(SHEETS.comments, data, ['id']);
  updateObjectAtRow(sheet(SHEETS.comments), row, data, ['action','token','username','adminAction','id','row']);
  return {success:true, message:'Comment updated', row:row};
}

function deleteComment(data) {
  const row = findRow(SHEETS.comments, data, ['id']);
  sheet(SHEETS.comments).deleteRow(row);
  return {success:true, message:'Comment deleted'};
}

function replyComment(data) {
  const row = findRow(SHEETS.comments, data, ['id']);
  const sh = sheet(SHEETS.comments);
  updateObjectAtRow(sh, row, {
    'Admin Reply': data.reply || '',
    Status: data.Status || 'Replied'
  }, []);
  return {success:true, message:'Reply saved'};
}

function addApplication(data) {
  const sh = sheet(SHEETS.applications);
  ensureHeaders(sh, applicationHeaders());
  const row = Object.assign({}, data, {
    Timestamp:data.Timestamp || new Date(),
    Status:data.Status || 'Pending'
  });
  appendObject(sh, row);
  return {success:true, message:'Application submitted successfully', row:sh.getLastRow()};
}

function updateApplication(data) {
  const row = findRow(SHEETS.applications, data, ['row','Timestamp']);
  updateObjectAtRow(sheet(SHEETS.applications), row, data,
    ['action','token','username','adminAction','row']);
  return {success:true, message:'Application updated', row:row};
}

function deleteApplication(data) {
  const row = findRow(SHEETS.applications, data, ['row','Timestamp']);
  sheet(SHEETS.applications).deleteRow(row);
  return {success:true, message:'Application deleted'};
}

function addWard(data) {
  const sh = sheet(SHEETS.wards);
  ensureHeaders(sh, wardHeaders());
  let cn = String(data['C.N'] || data.CN || '').trim();
  if (!cn) cn = 'CN-' + Utilities.getUuid().slice(0,8).toUpperCase();
  const row = Object.assign({}, data, {'C.N':cn});
  appendObject(sh, row);
  return {success:true, message:'Ward record submitted successfully', cn:cn, row:sh.getLastRow()};
}

function updateWard(data) {
  const row = findRow(SHEETS.wards, data, ['row','C.N','Name']);
  updateObjectAtRow(sheet(SHEETS.wards), row, data,
    ['action','token','username','adminAction','row']);
  return {success:true, message:'Ward record updated', row:row};
}

function deleteWard(data) {
  const row = findRow(SHEETS.wards, data, ['row','C.N','Name']);
  sheet(SHEETS.wards).deleteRow(row);
  return {success:true, message:'Ward record deleted'};
}

function getRecords(sheetName, data) {
  let rows = getSheetRows(sheetName);
  if (data && data.query) return searchArray(rows, data.query, 100);
  return {success:true, rows:rows.slice(0,100)};
}

function searchRecords(sheetName, query, data) {
  const rows = getSheetRows(sheetName);
  return {
    success:true,
    rows:searchArray(rows, query || '', Number(data.limit || 100))
  };
}

function searchArray(rows, query, limit) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return rows.slice(0, limit);
  return rows.filter(r =>
    Object.keys(r).some(k => String(r[k] == null ? '' : r[k]).toLowerCase().indexOf(q) !== -1)
  ).slice(0, limit);
}

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
  if (data.row && Number(data.row) >= 2) return Number(data.row);

  const rows = getSheetRows(sheetName);
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    const wanted = String(data[key] || '').trim();
    if (!wanted) continue;
    const found = rows.find(r => String(valueCI(r,key) || '').trim() === wanted);
    if (found) return Number(found.row);
  }
  throw new Error('Record not found. Search and load the record first.');
}

function updateObjectAtRow(sh, row, data, skipKeys) {
  const lastCol = Math.max(1, sh.getLastColumn());
  const headers = sh.getRange(1,1,1,lastCol).getValues()[0].map(v=>String(v).trim());
  headers.forEach((h, i) => {
    if (skipKeys.indexOf(h) !== -1) return;
    if (Object.prototype.hasOwnProperty.call(data, h)) {
      sh.getRange(row, i+1).setValue(data[h]);
    }
  });
}

function appendObject(sh, data) {
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(v=>String(v).trim());
  const row = headers.map(h => Object.prototype.hasOwnProperty.call(data,h) ? data[h] : '');
  sh.appendRow(row);
}

function ensureHeaders(sh, required) {
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1,1,1,required.length).setValues([required]);
    return;
  }
  const existing = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(v=>String(v).trim());
  const missing = required.filter(h => existing.indexOf(h) === -1);
  if (missing.length) sh.getRange(1,existing.length+1,1,missing.length).setValues([missing]);
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

function applicationHeaders() {
  return ['Timestamp','Full Name','Contact','Address','position','To','To-line 2','Subject','Types',
    'Chalani No.','Chalani Date','Darta No.','Darta Date','Status','Details','Attachment',
    'Download','send to gmail','send to Whatsapp'];
}

function wardHeaders() {
  return ['C.N','Name','Address','Family Members','Male','Female','Voters','Phone','Email','Whatsapp',
    'Working Male','Working Female','Unemployed Male','Unemployed Female','Economic Status',
    'Income Source','18+ Age Group','Complaint / Grievance'];
}

function today() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function timeNow() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
}
