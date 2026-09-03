/**
 * मरिण सुरक्षित समाज
 * Google Apps Script Backend
 *
 * आवश्यक Google Sheet tabs:
 * Reports, Users, Logs, Settings
 *
 * पहिलो पटक:
 * 1) यो Code.gs पूरा paste गर्नुहोस्
 * 2) setupSystem() एक पटक Run गर्नुहोस्
 * 3) पहिलो Admin बनाउन createFirstAdmin() Run गर्नुहोस्
 * 4) Deploy > New deployment > Web app
 *    Execute as: Me
 *    Who has access: Anyone
 * 5) Web App URL लाई GitHub को index.html मा राख्नुहोस्।
 */

const CONFIG = {
  SPREADSHEET_ID: "", // खाली राख्दा यो Apps Script सँग जोडिएको Sheet प्रयोग हुन्छ।
  REPORT_SHEET: "Reports",
  USERS_SHEET: "Users",
  LOGS_SHEET: "Logs",
  SETTINGS_SHEET: "Settings",

  // पहिलो Admin बनाउन createFirstAdmin() मा यी values परिवर्तन गर्नुहोस्।
  FIRST_ADMIN_NAME: "Main Admin",
  FIRST_ADMIN_EMAIL: "youradmin@gmail.com",
  FIRST_ADMIN_PASSWORD: "ChangeThisPassword123!"
};


/* =========================================================
   DATABASE
========================================================= */

function getSS() {
  if (CONFIG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("Google Sheet जोडिएको छैन।");
  }
  return ss;
}

function getSheet_(name) {
  const ss = getSS();
  let sh = ss.getSheetByName(name);

  if (!sh) {
    sh = ss.insertSheet(name);
  }

  return sh;
}

function setupSystem() {
  const reports = getSheet_(CONFIG.REPORT_SHEET);
  const users = getSheet_(CONFIG.USERS_SHEET);
  const logs = getSheet_(CONFIG.LOGS_SHEET);
  const settings = getSheet_(CONFIG.SETTINGS_SHEET);

  setHeader_(reports, [
    "ID",
    "Timestamp",
    "Category",
    "Location",
    "EventDate",
    "EventTime",
    "Priority",
    "Description",
    "Additional",
    "ReporterName",
    "Phone",
    "Anonymous",
    "Status",
    "AssignedTo",
    "AdminNote",
    "UpdatedAt",
    "UpdatedBy"
  ]);

  setHeader_(users, [
    "UserID",
    "Name",
    "Email",
    "PasswordHash",
    "Role",
    "Status",
    "CreatedAt",
    "LastLogin"
  ]);

  setHeader_(logs, [
    "Timestamp",
    "Action",
    "UserEmail",
    "ReferenceID",
    "Details",
    "IP"
  ]);

  setHeader_(settings, [
    "Key",
    "Value"
  ]);

  if (settings.getLastRow() < 2) {
    settings.getRange(2, 1, 4, 2).setValues([
      ["SYSTEM_NAME", "मरिण सुरक्षित समाज"],
      ["NOTIFICATION_ENABLED", "YES"],
      ["NOTIFICATION_SUBJECT", "मरिण सुरक्षित समाज - नयाँ सूचना"],
      ["PUBLIC_TRACKING", "YES"]
    ]);
  }

  SpreadsheetApp.flush();

  return "System setup पूरा भयो।";
}

function setHeader_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    const current = sheet
      .getRange(1, 1, 1, headers.length)
      .getValues()[0];

    const same = headers.every((x, i) => current[i] === x);

    if (!same) {
      sheet
        .getRange(1, 1, 1, headers.length)
        .setValues([headers]);
      sheet.setFrozenRows(1);
    }
  }
}


/* =========================================================
   FIRST ADMIN
========================================================= */

