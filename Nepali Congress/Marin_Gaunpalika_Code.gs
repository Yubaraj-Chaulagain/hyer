/* ============================================================
   MARIN GAUPALIKA DASHBOARD
   COMPLETE GOOGLE APPS SCRIPT - Code.gs
   ============================================================ */


/* ============================================================
   CONFIGURATION
   ============================================================ */

const CONFIG = {

  /*
   * आफ्नो Google Spreadsheet ID
   *
   * Example:
   * https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   */
  SPREADSHEET_ID:
    '1WwIGRZdjpmI9aD35lV2P2xddNzVMwUECwj_OEAf3zKM',


  /*
   * Admin notification Gmail
   *
   * यहाँ तपाईंले notification प्राप्त गर्ने Gmail राख्नुहोस्।
   */
  ADMIN_EMAIL:
    'Nepalicongressmarin@gmail.com',


  /* ================= SHEET NAMES ================= */

  SHEETS: {

    USERS:
      'Users',

    COMMENTS:
      'Comments',

    APPLICATIONS:
      'Applications',

    WARD:
      'Ward'

  },


  /* ================= USERS HEADERS ================= */

  USER_HEADERS: [

    'Username',
    'Password',
    'Name',
    'Role',
    'Status',
    'Email'

  ],


  /* ================= COMMENTS HEADERS ================= */

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
    'Status'

  ],


  /* ================= APPLICATION HEADERS ================= */

  APPLICATION_HEADERS: [

    'Timestamp',
    'Types',
    'Full Name',
    'Contact',
    'Address',
    'position',
    'To-line 2',
    'To',
    'Subject',
    'Details',
    'Chalani No.',
    'Chalani Date',
    'Darta No.',
    'Darta Date',
    'Status',
    'Attachment',
    'Download',
    'send to gmail',
    'send to Whatsapp'

  ],


  /* ================= WARD HEADERS ================= */

  WARD_HEADERS: [

    'Particulars',
    'Ward No. 1',
    'Ward No. 2',
    'Ward No. 3',
    'Ward No. 4',
    'Ward No. 5',
    'Ward No. 6',
    'Ward No. 7',
    'Grand Total'

  ]

};


/* ============================================================
   SPREADSHEET
   ============================================================ */

function getSpreadsheet_() {

  if (
    CONFIG.SPREADSHEET_ID &&
    CONFIG.SPREADSHEET_ID.trim()
  ) {

    return SpreadsheetApp.openById(
      CONFIG.SPREADSHEET_ID.trim()
    );

  }

  return SpreadsheetApp.getActiveSpreadsheet();
}


/* ============================================================
   GET SHEET
   ============================================================ */

function getSheet_(sheetName) {

  const ss = getSpreadsheet_();

  let sheet =
    ss.getSheetByName(sheetName);

  if (!sheet) {

    sheet =
      ss.insertSheet(sheetName);

  }

  return sheet;
}


/* ============================================================
   ENSURE HEADERS
   ============================================================ */

function ensureHeaders_(
  sheet,
  headers
) {

  if (!headers || !headers.length) {
    return;
  }

  const existingLastColumn =
    sheet.getLastColumn();

  const existingLastRow =
    sheet.getLastRow();


  /* Empty sheet */

  if (
    existingLastRow === 0 ||
    existingLastColumn === 0
  ) {

    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([headers]);

    formatHeader_(sheet);

    return;
  }


  /* Read current header */

  const currentHeaders =
    sheet
      .getRange(
        1,
        1,
        1,
        Math.max(
          existingLastColumn,
          headers.length
        )
      )
      .getValues()[0];


  headers.forEach(
    function(header,index) {

      if (
        String(
          currentHeaders[index] || ''
        ).trim() !== header
      ) {

        sheet
          .getRange(
            1,
            index + 1
          )
          .setValue(header);

      }

    }
  );


  formatHeader_(sheet);

}


