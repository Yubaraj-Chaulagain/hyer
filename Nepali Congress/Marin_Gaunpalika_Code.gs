/**
 * ============================================================
 * MARIN GAUNPALIKA - FULL GOOGLE APPS SCRIPT API
 * ============================================================
 * Spreadsheet ID:
 * 1WwIGRZdjpmI9aD35lV2P2xddNzVMwUECwj_OEAf3zKM
 *
 * Admin Gmail:
 * Nepalicongressmarin@gmail.com
 *
 * Includes:
 * - Login / token authentication
 * - Comments / Suggestions / Grievance CRUD + reply
 * - News / Application CRUD
 * - Ward-wise CRUD
 * - List/read APIs for HTML frontend
 * - Dashboard API
 * - Automatic admin Gmail notifications
 * - User email notifications where an email is supplied
 * - Automatic sheet/header setup
 *
 * IMPORTANT:
 * 1. Replace the old Code.gs completely with this file.
 * 2. Run setupSheets() once from Apps Script and authorize.
 * 3. Run testAdminEmail() once to test Gmail.
 * 4. Deploy as Web app:
 *      Execute as: Me
 *      Who has access: Anyone
 * 5. After changing code, create a NEW deployment/version or
 *    update the existing deployment.
 * ============================================================
 */

const CONFIG = {
  SPREADSHEET_ID: '1WwIGRZdjpmI9aD35lV2P2xddNzVMwUECwj_OEAf3zKM',
  ADMIN_EMAIL: 'Nepalicongressmarin@gmail.com',
  TOKEN_TTL_SECONDS: 21600,
  MAX_BODY_LENGTH: 500000,
  TIMEZONE: 'Asia/Kathmandu',

  SHEETS: {
    USERS: 'Users',
    COMMENTS: 'Comments',
    APPLICATIONS: 'News/Application',
    WARD: 'Ward-wise'
  },

  USER_HEADERS: [
    'Username',
    'Password'
  ],

  COMMENT_HEADERS: [
    'ID',
    'Date',
    'Time',
    'Name',
    'Address',
    'Mobile',
    'Email',
    'Category',
    'Subject',
    'Message/Comment',
    'Attachment',
    'Admin Reply',
    'Reply Date',
    'Reply Time',
    'Status',
    'Replied By',
    'Updated By',
    'Updated At'
  ],

  APPLICATION_HEADERS: [
    'Timestamp',
    'Full Name',
    'Contact',
    'Address',
    'position',
    'To',
    'To-line 2',
    'Subject',
    'Details',
    'Chalani No.',
    'Chalani Date',
    'Darta No.',
    'Darta Date',
    'Attachment',
    'Types',
    'Download',
    'send to gmail',
    'send to Whatsapp',
    'Status',
    'Updated By',
    'Updated At'
  ],

  WARD_HEADERS: [
    'C.N',
    'Name',
    'Address',
    'Family Members',
    'Male',
    'Female',
    'Voters',
    'Phone',
    'Email',
    'Whatsapp',
    'Working Male',
    'Working Female',
    'Unemployed Male',
    'Unemployed Female',
    'Economic Status',
    'Income Source',
    '18+ Age Group',
    'Complaint / Grievance',
    'Updated By',
    'Updated At'
  ]
};


/* ============================================================
   WEB APP
   ============================================================ */

function doGet(e) {
  try {
    e = e || {};
    const action = String(
      e.parameter && e.parameter.action
        ? e.parameter.action
        : 'ping'
    ).trim();

    switch (action) {
      case 'ping':
        return json_({
          success: true,
          message: 'Marin API is running.',
          time: new Date().toISOString()
        });

      case 'login':
        return json_(login_(
          e.parameter.username || '',
          e.parameter.password || ''
        ));

      case 'comments':
      case 'getComments':
        return json_(getComments_(e.parameter || {}));

      case 'applications':
      case 'getApplications':
        return json_(getApplications_(e.parameter || {}));

      case 'ward':
      case 'wards':
      case 'getWard':
      case 'getWards':
        return json_(getWards_(e.parameter || {}));

      case 'dashboard':
      case 'getDashboard':
        return json_(getDashboard_(e.parameter || {}));

      default:
        throw new Error('Invalid GET action: ' + action);
    }
  } catch (err) {
    return json_({
      success: false,
      message: errorMessage_(err)
    });
  }
}