function createFirstAdmin() {
  setupSystem();

  const email = String(CONFIG.FIRST_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(CONFIG.FIRST_ADMIN_PASSWORD || "");

  if (!email || email === "youradmin@gmail.com") {
    throw new Error(
      "CONFIG.FIRST_ADMIN_EMAIL मा वास्तविक Admin Gmail राख्नुहोस्।"
    );
  }

  if (!password || password === "ChangeThisPassword123!") {
    throw new Error(
      "CONFIG.FIRST_ADMIN_PASSWORD मा आफ्नो नयाँ password राख्नुहोस्।"
    );
  }

  const sh = getSheet_(CONFIG.USERS_SHEET);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (
      String(values[i][2]).trim().toLowerCase() === email
    ) {
      throw new Error("यो Gmail पहिले नै Users मा छ।");
    }
  }

  const userId = "USR-" + Utilities.getUuid().slice(0, 8).toUpperCase();
  const now = new Date();

  sh.appendRow([
    userId,
    CONFIG.FIRST_ADMIN_NAME,
    email,
    hashPassword_(password),
    "Admin",
    "Active",
    now,
    ""
  ]);

  sendEmail_(
    email,
    "मरिण सुरक्षित समाज - Admin Account",
    "तपाईंको Admin account तयार भएको छ।\n\nGmail: " +
      email +
      "\n\nLogin गरेर password प्रयोग गर्नुहोस्।"
  );

  return "पहिलो Admin तयार भयो: " + email;
}


/* =========================================================
   WEB APP
========================================================= */

function doGet(e) {
  return ContentService
    .createTextOutput(
      JSON.stringify({
        success: true,
        message: "मरिण सुरक्षित समाज API चलिरहेको छ।"
      })
    )
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(
      e && e.postData && e.postData.contents
        ? e.postData.contents
        : "{}"
    );

    const action = String(data.action || "").trim();

    switch (action) {
      case "submitReport":
        return json_(
          submitReport_(data)
        );

      case "getPublicReport":
        return json_(
          getPublicReport_(data)
        );

      case "adminLogin":
        return json_(
          adminLogin_(data)
        );

      case "getReports":
        return json_(
          getReports_(data)
        );

      case "updateReportStatus":
        return json_(
          updateReportStatus_(data)
        );

      case "deleteReport":
        return json_(
          deleteReport_(data)
        );

      case "getUsers":
        return json_(
          getUsers_(data)
        );

      case "createUser":
        return json_(
          createUser_(data)
        );

      case "updateUser":
        return json_(
          updateUser_(data)
        );

      case "deleteUser":
        return json_(
          deleteUser_(data)
        );

      default:
        return json_({
          success: false,
          message: "Unknown action."
        });
    }

  } catch (err) {

    logError_(err);

    return json_({
      success: false,
      message: err.message || "Server error."
    });
  }
}


/* =========================================================
   CITIZEN REPORT
========================================================= */

function submitReport_(data) {

  setupSystem();

  const category = clean_(data.category);
  const location = clean_(data.location);
  const description = clean_(data.description);

  if (!category) {
    throw new Error("समस्याको प्रकार छान्नुहोस्।");
  }

  if (!location) {
    throw new Error("स्थान राख्नुहोस्।");
  }

  if (!description) {
    throw new Error("घटनाको विवरण राख्नुहोस्।");
  }

  const id = createReferenceID_();
  const now = new Date();

  const row = [
    id,
    now,
    category,
    location,
    clean_(data.eventDate),
    clean_(data.eventTime),
    clean_(data.priority) || "सामान्य",
    description,
    clean_(data.additional),
    clean_(data.reporterName),
    clean_(data.phone),
    clean_(data.anonymous) || "होइन",
    "नयाँ",
    "",
    "",
    now,
    ""
  ];

  const sh = getSheet_(CONFIG.REPORT_SHEET);

  sh.appendRow(row);

  logAction_(
    "NEW_REPORT",
    "",
    id,
    "नयाँ नागरिक सूचना दर्ता भयो।"
  );

  /*
   * सबै Active Admin को Gmail मा तुरुन्त email।
   */
  notifyAllAdmins_(row);

  return {
    success: true,
    id: id,
    message: "सूचना सफलतापूर्वक दर्ता भयो।"
  };
}

function createReferenceID_() {
  const tz = Session.getScriptTimeZone() || "Asia/Kathmandu";
  const date = Utilities.formatDate(
    new Date(),
    tz,
    "yyyyMMdd"
  );

  const sh = getSheet_(CONFIG.REPORT_SHEET);
  const lastRow = sh.getLastRow();

  let serial = 1;

  if (lastRow > 1) {
    serial = lastRow;
  }

  return (
    "MARIN-" +
    date +
    "-" +
    ("0000" + serial).slice(-4)
  );
}