/* ============================================================
   HEADER FORMAT
   ============================================================ */

function formatHeader_(sheet) {

  const lastColumn =
    sheet.getLastColumn();

  if (!lastColumn) {
    return;
  }

  sheet
    .getRange(
      1,
      1,
      1,
      lastColumn
    )
    .setFontWeight('bold')
    .setBackground('#071b5c')
    .setFontColor('#ffffff');

  sheet.setFrozenRows(1);

}


/* ============================================================
   ONE-TIME SETUP
   ============================================================ */

function setupSheets() {

  const ss =
    getSpreadsheet_();

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

      let sheet =
        ss.getSheetByName(item[0]);

      if (!sheet) {

        sheet =
          ss.insertSheet(item[0]);

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
   WEB APP GET
   ============================================================ */

function doGet(e) {

  return ContentService
    .createTextOutput(
      JSON.stringify({
        success:true,
        message:
          'Marin Gaupalika API is running.',
        time:
          new Date().toISOString()
      })
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );

}


/* ============================================================
   WEB APP POST
   ============================================================ */

function doPost(e) {

  try {

    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {

      return jsonResponse_(
        false,
        'POST data भेटिएन।'
      );

    }


    const raw =
      e.postData.contents;

    const data =
      JSON.parse(raw);


    if (!data.action) {

      return jsonResponse_(
        false,
        'Action आवश्यक छ।'
      );

    }


    switch (
      String(data.action).trim()
    ) {

      case 'addComment':

        return handleAddComment_(data);


      case 'reply':

        return handleCommentReply_(data);


      default:

        return jsonResponse_(
          false,
          'Unknown action: ' +
          data.action
        );

    }

  }
  catch(error) {

    console.error(
      error.stack ||
      error
    );

    return jsonResponse_(
      false,
      error.message ||
      'Server error'
    );

  }

}


/* ============================================================
   JSON RESPONSE
   ============================================================ */

function jsonResponse_(
  success,
  message,
  extra
) {

  const result = {

    success:
      Boolean(success),

    message:
      String(message || '')

  };


  if (extra) {

    Object.keys(extra)
      .forEach(
        function(key) {

          result[key] =
            extra[key];

        }
      );

  }


  return ContentService
    .createTextOutput(
      JSON.stringify(result)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );

}


/* ============================================================
   ADD NEW COMMENT
   ============================================================ */

function handleAddComment_(data) {

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);


  try {

    const name =
      clean_(data.Name);

    const address =
      clean_(data.Address);

    const mobile =
      clean_(data.Mobile);

    const email =
      clean_(data.Email);

    const category =
      clean_(data.Category);

    const subject =
      clean_(data.Subject);

    const message =
      clean_(data['Message/Comment']);

    const attachment =
      clean_(data.Attachment);


    /* ================= VALIDATION ================= */

    if (!name) {

      return jsonResponse_(
        false,
        'Name आवश्यक छ।'
      );

    }

    if (!mobile) {

      return jsonResponse_(
        false,
        'Mobile आवश्यक छ।'
      );

    }

    if (!category) {

      return jsonResponse_(
        false,
        'Category आवश्यक छ।'
      );

    }

    if (!message) {

      return jsonResponse_(
        false,
        'Message/Comment आवश्यक छ।'
      );

    }


    if (
      email &&
      !validEmail_(email)
    ) {

      return jsonResponse_(
        false,
        'Email सही छैन।'
      );

    }


    /* ================= SHEET ================= */

    const sheet =
      getSheet_(
        CONFIG.SHEETS.COMMENTS
      );


    ensureHeaders_(
      sheet,
      CONFIG.COMMENT_HEADERS
    );


    /* ================= ID ================= */

    const id =
      generateCommentId_(
        sheet
      );


    /* ================= DATE / TIME ================= */

    const now =
      new Date();

    const timezone =
      Session.getScriptTimeZone() ||
      'Asia/Kathmandu';

    const date =
      Utilities.formatDate(
        now,
        timezone,
        'yyyy-MM-dd'
      );

    const time =
      Utilities.formatDate(
        now,
        timezone,
        'HH:mm'
      );


    /* ================= ROW ================= */

    const row = [

      id,

      date,

      time,

      name,

      address,

      mobile,

      email,

      category,

      subject,

      message,

      attachment,

      '',

      '',

      'Pending'

    ];


    sheet
      .appendRow(row);


    /* ================= FORMAT ================= */

    const lastRow =
      sheet.getLastRow();

    sheet
      .getRange(
        lastRow,
        1,
        1,
        row.length
      )
      .setVerticalAlignment(
        'top'
      );


    /* ================= EMAIL ================= */

    sendNewCommentEmail_({

      id:id,

      date:date,

      time:time,

      name:name,

      address:address,

      mobile:mobile,

      email:email,

      category:category,

      subject:subject,

      message:message,

      attachment:attachment

    });


    return jsonResponse_(
      true,
      'Comment successfully submitted.',
      {
        id:id,
        date:date,
        time:time,
        status:'Pending'
      }
    );

  }
  finally {

    lock.releaseLock();

  }

}


/* ============================================================
   GENERATE COMMENT ID
   ============================================================ */

function generateCommentId_(sheet) {

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {

    return 'C-0001';

  }


  const idColumn =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        1
      )
      .getValues()
      .flat();


  let max = 0;


  idColumn.forEach(
    function(value) {

      const match =
        String(value)
          .match(
            /(\d+)$/
          );

      if (match) {

        const number =
          parseInt(
            match[1],
            10
          );

        if (
          number > max
        ) {

          max = number;

        }

      }

    }
  );


  return (
    'C-' +
    String(max + 1)
      .padStart(
        4,
        '0'
      )
  );

}


