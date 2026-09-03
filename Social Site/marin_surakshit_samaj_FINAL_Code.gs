/**
 * मरिण सुरक्षित समाज — FINAL Google Apps Script Backend
 *
 * Google Sheet ID:
 * 1A5f_xd2qDZQvU69DeHXD_M67SINoO6QfYbiVLHRQzOQ
 *
 * Features:
 * - Reports + public QR tracking
 * - Plain-text passwords (as requested)
 * - Public Admin Request
 * - Main Admin approval/rejection
 * - Requester Gmail notification
 * - Main Admin Gmail notification
 * - Approved admin account notification
 * - Users sheet with:
 *   UserID, Photo, Name, Email, Whatsapp, Password,
 *   Role, Status, CreatedAt, LastLogin, Position
 * - Ward/position based routing
 * - Target organization/person selection
 * - Target notification + all active admin notification
 * - Logs + Settings
 *
 * IMPORTANT:
 * 1. Change FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD.
 * 2. Run setupSystem()
 * 3. Run createFirstAdmin()
 * 4. Deploy as Web App:
 *    Execute as: Me
 *    Who has access: Anyone
 * 5. Put Web App /exec URL in index.html.
 *
 * SECURITY NOTE:
 * Plain-text passwords are intentionally used because requested.
 * This is less secure than password hashing. Restrict Sheet access.
 */

const CONFIG = {
  SPREADSHEET_ID: "1A5f_xd2qDZQvU69DeHXD_M67SINoO6QfYbiVLHRQzOQ",

  REPORT_SHEET: "Reports",
  USERS_SHEET: "Users",
  REQUESTS_SHEET: "AdminRequests",
  TARGETS_SHEET: "Targets",
  LOGS_SHEET: "Logs",
  SETTINGS_SHEET: "Settings",

  FIRST_ADMIN_NAME: "Main Admin",
  FIRST_ADMIN_EMAIL: "yubarajchaulagain5@gmail.com",
  FIRST_ADMIN_PASSWORD: "Sarojkumar643",

  SESSION_SECONDS: 21600
};


/* =========================================================
   DATABASE SETUP
========================================================= */

