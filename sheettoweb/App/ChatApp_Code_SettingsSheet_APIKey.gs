/*
 * CHAT APP - GOOGLE SHEETS DATABASE VERSION
 * Plain-text passwords as requested.
 *
 * FIRST TIME:
 * 1) Open this Apps Script project.
 * 2) Paste this whole file into Code.gs and save.
 * 3) Run firstTimeSetup() once from the Run menu.
 * 4) Approve the permissions.
 * 5) Open the returned/logged spreadsheet URL in Executions, or run
 *    getDatabaseInfo() to see the database URL.
 *
 * The script automatically creates:
 * Members, Messages, Sessions, OTP, Files, Settings
 *
 * The database Spreadsheet ID is stored in Script Properties as
 * CHATAPP_SPREADSHEET_ID, so it keeps using the same Google Sheet.
 *
 * To use an existing Google Sheet instead, run:
 * setDatabaseId('YOUR_SPREADSHEET_ID')
 *
 * 24-hour cleanup:
 * - Messages are automatically removed 24 hours after creation.
 * - Uploaded Drive files are removed after FILE_HOURS.
 * - InstallCleanupTrigger() runs cleanup hourly.
 */

const CONFIG = {
  // Google Sheet database settings.
  // If CHATAPP_SPREADSHEET_ID is not set, the script will automatically
  // create a new Google Sheet named "ChatApp Database" and remember its ID.
  DATABASE_NAME: 'ChatApp Database',
  MESSAGE_HOURS: 24,
  FILE_HOURS: 24,
  DRIVE_FOLDER: 'ChatApp Files',
  SHEETS: {
    Members: ['MemberID','Name','Email','Password','PhotoURL','CreatedAt','LastLogin','LastSeen','Status','Active'],
    Messages: ['MessageID','From','To','Message','Type','FileURL','CreatedAt','SeenAt','ExpiresAt','Deleted'],
    Sessions: ['MemberID','Name','LoginAt','LastSeen','Status'],
    OTP: ['MemberID','OTP','CreatedAt','ExpiresAt','Used'],
    Files: ['FileID','MemberID','FileName','FileType','FileURL','DriveFileId','CreatedAt','ExpiresAt','Deleted'],
    Settings: ['Key','Value']
  }
};


function getDatabase_(){
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('CHATAPP_SPREADSHEET_ID');
  if(id){
    try { return SpreadsheetApp.openById(id); }
    catch(e) { props.deleteProperty('CHATAPP_SPREADSHEET_ID'); }
  }

  // First try an explicitly supplied Spreadsheet ID from Script Properties.
  // If none exists, create the database automatically.
  const ss = SpreadsheetApp.create(CONFIG.DATABASE_NAME);
  props.setProperty('CHATAPP_SPREADSHEET_ID', ss.getId());
  return ss;
}

function setDatabaseId(spreadsheetId){
  const id = String(spreadsheetId || '').trim();
  if(!id) return json_({error:'Spreadsheet ID is required'});
  const ss = SpreadsheetApp.openById(id); // validates access
  PropertiesService.getScriptProperties().setProperty('CHATAPP_SPREADSHEET_ID', ss.getId());
  setupSheets_();
  return json_({
    ok:true,
    message:'Google Sheet connected successfully',
    spreadsheetId:ss.getId(),
    spreadsheetUrl:ss.getUrl(),
    name:ss.getName()
  });
}

function getDatabaseInfo(){
  const ss = getDatabase_();
  setupSheets_();
  return {
    ok:true,
    spreadsheetId:ss.getId(),
    spreadsheetUrl:ss.getUrl(),
    name:ss.getName()
  };
}

function setupChatSystem(){
  const ss=getDatabase_();
  Object.keys(CONFIG.SHEETS).forEach(n=>{
    let sh=ss.getSheetByName(n);
    if(!sh) sh=ss.insertSheet(n);
    const h=CONFIG.SHEETS[n];
    if(sh.getLastRow()===0) sh.getRange(1,1,1,h.length).setValues([h]);
    else sh.getRange(1,1,1,h.length).setValues([h]);
    sh.setFrozenRows(1);
  });
  setSetting_('MESSAGE_HOURS', CONFIG.MESSAGE_HOURS);
  setSetting_('FILE_HOURS', CONFIG.FILE_HOURS);
  // ImgBB API key is stored in the Google Sheet Settings sheet.
  // Add your key in Settings!B:B next to IMGBB_API_KEY.
  if (getSetting_('IMGBB_API_KEY', '') === '') setSetting_('IMGBB_API_KEY', '');
  return json_({
    ok:true,
    message:'All sheets and headers are ready',
    spreadsheetId:ss.getId(),
    spreadsheetUrl:ss.getUrl(),
    spreadsheetName:ss.getName()
  });
}

