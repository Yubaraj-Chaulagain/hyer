/*******************************************************
 * CRM2 / Member Finance System
 * Google Sheets Database + ImgBB backend
 *
 * 1. Paste this complete code into Apps Script.
 * 2. Run setupCRM() once.
 * 3. Deploy as Web app:
 *    Execute as: Me
 *    Who has access: Anyone
 *
 * The script automatically creates all sheets + headers.
 * ImgBB API key is stored in Settings sheet, NOT in HTML.
 * HTML sends image data to uploadImage; this server uploads
 * it to ImgBB using the key stored in Settings.
 *
 * Default login created by setupCRM():
 * Username: admin
 * Password: admin123
 *******************************************************/

const CRM = {
  databaseName: 'CRM2 Database',
  propertyKey: 'CRM2_SPREADSHEET_ID',

  sheets: {
    Users: [
      'Username','Password','Role','MemberID','CreatedAt','UpdatedAt'
    ],

    Members: [
      'MemberID','Name','Address','Father Name','Grand Father Name',
      'spouse/wife Name','Phone','Email','Identy PhotoURL',
      'Member PhotoURL','Status','OTP','EntryDate','CreatedAt','UpdatedAt'
    ],

    Items: [
      'ItemID','Name','Price','Quantity','CreatedAt','UpdatedAt'
    ],

    Transactions: [
      'TxnID','MemberID','Type','Amount','Details',
      'PaymentType','Date','RefMemberID','CreatedAt','UpdatedAt'
    ],

    Loans: [
      'LoanID','MemberID','Amount','Months','MonthlyPayment',
      'Paid','Remaining','NextDueDate','Status','CreatedAt','UpdatedAt'
    ],

    LoanPayments: [
      'PaymentID','LoanID','Amount','Date','MemberID','CreatedAt'
    ],

    MemberResult: [
      'MemberID','Result ballance','Deposit','Withdraw','LoanPay',
      'Transfer Sent','Transfer Received','Buying','Selling',
      'Loans','Office To Transfar'
    ],

    Settings: [
      'Key','Value','Description','UpdatedAt'
    ],

    EmailLog: [
      'LogID','To','Subject','Message','Status','Date'
    ]
  }
};


/* =========================
   WEB APP
========================= */

function doGet(e) {
  try {
    setupCRM();
    return json_({
      status: true,
      message: 'CRM2 API is running',
      database: getSpreadsheet_().getName()
    });
  } catch (err) {
    return json_({
      status: false,
      message: String(err.message || err)
    });
  }
}


