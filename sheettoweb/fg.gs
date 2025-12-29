const MEMBER_SHEET = "Members";
const USER_SHEET   = "Users";

/* ================= GET ================= */
function doGet(){
  const sh = SpreadsheetApp.getActive().getSheetByName(MEMBER_SHEET);
  const data = sh.getDataRange().getValues();
  const headers = data.shift();
  return json(data.map(r=>{
    let o={};
    headers.forEach((h,i)=>o[h]=r[i]);
    return o;
  }));
}

/* ================= POST ================= */
function doPost(e){
  const d = JSON.parse(e.postData.contents);

  if(d.action==="login")  return json(login(d));
  if(d.action==="add")    return json(addMember(d));
  if(d.action==="update") return json(updateMember(d));
  if(d.action==="delete") return json(deleteMember(d.MemberID));

  return json({ok:false});
}

/* ================= LOGIN ================= */
function login(d){
  const sh = SpreadsheetApp.getActive().getSheetByName(USER_SHEET);
  const data = sh.getDataRange().getValues();
  const headers = data.shift();

  for(const r of data){
    let u={}; headers.forEach((h,i)=>u[h]=r[i]);

    if(
      String(u.Username).trim() === String(d.user).trim() &&
      String(u.Password).trim() === String(d.pass).trim() &&
      String(u.Status).trim().toLowerCase() === "active"
    ){
      return {ok:true, role:u.Role};
    }
  }
  return {ok:false};
}

/* ================= MEMBER ================= */
function addMember(d){
  const sh = SpreadsheetApp.getActive().getSheetByName(MEMBER_SHEET);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  sh.appendRow(headers.map(h=>d[h]||""));
  return {ok:true};
}

function updateMember(d){
  const sh = SpreadsheetApp.getActive().getSheetByName(MEMBER_SHEET);
  const data = sh.getDataRange().getValues();
  const headers = data[0];

  for(let i=1;i<data.length;i++){
    if(data[i][0]==d.MemberID){
      headers.forEach((h,j)=>{
        sh.getRange(i+1,j+1).setValue(d[h]||"");
      });
      return {ok:true};
    }
  }
  return {ok:false};
}

function deleteMember(id){
  const sh = SpreadsheetApp.getActive().getSheetByName(MEMBER_SHEET);
  const data = sh.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(data[i][0]==id){
      sh.deleteRow(i+1);
      return {ok:true};
    }
  }
  return {ok:false};
}

/* ================= JSON ================= */
function json(o){
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