function doPost(e) {
  try {
    const raw =
      e &&
      e.postData &&
      e.postData.contents
        ? e.postData.contents
        : '{}';

    if (raw.length > CONFIG.MAX_BODY_LENGTH) {
      throw new Error('Request धेरै ठूलो छ।');
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      throw new Error('Invalid JSON request');
    }

    const action = String(data.action || '').trim();
    if (!action) {
      throw new Error('Action आवश्यक छ।');
    }

    switch (action) {
      case 'ping':
        return json_({
          success: true,
          message: 'Marin API is running.'
        });

      case 'login':
        return json_(login_(
          data.username || '',
          data.password || ''
        ));

      /* READ */
      case 'comments':
      case 'getComments':
        return json_(getComments_(data));

      case 'applications':
      case 'getApplications':
        return json_(getApplications_(data));

      case 'ward':
      case 'wards':
      case 'getWard':
      case 'getWards':
        return json_(getWards_(data));

      case 'dashboard':
      case 'getDashboard':
        return json_(getDashboard_(data));

      /* COMMENTS */
      case 'addComment':
        return json_(addComment_(data));

      case 'reply':
      case 'replyComment':
        return json_(replyComment_(data));

      case 'updateComment':
      case 'editComment':
        return json_(updateComment_(data));

      case 'deleteComment':
        return json_(deleteComment_(data));

      /* APPLICATION */
      case 'addApplication':
        return json_(addApplication_(data));

      case 'updateApplication':
      case 'editApplication':
        return json_(updateApplication_(data));

      case 'deleteApplication':
        return json_(deleteApplication_(data));

      /* WARD */
      case 'addWard':
        return json_(addWard_(data));

      case 'updateWard':
      case 'editWard':
        return json_(updateWard_(data));

      case 'deleteWard':
        return json_(deleteWard_(data));

      /* GMAIL */
      case 'sendGmail':
        return json_(sendGmail_(data));

      /* SETUP */
      case 'setupSheets':
        requireAdmin_(data);
        return json_({
          success: true,
          message: setupSheets()
        });

      default:
        throw new Error('Invalid action: ' + action);
    }
  } catch (err) {
    return json_({
      success: false,
      message: errorMessage_(err)
    });
  }
}


/* ============================================================
   AUTHENTICATION
   ============================================================ */

function login_(username, password) {
  username = String(username || '').trim();
  password = String(password || '');

  if (!username || !password) {
    throw new Error('Username र Password आवश्यक छ।');
  }

  const user = findUser_(username, password);

  if (!user) {
    return {
      success: false,
      message: 'Username वा Password गलत छ।'
    };
  }

  const token =
    Utilities.getUuid() + '-' + Utilities.getUuid();

  CacheService.getScriptCache().put(
    'AUTH_' + token,
    username,
    CONFIG.TOKEN_TTL_SECONDS
  );

  return {
    success: true,
    message: 'Login successful',
    token: token,
    username: username,
    expiresIn: CONFIG.TOKEN_TTL_SECONDS
  };
}


function requireAdmin_(data) {
  data = data || {};

  const token = String(
    data.token ||
    (data.auth && data.auth.token) ||
    ''
  ).trim();

  if (token) {
    const username =
      CacheService.getScriptCache().get('AUTH_' + token);

    if (username) return username;
  }

  const username = String(
    data.username ||
    (data.auth && data.auth.username) ||
    ''
  ).trim();

  const password = String(
    data.password ||
    (data.auth && data.auth.password) ||
    ''
  );

  if (
    username &&
    password &&
    findUser_(username, password)
  ) {
    return username;
  }

  throw new Error('यो कार्य गर्न Admin Login आवश्यक छ।');
}


function findUser_(username, password) {
  const sheet = getUserSheet_();
  const data = sheet.getDataRange().getDisplayValues();

  if (data.length < 2) return null;

  const headers = data[0].map(String);
  const ui = headerIndex_(headers, 'Username');
  const pi = headerIndex_(headers, 'Password');

  if (ui < 0 || pi < 0) {
    throw new Error(
      'Users sheet मा Username र Password header चाहिन्छ।'
    );
  }

  for (let r = 1; r < data.length; r++) {
    if (
      String(data[r][ui]).trim() === username &&
      String(data[r][pi]) === password
    ) {
      return {
        row: r + 1,
        username: username
      };
    }
  }

  return null;
}


/* ============================================================
   COMMENTS - ADD
   ============================================================ */