function doPost(e) {
  try {
    setupCRM();

    const data = parseRequest_(e);
    const action = String(data.action || '').trim();

    if (!action) {
      return json_({status:false, message:'Action is required'});
    }

    switch (action) {

      case 'setup':
      case 'setupCRM':
        setupCRM();
        return json_({
          status:true,
          message:'All CRM2 sheets and headers are ready',
          spreadsheetId:getSpreadsheet_().getId(),
          spreadsheetName:getSpreadsheet_().getName()
        });

      case 'login':
        return json_(login_(data));

      /* MEMBERS */
      case 'getMembers':
        return json_(getRows_('Members'));

      case 'addMember':
        return json_(addMember_(data));

      case 'updateMember':
        return json_(updateRow_('Members','MemberID',data));

      case 'deleteMember':
        return json_(deleteRow_('Members','MemberID',data.MemberID));

      /* USERS */
      case 'getUsers':
        return json_(getRows_('Users'));

      case 'addUser':
        return json_(addUser_(data));

      case 'updateUser':
        return json_(updateUser_(data));

      case 'deleteUser':
        return json_(deleteRow_('Users','Username',data.Username));

      /* ITEMS */
      case 'getItems':
        return json_(getRows_('Items'));

      case 'addItem':
        return json_(addRow_('Items',data,'ItemID'));

      case 'updateItem':
        return json_(updateRow_('Items','ItemID',data));

      case 'deleteItem':
        return json_(deleteRow_('Items','ItemID',data.ItemID));

      /* TRANSACTIONS */
      case 'getTransactions':
        return json_(getRows_('Transactions'));

      case 'addTransaction':
        return json_(addTransaction_(data));

      case 'updateTransaction':
        return json_(updateRow_('Transactions','TxnID',data));

      case 'deleteTransaction':
        return json_(deleteRow_('Transactions','TxnID',data.TxnID));

      case 'getMemberTransactions':
        return json_(getMemberTransactions_(data.MemberID));

      /* TRANSFER */
      case 'transfer':
        return json_(validateTransfer_(data));

      case 'getTransfers':
        return json_(getRows_('Transactions')
          .filter(r => String(r.Type).toLowerCase().includes('transfer')));

      case 'getTransferHistory':
        return json_(getTransferHistory_(data.MemberID));

      /* LOANS */
      case 'getLoans':
        return json_(getRows_('Loans'));

      case 'addLoan':
        return json_(addLoan_(data));

      case 'payLoan':
        return json_(payLoan_(data));

      case 'getLoanPayments':
        return json_(getLoanPayments_(data.LoanID));

      /* MEMBER RESULT */
      case 'getMemberResult':
        return json_(buildMemberResults_());

      /* SETTINGS */
      case 'getSettings':
        return json_(getSettings_());

      case 'getSetting':
        return json_(getSetting_(data.Key));

      case 'saveSetting':
      case 'updateSetting':
        return json_(saveSetting_(data));

      /*
       * ImgBB key never goes to browser.
       * Browser sends base64 -> Apps Script -> ImgBB.
       */
      case 'uploadImage':
        return json_(uploadImage_(data));

      /* EMAIL */
      case 'sendEmail':
        return json_(sendEmail_(data));

      case 'sendBulkEmail':
        return json_(sendBulkEmail_(data));

      case 'testEmailReminder':
        return json_(testEmailReminder_());

      default:
        return json_({
          status:false,
          message:'Unknown action: ' + action
        });
    }

  } catch (err) {
    console.error(err);
    return json_({
      status:false,
      message:String(err.message || err)
    });
  }
}


/* =========================
   DATABASE SETUP
========================= */

function setupCRM() {
  const ss = getSpreadsheet_();

  Object.keys(CRM.sheets).forEach(function(name) {
    ensureSheet_(ss, name, CRM.sheets[name]);
  });

  seedSettings_();
  seedAdmin_();

  return ss;
}


function createCRMDatabase() {
  const ss = getSpreadsheet_();
  setupCRM();

  Logger.log('CRM2 Database: ' + ss.getName());
  Logger.log('Spreadsheet ID: ' + ss.getId());
  return ss.getId();
}


function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(CRM.propertyKey);

  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      props.deleteProperty(CRM.propertyKey);
    }
  }

  /* If this Apps Script is bound to a Google Sheet, use that sheet. */
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      props.setProperty(CRM.propertyKey, active.getId());
      return active;
    }
  } catch (err) {}

  /* Otherwise automatically create a new Google Sheet. */
  const created = SpreadsheetApp.create(CRM.databaseName);
  props.setProperty(CRM.propertyKey, created.getId());
  return created;
}


function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);

  if (!sh) {
    sh = ss.insertSheet(name);
  }

  if (sh.getMaxColumns() < headers.length) {
    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      headers.length - sh.getMaxColumns()
    );
  }

  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
  } else {
    const current = sh.getRange(1,1,1,headers.length).getValues()[0];
    let changed = false;

    for (let i=0; i<headers.length; i++) {
      if (String(current[i] || '') !== String(headers[i])) {
        current[i] = headers[i];
        changed = true;
      }
    }

    if (changed) {
      sh.getRange(1,1,1,headers.length).setValues([current]);
    }
  }

  sh.setFrozenRows(1);
  return sh;
}


/* =========================
   SEED DATA
========================= */

