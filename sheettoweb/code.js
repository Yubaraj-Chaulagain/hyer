const SHEET_MEMBERS = "Members";
const SHEET_USERS = "Users";

// Serve HTML
function doGet() {
  return HtmlService.createHtmlOutputFromFile("index");
}

// Handle API requests
function doPost(e) {
  if (!e.postData) return json({status:false,message:"No data"});
  const d = JSON.parse(e.postData.contents);

  // --- LOGIN ---
  if(d.action==="login") return json(login(d));

  // --- MEMBERS ---
  if(d.action==="getMembers") return json(getMembers(d.username));
  if(d.action==="add") return json(addMember(d));
  if(d.action==="update") return json(updateMember(d));
  if(d.action==="delete") return json(deleteMember(d.MemberID));

  // --- USERS (admin only) ---
  if(d.action==="getUsers") return json(getUsers(d.username));
  if(d.action==="addUser") return json(addUser(d));
  if(d.action==="updateUser") return json(updateUser(d));
  if(d.action==="deleteUser") return json(deleteUser(d.Username, d.admin));

  return json({status:false,message:"Invalid action"});
}

// --- LOGIN ---
function login(d){
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  const data = sh.getDataRange().getValues();
  const header = data.shift();

  for(let row of data){
    if(row[0]===d.username && row[1]===d.password){
      return {status:true, role:row[2], MemberID:row[3]||""};
    }
  }
  return {status:false,message:"Invalid username or password"};
}

// --- MEMBER MANAGEMENT ---
function getMembers(username){
  const role = getUserRole(username);
  const memberID = getMemberID(username);
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_MEMBERS);
  const data = sh.getDataRange().getValues();
  const header = data.shift();

  if(role==="admin"||role==="user"){
    return data.map(r=>{
      let o={}; header.forEach((h,i)=>o[h]=r[i]); return o;
    });
  } else if(role==="member"){
    const r = data.find(r=>r[0]==memberID);
    if(!r) return [];
    let o={}; header.forEach((h,i)=>o[h]=r[i]); return [o];
  }
  return [];
}

function addMember(d){ return add(d); }
function updateMember(d){ return update(d); }
function deleteMember(id){ return del(id); }

// --- USER MANAGEMENT (ADMIN) ---
function getUsers(username){
  if(getUserRole(username)!=="admin") return [];
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  const data = sh.getDataRange().getValues();
  const header = data.shift();
  return data.map(r=>{ let o={}; header.forEach((h,i)=>o[h]=r[i]); return o; });
}

function addUser(d){
  if(getUserRole(d.admin)!=="admin") return {status:false,message:"No permission"};
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  sh.appendRow([d.Username,d.Password,d.Role,d.MemberID||""]);
  return {status:true};
}

function updateUser(d){
  if(getUserRole(d.admin)!=="admin") return {status:false,message:"No permission"};
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  const data = sh.getDataRange().getValues();
  const header = data[0];
  for(let i=1;i<data.length;i++){
    if(data[i][0]===d.Username){
      header.forEach((h,j)=>sh.getRange(i+1,j+1).setValue(d[h]||""));
      return {status:true};
    }
  }
  return {status:false,message:"User not found"};
}

function deleteUser(username, admin){
  if(getUserRole(admin)!=="admin") return {status:false,message:"No permission"};
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  const data = sh.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(data[i][0]===username){
      sh.deleteRow(i+1);
      return {status:true};
    }
  }
  return {status:false,message:"User not found"};
}

// --- HELPER ---
function getUserRole(username){
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  const data = sh.getDataRange().getValues();
  const header = data.shift();
  const userRow = data.find(r=>r[0]===username);
  return userRow?userRow[2]:"";
}

function getMemberID(username){
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  const data = sh.getDataRange().getValues();
  const header = data.shift();
  const userRow = data.find(r=>r[0]===username);
  return userRow?userRow[3]:"";
}

// --- EXISTING MEMBER FUNCTIONS ---
function add(d){
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_MEMBERS);
  sh.appendRow([d.MemberID,d.Name,d.Address,d["Father Name"],d["Grand Father Name"],
    d["spouse/wife Name"],d.Phone,d.Email,d["Identy PhotoURL"],d["Member PhotoURL"],
    d.Status,d.OTP,d.EntryDate]);
  return {status:true};
}

function update(d){
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_MEMBERS);
  const data = sh.getDataRange().getValues();
  const header = data[0];
  for(let i=1;i<data.length;i++){
    if(data[i][0]==d.MemberID){
      header.forEach((h,j)=>sh.getRange(i+1,j+1).setValue(d[h]||""));
      return {status:true};
    }
  }
  return {status:false,message:"Member not found"};
}

function del(id){
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_MEMBERS);
  const data = sh.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(data[i][0]==id){
      sh.deleteRow(i+1);
      return {status:true};
    }
  }
  return {status:false,message:"Member not found"};
}

// --- JSON HELPER ---
function json(o){
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