/* ============================================================
   ADMIN REPLY
   ============================================================ */

function handleCommentReply_(data) {

  const id =
    clean_(data.id);

  const reply =
    clean_(data.reply);


  if (!id) {

    return jsonResponse_(
      false,
      'Comment ID आवश्यक छ।'
    );

  }


  if (!reply) {

    return jsonResponse_(
      false,
      'Reply खाली राख्न मिल्दैन।'
    );

  }


  const sheet =
    getSheet_(
      CONFIG.SHEETS.COMMENTS
    );


  ensureHeaders_(
    sheet,
    CONFIG.COMMENT_HEADERS
  );


  const lastRow =
    sheet.getLastRow();


  if (lastRow < 2) {

    return jsonResponse_(
      false,
      'Comments sheet खाली छ।'
    );

  }


  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0];


  const idCol =
    findHeaderIndex_(
      headers,
      'ID'
    );

  const replyCol =
    findHeaderIndex_(
      headers,
      'Admin Reply'
    );

  const replyDateCol =
    findHeaderIndex_(
      headers,
      'Reply Date'
    );

  const statusCol =
    findHeaderIndex_(
      headers,
      'Status'
    );


  if (
    idCol < 0 ||
    replyCol < 0 ||
    replyDateCol < 0 ||
    statusCol < 0
  ) {

    return jsonResponse_(
      false,
      'Comments sheet headers मिलेन।'
    );

  }


  const ids =
    sheet
      .getRange(
        2,
        idCol + 1,
        lastRow - 1,
        1
      )
      .getValues()
      .flat();


  let targetRow = -1;


  for (
    let i = 0;
    i < ids.length;
    i++
  ) {

    if (
      String(ids[i]).trim() ===
      String(id).trim()
    ) {

      targetRow =
        i + 2;

      break;

    }

  }


  if (targetRow < 0) {

    return jsonResponse_(
      false,
      'Comment ID भेटिएन: ' +
      id
    );

  }


  const timezone =
    Session.getScriptTimeZone() ||
    'Asia/Kathmandu';

  const now =
    Utilities.formatDate(
      new Date(),
      timezone,
      'yyyy-MM-dd HH:mm'
    );


  /* ================= UPDATE ================= */

  sheet
    .getRange(
      targetRow,
      replyCol + 1
    )
    .setValue(reply);


  sheet
    .getRange(
      targetRow,
      replyDateCol + 1
    )
    .setValue(now);


  sheet
    .getRange(
      targetRow,
      statusCol + 1
    )
    .setValue('Replied');


  /* ================= EMAIL ================= */

  const rowValues =
    sheet
      .getRange(
        targetRow,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0];


  const rowObject =
    rowToObject_(
      headers,
      rowValues
    );


  sendReplyEmail_(
    rowObject,
    reply,
    now
  );


  return jsonResponse_(
    true,
    'Reply successfully saved.',
    {
      id:id,
      status:'Replied',
      replyDate:now
    }
  );

}