function seedAdmin_() {
  const rows = getRows_('Users');

  if (!rows.some(r => String(r.Username) === 'admin')) {
    addRow_('Users', {
      Username:'admin',
      Password:'admin123',
      Role:'admin',
      MemberID:'',
      CreatedAt:now_(),
      UpdatedAt:now_()
    }, 'Username');
  }
}


function seedSettings_() {
  const defaults = [
    {
      Key:'AppName',
      Value:'CRM2',
      Description:'Application name'
    },
    {
      Key:'ImgBB_API_Key',
      Value:'',
      Description:'Put your ImgBB API key here. It is used server-side only.'
    },
    {
      Key:'ImgBB_Upload_URL',
      Value:'https://api.imgbb.com/1/upload',
      Description:'ImgBB upload endpoint'
    },
    {
      Key:'Currency',
      Value:'NPR',
      Description:'Application currency'
    }
  ];

  const existing = getRows_('Settings');

  defaults.forEach(function(item) {
    if (!existing.some(r => String(r.Key) === item.Key)) {
      saveSetting_(item);
    }
  });
}


/* =========================
   GENERIC SHEET HELPERS
========================= */

function getSheet_(name) {
  const sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}


function getHeaders_(name) {
  return CRM.sheets[name];
}


function getRows_(name) {
  const sh = getSheet_(name);
  const headers = getHeaders_(name);
  const lastRow = sh.getLastRow();

  if (lastRow < 2) return [];

  const values = sh.getRange(
    2,
    1,
    lastRow - 1,
    headers.length
  ).getValues();

  return values
    .filter(row => row.some(v => v !== '' && v !== null))
    .map(row => rowToObject_(headers,row));
}


function rowToObject_(headers,row) {
  const obj = {};
  headers.forEach(function(h,i) {
    obj[h] = normalizeValue_(row[i]);
  });
  return obj;
}


function normalizeValue_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(
      v,
      Session.getScriptTimeZone() || 'Asia/Kathmandu',
      'yyyy-MM-dd HH:mm:ss'
    );
  }
  return v;
}


function addRow_(sheetName,data,idField) {
  const sh = getSheet_(sheetName);
  const headers = getHeaders_(sheetName);
  const rowObj = Object.assign({},data);

  if (idField && !String(rowObj[idField] || '').trim()) {
    rowObj[idField] = id_(idField);
  }

  const values = headers.map(function(h) {
    return rowObj[h] !== undefined ? rowObj[h] : '';
  });

  sh.appendRow(values);

  return {
    status:true,
    message:sheetName + ' saved successfully',
    [idField || 'id']:idField ? rowObj[idField] : ''
  };
}


function updateRow_(sheetName,keyField,data) {
  const sh = getSheet_(sheetName);
  const headers = getHeaders_(sheetName);
  const keyCol = headers.indexOf(keyField) + 1;

  if (!keyCol) {
    return {status:false,message:'Key field not found: '+keyField};
  }

  const key = String(data[keyField] || '').trim();
  if (!key) return {status:false,message:keyField+' is required'};

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    return {status:false,message:'No records found'};
  }

  const keyValues = sh.getRange(2,keyCol,lastRow-1,1).getValues();

  for (let i=0; i<keyValues.length; i++) {
    if (String(keyValues[i][0]) === key) {
      const rowNumber = i + 2;
      const current = sh.getRange(
        rowNumber,1,1,headers.length
      ).getValues()[0];

      headers.forEach(function(h,index) {
        if (data[h] !== undefined) {
          current[index] = data[h];
        }
      });

      if (headers.indexOf('UpdatedAt') >= 0) {
        current[headers.indexOf('UpdatedAt')] = now_();
      }

      sh.getRange(
        rowNumber,1,1,headers.length
      ).setValues([current]);

      return {
        status:true,
        message:sheetName+' updated successfully'
      };
    }
  }

  return {
    status:false,
    message:keyField+' not found: '+key
  };
}