function addComment_(data) {
  const sheet = getDataSheet_('comments');
  ensureHeaders_(sheet, CONFIG.COMMENT_HEADERS);

  const id = nextNumericId_(sheet, 'ID');
  const now = new Date();

  const values = {
    'ID': id,
    'Date': value_(data, 'Date') ||
      formatDate_(now, 'yyyy-MM-dd'),
    'Time': value_(data, 'Time') ||
      formatDate_(now, 'HH:mm'),
    'Name': value_(data, 'Name'),
    'Address': value_(data, 'Address'),
    'Mobile': value_(data, 'Mobile'),
    'Email': value_(data, 'Email'),
    'Category': value_(data, 'Category'),
    'Subject': value_(data, 'Subject'),
    'Message/Comment': value_(data, 'Message/Comment') ||
      value_(data, 'Message') ||
      value_(data, 'Comment'),
    'Attachment': value_(data, 'Attachment'),
    'Admin Reply': '',
    'Reply Date': '',
    'Reply Time': '',
    'Status': 'Pending',
    'Replied By': '',
    'Updated By': '',
    'Updated At': ''
  };

  if (
    !values.Name ||
    !values.Mobile ||
    !values.Category ||
    !values['Message/Comment']
  ) {
    throw new Error(
      'Name, Mobile, Category र Message/Comment आवश्यक छ।'
    );
  }

  appendByHeaders_(sheet, values);

  notifyAdmin_(
    '📝 नयाँ Comment / गुनासो - ID ' + id,
    details_(
      'नयाँ Comment / गुनासो प्राप्त भएको छ।',
      {
        'ID': id,
        'Name': values.Name,
        'Address': values.Address,
        'Mobile': values.Mobile,
        'Email': values.Email,
        'Category': values.Category,
        'Subject': values.Subject,
        'Message/Comment': values['Message/Comment']
      }
    )
  );

  if (validEmail_(values.Email)) {
    safeSendEmail_(
      values.Email,
      'तपाईंको Comment / गुनासो प्राप्त भयो',
      details_(
        'तपाईंको Comment / गुनासो सफलतापूर्वक प्राप्त भएको छ।',
        {
          'Reference ID': id,
          'Subject': values.Subject,
          'Status': 'Pending'
        }
      )
    );
  }

  return {
    success: true,
    message: 'Comment successfully submitted.',
    id: id
  };
}


/* ============================================================
   COMMENT REPLY
   ============================================================ */

function replyComment_(data) {
  const admin = requireAdmin_(data);
  const sheet = getDataSheet_('comments');
  ensureHeaders_(sheet, CONFIG.COMMENT_HEADERS);

  const id = value_(data, 'id') || value_(data, 'ID');
  const reply =
    value_(data, 'reply') ||
    value_(data, 'Admin Reply');

  if (!id) throw new Error('Comment ID आवश्यक छ।');
  if (!reply) throw new Error('Reply लेख्नुहोस्।');

  const row = findRowByValue_(sheet, 'ID', id);
  if (row < 2) throw new Error('Comment भेटिएन।');

  const old = rowObject_(sheet, row);
  const now = new Date();

  setCellByHeader_(sheet, row, 'Admin Reply', reply);
  setCellByHeader_(
    sheet, row, 'Reply Date',
    formatDate_(now, 'yyyy-MM-dd')
  );
  setCellByHeader_(
    sheet, row, 'Reply Time',
    formatDate_(now, 'HH:mm')
  );
  setCellByHeader_(sheet, row, 'Status', 'Replied');
  setCellByHeader_(sheet, row, 'Replied By', admin);

  notifyAdmin_(
    '💬 Admin Reply - Comment ID ' + id,
    details_(
      'Admin ले Comment मा Reply गरेको छ।',
      {
        'ID': id,
        'Name': old.Name || '',
        'Subject': old.Subject || '',
        'Reply': reply,
        'Replied By': admin
      }
    )
  );

  if (validEmail_(old.Email)) {
    safeSendEmail_(
      old.Email,
      'तपाईंको गुनासोमा Admin Reply',
      details_(
        'तपाईंको गुनासोमा Admin बाट जवाफ पठाइएको छ।',
        {
          'Reference ID': id,
          'Subject': old.Subject || '',
          'Reply': reply
        }
      )
    );
  }

  return {
    success: true,
    message: 'Reply successfully saved.',
    id: id,
    repliedBy: admin
  };
}


/* ============================================================
   COMMENT UPDATE
   ============================================================ */

function updateComment_(data) {
  const admin = requireAdmin_(data);
  const sheet = getDataSheet_('comments');
  ensureHeaders_(sheet, CONFIG.COMMENT_HEADERS);

  const id = value_(data, 'id') || value_(data, 'ID');
  if (!id) throw new Error('Comment ID आवश्यक छ।');

  const row = findRowByValue_(sheet, 'ID', id);
  if (row < 2) throw new Error('Comment भेटिएन।');

  const old = rowObject_(sheet, row);

  updateFields_(
    sheet,
    row,
    data,
    CONFIG.COMMENT_HEADERS
  );

  setCellByHeader_(sheet, row, 'Updated By', admin);
  setCellByHeader_(sheet, row, 'Updated At', new Date());

  notifyAdmin_(
    '✏️ Comment Updated - ID ' + id,
    details_(
      'Comment update गरिएको छ।',
      {
        'ID': id,
        'Name': data.Name || old.Name || '',
        'Subject': data.Subject || old.Subject || '',
        'Updated By': admin
      }
    )
  );

  return {
    success: true,
    message: 'Comment updated successfully.',
    id: id
  };
}