function doGet(e){
  try{
    setupSheets_();
    const a=(e.parameter.action||'').trim();
    if(a==='members') return json_(getMembers_());
    if(a==='msgs') return json_(getMessages_());
    if(a==='health') return json_(getSystemStatus_());
    if(a==='database') return json_(getDatabaseInfo());
    return json_({ok:true,service:'ChatApp API'});
  }catch(err){ return json_({error:String(err)}); }
}

function doPost(e){
  try{
    setupSheets_();
    const p=e.parameter||{}; const a=(p.action||'').trim();
    switch(a){
      case 'register': return register_(p);
      case 'login': return login_(p);
      case 'logout': return logout_(p);
      case 'send': return send_(p);
      case 'public': return publicSend_(p);
      case 'markSeen': return markSeen_(p);
      case 'sendOTP': return sendOTP_(p);
      case 'verifyOTP': return verifyOTP_(p);
      case 'changePass': return changePass_(p);
      case 'resetPass': return resetPass_(p);
      case 'uploadPhoto': return uploadPhoto_(p);
      case 'updatePhoto': return updatePhoto_(p);
      case 'uploadTempFile': return uploadTempFile_(p);
      case 'cleanup': return cleanup_();
      case 'connectSheet': return setDatabaseId(p.spreadsheetId||p.id);
      default: return json_({error:'Unknown action'});
    }
  }catch(err){ return json_({error:String(err)}); }
}