/* ============================================================
   SEND NEW COMMENT EMAIL
   ============================================================ */

function sendNewCommentEmail_(comment) {

  const email =
    CONFIG.ADMIN_EMAIL;


  if (
    !validEmail_(email)
  ) {

    console.warn(
      'ADMIN_EMAIL invalid.'
    );

    return;

  }


  try {

    const subject =
      '💬 New Comment / Grievance - ' +
      comment.id;


    const body =

      'Marin Gaupalika Dashboard\n\n' +

      'नयाँ Comment / गुनासो प्राप्त भएको छ।\n\n' +

      'ID: ' +
      comment.id +
      '\n' +

      'Date: ' +
      comment.date +
      '\n' +

      'Time: ' +
      comment.time +
      '\n\n' +

      'Name: ' +
      comment.name +
      '\n' +

      'Address: ' +
      comment.address +
      '\n' +

      'Mobile: ' +
      comment.mobile +
      '\n' +

      'Email: ' +
      comment.email +
      '\n' +

      'Category: ' +
      comment.category +
      '\n' +

      'Subject: ' +
      comment.subject +
      '\n\n' +

      'Message:\n' +
      comment.message +
      '\n\n' +

      (
        comment.attachment
          ? 'Attachment:\n' +
            comment.attachment +
            '\n\n'
          : ''
      ) +

      'Status: Pending';


    MailApp.sendEmail({

      to:email,

      subject:subject,

      body:body

    });

  }
  catch(error) {

    console.error(
      'New comment email error:',
      error
    );

  }

}


/* ============================================================
   SEND REPLY EMAIL
   ============================================================ */

function sendReplyEmail_(
  row,
  reply,
  replyDate
) {

  const email =
    clean_(
      row['Email']
    );


  /*
   * Reply notification:
   * पहिले comment गर्ने व्यक्तिको Email मा पठाउने।
   */
  if (
    !validEmail_(email)
  ) {

    console.log(
      'User email छैन। Reply notification skip गरियो।'
    );

    return;

  }


  try {

    const name =
      clean_(
        row['Name']
      ) ||
      'User';


    const subject =
      clean_(
        row['Subject']
      ) ||
      'Your Comment / Grievance';


    const replySubject =
      'Re: ' +
      subject;


    const body =

      'नमस्कार ' +
      name +
      ',\n\n' +

      'तपाईंले Marin Gaupalika Dashboard मा पठाउनुभएको Comment / गुनासोको Admin Reply प्राप्त भएको छ।\n\n' +

      'Comment ID: ' +
      row['ID'] +
      '\n' +

      'Subject: ' +
      subject +
      '\n\n' +

      'तपाईंको सन्देश:\n' +

      clean_(
        row['Message/Comment']
      ) +

      '\n\n' +

      'Admin Reply:\n' +

      reply +

      '\n\n' +

      'Reply Date: ' +
      replyDate +

      '\n\n' +

      'Marin Gaupalika Dashboard';


    MailApp.sendEmail({

      to:email,

      subject:replySubject,

      body:body

    });

  }
  catch(error) {

    console.error(
      'Reply email error:',
      error
    );

  }

}