/* ============================================================
   COMMENT DELETE
   ============================================================ */

function deleteComment_(data) {
  const admin = requireAdmin_(data);
  const sheet = getDataSheet_('comments');

  const id = value_(data, 'id') || value_(data, 'ID');
  if (!id) throw new Error('Comment ID आवश्यक छ।');

  const row = findRowByValue_(sheet, 'ID', id);
  if (row < 2) throw new Error('Comment भेटिएन।');

  const old = rowObject_(sheet, row);
  sheet.deleteRow(row);

  notifyAdmin_(
    '🗑️ Comment Deleted - ID ' + id,
    details_(
      'Comment delete गरिएको छ।',
      {
        'ID': id,
        'Name': old.Name || '',
        'Subject': old.Subject || '',
        'Deleted By': admin
      }
    )
  );

  return {
    success: true,
    message: 'Comment deleted successfully.',
    id: id,
    deletedBy: admin
  };
}


/* ============================================================
   APPLICATION - ADD
   ============================================================ */

function addApplication_(data) {
  const sheet = getDataSheet_('applications');
  ensureHeaders_(sheet, CONFIG.APPLICATION_HEADERS);

  const now = new Date();

  const values = {
    'Timestamp': now,
    'Full Name': value_(data, 'Full Name'),
    'Contact': value_(data, 'Contact'),
    'Address': value_(data, 'Address'),
    'position': value_(data, 'position'),
    'To': value_(data, 'To'),
    'To-line 2': value_(data, 'To-line 2'),
    'Subject': value_(data, 'Subject'),
    'Details': value_(data, 'Details'),
    'Chalani No.': value_(data, 'Chalani No.'),
    'Chalani Date': value_(data, 'Chalani Date'),
    'Darta No.': value_(data, 'Darta No.'),
    'Darta Date': value_(data, 'Darta Date'),
    'Attachment': value_(data, 'Attachment'),
    'Types': value_(data, 'Types') || 'Application',
    'Download': value_(data, 'Download'),
    'send to gmail': value_(data, 'send to gmail'),
    'send to Whatsapp': value_(data, 'send to Whatsapp'),
    'Status': value_(data, 'Status') || 'Pending',
    'Updated By': '',
    'Updated At': ''
  };

  if (
    !values['Full Name'] ||
    !values.Contact ||
    !values.Subject ||
    !values.Details
  ) {
    throw new Error(
      'Full Name, Contact, Subject र Details आवश्यक छ।'
    );
  }

  appendByHeaders_(sheet, values);

  notifyAdmin_(
    '📰 नयाँ News / Application',
    details_(
      'नयाँ News / Application प्राप्त भएको छ।',
      {
        'Full Name': values['Full Name'],
        'Contact': values.Contact,
        'Address': values.Address,
        'Position': values.position,
        'To': values.To,
        'Subject': values.Subject,
        'Details': values.Details,
        'Status': values.Status
      }
    )
  );

  if (validEmail_(values['send to gmail'])) {
    safeSendEmail_(
      values['send to gmail'],
      'News / Application Received',
      details_(
        'तपाईंको आवेदन प्राप्त भएको छ।',
        {
          'Full Name': values['Full Name'],
          'Subject': values.Subject,
          'Status': values.Status
        }
      )
    );
  }

  return {
    success: true,
    message: 'Application submitted successfully.'
  };
}


/* ============================================================
   APPLICATION - UPDATE
   ============================================================ */

function updateApplication_(data) {
  const admin = requireAdmin_(data);
  const sheet = getDataSheet_('applications');
  ensureHeaders_(sheet, CONFIG.APPLICATION_HEADERS);

  const row = findApplicationRow_(sheet, data);
  if (row < 2) throw new Error('Application भेटिएन।');

  const old = rowObject_(sheet, row);

  updateFields_(
    sheet,
    row,
    data,
    CONFIG.APPLICATION_HEADERS
  );

  setCellByHeader_(sheet, row, 'Updated By', admin);
  setCellByHeader_(sheet, row, 'Updated At', new Date());

  notifyAdmin_(
    '✏️ Application Updated',
    details_(
      'News / Application update गरिएको छ।',
      {
        'Full Name':
          data['Full Name'] ||
          old['Full Name'] ||
          '',
        'Subject':
          data.Subject ||
          old.Subject ||
          '',
        'Updated By': admin
      }
    )
  );

  return {
    success: true,
    message: 'Application updated successfully.',
    row: row
  };
}