function deleteRow_(sheetName,keyField,keyValue) {
  const sh = getSheet_(sheetName);
  const headers = getHeaders_(sheetName);
  const keyCol = headers.indexOf(keyField) + 1;
  const key = String(keyValue || '').trim();

  if (!key) return {status:false,message:keyField+' is required'};

  const lastRow = sh.getLastRow();

  if (lastRow < 2) {
    return {status:false,message:'No records found'};
  }

  const values = sh.getRange(
    2,keyCol,lastRow-1,1
  ).getValues();

  for (let i=0; i<values.length; i++) {
    if (String(values[i][0]) === key) {
      sh.deleteRow(i+2);
      return {
        status:true,
        message:sheetName+' deleted successfully'
      };
    }
  }

  return {
    status:false,
    message:keyField+' not found: '+key
  };
}


/* =========================
   LOGIN / USERS
========================= */

function login_(data) {
  const username = String(data.username || '').trim();
  const password = String(data.password || '');

  if (!username || !password) {
    return {status:false,message:'Username and password required'};
  }

  const users = getRows_('Users');

  const user = users.find(function(u) {
    return String(u.Username) === username &&
           String(u.Password) === password;
  });

  if (!user) {
    return {status:false,message:'Invalid username or password'};
  }

  return {
    status:true,
    message:'Login successful',
    username:user.Username,
    role:user.Role || 'user',
    MemberID:user.MemberID || ''
  };
}


function addUser_(data) {
  const username = String(data.Username || '').trim();
  if (!username) return {status:false,message:'Username required'};

  const users = getRows_('Users');

  if (users.some(u => String(u.Username) === username)) {
    return {status:false,message:'Username already exists'};
  }

  return addRow_('Users',{
    Username:username,
    Password:String(data.Password || ''),
    Role:String(data.Role || 'user'),
    MemberID:String(data.MemberID || ''),
    CreatedAt:now_(),
    UpdatedAt:now_()
  },'Username');
}


function updateUser_(data) {
  if (!String(data.Password || '')) {
    delete data.Password;
  }
  return updateRow_('Users','Username',data);
}


/* =========================
   MEMBERS
========================= */

function addMember_(data) {
  const memberID = String(data.MemberID || '').trim();

  if (!memberID) {
    return {status:false,message:'MemberID is required'};
  }

  const members = getRows_('Members');

  if (members.some(m => String(m.MemberID) === memberID)) {
    return {status:false,message:'MemberID already exists'};
  }

  const now = now_();

  return addRow_('Members',Object.assign({},data,{
    MemberID:memberID,
    CreatedAt:now,
    UpdatedAt:now
  }),'MemberID');
}


/* =========================
   TRANSACTIONS
========================= */

function addTransaction_(data) {
  const amount = Number(data.Amount || 0);

  if (!data.MemberID) {
    return {status:false,message:'MemberID is required'};
  }

  if (amount <= 0) {
    return {status:false,message:'Amount must be greater than zero'};
  }

  return addRow_('Transactions',{
    TxnID:String(data.TxnID || id_('TXN')),
    MemberID:String(data.MemberID || ''),
    Type:String(data.Type || ''),
    Amount:amount,
    Details:String(data.Details || ''),
    PaymentType:String(data.PaymentType || ''),
    Date:String(data.Date || now_()),
    RefMemberID:String(data.RefMemberID || ''),
    CreatedAt:now_(),
    UpdatedAt:now_()
  },'TxnID');
}


function getMemberTransactions_(memberID) {
  const id = String(memberID || '').trim();
  return getRows_('Transactions')
    .filter(t => String(t.MemberID) === id ||
                 String(t.RefMemberID) === id);
}


/* =========================
   TRANSFER
========================= */

