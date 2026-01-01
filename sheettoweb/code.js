const SHEET = "Members";
const USERS_SHEET = "Users";

function login(d){
  const sh = SpreadsheetApp.getActive().getSheetByName(USER_SHEET);
  const data = sh.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(data[i][0]===d.username && data[i][1]===d.password){
      return {status:true, username:d.username, role:data[i][2] || "user"};
    }
  }
  return {status:false,message:"Invalid username or password"};
}
function changePassword(d){
  const sh = SpreadsheetApp.getActive().getSheetByName(USER_SHEET);
  const data = sh.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(data[i][0]===d.username && data[i][1]===d.oldPassword){
      sh.getRange(i+1,2).setValue(d.newPassword);
      return {status:true,message:"Password changed"};
    }
  }
  return {status:false,message:"Old password is incorrect"};
}
function doGet() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET);
  const data = sh.getDataRange().getValues();
  const header = data.shift();

  return json(data.map(r=>{
    let o={};
    header.forEach((h,i)=>o[h]=r[i]);
    return o;
  }));
}

function doPost(e) {
  if (!e.postData) return json({status:false,message:"No data"});
  const d = JSON.parse(e.postData.contents);

  if(d.action==="login") return json(login(d));
  if(d.action==="add") return json(add(d));
  if(d.action==="update") return json(update(d));
  if(d.action==="delete") return json(del(d.MemberID));

  return json({status:false,message:"Invalid action"});
}

function add(d){
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET);
  sh.appendRow([
    d.MemberID,d.Name,d.Address,d["Father Name"],d["Grand Father Name"],
    d["spouse/wife Name"],d.Phone,d.Email,
    d["Identy PhotoURL"],d["Member PhotoURL"],
    d.Status,d.OTP,d.EntryDate
  ]);
  return {status:true};
}

function update(d){
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET);
  const data = sh.getDataRange().getValues();
  const header = data[0];

  for(let i=1;i<data.length;i++){
    if(data[i][0]==d.MemberID){
      header.forEach((h,j)=>{
        sh.getRange(i+1,j+1).setValue(d[h]||"");
      });
      return {status:true};
    }
  }
  return {status:false,message:"Not found"};
}

function del(id){
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET);
  const data = sh.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(data[i][0]==id){
      sh.deleteRow(i+1);
      return {status:true};
    }
  }
  return {status:false,message:"Not found"};
}

function json(o){
  return ContentService.createTextOutput(JSON.stringify(o))
  .setMimeType(ContentService.MimeType.JSON);
}