/* ============================================================
   APPLICATION - DELETE
   ============================================================ */

function deleteApplication_(data) {
  const admin = requireAdmin_(data);
  const sheet = getDataSheet_('applications');

  const row = findApplicationRow_(sheet, data);
  if (row < 2) throw new Error('Application भेटिएन।');

  const old = rowObject_(sheet, row);
  sheet.deleteRow(row);

  notifyAdmin_(
    '🗑️ Application Deleted',
    details_(
      'News / Application delete गरिएको छ।',
      {
        'Full Name': old['Full Name'] || '',
        'Subject': old.Subject || '',
        'Deleted By': admin
      }
    )
  );

  return {
    success: true,
    message: 'Application deleted successfully.',
    row: row,
    deletedBy: admin
  };
}


function findApplicationRow_(sheet, data) {
  const explicitRow = Number(data.row || 0);

  if (
    explicitRow >= 2 &&
    explicitRow <= sheet.getLastRow()
  ) {
    return explicitRow;
  }

  const timestamp = value_(data, 'Timestamp');
  const fullName = value_(data, 'Full Name');

  if (timestamp && fullName) {
    const values = sheet.getDataRange().getDisplayValues();
    const headers = values[0].map(String);

    const ti = headerIndex_(headers, 'Timestamp');
    const ni = headerIndex_(headers, 'Full Name');

    if (ti >= 0 && ni >= 0) {
      for (let r = 1; r < values.length; r++) {
        if (
          String(values[r][ti]).trim() === String(timestamp).trim() &&
          String(values[r][ni]).trim() === String(fullName).trim()
        ) {
          return r + 1;
        }
      }
    }
  }

  if (timestamp) {
    const row = findRowByValue_(
      sheet,
      'Timestamp',
      timestamp
    );
    if (row >= 2) return row;
  }

  throw new Error(
    'Application पहिचान गर्न row वा Timestamp चाहिन्छ।'
  );
}


/* ============================================================
   WARD - ADD
   ============================================================ */

function addWard_(data) {
  const sheet = getDataSheet_('ward');
  ensureHeaders_(sheet, CONFIG.WARD_HEADERS);

  const values = {};

  CONFIG.WARD_HEADERS.forEach(function(header) {
    if (
      header !== 'Updated By' &&
      header !== 'Updated At'
    ) {
      values[header] = value_(data, header);
    }
  });

  values['Updated By'] = '';
  values['Updated At'] = '';

  if (!values['C.N'] || !values.Name) {
    throw new Error('C.N र Name आवश्यक छ।');
  }

  appendByHeaders_(sheet, values);

  notifyAdmin_(
    '🏠 नयाँ Ward-wise Record - C.N ' + values['C.N'],
    details_(
      'नयाँ Ward-wise record प्राप्त भएको छ।',
      {
        'C.N': values['C.N'],
        'Name': values.Name,
        'Address': values.Address,
        'Phone': values.Phone,
        'Email': values.Email,
        'Family Members': values['Family Members'],
        'Economic Status': values['Economic Status'],
        'Complaint / Grievance':
          values['Complaint / Grievance']
      }
    )
  );

  if (validEmail_(values.Email)) {
    safeSendEmail_(
      values.Email,
      'Ward-wise Record Received',
      details_(
        'तपाईंको Ward-wise विवरण प्राप्त भएको छ।',
        {
          'C.N': values['C.N'],
          'Name': values.Name
        }
      )
    );
  }

  return {
    success: true,
    message: 'Ward record submitted successfully.',
    cn: values['C.N']
  };
}


/* ============================================================
   WARD - UPDATE
   ============================================================ */

function updateWard_(data) {
  const admin = requireAdmin_(data);
  const sheet = getDataSheet_('ward');
  ensureHeaders_(sheet, CONFIG.WARD_HEADERS);

  const cn = value_(data, 'C.N');
  if (!cn) throw new Error('C.N आवश्यक छ।');

  const row = findRowByValue_(sheet, 'C.N', cn);
  if (row < 2) throw new Error('Ward record भेटिएन।');

  const old = rowObject_(sheet, row);

  updateFields_(
    sheet,
    row,
    data,
    CONFIG.WARD_HEADERS
  );

  setCellByHeader_(sheet, row, 'Updated By', admin);
  setCellByHeader_(sheet, row, 'Updated At', new Date());

  notifyAdmin_(
    '✏️ Ward Record Updated - C.N ' + cn,
    details_(
      'Ward-wise record update गरिएको छ।',
      {
        'C.N': cn,
        'Name': data.Name || old.Name || '',
        'Updated By': admin
      }
    )
  );

  return {
    success: true,
    message: 'Ward record updated successfully.',
    cn: cn
  };
}