/* ============================================================
   TEST GMAIL
   ============================================================ */

function testAdminEmail() {

  const email =
    CONFIG.ADMIN_EMAIL;


  if (
    !validEmail_(email)
  ) {

    throw new Error(
      'CONFIG.ADMIN_EMAIL गलत छ।'
    );

  }


  MailApp.sendEmail({

    to:email,

    subject:
      '✅ Marin Gaupalika - Gmail Test',

    body:

      'यो Apps Script को Gmail notification test हो.\n\n' +

      'Google Apps Script बाट Gmail notification test गरिएको हो.'

  });


  return (
    'Test email sent to ' +
    email
  );

}


/* ============================================================
   TEST SPREADSHEET ACCESS
   ============================================================ */

function testSpreadsheetAccess() {

  try {

    const ss =
      SpreadsheetApp.openById(
        CONFIG.SPREADSHEET_ID
      );


    console.log(
      'Name: ' +
      ss.getName()
    );


    console.log(
      'ID: ' +
      ss.getId()
    );


    return (
      'SUCCESS - ' +
      ss.getName()
    );

  }
  catch(error) {

    console.error(
      error.stack ||
      error
    );

    throw error;

  }

}


/* ============================================================
   TEST COMMENT API
   ============================================================ */

function testAddComment() {

  const testData = {

    action:
      'addComment',

    Name:
      'Test User',

    Address:
      'Marin',

    Mobile:
      '9800000000',

    Email:
      CONFIG.ADMIN_EMAIL,

    Category:
      'general',

    Subject:
      'API Test',

    'Message/Comment':
      'यो Google Apps Script API test comment हो।',

    Attachment:
      ''

  };


  const result =
    handleAddComment_(
      testData
    );


  console.log(
    result.getContent()
  );


  return result.getContent();

}


/* ============================================================
   TEST REPLY
   ============================================================ */

function testReply() {

  const sheet =
    getSheet_(
      CONFIG.SHEETS.COMMENTS
    );


  if (
    sheet.getLastRow() < 2
  ) {

    throw new Error(
      'पहिला एउटा Comment हुनुपर्छ।'
    );

  }


  const id =
    sheet
      .getRange(
        2,
        1
      )
      .getValue();


  const result =
    handleCommentReply_({

      action:
        'reply',

      id:
        String(id),

      reply:
        'यो test admin reply हो।'

    });


  console.log(
    result.getContent()
  );


  return result.getContent();

}


/* ============================================================
   HELPERS
   ============================================================ */

function clean_(value) {

  return String(
    value === null ||
    value === undefined
      ? ''
      : value
  ).trim();

}


/* ============================================================
   VALID EMAIL
   ============================================================ */

function validEmail_(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(
      String(email || '').trim()
    );

}


/* ============================================================
   FIND HEADER INDEX
   ============================================================ */

function findHeaderIndex_(
  headers,
  target
) {

  const normalizedTarget =
    normalize_(target);


  for (
    let i = 0;
    i < headers.length;
    i++
  ) {

    if (
      normalize_(
        headers[i]
      ) ===
      normalizedTarget
    ) {

      return i;

    }

  }


  return -1;

}


/* ============================================================
   NORMALIZE HEADER
   ============================================================ */

function normalize_(value) {

  return String(
    value || ''
  )
    .trim()
    .toLowerCase();

}


/* ============================================================
   ROW TO OBJECT
   ============================================================ */

function rowToObject_(
  headers,
  values
) {

  const object = {};


  headers.forEach(
    function(header,index) {

      object[
        String(header)
      ] =
        values[index] !== undefined
          ? values[index]
          : '';

    }
  );


  return object;

}