function validateTransfer_(data) {
  const from = String(data.From || '').trim();
  const to = String(data.To || '').trim();
  const amount = Number(data.Amount || 0);

  if (!from || !to) {
    return {status:false,message:'From and To members are required'};
  }

  if (from === to) {
    return {status:false,message:'Cannot transfer to the same member'};
  }

  if (amount <= 0) {
    return {status:false,message:'Amount must be greater than zero'};
  }

  const results = buildMemberResults_();
  const sender = results.find(
    r => String(r.MemberID) === from
  );

  const balance = Number(sender && sender['Result ballance'] || 0);

  if (balance < amount) {
    return {
      status:false,
      message:'Insufficient balance. Available balance: '+balance
    };
  }

  /*
   * IMPORTANT:
   * crm2.html already creates Transfer Sent and
   * Transfer Received transaction rows after this validation.
   * Therefore this action does NOT create duplicate rows.
   */
  return {
    status:true,
    message:'Transfer approved',
    balance:balance
  };
}


function getTransferHistory_(memberID) {
  const id = String(memberID || '').trim();

  return getRows_('Transactions').filter(function(t) {
    const type = String(t.Type || '').toLowerCase();
    return type.includes('transfer') &&
      (String(t.MemberID) === id ||
       String(t.RefMemberID) === id);
  });
}


/* =========================
   LOANS
========================= */

function addLoan_(data) {
  const amount = Number(data.Amount || 0);
  const months = Number(data.Months || 0);

  if (!data.MemberID) {
    return {status:false,message:'MemberID is required'};
  }

  if (amount <= 0 || months <= 0) {
    return {status:false,message:'Valid amount and months required'};
  }

  const monthly = Math.round((amount / months) * 100) / 100;
  const nextDue = addMonths_(new Date(),1);

  const loanID = String(data.LoanID || id_('LN'));

  const result = addRow_('Loans',{
    LoanID:loanID,
    MemberID:String(data.MemberID),
    Amount:amount,
    Months:months,
    MonthlyPayment:monthly,
    Paid:0,
    Remaining:amount,
    NextDueDate:formatDate_(nextDue),
    Status:'Active',
    CreatedAt:now_(),
    UpdatedAt:now_()
  },'LoanID');

  if (result.status) {
    /*
     * Loan itself is not a member expense transaction here.
     * It remains in Loans and is shown separately in MemberResult.
     */
  }

  return result;
}


function payLoan_(data) {
  const loanID = String(data.LoanID || '').trim();
  const payment = Number(data.Amount || 0);

  if (!loanID || payment <= 0) {
    return {status:false,message:'Valid LoanID and amount required'};
  }

  const sh = getSheet_('Loans');
  const headers = getHeaders_('Loans');
  const idCol = headers.indexOf('LoanID') + 1;

  if (sh.getLastRow() < 2) {
    return {status:false,message:'Loan not found'};
  }

  const ids = sh.getRange(
    2,idCol,sh.getLastRow()-1,1
  ).getValues();

  for (let i=0; i<ids.length; i++) {
    if (String(ids[i][0]) === loanID) {
      const rowNumber = i+2;
      const row = sh.getRange(
        rowNumber,1,1,headers.length
      ).getValues()[0];

      const idxAmount = headers.indexOf('Amount');
      const idxPaid = headers.indexOf('Paid');
      const idxRemaining = headers.indexOf('Remaining');
      const idxDue = headers.indexOf('NextDueDate');
      const idxStatus = headers.indexOf('Status');
      const idxMember = headers.indexOf('MemberID');
      const idxUpdated = headers.indexOf('UpdatedAt');

      const original = Number(row[idxAmount] || 0);
      const paidBefore = Number(row[idxPaid] || 0);
      const remainingBefore =
        Number(row[idxRemaining] || (original-paidBefore));

      if (remainingBefore <= 0) {
        return {status:false,message:'Loan is already fully paid'};
      }

      if (payment > remainingBefore) {
        return {
          status:false,
          message:'Payment exceeds remaining loan amount'
        };
      }

      const paidAfter = paidBefore + payment;
      const remainingAfter = remainingBefore - payment;

      row[idxPaid] = paidAfter;
      row[idxRemaining] = remainingAfter;
      row[idxStatus] = remainingAfter <= 0 ? 'Paid' : 'Active';
      row[idxDue] =
        remainingAfter <= 0
          ? ''
          : formatDate_(addMonths_(new Date(),1));

      if (idxUpdated >= 0) row[idxUpdated] = now_();

      sh.getRange(
        rowNumber,1,1,headers.length
      ).setValues([row]);

      const memberID = String(row[idxMember] || '');

      getSheet_('LoanPayments').appendRow([
        id_('LP'),
        loanID,
        payment,
        now_(),
        memberID,
        now_()
      ]);

      /*
       * Loan repayment is also stored as a transaction,
       * so Member Result can calculate LoanPay.
       */
      getSheet_('Transactions').appendRow([
        id_('TXN'),
        memberID,
        'LoanPay',
        payment,
        'Loan payment ' + loanID,
        'Cash',
        now_(),
        '',
        now_(),
        now_()
      ]);

      return {
        status:true,
        message:'Loan payment successful',
        LoanID:loanID,
        Paid:paidAfter,
        Remaining:remainingAfter
      };
    }
  }

  return {status:false,message:'Loan not found'};
}