/* ============================================================
   WARD - DELETE
   ============================================================ */

function deleteWard_(data) {
  const admin = requireAdmin_(data);
  const sheet = getDataSheet_('ward');

  const cn = value_(data, 'C.N');
  if (!cn) throw new Error('C.N आवश्यक छ।');

  const row = findRowByValue_(sheet, 'C.N', cn);
  if (row < 2) throw new Error('Ward record भेटिएन।');

  const old = rowObject_(sheet, row);
  sheet.deleteRow(row);

  notifyAdmin_(
    '🗑️ Ward Record Deleted - C.N ' + cn,
    details_(
      'Ward-wise record delete गरिएको छ।',
      {
        'C.N': cn,
        'Name': old.Name || '',
        'Deleted By': admin
      }
    )
  );

  return {
    success: true,
    message: 'Ward record deleted successfully.',
    cn: cn,
    deletedBy: admin
  };
}


/* ============================================================
   READ APIs
   ============================================================ */

function getComments_(data) {
  const sheet = getDataSheet_('comments');
  ensureHeaders_(sheet, CONFIG.COMMENT_HEADERS);

  return {
    success: true,
    data: sheetToObjects_(sheet)
  };
}


function getApplications_(data) {
  const sheet = getDataSheet_('applications');
  ensureHeaders_(sheet, CONFIG.APPLICATION_HEADERS);

  return {
    success: true,
    data: sheetToObjects_(sheet)
  };
}


function getWards_(data) {
  const sheet = getDataSheet_('ward');
  ensureHeaders_(sheet, CONFIG.WARD_HEADERS);

  return {
    success: true,
    data: sheetToObjects_(sheet)
  };
}


function getDashboard_(data) {
  const comments = getDataSheet_('comments');
  const applications = getDataSheet_('applications');
  const ward = getDataSheet_('ward');

  return {
    success: true,
    counts: {
      comments: Math.max(0, comments.getLastRow() - 1),
      applications: Math.max(0, applications.getLastRow() - 1),
      wards: Math.max(0, ward.getLastRow() - 1)
    }
  };
}


function sheetToObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) return [];

  const rangeValues = sheet
    .getRange(1, 1, lastRow, lastCol)
    .getDisplayValues();

  const headers = rangeValues[0].map(function(h) {
    return String(h);
  });

  const result = [];

  for (let r = 1; r < rangeValues.length; r++) {
    const obj = {
      _row: r + 1
    };

    let hasValue = false;

    headers.forEach(function(header, c) {
      const val = rangeValues[r][c];
      obj[header] = val;

      if (String(val).trim() !== '') {
        hasValue = true;
      }
    });

    if (hasValue) result.push(obj);
  }

  return result;
}


/* ============================================================
   SEND GMAIL
   ============================================================ */

function sendGmail_(data) {
  const admin = requireAdmin_(data);

  const to = String(data.to || '').trim();
  const subject = String(
    data.subject || 'Marin Gaupalika Notification'
  ).trim();
  const body = String(data.body || '');

  if (!validEmail_(to)) {
    throw new Error('Valid email आवश्यक छ।');
  }

  sendEmail_(to, subject, body);

  notifyAdmin_(
    '📧 Gmail Sent',
    details_(
      'Gmail पठाइएको छ।',
      {
        'To': to,
        'Subject': subject,
        'Sent By': admin
      }
    )
  );

  return {
    success: true,
    message: 'Gmail sent successfully.'
  };
}


/* ============================================================
   ADMIN EMAIL
   ============================================================ */

function notifyAdmin_(subject, body) {
  const email = String(
    CONFIG.ADMIN_EMAIL || ''
  ).trim();

  if (!validEmail_(email)) return;

  /*
   * Gmail notification failure should NOT make the original
   * form submission fail. Therefore notification is wrapped
   * safely.
   */
  safeSendEmail_(email, subject, body);
}


function safeSendEmail_(to, subject, body) {
  try {
    sendEmail_(to, subject, body);
    return true;
  } catch (err) {
    console.log(
      'Email failed: ' +
      errorMessage_(err)
    );
    return false;
  }
}


function sendEmail_(to, subject, body) {
  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: body,
    htmlBody:
      '<div style="' +
      'font-family:Arial,sans-serif;' +
      'line-height:1.7;font-size:14px;">' +
      escapeHtml_(body).replace(/\n/g, '<br>') +
      '</div>'
  });
}


/* ============================================================
   SPREADSHEET
   ============================================================ */

function getSpreadsheet_() {
  return SpreadsheetApp.openById(
    CONFIG.SPREADSHEET_ID
  );
}