function setupSheets_(){
  const ss=getDatabase_();
  Object.keys(CONFIG.SHEETS).forEach(n=>{
    let sh=ss.getSheetByName(n); if(!sh) sh=ss.insertSheet(n);
    const h=CONFIG.SHEETS[n];
    if(sh.getLastRow()===0 || sh.getRange(1,1,1,h.length).getValues()[0].join('|')!==h.join('|')) sh.getRange(1,1,1,h.length).setValues([h]);
    sh.setFrozenRows(1);
  });
}
function sh_(n){return getDatabase_().getSheetByName(n);}
function rows_(n){const s=sh_(n),v=s.getDataRange().getValues(); return v.length>1?v.slice(1):[];}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function now_(){return new Date();}
function iso_(d){return new Date(d).toISOString();}
function id_(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function setSetting_(k,v){const s=sh_('Settings'),r=s.getDataRange().getValues();for(let i=1;i<r.length;i++){if(String(r[i][0])===k){s.getRange(i+1,2).setValue(v);return;}}s.appendRow([k,v]);}
function getSetting_(k,d){const r=rows_('Settings');for(const x of r)if(String(x[0])===k)return x[1];return d;}

function register_(p){
  const id=String(p.id||'').trim(), name=String(p.name||'').trim(), email=String(p.email||'').trim(), pass=String(p.pass||'');
  if(!id||!name||!email||!pass)return json_({error:'Fill all required fields'});
  const s=sh_('Members'), r=rows_('Members');
  if(r.some(x=>String(x[0]).toLowerCase()===id.toLowerCase()))return json_({error:'Member ID already exists'});
  s.appendRow([id,name,email,pass,String(p.photo||''),now_(),'','','Offline','Yes']);
  return json_({ok:true,message:'Registered Successfully'});
}

function login_(p){
  const id=String(p.id||'').trim(), pass=String(p.pass||'');
  const s=sh_('Members'), r=s.getDataRange().getValues();
  for(let i=1;i<r.length;i++){
    if(String(r[i][0])===id && String(r[i][3])===pass && String(r[i][9]||'Yes')!=='No'){
      const d=now_(); s.getRange(i+1,7,1,3).setValues([[d,d,d]]); s.getRange(i+1,9).setValue('Online');
      sh_('Sessions').appendRow([id,r[i][1],d,d,'Online']);
      return json_({name:r[i][1],photo:r[i][4]||''});
    }
  }
  return json_({error:'Wrong Member ID or Password'});
}
function logout_(p){
  const id=String(p.id||''); const s=sh_('Members'),r=s.getDataRange().getValues();
  for(let i=1;i<r.length;i++)if(String(r[i][0])===id){s.getRange(i+1,8).setValue(now_());s.getRange(i+1,9).setValue('Offline');break;}
  return json_({ok:true});
}

function send_(p){
  const from=String(p.from||''),to=String(p.to||''),msg=String(p.msg||''),type=String(p.type||'text'),url=String(p.fileURL||'');
  if(!from||!to||(!msg&&!url))return json_({error:'Invalid message'});
  const d=now_(); sh_('Messages').appendRow([id_(),from,to,msg,type,url,d,'','', 'No']);
  return json_({ok:true});
}
function publicSend_(p){
  const from=String(p.from||''),msg=String(p.msg||''); if(!from||!msg)return json_({error:'Invalid message'});
  const d=now_(); sh_('Messages').appendRow([id_(),from,'ALL',msg,'text','',d,'','', 'No']); return json_({ok:true});
}

function getMessages_(){
  cleanup_();
  const r=rows_('Messages');
  return [CONFIG.SHEETS.Messages].concat(r.map(x=>[x[0],x[1],x[2],x[3],x[4],x[5],x[6],x[7],x[8],x[9]]));
}
function markSeen_(p){
  const ids=String(p.messageIds||'').split(',').map(x=>x.trim()).filter(Boolean); if(!ids.length)return json_({ok:true});
  const s=sh_('Messages'),r=s.getDataRange().getValues(),d=now_(),exp=new Date(d.getTime()+Number(getSetting_('MESSAGE_HOURS',24))*3600000);
  for(let i=1;i<r.length;i++)if(ids.indexOf(String(r[i][0]))>=0){if(!r[i][7]){s.getRange(i+1,8).setValue(d);s.getRange(i+1,9).setValue(exp);}}
  return json_({ok:true});
}

function getMembers_(){
  cleanup_();
  const r=rows_('Members'), now=Date.now(), all=[], online=[];
  r.forEach(x=>{
    if(String(x[9]||'Yes')==='No') return;
    const name=String(x[1]||'').trim();
    if(!name) return;
    all.push(name);
    const last=x[7]?new Date(x[7]).getTime():0;
    if(last && now-last<120000) online.push(name);
  });
  return {all:[...new Set(all)], online:[...new Set(online)]};
}

function cleanup_(){
  const s=sh_('Messages'),r=s.getDataRange().getValues(),now=Date.now();
  for(let i=r.length-1;i>=1;i--){
    const created=r[i][6];
    const exp=r[i][8];
    // Messages are deleted automatically 24 hours after creation.
    // If ExpiresAt is already set, it is also respected.
    const createdTime = created ? new Date(created).getTime() : 0;
    const expiryTime = exp ? new Date(exp).getTime() : 0;
    const limit = Number(getSetting_('MESSAGE_HOURS', CONFIG.MESSAGE_HOURS)) * 3600000;
    if((expiryTime && expiryTime <= now) || (createdTime && createdTime + limit <= now)){
      s.deleteRow(i+1);
    }
  }
  const fs=sh_('Files'),fr=fs.getDataRange().getValues();
  for(let i=fr.length-1;i>=1;i--){const exp=fr[i][7];if(exp&&new Date(exp).getTime()<=now){const fid=String(fr[i][5]||'');try{if(fid)DriveApp.getFileById(fid).setTrashed(true);}catch(e){}fs.deleteRow(i+1);}}
  const ms=sh_('Members'),mr=ms.getDataRange().getValues();
  for(let i=1;i<mr.length;i++){const last=mr[i][7]?new Date(mr[i][7]).getTime():0;if(last&&now-last>120000&&String(mr[i][8])==='Online')ms.getRange(i+1,9).setValue('Offline');}
  return json_({ok:true});
}

function getOrCreateDriveFolder_(){
  const props=PropertiesService.getScriptProperties(),key='CHATAPP_DRIVE_FOLDER_ID';let id=props.getProperty(key),f;
  if(id)try{f=DriveApp.getFolderById(id);}catch(e){}
  if(!f){const it=DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER);f=it.hasNext()?it.next():DriveApp.createFolder(CONFIG.DRIVE_FOLDER);props.setProperty(key,f.getId());}
  return f;
}
function getImgKey_(){
  // IMPORTANT: API key is intentionally read from the Google Sheet Settings sheet.
  const k=String(getSetting_('IMGBB_API_KEY','')).trim();
  if(!k) throw new Error('IMGBB_API_KEY is not configured in Settings sheet');
  return k;
}
function uploadPhoto_(p){
  const memberId=String(p.memberId||p.id||'').trim(), image=String(p.image||''); if(!image)return json_({error:'Image missing'});
  const res=UrlFetchApp.fetch('https://api.imgbb.com/1/upload?key='+encodeURIComponent(getImgKey_()),{method:'post',payload:{image:image},muteHttpExceptions:true});
  const d=JSON.parse(res.getContentText()); if(!d.success) return json_({error:'ImgBB upload failed'});
  const url=d.data.url, s=sh_('Members'),r=s.getDataRange().getValues();
  if(memberId){for(let i=1;i<r.length;i++)if(String(r[i][0])===memberId){s.getRange(i+1,5).setValue(url);break;}}
  return json_({ok:true,url:url});
}
function updatePhoto_(p){
  const id=String(p.id||p.memberId||''),photo=String(p.photo||'');if(!id||!photo)return json_({error:'Missing data'});
  const s=sh_('Members'),r=s.getDataRange().getValues();for(let i=1;i<r.length;i++)if(String(r[i][0])===id){s.getRange(i+1,5).setValue(photo);return json_({ok:true});}
  return json_({error:'Member not found'});
}
function uploadTempFile_(p){
  const b64=String(p.file||'').split(',').pop(),name=String(p.name||'file'),mime=String(p.mime||'application/octet-stream'),memberId=String(p.memberId||'');if(!b64)return json_({error:'File missing'});
  const bytes=Utilities.base64Decode(b64),blob=Utilities.newBlob(bytes,mime,name),folder=getOrCreateDriveFolder_(),file=folder.createFile(blob);file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  const d=now_(),exp=new Date(d.getTime()+Number(getSetting_('FILE_HOURS',24))*3600000),url='https://drive.google.com/uc?export=download&id='+file.getId();
  sh_('Files').appendRow([id_(),memberId,name,mime,url,file.getId(),d,exp,'No']);return json_({ok:true,url:url});
}