/* =========================================================
   EMAIL NOTIFICATION
========================================================= */

function notifyAllAdmins_(row) {

  const enabled = getSetting_("NOTIFICATION_ENABLED");

  if (
    String(enabled).toUpperCase() !== "YES"
  ) {
    return;
  }

  const admins = getActiveAdmins_();

  if (!admins.length) {
    return;
  }

  const id = row[0];
  const timestamp = row[1];
  const category = row[2];
  const location = row[3];
  const eventDate = row[4];
  const eventTime = row[5];
  const priority = row[6];
  const description = row[7];
  const additional = row[8];
  const anonymous = row[11];

  const subject =
    getSetting_("NOTIFICATION_SUBJECT") ||
    "मरिण सुरक्षित समाज - नयाँ सूचना";

  let body =
    "नयाँ नागरिक सूचना प्राप्त भएको छ।\n\n" +
    "Reference ID: " + id + "\n" +
    "समस्या: " + category + "\n" +
    "स्थान: " + location + "\n" +
    "घटना मिति: " + eventDate + "\n" +
    "घटना समय: " + eventTime + "\n" +
    "Priority: " + priority + "\n" +
    "गोप्य सूचना: " + anonymous + "\n\n" +
    "घटनाको विवरण:\n" +
    description + "\n\n";

  if (additional) {
    body +=
      "थप जानकारी:\n" +
      additional +
      "\n\n";
  }

  body +=
    "यो सूचना Admin Dashboard बाट जाँच गर्नुहोस्।\n\n" +
    "मरिण सुरक्षित समाज";

  admins.forEach(function(admin) {
    try {
      sendEmail_(
        admin.email,
        subject,
        body
      );
    } catch (err) {
      logAction_(
        "EMAIL_ERROR",
        admin.email,
        id,
        err.message
      );
    }
  });
}

function sendEmail_(to, subject, body) {
  if (!to) return;

  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: body,
    name: "मरिण सुरक्षित समाज"
  });
}

function getActiveAdmins_() {
  const sh = getSheet_(CONFIG.USERS_SHEET);
  const values = sh.getDataRange().getValues();

  const result = [];

  for (let i = 1; i < values.length; i++) {

    const email =
      String(values[i][2] || "")
        .trim()
        .toLowerCase();

    const role =
      String(values[i][4] || "")
        .trim()
        .toLowerCase();

    const status =
      String(values[i][5] || "")
        .trim()
        .toLowerCase();

    if (
      email &&
      (role === "admin" || role === "operator") &&
      status === "active"
    ) {
      result.push({
        id: values[i][0],
        name: values[i][1],
        email: email,
        role: role
      });
    }
  }

  return result;
}


/* =========================================================
   PUBLIC TRACKING
========================================================= */

function getPublicReport_(data) {

  const enabled = getSetting_("PUBLIC_TRACKING");

  if (
    String(enabled).toUpperCase() !== "YES"
  ) {
    throw new Error(
      "Public tracking बन्द गरिएको छ।"
    );
  }

  const id = clean_(data.id);

  if (!id) {
    throw new Error(
      "Reference ID राख्नुहोस्।"
    );
  }

  const sh = getSheet_(CONFIG.REPORT_SHEET);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {

    if (
      String(values[i][0]).trim() === id
    ) {

      return {
        success: true,
        id: values[i][0],
        category: values[i][2],
        status: values[i][12] || "नयाँ"
      };
    }
  }

  return {
    success: false,
    message: "यो Reference ID भेटिएन।"
  };
}


/* =========================================================
   ADMIN LOGIN
========================================================= */