function getUserSheet_() {
  const ss = getSpreadsheet_();

  const named = ss.getSheetByName(
    CONFIG.SHEETS.USERS
  );

  if (named) return named;

  const found = findSheetByHeaders_(
    ss,
    CONFIG.USER_HEADERS
  );

  if (found) return found;

  throw new Error(
    'Users sheet भेटिएन। Username र Password भएको sheet चाहिन्छ।'
  );
}


function getDataSheet_(type) {
  const ss = getSpreadsheet_();

  const map = {
    comments: {
      name: CONFIG.SHEETS.COMMENTS,
      headers: CONFIG.COMMENT_HEADERS
    },
    applications: {
      name: CONFIG.SHEETS.APPLICATIONS,
      headers: CONFIG.APPLICATION_HEADERS
    },
    ward: {
      name: CONFIG.SHEETS.WARD,
      headers: CONFIG.WARD_HEADERS
    }
  };

  const cfg = map[type];

  if (!cfg) {
    throw new Error(
      'Unknown sheet type: ' + type
    );
  }

  const named = ss.getSheetByName(cfg.name);
  if (named) return named;

  const found = findSheetByHeaders_(
    ss,
    cfg.headers
  );

  if (found) return found;

  const created = ss.insertSheet(cfg.name);

  created
    .getRange(
      1,
      1,
      1,
      cfg.headers.length
    )
    .setValues([cfg.headers]);

  return created;
}


/* ============================================================
   FIND SHEET BY HEADERS
   ============================================================ */

function findSheetByHeaders_(ss, requiredHeaders) {
  const sheets = ss.getSheets();

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const lastCol = sheet.getLastColumn();

    if (!lastCol) continue;

    const headers = sheet
      .getRange(1, 1, 1, lastCol)
      .getDisplayValues()[0]
      .map(String);

    const ok = requiredHeaders.every(
      function(header) {
        return headerIndex_(headers, header) >= 0;
      }
    );

    if (ok) return sheet;
  }

  return null;
}


/* ============================================================
   ENSURE HEADERS
   ============================================================ */

function ensureHeaders_(sheet, headers) {
  if (!headers || !headers.length) return;

  if (sheet.getLastColumn() === 0) {
    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([headers]);

    return;
  }

  const existing = sheet
    .getRange(
      1,
      1,
      1,
      sheet.getLastColumn()
    )
    .getDisplayValues()[0]
    .map(String);

  const missing = headers.filter(
    function(header) {
      return headerIndex_(existing, header) < 0;
    }
  );

  if (missing.length) {
    sheet
      .getRange(
        1,
        existing.length + 1,
        1,
        missing.length
      )
      .setValues([missing]);
  }
}


/* ============================================================
   APPEND
   ============================================================ */

function appendByHeaders_(sheet, obj) {
  const lastCol = sheet.getLastColumn();

  if (lastCol < 1) {
    throw new Error('Sheet header भेटिएन।');
  }

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(String);

  const row = headers.map(
    function(header) {
      return Object.prototype.hasOwnProperty.call(
        obj,
        header
      )
        ? obj[header]
        : '';
    }
  );

  sheet.appendRow(row);
}


/* ============================================================
   UPDATE FIELDS
   ============================================================ */

function updateFields_(sheet, row, data, allowedHeaders) {
  const lastCol = sheet.getLastColumn();

  if (lastCol < 1) return;

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(String);

  allowedHeaders.forEach(
    function(header) {
      if (
        !Object.prototype.hasOwnProperty.call(
          data,
          header
        )
      ) {
        return;
      }

      const idx = headerIndex_(
        headers,
        header
      );

      if (idx >= 0) {
        sheet
          .getRange(row, idx + 1)
          .setValue(data[header]);
      }
    }
  );
}


/* ============================================================
   SET CELL BY HEADER
   ============================================================ */

function setCellByHeader_(
  sheet,
  row,
  header,
  value
) {
  let lastCol = sheet.getLastColumn();

  if (lastCol < 1) return;

  let headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(String);

  let idx = headerIndex_(
    headers,
    header
  );

  if (idx < 0) {
    sheet
      .getRange(1, lastCol + 1)
      .setValue(header);

    idx = lastCol;
  }

  sheet
    .getRange(row, idx + 1)
    .setValue(value);
}


/* ============================================================
   FIND ROW
   ============================================================ */

function findRowByValue_(
  sheet,
  header,
  value
) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    return -1;
  }

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(String);

  const idx = headerIndex_(
    headers,
    header
  );

  if (idx < 0) {
    throw new Error(
      'Header भेटिएन: ' + header
    );
  }

  const column = sheet
    .getRange(
      2,
      idx + 1,
      lastRow - 1,
      1
    )
    .getDisplayValues();

  const target = String(
    value == null ? '' : value
  ).trim();

  for (let i = 0; i < column.length; i++) {
    if (
      String(column[i][0]).trim() === target
    ) {
      return i + 2;
    }
  }

  return -1;
}