function sendOTP_(p){
  const id=String(p.memberId||'').trim(); if(!id)return json_({error:'Member ID required'});
  const r=rows_('Members'); let email='';
  for(const x of r)if(String(x[0])===id){email=String(x[2]||'');break;}
  if(!email)return json_({error:'Member not found'});
  const otp=String(Math.floor(100000+Math.random()*900000)); const d=now_(); const exp=new Date(d.getTime()+10*60000);
  sh_('OTP').appendRow([id,otp,d,exp,'No']);
  MailApp.sendEmail(email,'ChatApp Password Reset OTP','Your ChatApp OTP is: '+otp+'\n\nThis OTP expires in 10 minutes.');
  return json_({ok:true});
}
function verifyOTP_(p){
  const id=String(p.memberId||'').trim(),otp=String(p.otp||'').trim(),np=String(p.newpass||'');
  if(!id||!otp||!np)return json_({error:'Fill all fields'});
  const s=sh_('OTP'),r=s.getDataRange().getValues(),now=Date.now(); let idx=-1;
  for(let i=r.length-1;i>=1;i--)if(String(r[i][0])===id&&String(r[i][1])===otp&&String(r[i][4])!=='Yes'&&new Date(r[i][3]).getTime()>now){idx=i;break;}
  if(idx<0)return json_({error:'Invalid or expired OTP'});
  const m=sh_('Members'),mr=m.getDataRange().getValues(); let ok=false;
  for(let i=1;i<mr.length;i++)if(String(mr[i][0])===id){m.getRange(i+1,4).setValue(np);ok=true;break;}
  if(ok)s.getRange(idx+1,5).setValue('Yes');
  return ok?json_({ok:true}):json_({error:'Member not found'});
}
function changePass_(p){
  const id=String(p.id||''),oldp=String(p.oldpass||''),newp=String(p.newpass||'');const s=sh_('Members'),r=s.getDataRange().getValues();
  for(let i=1;i<r.length;i++)if(String(r[i][0])===id){if(String(r[i][3])!==oldp)return json_({error:'Current password wrong'});s.getRange(i+1,4).setValue(newp);return json_({ok:true});}return json_({error:'Member not found'});
}
function resetPass_(p){return json_({error:'Use the OTP reset form'});}
function getSystemStatus_(){const ss=getDatabase_();const out={ok:true,imgbbConfigured:!!String(getSetting_('IMGBB_API_KEY','')).trim(),sheets:{}};Object.keys(CONFIG.SHEETS).forEach(n=>out.sheets[n]=ss.getSheetByName(n)?ss.getSheetByName(n).getLastRow()-1:-1);return out;}


function firstTimeSetup(){
  const result = setupChatSystem();
  installCleanupTrigger();
  return result;
}

function installCleanupTrigger(){
  ScriptApp.getProjectTriggers().forEach(t=>{if(t.getHandlerFunction()==='cleanup_')ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger('cleanup_').timeBased().everyHours(1).create();
  return 'Hourly cleanup trigger installed';
}