function adminLogin_(data) {

  const email =
    String(data.email || "")
      .trim()
      .toLowerCase();

  const password =
    String(data.password || "");

  if (!email || !password) {
    throw new Error(
      "Gmail र password दुवै राख्नुहोस्।"
    );
  }

  const sh = getSheet_(CONFIG.USERS_SHEET);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {

    const dbEmail =
      String(values[i][2] || "")
        .trim()
        .toLowerCase();

    if (dbEmail !== email) continue;

    const status =
      String(values[i][5] || "")
        .trim()
        .toLowerCase();

    if (status !== "active") {
      throw new Error(
        "यो account Active छैन।"
      );
    }

    const storedHash =
      String(values[i][3] || "");

    if (
      hashPassword_(password) !== storedHash
    ) {
      throw new Error(
        "Gmail वा password गलत छ।"
      );
    }

    const role =
      String(values[i][4] || "")
        .trim()
        .toLowerCase();

    if (
      role !== "admin" &&
      role !== "operator"
    ) {
      throw new Error(
        "यो account लाई dashboard access छैन।"
      );
    }

    const token = createToken_(
      email,
      role
    );

    sh.getRange(i + 1, 8)
      .setValue(new Date());

    logAction_(
      "LOGIN",
      email,
      "",
      "Admin login भयो।"
    );

    return {
      success: true,
      token: token,
      role: role,
      name: values[i][1],
      message: "Login सफल भयो।"
    };
  }

  throw new Error(
    "Gmail वा password गलत छ।"
  );
}


/* =========================================================
   TOKEN
========================================================= */

function createToken_(email, role) {

  const raw =
    email +
    "|" +
    role +
    "|" +
    new Date().getTime() +
    "|" +
    Utilities.getUuid();

  const token =
    Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        raw
      )
    );

  CacheService
    .getScriptCache()
    .put(
      "TOKEN_" + token,
      JSON.stringify({
        email: email,
        role: role,
        created: new Date().getTime()
      }),
      21600
    );

  return token;
}

function verifyToken_(token) {

  if (!token) {
    throw new Error(
      "Login आवश्यक छ।"
    );
  }

  const cache =
    CacheService
      .getScriptCache()
      .get("TOKEN_" + token);

  if (!cache) {
    throw new Error(
      "Session समाप्त भयो। फेरि Login गर्नुहोस्।"
    );
  }

  return JSON.parse(cache);
}


/* =========================================================
   REPORTS
========================================================= */

function getReports_(data) {

  const user =
    verifyToken_(data.token);

  const sh =
    getSheet_(CONFIG.REPORT_SHEET);

  const values =
    sh.getDataRange().getValues();

  const headers =
    values.length
      ? values[0]
      : [];

  const reports = [];

  for (let i = 1; i < values.length; i++) {

    const row = values[i];

    const obj = {};

    headers.forEach(function(header, index) {
      obj[header] =
        formatValue_(row[index]);
    });

    reports.push(obj);
  }

  logAction_(
    "GET_REPORTS",
    user.email,
    "",
    "Admin ले reports हेरे।"
  );

  return {
    success: true,
    reports: reports
  };
}


/* =========================================================
   UPDATE STATUS
========================================================= */

function updateReportStatus_(data) {

  const user =
    verifyToken_(data.token);

  const id =
    clean_(data.id);

  const status =
    clean_(data.status);

  if (!id || !status) {
    throw new Error(
      "Reference ID र status आवश्यक छ।"
    );
  }

  const allowed = [
    "नयाँ",
    "जाँच हुँदैछ",
    "कारबाही हुँदैछ",
    "सम्पन्न"
  ];

  if (allowed.indexOf(status) === -1) {
    throw new Error(
      "Invalid status."
    );
  }

  const sh =
    getSheet_(CONFIG.REPORT_SHEET);

  const values =
    sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {

    if (
      String(values[i][0]).trim() === id
    ) {

      const sheetRow = i + 1;

      sh.getRange(sheetRow, 13)
        .setValue(status);

      sh.getRange(sheetRow, 16)
        .setValue(new Date());

      sh.getRange(sheetRow, 17)
        .setValue(user.email);

      logAction_(
        "UPDATE_STATUS",
        user.email,
        id,
        "Status: " + status
      );

      return {
        success: true,
        message: "Status update भयो।"
      };
    }
  }

  throw new Error(
    "Reference ID भेटिएन।"
  );
}


/* =========================================================
   DELETE REPORT
========================================================= */