/* ============================================================
   ROW OBJECT
   ============================================================ */

function rowObject_(sheet, row) {
  const lastCol = sheet.getLastColumn();

  if (lastCol < 1) return {};

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(String);

  const values = sheet
    .getRange(
      row,
      1,
      1,
      lastCol
    )
    .getDisplayValues()[0];

  const obj = {};

  headers.forEach(
    function(header, i) {
      obj[header] = values[i];
    }
  );

  return obj;
}


/* ============================================================
   NEXT NUMERIC ID
   ============================================================ */

function nextNumericId_(sheet, header) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return 1;

  const lastCol = sheet.getLastColumn();

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0];

  const idx = headerIndex_(
    headers,
    header
  );

  if (idx < 0) return 1;

  const values = sheet
    .getRange(
      2,
      idx + 1,
      lastRow - 1,
      1
    )
    .getDisplayValues();

  let max = 0;

  values.forEach(
    function(row) {
      const n = Number(
        String(row[0])
          .replace(/[^0-9.-]/g, '')
      );

      if (isFinite(n) && n > max) {
        max = n;
      }
    }
  );

  return max + 1;
}


/* ============================================================
   HEADER INDEX
   ============================================================ */

function headerIndex_(headers, wanted) {
  const w = String(
    wanted == null ? '' : wanted
  )
    .trim()
    .toLowerCase();

  for (let i = 0; i < headers.length; i++) {
    if (
      String(headers[i])
        .trim()
        .toLowerCase() === w
    ) {
      return i;
    }
  }

  return -1;
}


/* ============================================================
   VALUE
   ============================================================ */

function value_(obj, key) {
  if (
    Object.prototype.hasOwnProperty.call(
      obj,
      key
    )
  ) {
    return String(
      obj[key] == null ? '' : obj[key]
    ).trim();
  }

  return '';
}


/* ============================================================
   EMAIL
   ============================================================ */

function validEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || '').trim()
  );
}


/* ============================================================
   HTML ESCAPE
   ============================================================ */

function escapeHtml_(value) {
  return String(
    value == null ? '' : value
  )
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/* ============================================================
   DATE
   ============================================================ */

function formatDate_(date, pattern) {
  return Utilities.formatDate(
    date,
    CONFIG.TIMEZONE,
    pattern
  );
}


/* ============================================================
   EMAIL DETAILS
   ============================================================ */

function details_(intro, fields) {
  let text = intro + '\n\n';

  Object.keys(fields).forEach(
    function(key) {
      text +=
        key +
        ': ' +
        String(
          fields[key] == null
            ? ''
            : fields[key]
        ) +
        '\n';
    }
  );

  return text;
}


/* ============================================================
   ERROR
   ============================================================ */

function errorMessage_(err) {
  return (
    err &&
    err.message
      ? err.message
      : String(err)
  );
}


/* ============================================================
   JSON
   ============================================================ */

function json_(obj) {
  return ContentService
    .createTextOutput(
      JSON.stringify(obj)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


/* ============================================================
   ONE-TIME SETUP
   ============================================================ */

function setupSheets() {
  const ss = getSpreadsheet_();

  const configs = [
    [
      CONFIG.SHEETS.USERS,
      CONFIG.USER_HEADERS
    ],
    [
      CONFIG.SHEETS.COMMENTS,
      CONFIG.COMMENT_HEADERS
    ],
    [
      CONFIG.SHEETS.APPLICATIONS,
      CONFIG.APPLICATION_HEADERS
    ],
    [
      CONFIG.SHEETS.WARD,
      CONFIG.WARD_HEADERS
    ]
  ];

  configs.forEach(
    function(item) {
      let sheet = ss.getSheetByName(item[0]);

      if (!sheet) {
        sheet = ss.insertSheet(item[0]);
      }

      ensureHeaders_(
        sheet,
        item[1]
      );
    }
  );

  return 'Setup complete';
}


/* ============================================================
   TEST GMAIL
   ============================================================ */

function testAdminEmail() {
  const email = CONFIG.ADMIN_EMAIL;

  if (!validEmail_(email)) {
    throw new Error(
      'CONFIG.ADMIN_EMAIL गलत छ।'
    );
  }

  /*
   * Direct send is intentional here. If authorization is not
   * granted, Apps Script will show the authorization dialog.
   */
  MailApp.sendEmail({
    to: email,
    subject: '✅ Marin Gaupalika - Gmail Test',
    body:
      'यो Apps Script को Gmail notification test हो.\n\n' +
      'Google Apps Script बाट Gmail notification test गरिएको हो.'
  });

  return 'Test email sent to ' + email;
}
