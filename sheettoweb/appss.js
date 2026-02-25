const SHEET_USERS="Users";
const SHEET_MSG="Messages";
const SHEET_TYPING="Typing";
const SHEET_OTP="OTP";

// --------------- GET -----------------
function doGet(e){
  const action=e.parameter.action;
  if(action=="members") return getMembers();
  if(action=="msgs") return getMessages();
  if(action=="typing") return getTyping();
  return ContentService.createTextOutput("OK");
}

// --------------- POST ----------------
function doPost(e){
  const action=e.parameter.action;
  if(action=="register") return register(e);
  if(action=="login") return login(e);
  if(action=="send") return sendMessage(e);
  if(action=="typing") return typing(e);
  if(action=="online") return online(e);
  if(action=="sendOTP") return sendOTP(e);
  if(action=="verifyOTP") return verifyOTP(e);
  if(action=="changePass") return changePass(e);
  return ContentService.createTextOutput("OK");
}

// ---------------- REGISTER ----------------
function register(e){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  sh.appendRow([new Date(),e.parameter.id,e.parameter.name,e.parameter.email,e.parameter.pass,"offline",""]);
  return ContentService.createTextOutput("REGISTERED");
}

// ---------------- LOGIN ----------------
function login(e){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  const data=sh.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(data[i][1]==e.parameter.id && data[i][4]==e.parameter.pass){
      sh.getRange(i+1,6).setValue("online");
      sh.getRange(i+1,7).setValue(new Date());
      return ContentService.createTextOutput(data[i][2]); // return Name
    }
  }
  return ContentService.createTextOutput("FAIL");
}

// ---------------- SEND MESSAGE ----------------


function sendMessage(e){
  const sh=SpreadsheetApp.getActive().getSheetByName("Messages");
  sh.appendRow([new Date(), e.parameter.from, e.parameter.to, e.parameter.msg, e.parameter.type || "text", ""]);
  return ContentService.createTextOutput("ok");
}

// ---------------- GET MESSAGES ----------------
function getMessages(){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEET_MSG);
  const data=sh.getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------- MEMBERS ----------------
function getMembers(){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  const data=sh.getDataRange().getValues();
  let list=[];
  for(let i=1;i<data.length;i++) list.push(data[i][2]);
  return ContentService.createTextOutput(JSON.stringify(list)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------- TYPING ----------------
function typing(e){
  let sh=SpreadsheetApp.getActive().getSheetByName(SHEET_TYPING);
  if(!sh) sh=SpreadsheetApp.getActive().insertSheet(SHEET_TYPING).appendRow(["Name","TypingTo","Time"]);
  sh.appendRow([e.parameter.name,e.parameter.to,new Date()]);
  return ContentService.createTextOutput("ok");
}

function getTyping(){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEET_TYPING);
  if(!sh) return ContentService.createTextOutput("[]");
  return ContentService.createTextOutput(JSON.stringify(sh.getDataRange().getValues())).setMimeType(ContentService.MimeType.JSON);
}

// ---------------- ONLINE STATUS ----------------
function online(e){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  const data=sh.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(data[i][2]==e.parameter.name){
      sh.getRange(i+1,6).setValue("online");
      sh.getRange(i+1,7).setValue(new Date());
    }
  }
  return ContentService.createTextOutput("ok");
}

// ---------------- SEND OTP ----------------
function sendOTP(e){
  const otp=Math.floor(100000+Math.random()*900000);
  MailApp.sendEmail(e.parameter.email,"Your OTP Code","OTP: "+otp);
  let sh=SpreadsheetApp.getActive().getSheetByName(SHEET_OTP);
  if(!sh) sh=SpreadsheetApp.getActive().insertSheet(SHEET_OTP).appendRow(["Time","Email","OTP"]);
  sh.appendRow([new Date(),e.parameter.email,otp]);
  return ContentService.createTextOutput("OTP SENT");
}

// ---------------- VERIFY OTP ----------------
function verifyOTP(e){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEET_OTP);
  if(!sh) return ContentService.createTextOutput("FAIL");
  const data=sh.getDataRange().getValues();
  for(let i=data.length-1;i>=1;i--){
    if(data[i][1]==e.parameter.email && data[i][2]==e.parameter.otp){
      return ContentService.createTextOutput("OK");
    }
  }
  return ContentService.createTextOutput("FAIL");
}

// ---------------- CHANGE PASSWORD ----------------
function changePass(e){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  const data=sh.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    // Check by MemberID OR Email
    if(data[i][1]==e.parameter.id || data[i][3]==e.parameter.email){
      sh.getRange(i+1,5).setValue(e.parameter.newpass);
      return ContentService.createTextOutput("PASSWORD CHANGED");
    }
  }
  return ContentService.createTextOutput("USER NOT FOUND");
}