function deleteReport_(data) {

  const user =
    verifyToken_(data.token);

  if (user.role !== "admin") {
    throw new Error(
      "Delete गर्न Admin अधिकार आवश्यक छ।"
    );
  }

  const id =
    clean_(data.id);

  if (!id) {
    throw new Error(
      "Reference ID आवश्यक छ।"
    );
  }

  const sh =
    getSheet_(CONFIG.REPORT_SHEET);

  const values =
    sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {

    if (
      String(values[i][0]).trim() === id
    ) {

      sh.deleteRow(i + 1);

      logAction_(
        "DELETE_REPORT",
        user.email,
        id,
        "Report delete गरियो।"
      );

      return {
        success: true,
        message: "Report delete भयो।"
      };
    }
  }

  throw new Error(
    "Reference ID भेटिएन।"
  );
}


/* =========================================================
   USERS
========================================================= */

function getUsers_(data) {

  const user =
    verifyToken_(data.token);

  if (user.role !== "admin") {
    throw new Error(
      "Users व्यवस्थापन गर्न Admin अधिकार आवश्यक छ।"
    );
  }

  const sh =
    getSheet_(CONFIG.USERS_SHEET);

  const values =
    sh.getDataRange().getValues();

  const users = [];

  for (let i = 1; i < values.length; i++) {

    users.push({
      userId: values[i][0],
      name: values[i][1],
      email: values[i][2],
      role: values[i][4],
      status: values[i][5],
      createdAt: formatValue_(values[i][6]),
      lastLogin: formatValue_(values[i][7])
    });
  }

  return {
    success: true,
    users: users
  };
}

function createUser_(data) {

  const admin =
    verifyToken_(data.token);

  if (admin.role !== "admin") {
    throw new Error(
      "User बनाउन Admin अधिकार आवश्यक छ।"
    );
  }

  const name =
    clean_(data.name);

  const email =
    String(data.email || "")
      .trim()
      .toLowerCase();

  const password =
    String(data.password || "");

  const role =
    clean_(data.role) || "Admin";

  if (!name || !email || !password) {
    throw new Error(
      "Name, Gmail र password आवश्यक छ।"
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(
      "Valid Gmail/email राख्नुहोस्।"
    );
  }

  if (password.length < 8) {
    throw new Error(
      "Password कम्तीमा 8 characters हुनुपर्छ।"
    );
  }

  if (
    ["Admin", "Operator"].indexOf(role) === -1
  ) {
    throw new Error(
      "Role Admin वा Operator हुनुपर्छ।"
    );
  }

  const sh =
    getSheet_(CONFIG.USERS_SHEET);

  const values =
    sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (
      String(values[i][2])
        .trim()
        .toLowerCase() === email
    ) {
      throw new Error(
        "यो Gmail पहिले नै Users मा छ।"
      );
    }
  }

  const id =
    "USR-" +
    Utilities.getUuid()
      .slice(0, 8)
      .toUpperCase();

  sh.appendRow([
    id,
    name,
    email,
    hashPassword_(password),
    role,
    "Active",
    new Date(),
    ""
  ]);

  /*
   * नयाँ Admin/Operator को Gmail मा account notification।
   */
  sendEmail_(
    email,
    "मरिण सुरक्षित समाज - Account तयार भयो",
    "तपाईंको account तयार भएको छ।\n\n" +
    "Gmail: " + email + "\n" +
    "Role: " + role + "\n\n" +
    "Admin/Operator dashboard मा login गर्नुहोस्।"
  );

  logAction_(
    "CREATE_USER",
    admin.email,
    "",
    email + " / " + role
  );

  return {
    success: true,
    message: "User तयार भयो।",
    userId: id
  };
}

function updateUser_(data) {

  const admin =
    verifyToken_(data.token);

  if (admin.role !== "admin") {
    throw new Error(
      "User update गर्न Admin अधिकार आवश्यक छ।"
    );
  }

  const userId =
    clean_(data.userId);

  const status =
    clean_(data.status);

  const role =
    clean_(data.role);

  const name =
    clean_(data.name);

  if (!userId) {
    throw new Error(
      "UserID आवश्यक छ।"
    );
  }

  const sh =
    getSheet_(CONFIG.USERS_SHEET);

  const values =
    sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {

    if (
      String(values[i][0]).trim() === userId
    ) {

      const row = i + 1;

      if (name) {
        sh.getRange(row, 2)
          .setValue(name);
      }

      if (
        role &&
        ["Admin", "Operator"].indexOf(role) >= 0
      ) {
        sh.getRange(row, 5)
          .setValue(role);
      }

      if (
        status &&
        ["Active", "Inactive"].indexOf(status) >= 0
      ) {
        sh.getRange(row, 6)
          .setValue(status);
      }

      logAction_(
        "UPDATE_USER",
        admin.email,
        "",
        "UserID: " + userId
      );

      return {
        success: true,
        message: "User update भयो।"
      };
    }
  }

  throw new Error(
    "User भेटिएन।"
  );
}