function getSS() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet_(name) {
  const ss = getSS();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function setupSystem() {
  setHeader_(getSheet_(CONFIG.REPORT_SHEET), [
    "ID","Timestamp","Category","Location","Ward",
    "EventDate","EventTime","Priority","Description",
    "Additional","ReporterName","Phone","Anonymous",
    "Status","AssignedTo","TargetID","TargetName",
    "AdminNote","UpdatedAt","UpdatedBy"
  ]);

  setHeader_(getSheet_(CONFIG.USERS_SHEET), [
    "UserID","Photo","Name","Email","Whatsapp","Password",
    "Role","Status","CreatedAt","LastLogin","Position"
  ]);

  setHeader_(getSheet_(CONFIG.REQUESTS_SHEET), [
    "RequestID","Timestamp","Photo","Name","Email","Whatsapp",
    "Password","Position","Ward","Reason","Status",
    "ReviewedAt","ReviewedBy","RejectReason"
  ]);

  setHeader_(getSheet_(CONFIG.TARGETS_SHEET), [
    "TargetID","Photo","Name","Type","Email","Whatsapp",
    "Ward","Position","Status","CreatedAt"
  ]);

  setHeader_(getSheet_(CONFIG.LOGS_SHEET), [
    "Timestamp","Action","UserEmail","ReferenceID","Details","IP"
  ]);

  const settings = getSheet_(CONFIG.SETTINGS_SHEET);
  setHeader_(settings, ["Key","Value"]);

  if (settings.getLastRow() < 2) {
    settings.getRange(2,1,8,2).setValues([
      ["SYSTEM_NAME","मरिण सुरक्षित समाज"],
      ["NOTIFICATION_ENABLED","YES"],
      ["NOTIFICATION_SUBJECT","मरिण सुरक्षित समाज - नयाँ सूचना"],
      ["PUBLIC_TRACKING","YES"],
      ["ADMIN_REQUEST_ENABLED","YES"],
      ["DEFAULT_REPORT_STATUS","नयाँ"],
      ["DEFAULT_REQUEST_STATUS","Pending"],
      ["TIMEZONE","Asia/Kathmandu"]
    ]);
  }

  // Useful default target examples. Added only if Targets is empty.
  const targets = getSheet_(CONFIG.TARGETS_SHEET);
  if (targets.getLastRow() < 2) {
    targets.getRange(2,1,5,10).setValues([
      ["TGT-POLICE","","प्रहरी","Police","","","","","Active",new Date()],
      ["TGT-HOSPITAL","","अस्पताल","Hospital","","","","","Active",new Date()],
      ["TGT-GAUPALIKA","","मरिण गाउँपालिका","Gaupalika","","","","","Active",new Date()],
      ["TGT-WARD","","वडा कार्यालय","Ward Office","","","","","Active",new Date()],
      ["TGT-SANSTHA","","सम्बन्धित संस्था","Institution","","","","","Active",new Date()]
    ]);
  }

  SpreadsheetApp.flush();
  return "System setup पूरा भयो।";
}

function setHeader_(sheet, headers) {
  const currentWidth = Math.max(sheet.getLastColumn(), headers.length);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
  } else {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
}


/* =========================================================
   FIRST MAIN ADMIN
========================================================= */

function createFirstAdmin() {
  setupSystem();

  const email = clean_(CONFIG.FIRST_ADMIN_EMAIL).toLowerCase();
  const password = String(CONFIG.FIRST_ADMIN_PASSWORD || "");

  if (!email || email === "youradmin@gmail.com") {
    throw new Error("CONFIG.FIRST_ADMIN_EMAIL मा वास्तविक Gmail राख्नुहोस्।");
  }
  if (!password || password === "ChangeThisPassword123!") {
    throw new Error("CONFIG.FIRST_ADMIN_PASSWORD मा वास्तविक password राख्नुहोस्।");
  }

  const sh = getSheet_(CONFIG.USERS_SHEET);
  const values = sh.getDataRange().getValues();

  for (let i=1;i<values.length;i++) {
    if (clean_(values[i][3]).toLowerCase() === email) {
      throw new Error("यो Gmail पहिले नै Users मा छ।");
    }
  }

  const id = makeID_("USR");
  sh.appendRow([
    id,"",CONFIG.FIRST_ADMIN_NAME,email,"",password,
    "Main Admin","Active",new Date(),"","Main Admin"
  ]);

  sendEmail_(
    email,
    "मरिण सुरक्षित समाज - Main Admin Account",
    "तपाईंको Main Admin account तयार भएको छ।\n\n" +
    "Gmail: " + email + "\n" +
    "Password: " + password + "\n" +
    "Role: Main Admin\n\n" +
    "यो password सुरक्षित राख्नुहोस्।"
  );

  return "Main Admin तयार भयो: " + email;
}


/* =========================================================
   WEB APP
========================================================= */

function doGet(e) {
  return json_({
    success:true,
    message:"मरिण सुरक्षित समाज API चलिरहेको छ।"
  });
}

function doPost(e) {
  try {
    const data = JSON.parse(
      e && e.postData && e.postData.contents
        ? e.postData.contents : "{}"
    );

    const action = clean_(data.action);

    switch(action) {
      case "submitReport": return json_(submitReport_(data));
      case "getPublicReport": return json_(getPublicReport_(data));

      case "adminLogin": return json_(adminLogin_(data));
      case "getReports": return json_(getReports_(data));
      case "updateReportStatus": return json_(updateReportStatus_(data));
      case "deleteReport": return json_(deleteReport_(data));

      case "requestAdmin": return json_(requestAdmin_(data));
      case "getAdminRequests": return json_(getAdminRequests_(data));
      case "approveAdminRequest": return json_(approveAdminRequest_(data));
      case "rejectAdminRequest": return json_(rejectAdminRequest_(data));

      case "getUsers": return json_(getUsers_(data));
      case "createUser": return json_(createUser_(data));
      case "updateUser": return json_(updateUser_(data));
      case "deleteUser": return json_(deleteUser_(data));

      case "getTargets": return json_(getTargets_(data));
      case "createTarget": return json_(createTarget_(data));
      case "updateTarget": return json_(updateTarget_(data));
      case "deleteTarget": return json_(deleteTarget_(data));

      default:
        return json_({success:false,message:"Unknown action."});
    }
  } catch(err) {
    logError_(err);
    return json_({
      success:false,
      message:err && err.message ? err.message : "Server error."
    });
  }
}


/* =========================================================
   REPORT SUBMISSION
========================================================= */

function submitReport_(data) {
  setupSystem();

  const category = clean_(data.category);
  const location = clean_(data.location);
  const ward = clean_(data.ward);
  const description = clean_(data.description);

  if (!category) throw new Error("समस्याको प्रकार छान्नुहोस्।");
  if (!location) throw new Error("स्थान राख्नुहोस्।");
  if (!description) throw new Error("घटनाको विवरण राख्नुहोस्।");

  const id = createReferenceID_();
  const now = new Date();
  const priority = clean_(data.priority) || "सामान्य";

  const targetId = clean_(data.targetId);
  const target = targetId ? findTarget_(targetId) : null;
  const targetName = target ? target.name : clean_(data.targetName);

  const row = [
    id, now, category, location, ward,
    clean_(data.eventDate),
    clean_(data.eventTime),
    priority,
    description,
    clean_(data.additional),
    clean_(data.reporterName),
    clean_(data.phone),
    clean_(data.anonymous) || "होइन",
    getSetting_("DEFAULT_REPORT_STATUS") || "नयाँ",
    "",
    targetId,
    targetName,
    "",
    now,
    ""
  ];

  getSheet_(CONFIG.REPORT_SHEET).appendRow(row);

  logAction_("NEW_REPORT","","",id,
    "नयाँ नागरिक सूचना दर्ता भयो।");

  notifyReportAdminsAndTarget_(row);

  return {
    success:true,
    id:id,
    referenceId:id,
    message:"सूचना सफलतापूर्वक दर्ता भयो।"
  };
}

function createReferenceID_() {
  const tz = getSetting_("TIMEZONE") || "Asia/Kathmandu";
  const date = Utilities.formatDate(new Date(),tz,"yyyyMMdd");
  const sh = getSheet_(CONFIG.REPORT_SHEET);
  const next = Math.max(1, sh.getLastRow());
  return "MARIN-" + date + "-" + ("0000"+next).slice(-4);
}


/* =========================================================
   REPORT NOTIFICATIONS
========================================================= */

function notifyReportAdminsAndTarget_(row) {
  if (String(getSetting_("NOTIFICATION_ENABLED")).toUpperCase() !== "YES") return;

  const id=row[0];
  const category=row[2];
  const location=row[3];
  const ward=row[4];
  const eventDate=row[5];
  const eventTime=row[6];
  const priority=row[7];
  const description=row[8];
  const additional=row[9];
  const anonymous=row[12];
  const targetId=row[15];
  const targetName=row[16];

  const subject =
    getSetting_("NOTIFICATION_SUBJECT") ||
    "मरिण सुरक्षित समाज - नयाँ सूचना";

  let body =
    "नयाँ नागरिक सूचना प्राप्त भएको छ।\n\n" +
    "Reference ID: " + id + "\n" +
    "समस्या: " + category + "\n" +
    "स्थान: " + location + "\n" +
    "वडा: " + ward + "\n" +
    "घटना मिति: " + eventDate + "\n" +
    "घटना समय: " + eventTime + "\n" +
    "Priority: " + priority + "\n" +
    "गोप्य सूचना: " + anonymous + "\n\n" +
    "विवरण:\n" + description + "\n\n";

  if (additional) body += "थप जानकारी:\n" + additional + "\n\n";

  if (targetId || targetName) {
    body += "लक्षित निकाय/व्यक्ति: " +
      (targetName || targetId) + "\n\n";
  }

  body += "मरिण सुरक्षित समाज";

  // All active admins get notification.
  getActiveAdminUsers_().forEach(function(u) {
    try {
      sendEmail_(u.email,subject,body);
    } catch(err) {
      logAction_("EMAIL_ERROR",u.email,id,err.message);
    }
  });

  // Selected target also gets notification.
  if (targetId) {
    const target = findTarget_(targetId);
    if (target && String(target.status).toLowerCase()==="active") {
      sendTargetNotification_(target,subject,body,id);
    }
  }
}

function sendTargetNotification_(target,subject,body,referenceId) {
  let sent = false;

  if (target.email) {
    try {
      sendEmail_(target.email,subject,body);
      sent = true;
    } catch(err) {
      logAction_("TARGET_EMAIL_ERROR",target.email,
        referenceId,err.message);
    }
  }

  if (target.whatsapp) {
    logAction_(
      "TARGET_WHATSAPP_AVAILABLE",
      "",
      referenceId,
      "WhatsApp: " + target.whatsapp
    );
  }

  return sent;
}


/* =========================================================
   PUBLIC STATUS
========================================================= */

function getPublicReport_(data) {
  if (String(getSetting_("PUBLIC_TRACKING")).toUpperCase() !== "YES") {
    throw new Error("Public tracking बन्द गरिएको छ।");
  }

  const id = clean_(data.id);
  if (!id) throw new Error("Reference ID राख्नुहोस्।");

  const sh=getSheet_(CONFIG.REPORT_SHEET);
  const values=sh.getDataRange().getValues();

  for(let i=1;i<values.length;i++) {
    if(clean_(values[i][0])===id) {
      return {
        success:true,
        id:values[i][0],
        category:values[i][2],
        location:values[i][3],
        ward:values[i][4],
        priority:values[i][7],
        status:values[i][13] || "नयाँ",
        updatedAt:formatValue_(values[i][18]),
        message:"Status प्राप्त भयो।"
      };
    }
  }

  return {success:false,message:"यो Reference ID भेटिएन।"};
}


/* =========================================================
   ADMIN LOGIN
========================================================= */

function adminLogin_(data) {
  const email=clean_(data.email).toLowerCase();
  const password=String(data.password || "");

  if(!email || !password)
    throw new Error("Gmail र password दुवै राख्नुहोस्।");

  const sh=getSheet_(CONFIG.USERS_SHEET);
  const values=sh.getDataRange().getValues();

  for(let i=1;i<values.length;i++) {
    if(clean_(values[i][3]).toLowerCase()!==email) continue;

    const status=clean_(values[i][7]).toLowerCase();
    if(status!=="active")
      throw new Error("यो account Active छैन।");

    if(String(values[i][5])!==password)
      throw new Error("Gmail वा password गलत छ।");

    const role=clean_(values[i][6]).toLowerCase();

    if(["main admin","admin","operator"].indexOf(role)===-1)
      throw new Error("यो account लाई dashboard access छैन।");

    const token=createToken_(email,role);

    sh.getRange(i+1,10).setValue(new Date());

    logAction_("LOGIN",email,"","Dashboard login भयो।");

    return {
      success:true,
      token:token,
      role:role,
      name:values[i][2],
      userId:values[i][0]
    };
  }

  throw new Error("Gmail वा password गलत छ।");
}

function createToken_(email,role) {
  const token=Utilities.getUuid()+"-"+Utilities.getUuid();

  CacheService.getScriptCache().put(
    "TOKEN_"+token,
    JSON.stringify({
      email:email,
      role:role,
      created:new Date().getTime()
    }),
    CONFIG.SESSION_SECONDS
  );

  return token;
}

function verifyToken_(token) {
  if(!token) throw new Error("Login आवश्यक छ।");

  const cache=CacheService.getScriptCache().get("TOKEN_"+token);
  if(!cache) throw new Error("Session समाप्त भयो। फेरि Login गर्नुहोस्।");

  return JSON.parse(cache);
}

function isMainAdmin_(user) {
  return user && clean_(user.role).toLowerCase()==="main admin";
}

function isAdmin_(user) {
  const r=clean_(user.role).toLowerCase();
  return r==="main admin" || r==="admin";
}


/* =========================================================
   REPORT ADMIN FUNCTIONS
========================================================= */

function getReports_(data) {
  const user=verifyToken_(data.token);
  if(!isAdmin_(user)) throw new Error("Admin अधिकार आवश्यक छ।");

  const sh=getSheet_(CONFIG.REPORT_SHEET);
  const values=sh.getDataRange().getValues();
  const headers=values[0] || [];
  const reports=[];

  for(let i=1;i<values.length;i++) {
    const obj={};
    headers.forEach(function(h,j){ obj[h]=formatValue_(values[i][j]); });
    reports.push(obj);
  }

  return {success:true,reports:reports};
}

function updateReportStatus_(data) {
  const user=verifyToken_(data.token);
  if(!isAdmin_(user)) throw new Error("Admin अधिकार आवश्यक छ।");

  const id=clean_(data.id);
  const status=clean_(data.status);

  const allowed=["नयाँ","जाँच हुँदैछ","कारबाही हुँदैछ","सम्पन्न"];
  if(allowed.indexOf(status)===-1) throw new Error("Invalid status.");

  const sh=getSheet_(CONFIG.REPORT_SHEET);
  const values=sh.getDataRange().getValues();

  for(let i=1;i<values.length;i++) {
    if(clean_(values[i][0])===id) {
      sh.getRange(i+1,14).setValue(status);
      sh.getRange(i+1,19).setValue(new Date());
      sh.getRange(i+1,20).setValue(user.email);

      logAction_("UPDATE_STATUS",user.email,id,"Status: "+status);

      return {success:true,message:"Status update भयो।"};
    }
  }
  throw new Error("Reference ID भेटिएन।");
}

function deleteReport_(data) {
  const user=verifyToken_(data.token);
  if(!isMainAdmin_(user))
    throw new Error("Report delete गर्न Main Admin अधिकार आवश्यक छ।");

  const id=clean_(data.id);
  const sh=getSheet_(CONFIG.REPORT_SHEET);
  const values=sh.getDataRange().getValues();

  for(let i=1;i<values.length;i++) {
    if(clean_(values[i][0])===id) {
      sh.deleteRow(i+1);
      logAction_("DELETE_REPORT",user.email,id,"Report delete गरियो।");
      return {success:true,message:"Report delete भयो।"};
    }
  }
  throw new Error("Reference ID भेटिएन।");
}


/* =========================================================
   PUBLIC ADMIN REQUEST
========================================================= */

function requestAdmin_(data) {
  setupSystem();

  if(String(getSetting_("ADMIN_REQUEST_ENABLED")).toUpperCase()!=="YES")
    throw new Error("Admin request अहिले बन्द गरिएको छ।");

  const name=clean_(data.name);
  const email=clean_(data.email).toLowerCase();
  const whatsapp=clean_(data.whatsapp);
  const password=String(data.password || "");
  const position=clean_(data.position);
  const ward=clean_(data.ward);
  const reason=clean_(data.reason);
  const photo=clean_(data.photo);

  if(!name || !email || !password || !position || !ward)
    throw new Error("Name, Email, Password, Position र Ward आवश्यक छन्.");

  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Valid Gmail/email राख्नुहोस्.");

  if(password.length<6)
    throw new Error("Password कम्तीमा 6 characters हुनुपर्छ.");

  // Existing user?
  const users=getSheet_(CONFIG.USERS_SHEET).getDataRange().getValues();
  for(let i=1;i<users.length;i++) {
    if(clean_(users[i][3]).toLowerCase()===email)
      throw new Error("यो Gmail पहिले नै Users मा छ।");
  }

  // Existing pending request?
  const req=getSheet_(CONFIG.REQUESTS_SHEET).getDataRange().getValues();
  for(let i=1;i<req.length;i++) {
    if(clean_(req[i][4]).toLowerCase()===email &&
       clean_(req[i][10]).toLowerCase()==="pending") {
      throw new Error("यो Gmail बाट Pending request पहिले नै छ।");
    }
  }

  const requestId=makeID_("REQ");
  getSheet_(CONFIG.REQUESTS_SHEET).appendRow([
    requestId,new Date(),photo,name,email,whatsapp,password,
    position,ward,reason,"Pending","","",""
  ]);

  const body =
    "तपाईंको Admin/Operator request सफलतापूर्वक प्राप्त भयो।\n\n" +
    "Request ID: "+requestId+"\n" +
    "Name: "+name+"\n" +
    "Email: "+email+"\n" +
    "Position: "+position+"\n" +
    "Ward: "+ward+"\n\n" +
    "Main Admin ले verification गरेपछि तपाईंलाई approval वा rejection email पठाइनेछ।";

  sendEmail_(email,"मरिण सुरक्षित समाज - Admin Request प्राप्त भयो",body);

  // Main Admin notification
  getMainAdmins_().forEach(function(admin){
    sendEmail_(
      admin.email,
      "मरिण सुरक्षित समाज - नयाँ Admin Request",
      "नयाँ Admin/Operator request आएको छ।\n\n"+
      "Request ID: "+requestId+"\n"+
      "Name: "+name+"\n"+
      "Email: "+email+"\n"+
      "WhatsApp: "+whatsapp+"\n"+
      "Position: "+position+"\n"+
      "Ward: "+ward+"\n"+
      "Reason: "+reason+"\n\n"+
      "Main Admin Dashboard बाट Approve वा Reject गर्नुहोस्।"
    );
  });

  logAction_("ADMIN_REQUEST",email,requestId,
    "Public admin request submitted.");

  return {
    success:true,
    requestId:requestId,
    status:"Pending",
    message:"Request पठाइयो। Main Admin approval पछि मात्र account Active हुनेछ।"
  };
}


/* =========================================================
   MAIN ADMIN REQUEST MANAGEMENT
========================================================= */

function getAdminRequests_(data) {
  const user=verifyToken_(data.token);
  if(!isMainAdmin_(user))
    throw new Error("Main Admin अधिकार आवश्यक छ।");

  const sh=getSheet_(CONFIG.REQUESTS_SHEET);
  const values=sh.getDataRange().getValues();
  const headers=values[0] || [];
  const requests=[];

  for(let i=1;i<values.length;i++) {
    const obj={};
    headers.forEach(function(h,j){ obj[h]=formatValue_(values[i][j]); });
    requests.push(obj);
  }

  return {success:true,requests:requests};
}

function approveAdminRequest_(data) {
  const main=verifyToken_(data.token);
  if(!isMainAdmin_(main))
    throw new Error("Main Admin अधिकार आवश्यक छ।");

  const requestId=clean_(data.requestId);
  const reqSh=getSheet_(CONFIG.REQUESTS_SHEET);
  const values=reqSh.getDataRange().getValues();

  for(let i=1;i<values.length;i++) {
    if(clean_(values[i][0])!==requestId) continue;

    const status=clean_(values[i][10]).toLowerCase();
    if(status!=="pending")
      throw new Error("यो request पहिले नै process भइसकेको छ।");

    const photo=values[i][2];
    const name=values[i][3];
    const email=clean_(values[i][4]).toLowerCase();
    const whatsapp=values[i][5];
    const password=String(values[i][6] || "");
    const position=values[i][7];
    const ward=values[i][8];

    // Check duplicate user again
    const userSh=getSheet_(CONFIG.USERS_SHEET);
    const users=userSh.getDataRange().getValues();

    for(let j=1;j<users.length;j++) {
      if(clean_(users[j][3]).toLowerCase()===email)
        throw new Error("यो Gmail Users मा पहिले नै छ।");
    }

    const role = positionIsAdmin_(position) ? "Admin" : "Operator";
    const userId=makeID_("USR");

    userSh.appendRow([
      userId,photo,name,email,whatsapp,password,
      role,"Active",new Date(),"",position+" - Ward "+ward
    ]);

    reqSh.getRange(i+1,11).setValue("Approved");
    reqSh.getRange(i+1,12).setValue(new Date());
    reqSh.getRange(i+1,13).setValue(main.email);
    reqSh.getRange(i+1,14).setValue("");

    const approvedBody =
      "तपाईंको Admin/Operator request APPROVED भएको छ।\n\n"+
      "Request ID: "+requestId+"\n"+
      "User ID: "+userId+"\n"+
      "Name: "+name+"\n"+
      "Role: "+role+"\n"+
      "Position: "+position+"\n"+
      "Ward: "+ward+"\n\n"+
      "Login Gmail: "+email+"\n"+
      "Password: "+password+"\n\n"+
      "अब तपाईं dashboard मा login गर्न सक्नुहुन्छ।";

    sendEmail_(
      email,
      "मरिण सुरक्षित समाज - Admin Request APPROVED",
      approvedBody
    );

    logAction_("APPROVE_ADMIN_REQUEST",main.email,requestId,
      "Approved "+email+" as "+role);

    return {
      success:true,
      message:"Request approved भयो र requester लाई Gmail notification पठाइयो।",
      userId:userId
    };
  }

  throw new Error("Request ID भेटिएन।");
}

function rejectAdminRequest_(data) {
  const main=verifyToken_(data.token);
  if(!isMainAdmin_(main))
    throw new Error("Main Admin अधिकार आवश्यक छ।");

  const requestId=clean_(data.requestId);
  const reason=clean_(data.reason) || "Main Admin बाट request स्वीकृत भएन।";

  const sh=getSheet_(CONFIG.REQUESTS_SHEET);
  const values=sh.getDataRange().getValues();

  for(let i=1;i<values.length;i++) {
    if(clean_(values[i][0])!==requestId) continue;

    if(clean_(values[i][10]).toLowerCase()!=="pending")
      throw new Error("यो request पहिले नै process भइसकेको छ।");

    const email=clean_(values[i][4]).toLowerCase();
    const name=values[i][3];

    sh.getRange(i+1,11).setValue("Rejected");
    sh.getRange(i+1,12).setValue(new Date());
    sh.getRange(i+1,13).setValue(main.email);
    sh.getRange(i+1,14).setValue(reason);

    sendEmail_(
      email,
      "मरिण सुरक्षित समाज - Admin Request REJECTED",
      "नमस्कार "+name+",\n\n"+
      "तपाईंको Admin/Operator request REJECTED भएको छ।\n\n"+
      "Request ID: "+requestId+"\n"+
      "कारण: "+reason+"\n\n"+
      "यस request बाट तपाईंलाई dashboard access दिइएको छैन।"
    );

    logAction_("REJECT_ADMIN_REQUEST",main.email,requestId,
      "Rejected "+email+" Reason: "+reason);

    return {
      success:true,
      message:"Request rejected भयो र requester लाई notification पठाइयो।"
    };
  }

  throw new Error("Request ID भेटिएन।");
}

function positionIsAdmin_(position) {
  const p=clean_(position).toLowerCase();
  return p.indexOf("admin")>=0 ||
         p.indexOf("प्रमुख")>=0 ||
         p.indexOf("अधिकृत")>=0;
}


/* =========================================================
   USERS
========================================================= */

function getUsers_(data) {
  const user=verifyToken_(data.token);
  if(!isAdmin_(user))
    throw new Error("Admin अधिकार आवश्यक छ।");

  const sh=getSheet_(CONFIG.USERS_SHEET);
  const values=sh.getDataRange().getValues();
  const users=[];

  for(let i=1;i<values.length;i++) {
    users.push({
      userId:values[i][0],
      photo:values[i][1],
      name:values[i][2],
      email:values[i][3],
      whatsapp:values[i][4],
      role:values[i][6],
      status:values[i][7],
      createdAt:formatValue_(values[i][8]),
      lastLogin:formatValue_(values[i][9]),
      position:values[i][10]
    });
  }

  return {success:true,users:users};
}

function createUser_(data) {
  const admin=verifyToken_(data.token);
  if(!isMainAdmin_(admin))
    throw new Error("User बनाउन Main Admin अधिकार आवश्यक छ।");

  const name=clean_(data.name);
  const email=clean_(data.email).toLowerCase();
  const whatsapp=clean_(data.whatsapp);
  const password=String(data.password || "");
  const role=clean_(data.role) || "Operator";
  const position=clean_(data.position);
  const ward=clean_(data.ward);
  const photo=clean_(data.photo);

  if(!name || !email || !password)
    throw new Error("Name, Gmail र password आवश्यक छ.");

  if(password.length<6)
    throw new Error("Password कम्तीमा 6 characters हुनुपर्छ.");

  if(["Main Admin","Admin","Operator"].indexOf(role)===-1)
    throw new Error("Invalid role.");

  const sh=getSheet_(CONFIG.USERS_SHEET);
  const values=sh.getDataRange().getValues();

  for(let i=1;i<values.length;i++) {
    if(clean_(values[i][3]).toLowerCase()===email)
      throw new Error("यो Gmail पहिले नै Users मा छ।");
  }

  const id=makeID_("USR");
  sh.appendRow([
    id,photo,name,email,whatsapp,password,
    role,"Active",new Date(),"",
    position + (ward ? " - Ward "+ward : "")
  ]);

  sendEmail_(
    email,
    "मरिण सुरक्षित समाज - Account तयार भयो",
    "तपाईंको account तयार भएको छ।\n\n"+
    "Gmail: "+email+"\n"+
    "Password: "+password+"\n"+
    "Role: "+role+"\n"+
    "Position: "+position+"\n"+
    "Ward: "+ward
  );

  logAction_("CREATE_USER",admin.email,"",
    email+" / "+role);

  return {success:true,userId:id,message:"User तयार भयो।"};
}

function updateUser_(data) {
  const admin=verifyToken_(data.token);
  if(!isMainAdmin_(admin))
    throw new Error("User update गर्न Main Admin अधिकार आवश्यक छ।");

  const userId=clean_(data.userId);
  const sh=getSheet_(CONFIG.USERS_SHEET);
  const values=sh.getDataRange().getValues();

  for(let i=1;i<values.length;i++) {
    if(clean_(values[i][0])!==userId) continue;

    const row=i+1;

    if(data.name!==undefined) sh.getRange(row,3).setValue(clean_(data.name));
    if(data.photo!==undefined) sh.getRange(row,2).setValue(clean_(data.photo));
    if(data.whatsapp!==undefined) sh.getRange(row,5).setValue(clean_(data.whatsapp));
    if(data.password!==undefined && String(data.password).length>=6)
      sh.getRange(row,6).setValue(String(data.password));
    if(data.role!==undefined &&
       ["Main Admin","Admin","Operator"].indexOf(clean_(data.role))>=0)
      sh.getRange(row,7).setValue(clean_(data.role));
    if(data.status!==undefined &&
       ["Active","Inactive","Rejected"].indexOf(clean_(data.status))>=0)
      sh.getRange(row,8).setValue(clean_(data.status));
    if(data.position!==undefined) sh.getRange(row,11).setValue(clean_(data.position));

    logAction_("UPDATE_USER",admin.email,"","UserID: "+userId);
    return {success:true,message:"User update भयो।"};
  }

  throw new Error("User भेटिएन।");
}

function deleteUser_(data) {
  const admin=verifyToken_(data.token);
  if(!isMainAdmin_(admin))
    throw new Error("User delete गर्न Main Admin अधिकार आवश्यक छ।");

  const userId=clean_(data.userId);
  const sh=getSheet_(CONFIG.USERS_SHEET);
  const values=sh.getDataRange().getValues();

  let activeMainAdmins=0;
  for(let i=1;i<values.length;i++) {
    if(clean_(values[i][6]).toLowerCase()==="main admin" &&
       clean_(values[i][7]).toLowerCase()==="active")
      activeMainAdmins++;
  }

  for(let i=1;i<values.length;i++) {
    if(clean_(values[i][0])!==userId) continue;

    if(clean_(values[i][6]).toLowerCase()==="main admin" &&
       clean_(values[i][7]).toLowerCase()==="active" &&
       activeMainAdmins<=1)
      throw new Error("अन्तिम Active Main Admin delete गर्न मिल्दैन।");

    sh.deleteRow(i+1);
    logAction_("DELETE_USER",admin.email,"","UserID: "+userId);

    return {success:true,message:"User delete भयो।"};
  }

  throw new Error("User भेटिएन।");
}


/* =========================================================
   TARGETS: POLICE / HOSPITAL / GAUPALIKA / WARD / PARTY /
   INSTITUTION / BANK / OTHER
========================================================= */

function getTargets_(data) {
  const user=verifyToken_(data.token);
  if(!isAdmin_(user))
    throw new Error("Admin अधिकार आवश्यक छ।");

  const sh=getSheet_(CONFIG.TARGETS_SHEET);
  const values=sh.getDataRange().getValues();
  const targets=[];

  for(let i=1;i<values.length;i++) {
    targets.push({
      targetId:values[i][0],
      photo:values[i][1],
      name:values[i][2],
      type:values[i][3],
      email:values[i][4],
      whatsapp:values[i][5],
      ward:values[i][6],
      position:values[i][7],
      status:values[i][8],
      createdAt:formatValue_(values[i][9])
    });
  }

  return {success:true,targets:targets};
}

function createTarget_(data) {
  const admin=verifyToken_(data.token);
  if(!isMainAdmin_(admin))
    throw new Error("Target बनाउन Main Admin अधिकार आवश्यक छ।");

  const name=clean_(data.name);
  const type=clean_(data.type);
  const email=clean_(data.email).toLowerCase();
  const whatsapp=clean_(data.whatsapp);

  if(!name || !type)
    throw new Error("Target Name र Type आवश्यक छ.");

  const id=makeID_("TGT");
  getSheet_(CONFIG.TARGETS_SHEET).appendRow([
    id,clean_(data.photo),name,type,email,whatsapp,
    clean_(data.ward),clean_(data.position),"Active",new Date()
  ]);

  return {success:true,targetId:id};
}

function updateTarget_(data) {
  const admin=verifyToken_(data.token);
  if(!isMainAdmin_(admin))
    throw new Error("Target update गर्न Main Admin अधिकार आवश्यक छ।");

  const id=clean_(data.targetId);
  const sh=getSheet_(CONFIG.TARGETS_SHEET);
  const values=sh.getDataRange().getValues();

  for(let i=1;i<values.length;i++) {
    if(clean_(values[i][0])!==id) continue;

    const row=i+1;
    const map=[
      ["photo",2],["name",3],["type",4],["email",5],
      ["whatsapp",6],["ward",7],["position",8],["status",9]
    ];

    map.forEach(function(x){
      if(data[x[0]]!==undefined)
        sh.getRange(row,x[1]).setValue(clean_(data[x[0]]));
    });

    return {success:true,message:"Target update भयो।"};
  }

  throw new Error("Target भेटिएन।");
}

function deleteTarget_(data) {
  const admin=verifyToken_(data.token);
  if(!isMainAdmin_(admin))
    throw new Error("Target delete गर्न Main Admin अधिकार आवश्यक छ।");

  const id=clean_(data.targetId);
  const sh=getSheet_(CONFIG.TARGETS_SHEET);
  const values=sh.getDataRange().getValues();

  for(let i=1;i<values.length;i++) {
    if(clean_(values[i][0])===id) {
      sh.deleteRow(i+1);
      return {success:true,message:"Target delete भयो।"};
    }
  }

  throw new Error("Target भेटिएन।");
}

function findTarget_(id) {
  const sh=getSheet_(CONFIG.TARGETS_SHEET);
  const values=sh.getDataRange().getValues();

  for(let i=1;i<values.length;i++) {
    if(clean_(values[i][0])===clean_(id)) {
      return {
        targetId:values[i][0],
        photo:values[i][1],
        name:values[i][2],
        type:values[i][3],
        email:clean_(values[i][4]).toLowerCase(),
        whatsapp:values[i][5],
        ward:values[i][6],
        position:values[i][7],
        status:values[i][8]
      };
    }
  }
  return null;
}


/* =========================================================
   HELPERS
========================================================= */

function getMainAdmins_() {
  const sh=getSheet_(CONFIG.USERS_SHEET);
  const values=sh.getDataRange().getValues();
  const result=[];

  for(let i=1;i<values.length;i++) {
    const role=clean_(values[i][6]).toLowerCase();
    const status=clean_(values[i][7]).toLowerCase();
    const email=clean_(values[i][3]).toLowerCase();

    if(role==="main admin" && status==="active" && email) {
      result.push({
        userId:values[i][0],
        name:values[i][2],
        email:email
      });
    }
  }
  return result;
}

function getActiveAdminUsers_() {
  const sh=getSheet_(CONFIG.USERS_SHEET);
  const values=sh.getDataRange().getValues();
  const result=[];

  for(let i=1;i<values.length;i++) {
    const role=clean_(values[i][6]).toLowerCase();
    const status=clean_(values[i][7]).toLowerCase();
    const email=clean_(values[i][3]).toLowerCase();

    if(email &&
       status==="active" &&
       ["main admin","admin","operator"].indexOf(role)>=0) {
      result.push({
        userId:values[i][0],
        name:values[i][2],
        email:email,
        role:role,
        position:values[i][10]
      });
    }
  }
  return result;
}

function sendEmail_(to,subject,body) {
  if(!to) return;
  MailApp.sendEmail({
    to:to,
    subject:subject,
    body:body,
    name:"मरिण सुरक्षित समाज"
  });
}

function getSetting_(key) {
  const sh=getSheet_(CONFIG.SETTINGS_SHEET);
  const values=sh.getDataRange().getValues();

  for(let i=1;i<values.length;i++) {
    if(clean_(values[i][0])===key) return values[i][1];
  }
  return "";
}

function logAction_(action,userEmail,referenceId,details) {
  try {
    getSheet_(CONFIG.LOGS_SHEET).appendRow([
      new Date(),action,userEmail,referenceId,details,""
    ]);
  } catch(e) {}
}

function logError_(err) {
  try {
    logAction_("ERROR","","",
      err && err.message ? err.message : String(err));
  } catch(e) {}
}

function clean_(v) {
  return String(v==null ? "" : v).trim();
}

function formatValue_(v) {
  if(Object.prototype.toString.call(v)==="[object Date]") {
    return Utilities.formatDate(
      v,
      getSetting_("TIMEZONE") || "Asia/Kathmandu",
      "yyyy-MM-dd HH:mm:ss"
    );
  }
  return v==null ? "" : String(v);
}

function makeID_(prefix) {
  return prefix+"-"+Utilities.getUuid().slice(0,8).toUpperCase();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* =========================================================
   TEST
========================================================= */

function testAdminEmail() {
  const admins=getMainAdmins_();
  if(!admins.length) throw new Error("Active Main Admin भेटिएन।");

  admins.forEach(function(admin){
    sendEmail_(
      admin.email,
      "मरिण सुरक्षित समाज - Test Notification",
      "यो test email हो। Gmail notification system चलिरहेको छ।"
    );
  });

  return "Main Admin लाई test email पठाइयो।";
}