function getLoanPayments_(loanID) {
  return getRows_('LoanPayments')
    .filter(p => String(p.LoanID) === String(loanID || ''));
}


/* =========================
   MEMBER RESULT
========================= */

function buildMemberResults_() {
  const members = getRows_('Members');
  const txns = getRows_('Transactions');
  const loans = getRows_('Loans');

  const map = {};

  members.forEach(function(m) {
    const id = String(m.MemberID || '').trim();
    if (!id) return;

    map[id] = {
      MemberID:id,
      'Result ballance':0,
      Deposit:0,
      Withdraw:0,
      LoanPay:0,
      'Transfer Sent':0,
      'Transfer Received':0,
      Buying:0,
      Selling:0,
      Loans:0,
      'Office To Transfar':0
    };
  });

  /*
   * Include transaction member IDs even if a member row
   * is missing, so old transaction data is not hidden.
   */
  txns.forEach(function(t) {
    const id = String(t.MemberID || '').trim();
    if (!id) return;

    if (!map[id]) {
      map[id] = {
        MemberID:id,
        'Result ballance':0,
        Deposit:0,
        Withdraw:0,
        LoanPay:0,
        'Transfer Sent':0,
        'Transfer Received':0,
        Buying:0,
        Selling:0,
        Loans:0,
        'Office To Transfar':0
      };
    }

    const amount = Number(t.Amount || 0);
    const type = String(t.Type || '').trim().toLowerCase();

    if (type === 'deposit') {
      map[id].Deposit += amount;
    } else if (type === 'withdraw') {
      map[id].Withdraw += amount;
    } else if (type === 'loanpay') {
      map[id].LoanPay += amount;
    } else if (type === 'transfer sent') {
      map[id]['Transfer Sent'] += amount;
    } else if (type === 'transfer received') {
      map[id]['Transfer Received'] += amount;
    } else if (type === 'buy') {
      map[id].Buying += amount;
    } else if (type === 'sell') {
      map[id].Selling += amount;
    } else if (type === 'office to transfar' ||
               type === 'office to transfer') {
      map[id]['Office To Transfar'] += amount;
    }
  });

  loans.forEach(function(l) {
    const id = String(l.MemberID || '').trim();
    if (!id) return;

    if (!map[id]) {
      map[id] = {
        MemberID:id,
        'Result ballance':0,
        Deposit:0,
        Withdraw:0,
        LoanPay:0,
        'Transfer Sent':0,
        'Transfer Received':0,
        Buying:0,
        Selling:0,
        Loans:0,
        'Office To Transfar':0
      };
    }

    map[id].Loans += Number(l.Amount || 0);
  });

  return Object.keys(map).sort().map(function(id) {
    const r = map[id];

    /*
     * Balance:
     * money in = Deposit + Transfer Received + Selling
     * money out = Withdraw + Transfer Sent + Buying + LoanPay
     *
     * Loan amount is displayed separately under Loans.
     */
    r['Result ballance'] =
      r.Deposit +
      r['Transfer Received'] +
      r.Selling -
      r.Withdraw -
      r['Transfer Sent'] -
      r.Buying -
      r.LoanPay;

    return r;
  });
}