function deleteUser_(data) {

  const admin =
    verifyToken_(data.token);

  if (admin.role !== "admin") {
    throw new Error(
      "User delete गर्न Admin अधिकार आवश्यक छ।"
    );
  }

  const userId =
    clean_(data.userId);

  const sh =
    getSheet_(CONFIG.USERS_SHEET);

  const values =
    sh.getDataRange().getValues();

  let adminCount = 0;

  for (let i = 1; i < values.length; i++) {
    if (
      String(values[i][4])
        .trim()
        .toLowerCase() === "admin" &&
      String(values[i][5])
        .trim()
        .toLowerCase() === "active"
    ) {
      adminCount++;
    }
  }

  for (let i = 1; i < values.length; i++) {

    if (
      String(values[i][0]).trim() === userId
    ) {

      const targetRole =
        String(values[i][4])
          .trim()
          .toLowerCase();

      const targetStatus =
        String(values[i][5])
          .trim()
          .toLowerCase();

      if (
        targetRole === "admin" &&
        targetStatus === "active" &&
        adminCount <= 1
      ) {
        throw new Error(
          "अन्तिम Active Admin delete गर्न मिल्दैन।"
        );
      }

      sh.deleteRow(i + 1);

      logAction_(
        "DELETE_USER",
        admin.email,
        "",
        "UserID: " + userId
      );

      return {
        success: true,
        message: "User delete भयो।"
      };
    }
  }

  throw new Error(
    "User भेटिएन।"
  );
}


/* =========================================================
   PASSWORD HASH
========================================================= */

function hashPassword_(password) {

  const bytes =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(password),
      Utilities.Charset.UTF_8
    );

  return bytes
    .map(function(byte) {
      const v = byte < 0 ? byte + 256 : byte;
      return ("0" + v.toString(16)).slice(-2);
    })
    .join("");
}


/* =========================================================
   SETTINGS
========================================================= */

function getSetting_(key) {

  const sh =
    getSheet_(CONFIG.SETTINGS_SHEET);

  const values =
    sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {

    if (
      String(values[i][0]).trim() === key
    ) {
      return values[i][1];
    }
  }

  return "";
}


/* =========================================================
   LOGS
========================================================= */

function logAction_(
  action,
  userEmail,
  referenceId,
  details
) {

  try {

    const sh =
      getSheet_(CONFIG.LOGS_SHEET);

    sh.appendRow([
      new Date(),
      action,
      userEmail,
      referenceId,
      details,
      ""
    ]);

  } catch (err) {
    // Logging failure should not stop the main operation.
  }
}

function logError_(err) {
  try {
    logAction_(
      "ERROR",
      "",
      "",
      err.message || String(err)
    );
  } catch (e) {}
}


/* =========================================================
   HELPERS
========================================================= */

function clean_(value) {
  return String(value == null ? "" : value).trim();
}

function formatValue_(value) {

  if (
    Object.prototype.toString.call(value) ===
    "[object Date]"
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone() || "Asia/Kathmandu",
      "yyyy-MM-dd HH:mm:ss"
    );
  }

  return value == null
    ? ""
    : String(value);
}

function json_(obj) {

  return ContentService
    .createTextOutput(
      JSON.stringify(obj)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


/* =========================================================
   OPTIONAL: MANUAL TEST
========================================================= */

function testAdminEmail() {

  const admins =
    getActiveAdmins_();

  if (!admins.length) {
    throw new Error(
      "Active Admin भेटिएन।"
    );
  }

  admins.forEach(function(admin) {

    sendEmail_(
      admin.email,
      "मरिण सुरक्षित समाज - Test Notification",
      "यो test email हो।\n\n" +
      "तपाईंको Gmail notification system ठीकसँग चलिरहेको छ।"
    );

  });

  return "सबै Active Admin लाई test email पठाइयो।";
}