/* =========================
   SETTINGS
========================= */

function getSettings_() {
  return getRows_('Settings');
}


function getSetting_(key) {
  const k = String(key || '').trim();
  const rows = getRows_('Settings');
  const row = rows.find(r => String(r.Key) === k);

  if (!row) {
    return {
      status:false,
      message:'Setting not found',
      Key:k,
      Value:''
    };
  }

  return {
    status:true,
    Key:row.Key,
    Value:row.Value,
    Description:row.Description || ''
  };
}


function saveSetting_(data) {
  const key = String(data.Key || '').trim();

  if (!key) {
    return {status:false,message:'Setting Key is required'};
  }

  const sh = getSheet_('Settings');
  const headers = getHeaders_('Settings');
  const keyCol = headers.indexOf('Key') + 1;
  const lastRow = sh.getLastRow();

  if (lastRow >= 2) {
    const values = sh.getRange(
      2,keyCol,lastRow-1,1
    ).getValues();

    for (let i=0; i<values.length; i++) {
      if (String(values[i][0]) === key) {
        const rowNumber = i+2;

        sh.getRange(rowNumber,1,1,headers.length)
          .setValues([[
            key,
            data.Value !== undefined ? String(data.Value) : '',
            data.Description !== undefined ? String(data.Description) : '',
            now_()
          ]]);

        return {
          status:true,
          message:'Setting updated',
          Key:key
        };
      }
    }
  }

  sh.appendRow([
    key,
    data.Value !== undefined ? String(data.Value) : '',
    data.Description !== undefined ? String(data.Description) : '',
    now_()
  ]);

  return {
    status:true,
    message:'Setting saved',
    Key:key
  };
}


/* =========================
   IMGBB
========================= */

function uploadImage_(data) {
  const base64 = String(data.base64 || '').trim();

  if (!base64) {
    return {status:false,message:'Image data is missing'};
  }

  /*
   * Key is read only on the server from Settings.
   * It is never returned to the browser.
   */
  const keyRow = getSetting_('ImgBB_API_Key');

  if (!keyRow.status || !keyRow.Value) {
    return {
      status:false,
      message:'ImgBB API key is not set. Put it in Settings sheet under ImgBB_API_Key.'
    };
  }

  const endpointRow = getSetting_('ImgBB_Upload_URL');
  const endpoint =
    endpointRow.status && endpointRow.Value
      ? endpointRow.Value
      : 'https://api.imgbb.com/1/upload';

  const payload = {
    key:keyRow.Value,
    image:base64
  };

  if (data.fileName) {
    payload.name = String(data.fileName);
  }

  const response = UrlFetchApp.fetch(endpoint,{
    method:'post',
    payload:payload,
    muteHttpExceptions:true
  });

  const code = response.getResponseCode();
  const text = response.getContentText();

  let result;
  try {
    result = JSON.parse(text);
  } catch (err) {
    return {
      status:false,
      message:'ImgBB returned invalid response',
      httpCode:code
    };
  }

  if (code >= 200 && code < 300 && result.success && result.data) {
    return {
      status:true,
      message:'Image uploaded successfully',
      url:result.data.url || '',
      display_url:result.data.display_url || '',
      delete_url:result.data.delete_url || ''
    };
  }

  return {
    status:false,
    message:
      (result.error && result.error.message) ||
      'ImgBB upload failed',
    httpCode:code
  };
}


/* =========================
   EMAIL
========================= */

function sendEmail_(data) {
  let to = String(data.To || '').trim();
  const subject = String(
    data.Subject || data.subject || ''
  ).trim();
  const message = String(
    data.Message || data.message || ''
  );

  if (!to || !subject || !message) {
    return {
      status:false,
      message:'To, Subject and Message are required'
    };
  }

  /*
   * HTML transfer notification currently sends MemberID
   * in the To field. Resolve MemberID -> Email.
   */
  if (!to.includes('@')) {
    const member = getRows_('Members')
      .find(m => String(m.MemberID) === to);

    if (member && member.Email) {
      to = String(member.Email).trim();
    }
  }

  if (!to.includes('@')) {
    return {
      status:false,
      message:'Valid email address not found for recipient'
    };
  }

  try {
    MailApp.sendEmail({
      to:to,
      subject:subject,
      body:message,
      htmlBody:
        data.html === true
          ? message
          : String(message).replace(/\n/g,'<br>')
    });

    getSheet_('EmailLog').appendRow([
      id_('EMAIL'),
      to,
      subject,
      message,
      'Sent',
      now_()
    ]);

    return {
      status:true,
      message:'Email sent successfully',
      To:to
    };

  } catch (err) {
    getSheet_('EmailLog').appendRow([
      id_('EMAIL'),
      to,
      subject,
      message,
      'Failed: '+String(err.message || err),
      now_()
    ]);

    return {
      status:false,
      message:'Email failed: '+String(err.message || err)
    };
  }
}


function sendBulkEmail_(data) {
  const subject = String(data.subject || '').trim();
  const message = String(data.message || '');

  if (!subject || !message) {
    return {
      status:false,
      message:'Subject and message required'
    };
  }

  const members = getRows_('Members');
  let sent = 0;
  let failed = 0;

  members.forEach(function(m) {
    const email = String(m.Email || '').trim();
    if (!email || !email.includes('@')) return;

    try {
      MailApp.sendEmail({
        to:email,
        subject:subject,
        body:message,
        htmlBody:
          data.html === true
            ? message
            : message.replace(/\n/g,'<br>')
      });

      sent++;

      getSheet_('EmailLog').appendRow([
        id_('EMAIL'),
        email,
        subject,
        message,
        'Sent',
        now_()
      ]);

    } catch (err) {
      failed++;

      getSheet_('EmailLog').appendRow([
        id_('EMAIL'),
        email,
        subject,
        message,
        'Failed: '+String(err.message || err),
        now_()
      ]);
    }
  });

  return {
    status:true,
    message:'Bulk email process completed',
    sent:sent,
    failed:failed
  };
}


function testEmailReminder_() {
  const admins = getRows_('Users')
    .filter(u => String(u.Role).toLowerCase() === 'admin');

  let sent = 0;

  admins.forEach(function(u) {
    const memberID = String(u.MemberID || '');
    let email = '';

    if (memberID) {
      const member = getRows_('Members')
        .find(m => String(m.MemberID) === memberID);
      if (member) email = String(member.Email || '');
    }

    if (!email && String(u.Username).includes('@')) {
      email = String(u.Username);
    }

    if (!email || !email.includes('@')) return;

    try {
      MailApp.sendEmail({
        to:email,
        subject:'CRM2 Email Reminder Test',
        body:'CRM2 email reminder test was successful.'
      });
      sent++;
    } catch (err) {}
  });

  return {
    status:true,
    message:
      sent
        ? 'Test email sent successfully'
        : 'No admin email address was available',
    sent:sent
  };
}


/* =========================
   UTILS
========================= */

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  const raw = e.postData.contents;

  try {
    return JSON.parse(raw);
  } catch (err) {
    return e.parameter || {};
  }
}


function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


function now_() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || 'Asia/Kathmandu',
    'yyyy-MM-dd HH:mm:ss'
  );
}


function formatDate_(date) {
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone() || 'Asia/Kathmandu',
    'yyyy-MM-dd'
  );
}


function addMonths_(date,months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}


function id_(prefix) {
  return String(prefix || 'ID') +
    Date.now() +
    '_' +
    Math.floor(Math.random()*1000000);
}
