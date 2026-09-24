/**
 * FAR FACE ATTENDANCE PRO - 20 GATE + LEAVE/HOLIDAY + MONTHLY REPORT
 * Replace the old Face2.gs with this file.
 * Web App: Execute as Me / Who has access: Anyone
 * After saving, UPDATE the existing Web App deployment.
 */

const EMPLOYEE_SHEET = 'Employees';
const ATTENDANCE_SHEET = 'Attendance';
const LEAVE_SHEET = 'Leave';
const HOLIDAY_SHEET = 'Holidays';
const DAILY_SHEET = 'Daily Status';
const MONTHLY_SHEET = 'Monthly Summary';
const COMPANY_MONTHLY_SHEET = 'Company Monthly';
const EMAIL_LOG_SHEET = 'Email Log';
const STANDARD_DAILY_HOURS = 8;

function doGet(e) {
  try {
    const p = (e && e.parameter) ? e.parameter : {};
    const action = p.action || '';
    let result;
    if (action === 'employees') result = {success:true, employees:getEmployees()};
    else if (action === 'saveEmployee') result = saveEmployee(parsePayload(p.data));
    else if (action === 'attendance') result = saveAttendance(parsePayload(p.data));
    else if (action === 'attendanceToday') { const d=parsePayload(p.data); result={success:true,attendance:getAttendanceToday(d.date||'')}; }
    else if (action === 'deleteEmployee') result = deleteEmployee(parsePayload(p.data).id);
    else if (action === 'saveLeave') result = saveLeave(parsePayload(p.data));
    else if (action === 'leaves') { const d=parsePayload(p.data); result={success:true,leaves:getLeaves(d.date||'',d.month||'')}; }
    else if (action === 'deleteLeave') result = deleteLeave(parsePayload(p.data).id);
    else if (action === 'saveHoliday') result = saveHoliday(parsePayload(p.data));
    else if (action === 'holidays') { const d=parsePayload(p.data); result={success:true,holidays:getHolidays(d.month||'')}; }
    else if (action === 'deleteHoliday') result = deleteHoliday(parsePayload(p.data).id);
    else if (action === 'monthlySummary') { const d=parsePayload(p.data); result=getMonthlySummary(d.month||monthKey_(new Date())); }
    else if (action === 'companyMonthly') { const d=parsePayload(p.data); result=getCompanyMonthlySummary(d.month||monthKey_(new Date())); }
    else if (action === 'runDailyAttendance') result = {success:true, result:finalizeAttendanceUpToNow()};
    else if (action === 'sendMonthEndReports') result = sendMonthEndReports(true);
    else if (action === 'installTriggers') result = installAutomationTriggers();
    else result={success:true,message:'FAR Face Attendance Pro API is working.',actions:['employees','saveEmployee','attendance','attendanceToday','deleteEmployee','saveLeave','leaves','deleteLeave','saveHoliday','holidays','deleteHoliday','monthlySummary','companyMonthly','runDailyAttendance','sendMonthEndReports','installTriggers']};
    return output(result,p.callback||'');
  } catch(err) { return output({success:false,error:String(err)},e&&e.parameter?e.parameter.callback:''); }
}

function doPost(e) {
  try {
    const data=e&&e.postData&&e.postData.contents?JSON.parse(e.postData.contents):{};
    const action=data.action||''; const d=data.data||data; let result;
    if(['employee','registerEmployee','saveEmployee'].indexOf(action)>=0) result=saveEmployee(d);
    else if(action==='attendance') result=saveAttendance(d);
    else if(action==='attendanceToday') result={success:true,attendance:getAttendanceToday(d.date||'')};
    else if(action==='deleteEmployee') result=deleteEmployee(d.id);
    else if(action==='saveLeave') result=saveLeave(d);
    else if(action==='leaves') result={success:true,leaves:getLeaves(d.date||'',d.month||'')};
    else if(action==='deleteLeave') result=deleteLeave(d.id);
    else if(action==='saveHoliday') result=saveHoliday(d);
    else if(action==='holidays') result={success:true,holidays:getHolidays(d.month||'')};
    else if(action==='deleteHoliday') result=deleteHoliday(d.id);
    else if(action==='monthlySummary') result=getMonthlySummary(d.month||monthKey_(new Date()));
    else if(action==='companyMonthly') result=getCompanyMonthlySummary(d.month||monthKey_(new Date()));
    else if(action==='runDailyAttendance') result={success:true,result:finalizeAttendanceUpToNow()};
    else if(action==='sendMonthEndReports') result=sendMonthEndReports(true);
    else if(action==='installTriggers') result=installAutomationTriggers();
    else result={success:false,error:'Unknown action: '+action};
    return output(result,'');
  } catch(err){ return output({success:false,error:String(err)},''); }
}

function parsePayload(value){ if(!value)return {}; try{return JSON.parse(value);}catch(err){throw new Error('Invalid request data: '+err.message);} }
function output(data,callback){
  const json=JSON.stringify(data);
  if(callback){ const safe=String(callback).replace(/[^a-zA-Z0-9_$]/g,''); return ContentService.createTextOutput(safe+'('+json+');').setMimeType(ContentService.MimeType.JAVASCRIPT); }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function saveEmployee(data){
  const sheet=getEmployeeSheet(); const id=String(data.id||'').trim();
  if(!id)return {success:false,error:'Employee ID is required.'};
  const row=[id,String(data.name||'').trim(),String(data.trade||'').trim(),String(data.company||'').trim(),String(data.department||'').trim(),String(data.nationality||'').trim(),String(data.phone||'').trim(),String(data.site||'').trim(),String(data.joiningDate||'').trim(),String(data.photo||data.photoUrl||'').trim(),String(data.faceDescriptor||'').trim(),String(data.email||'').trim(),String(data.registeredAt||new Date().toISOString())];
  const last=sheet.getLastRow();
  if(last>=2){ const ids=sheet.getRange(2,1,last-1,1).getDisplayValues(); for(let i=0;i<ids.length;i++) if(String(ids[i][0]).trim().toLowerCase()===id.toLowerCase()){const tr=i+2; sheet.getRange(tr,1,1,row.length).setValues([row]); return {success:true,action:'updated',row:tr,employee:employeeObject(row)};} }
  sheet.appendRow(row); return {success:true,action:'created',row:sheet.getLastRow(),employee:employeeObject(row)};
}
function getEmployees(){
  const s=getEmployeeSheet(),last=s.getLastRow(); if(last<2)return [];
  const values=s.getRange(2,1,last-1,13).getValues(); return values.filter(r=>String(r[0]||'').trim()).map(employeeObject);
}
function employeeObject(r){return {id:String(r[0]||''),name:String(r[1]||''),trade:String(r[2]||''),company:String(r[3]||''),department:String(r[4]||''),nationality:String(r[5]||''),phone:String(r[6]||''),site:String(r[7]||''),joiningDate:formatDateValue(r[8]),photo:String(r[9]||''),faceDescriptor:String(r[10]||''),email:String(r[11]||''),registeredAt:String(r[12]||'')};}

function saveAttendance(data){
  const lock=LockService.getScriptLock();
  try{
    lock.waitLock(15000); const s=getAttendanceSheet(); const date=String(data.date||'').trim(),id=String(data.id||'').trim(),type=String(data.type||'').trim().toUpperCase(),gate=String(data.gate||'').trim();
    if(!date||!id||!type)return {success:false,error:'Attendance requires date, Employee ID and Type.'};
    if(type!=='ENTRY'&&type!=='OUT')return {success:false,error:'Invalid attendance type: '+type};
    const dup=findAttendance_(date,id,type); if(dup)return {success:true,duplicate:true,saved:false,message:'Already scanned: '+id+' - '+type+' on '+date,row:dup.row};
    const row=[date,String(data.time||''),id,String(data.name||''),String(data.status||''),String(data.photo||''),String(data.trade||''),String(data.company||''),String(data.department||''),String(data.nationality||''),String(data.phone||''),String(data.site||''),String(data.joiningDate||''),String(data.matchDistance||''),type,gate,new Date()];
    s.appendRow(row); SpreadsheetApp.flush(); return {success:true,saved:true,duplicate:false,row:s.getLastRow(),id:id,type:type,gate:gate,message:'Attendance saved successfully.'};
  }catch(err){return {success:false,saved:false,error:'Attendance save error: '+err.message};}finally{try{lock.releaseLock();}catch(e){}}
}
function getAttendanceToday(date){
  const s=getAttendanceSheet(),last=s.getLastRow(); if(last<2)return []; const vals=s.getRange(2,1,last-1,17).getValues(),out=[];
  vals.forEach(r=>{const rd=normalizeSheetDate_(r[0]); if(String(rd)!==String(date)||!String(r[2]||'').trim())return; out.push({date:rd,time:formatTimeValue_(r[1]),id:String(r[2]||''),name:String(r[3]||''),status:String(r[4]||''),photo:String(r[5]||''),trade:String(r[6]||''),company:String(r[7]||''),department:String(r[8]||''),nationality:String(r[9]||''),phone:String(r[10]||''),site:String(r[11]||''),joiningDate:formatDateValue(r[12]),matchDistance:r[13]===''?'':Number(r[13]),type:String(r[14]||'').toUpperCase(),gate:String(r[15]||''),savedAt:r[16]?String(r[16]):''});}); return out;
}
function findAttendance_(date,id,type){
  const s=getAttendanceSheet(),last=s.getLastRow(); if(last<2)return null; const vals=s.getRange(2,1,last-1,17).getValues();
  for(let i=0;i<vals.length;i++){const r=vals[i];if(String(normalizeSheetDate_(r[0]))===String(date)&&String(r[2]||'').trim().toLowerCase()===String(id).toLowerCase()&&String(r[14]||'').toUpperCase()===String(type).toUpperCase())return {row:i+2};} return null;
}
function deleteEmployee(id){
  const s=getEmployeeSheet(),last=s.getLastRow(); if(last<2)return {success:false,error:'No employees found.'}; const ids=s.getRange(2,1,last-1,1).getDisplayValues();
  for(let i=0;i<ids.length;i++)if(String(ids[i][0]).trim().toLowerCase()===String(id||'').trim().toLowerCase()){s.deleteRow(i+2);return {success:true,message:'Employee deleted successfully.'};} return {success:false,error:'Employee ID not found.'};
}

function saveLeave(data){
  const id=String(data.employeeId||data.id||'').trim(),date=String(data.date||'').trim(); if(!id||!date)return {success:false,error:'Employee ID and leave date are required.'};
  const emp=getEmployees().find(e=>String(e.id).toLowerCase()===id.toLowerCase()); if(!emp)return {success:false,error:'Employee not found.'};
  const s=getLeaveSheet(),rid=String(data.recordId||data.idRecord||Utilities.getUuid()),type=String(data.leaveType||'Sick Leave').trim(),hours=Number(data.hours||STANDARD_DAILY_HOURS),reason=String(data.reason||'').trim(),approved=String(data.approved||'YES').toUpperCase()==='YES';
  const row=[rid,date,emp.id,emp.name,emp.company,type,hours,reason,approved?'YES':'NO',new Date()];
  const last=s.getLastRow(); if(last>=2){const ids=s.getRange(2,1,last-1,1).getDisplayValues();for(let i=0;i<ids.length;i++)if(ids[i][0]===rid){s.getRange(i+2,1,row.length).setValues([row]);return {success:true,action:'updated',record:leaveObject(row)};}}
  s.appendRow(row); return {success:true,action:'created',record:leaveObject(row)};
}
function getLeaves(date,month){
  const s=getLeaveSheet(),last=s.getLastRow();if(last<2)return [];const vals=s.getRange(2,1,last-1,10).getValues();
  return vals.filter(r=>{const d=normalizeSheetDate_(r[1]);return (!date||d===date)&&(!month||d.slice(0,7)===month);}).map(leaveObject);
}
function leaveObject(r){return {recordId:String(r[0]||''),date:normalizeSheetDate_(r[1]),employeeId:String(r[2]||''),employeeName:String(r[3]||''),company:String(r[4]||''),leaveType:String(r[5]||''),hours:Number(r[6]||0),reason:String(r[7]||''),approved:String(r[8]||'').toUpperCase()==='YES',createdAt:String(r[9]||'')};}
function deleteLeave(id){return deleteById_(LEAVE_SHEET,1,id,'Leave record not found.');}

function saveHoliday(data){
  const date=String(data.date||'').trim(),name=String(data.name||data.holidayName||'').trim();if(!date||!name)return {success:false,error:'Holiday date and name are required.'};
  const s=getHolidaySheet(),rid=String(data.recordId||Utilities.getUuid()),row=[rid,date,name,String(data.governmentHoliday||'YES').toUpperCase()==='YES'?'YES':'NO',new Date()];
  const last=s.getLastRow();if(last>=2){const ids=s.getRange(2,1,last-1,1).getDisplayValues();for(let i=0;i<ids.length;i++)if(ids[i][0]===rid){s.getRange(i+2,1,row.length).setValues([row]);return {success:true,action:'updated',record:holidayObject(row)};}}
  s.appendRow(row);return {success:true,action:'created',record:holidayObject(row)};
}
function getHolidays(month){const s=getHolidaySheet(),last=s.getLastRow();if(last<2)return [];const vals=s.getRange(2,1,last-1,5).getValues();return vals.filter(r=>!month||normalizeSheetDate_(r[1]).slice(0,7)===month).map(holidayObject);}
function holidayObject(r){return {recordId:String(r[0]||''),date:normalizeSheetDate_(r[1]),name:String(r[2]||''),governmentHoliday:String(r[3]||'').toUpperCase()==='YES',createdAt:String(r[4]||'')};}
function deleteHoliday(id){return deleteById_(HOLIDAY_SHEET,1,id,'Holiday record not found.');}
function deleteById_(sheetName,col,id,msg){const s=SpreadsheetApp.getActive().getSheetByName(sheetName);if(!s||s.getLastRow()<2)return {success:false,error:msg};const vals=s.getRange(2,col,s.getLastRow()-1,1).getDisplayValues();for(let i=0;i<vals.length;i++)if(vals[i][0]===String(id)){s.deleteRow(i+2);return {success:true};}return {success:false,error:msg};}

function finalizeAttendanceUpToNow(){
  const lock=LockService.getScriptLock();try{lock.waitLock(20000);const now=new Date(),tz=Session.getScriptTimeZone();let cursor=new Date(now.getTime()-24*60*60*1000);const endKey=Utilities.formatDate(cursor,tz,'yyyy-MM-dd');const employees=getEmployees(),daily=getDailySheet();let count=0;
    employees.forEach(emp=>{if(!emp.joiningDate||emp.joiningDate>endKey)return;const existing=findDaily_(endKey,emp.id);if(existing)return;const status=calculateDayStatus_(emp,endKey);writeDaily_(daily,status);count++;});SpreadsheetApp.flush();return {date:endKey,created:count};
  }finally{try{lock.releaseLock();}catch(e){}}
}
function calculateDayStatus_(emp,date){
  const holiday=getHolidays('').find(h=>h.date===date&&h.governmentHoliday);
  const leave=getLeaves(date,'').filter(x=>String(x.employeeId).toLowerCase()===String(emp.id).toLowerCase()&&x.approved).sort((a,b)=>b.hours-a.hours)[0];
  const logs=getAttendanceForEmployeeDate_(emp.id,date);const worked=calculateWorkedHours_(logs);
  if(holiday){return {date,employeeId:emp.id,name:emp.name,company:emp.company,status:worked>0?'Holiday Worked':'Holiday',hours:worked,leaveHours:0,holidayExtraHours:worked>0?STANDARD_DAILY_HOURS:0,holidayName:holiday.name,leaveType:'',reason:'',finalizedAt:new Date()};}
  if(leave){return {date,employeeId:emp.id,name:emp.name,company:emp.company,status:'Leave',hours:0,leaveHours:Number(leave.hours||STANDARD_DAILY_HOURS),holidayExtraHours:0,holidayName:'',leaveType:leave.leaveType,reason:leave.reason,finalizedAt:new Date()};}
  if(worked>0){return {date,employeeId:emp.id,name:emp.name,company:emp.company,status:'Present',hours:worked,leaveHours:0,holidayExtraHours:0,holidayName:'',leaveType:'',reason:'',finalizedAt:new Date()};}
  return {date,employeeId:emp.id,name:emp.name,company:emp.company,status:'Absent',hours:0,leaveHours:0,holidayExtraHours:0,holidayName:'',leaveType:'',reason:'',finalizedAt:new Date()};
}
function getAttendanceForEmployeeDate_(id,date){const s=getAttendanceSheet(),last=s.getLastRow();if(last<2)return [];const vals=s.getRange(2,1,last-1,17).getValues();return vals.filter(r=>normalizeSheetDate_(r[0])===date&&String(r[2]||'').toLowerCase()===String(id).toLowerCase()).map(r=>({date:date,time:formatTimeValue_(r[1]),type:String(r[14]||'').toUpperCase()}));}
function calculateWorkedHours_(logs){
  if(!logs.length)return 0;const entries=logs.filter(x=>x.type==='ENTRY').map(x=>timeMinutes_(x.time)).filter(x=>x>=0).sort((a,b)=>a-b),outs=logs.filter(x=>x.type==='OUT').map(x=>timeMinutes_(x.time)).filter(x=>x>=0).sort((a,b)=>a-b);if(!entries.length||!outs.length)return 0;let total=0,used=0;entries.forEach(en=>{const out=outs.find(o=>o>en);if(out!==undefined){total+=out-en;outs.splice(outs.indexOf(out),1);used++;}});return Math.round((total/60)*100)/100;
}
function timeMinutes_(t){const m=String(t||'').match(/(\d{1,2}):(\d{2})/);if(!m)return -1;return Number(m[1])*60+Number(m[2]);}

function getMonthlySummary(month){
  ensureDailyMonth_(month);const s=getMonthlySheet();const emps=getEmployees();const daily=getDailyForMonth_(month);const rows=[];
  emps.forEach(e=>{const a=daily.filter(x=>String(x.employeeId).toLowerCase()===String(e.id).toLowerCase());const working=a.filter(x=>x.status==='Present'||x.status==='Holiday Worked').length,leave=a.filter(x=>x.status==='Leave').length,holiday=a.filter(x=>x.status==='Holiday'||x.status==='Holiday Worked').length,absent=a.filter(x=>x.status==='Absent').length,worked=a.reduce((n,x)=>n+Number(x.hours||0),0),leaveHours=a.reduce((n,x)=>n+Number(x.leaveHours||0),0),extra=a.reduce((n,x)=>n+Number(x.holidayExtraHours||0),0),total=worked+leaveHours+extra;rows.push({month,employeeId:e.id,name:e.name,company:e.company,workingDays:working,leaveDays:leave,holidayDays:holiday,absentDays:absent,workingHours:round2_(worked),leaveHours:round2_(leaveHours),holidayExtraHours:round2_(extra),totalHours:round2_(total),email:e.email||''});});
  writeMonthlyRows_(rows);return {success:true,month,rows};
}
function getCompanyMonthlySummary(month){const r=getMonthlySummary(month);const map={};r.rows.forEach(x=>{const c=x.company||'No Company';if(!map[c])map[c]={month,company:c,employees:0,workingDays:0,leaveDays:0,holidayDays:0,absentDays:0,workingHours:0,leaveHours:0,holidayExtraHours:0,totalHours:0};const o=map[c];o.employees++;['workingDays','leaveDays','holidayDays','absentDays','workingHours','leaveHours','holidayExtraHours','totalHours'].forEach(k=>o[k]+=Number(x[k]||0));});const rows=Object.values(map).map(x=>{['workingHours','leaveHours','holidayExtraHours','totalHours'].forEach(k=>x[k]=round2_(x[k]));return x;});writeCompanyRows_(rows);return {success:true,month,rows};}
function ensureDailyMonth_(month){const parts=month.split('-').map(Number);if(parts.length!==2)return;const first=new Date(parts[0],parts[1]-1,1);const today=new Date();const last=new Date(parts[0],parts[1],0);let end=last;if(parts[0]===today.getFullYear()&&parts[1]===today.getMonth()+1)end=new Date(Math.min(today.getTime()-24*60*60*1000,last.getTime()));if(end<first)return;const s=getDailySheet(),emps=getEmployees();for(let d=new Date(first);d<=end;d.setDate(d.getDate()+1)){const key=Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM-dd');emps.forEach(e=>{if(e.joiningDate&&e.joiningDate<=key&&!findDaily_(key,e.id)){writeDaily_(s,calculateDayStatus_(e,key));}});}}
function getDailyForMonth_(month){const s=getDailySheet(),last=s.getLastRow();if(last<2)return [];const vals=s.getRange(2,1,last-1,14).getValues();return vals.filter(r=>String(r[0]).slice(0,7)===month).map(dailyObject);}
function dailyObject(r){return {date:normalizeSheetDate_(r[0]),employeeId:String(r[1]||''),name:String(r[2]||''),company:String(r[3]||''),status:String(r[4]||''),hours:Number(r[5]||0),leaveHours:Number(r[6]||0),holidayExtraHours:Number(r[7]||0),leaveType:String(r[8]||''),holidayName:String(r[9]||''),reason:String(r[10]||''),finalizedAt:String(r[11]||''),shift:String(r[12]||''),note:String(r[13]||'')};}
function findDaily_(date,id){const s=getDailySheet(),last=s.getLastRow();if(last<2)return null;const vals=s.getRange(2,1,last-1,2).getDisplayValues();for(let i=0;i<vals.length;i++)if(vals[i][0]===date&&vals[i][1].toLowerCase()===String(id).toLowerCase())return {row:i+2};return null;}
function writeDaily_(s,o){s.appendRow([o.date,o.employeeId,o.name,o.company,o.status,o.hours,o.leaveHours,o.holidayExtraHours,o.leaveType,o.holidayName,o.reason,o.finalizedAt,'','']);}
function writeMonthlyRows_(rows){const s=getMonthlySheet();const last=s.getLastRow();if(last>=2)s.getRange(2,1,last-1,13).clearContent();if(rows.length)s.getRange(2,1,rows.length,13).setValues(rows.map(x=>[x.month,x.employeeId,x.name,x.company,x.workingDays,x.leaveDays,x.holidayDays,x.absentDays,x.workingHours,x.leaveHours,x.holidayExtraHours,x.totalHours,x.email]));}
function writeCompanyRows_(rows){const s=getCompanyMonthlySheet();const last=s.getLastRow();if(last>=2)s.getRange(2,1,last-1,10).clearContent();if(rows.length)s.getRange(2,1,rows.length,11).setValues(rows.map(x=>[x.month,x.company,x.employees,x.workingDays,x.leaveDays,x.holidayDays,x.absentDays,x.workingHours,x.leaveHours,x.holidayExtraHours,x.totalHours]));}

function sendMonthEndReports(force){
  const now=new Date(),tz=Session.getScriptTimeZone();if(!force&&!isLastDay_(now))return {success:true,sent:0,message:'Not the last day of the month.'};
  const month=Utilities.formatDate(now,tz,'yyyy-MM'),summary=getMonthlySummary(month),emps=getEmployees(),log=getEmailLogSheet();let sent=0,skipped=0,failed=0;
  summary.rows.forEach(r=>{if(!r.email){skipped++;return;}if(emailAlreadySent_(log,month,r.employeeId)){skipped++;return;}try{const subject=monthName_(month)+' Attendance Report - '+r.name;const body='Dear '+r.name+',\n\nMonthly Attendance Report\nMonth: '+monthName_(month)+'\nEmployee ID: '+r.employeeId+'\nCompany: '+(r.company||'-')+'\n\nWorking Days: '+r.workingDays+'\nLeave Days: '+r.leaveDays+'\nGovernment Holiday Days: '+r.holidayDays+'\nAbsent Days: '+r.absentDays+'\nWorking Hours: '+r.workingHours+'\nLeave Hours: '+r.leaveHours+'\nHoliday Extra Hours: '+r.holidayExtraHours+'\nTotal Hours: '+r.totalHours+'\n\nNote: Leave is credited at 8 hours by default. Government-holiday work receives 8 extra hours. The last-day status may be provisional if the 24-hour finalization window has not completed.\n\nRegards,\nFAR Face Attendance Pro';const html='<h2>FAR Face Attendance Pro</h2><p><b>Monthly Attendance Report</b></p><p>Month: '+esc_(monthName_(month))+'<br>Employee ID: '+esc_(r.employeeId)+'<br>Company: '+esc_(r.company||'-')+'</p><table border="1" cellpadding="6" cellspacing="0"><tr><td>Working Days</td><td>'+r.workingDays+'</td></tr><tr><td>Leave Days</td><td>'+r.leaveDays+'</td></tr><tr><td>Government Holiday Days</td><td>'+r.holidayDays+'</td></tr><tr><td>Absent Days</td><td>'+r.absentDays+'</td></tr><tr><td>Working Hours</td><td>'+r.workingHours+'</td></tr><tr><td>Leave Hours</td><td>'+r.leaveHours+'</td></tr><tr><td>Holiday Extra Hours</td><td>'+r.holidayExtraHours+'</td></tr><tr><td><b>Total Hours</b></td><td><b>'+r.totalHours+'</b></td></tr></table><p>Leave = 8 hours by default. Government-holiday work = 8 extra hours. Last-day status may be provisional.</p>';MailApp.sendEmail({to:r.email,subject:subject,body:body,htmlBody:html});log.appendRow([month,r.employeeId,r.email,new Date(),'SENT','']);sent++;}catch(e){log.appendRow([month,r.employeeId,r.email,new Date(),'FAILED',String(e)]);failed++;}});return {success:true,month,sent,skipped,failed};
}
function emailAlreadySent_(s,month,id){const last=s.getLastRow();if(last<2)return false;const vals=s.getRange(2,1,last-1,2).getDisplayValues();return vals.some(r=>r[0]===month&&String(r[1]).toLowerCase()===String(id).toLowerCase());}
function installAutomationTriggers(){
  const handlers=['runAttendanceAutomation','sendMonthEndReportsTrigger'];ScriptApp.getProjectTriggers().forEach(t=>{if(handlers.indexOf(t.getHandlerFunction())>=0)ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger('runAttendanceAutomation').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('sendMonthEndReportsTrigger').timeBased().everyDays(1).atHour(23).create();
  return {success:true,message:'Automatic hourly attendance and daily month-end email triggers installed.'};
}
function runAttendanceAutomation(){try{finalizeAttendanceUpToNow();}catch(e){console.error(e);}}
function sendMonthEndReportsTrigger(){try{sendMonthEndReports(false);}catch(e){console.error(e);}}

function getEmployeeSheet(){const ss=SpreadsheetApp.getActiveSpreadsheet();let s=ss.getSheetByName(EMPLOYEE_SHEET);if(!s)s=ss.insertSheet(EMPLOYEE_SHEET);const h=['Employee ID','Full Name','Trade','Company','Department','Nationality','Phone / WhatsApp','Site / Project','Joining Date','Photo URL','Face Descriptor','Email','Registered At'];s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);return s;}
function getAttendanceSheet(){const ss=SpreadsheetApp.getActiveSpreadsheet();let s=ss.getSheetByName(ATTENDANCE_SHEET);if(!s)s=ss.insertSheet(ATTENDANCE_SHEET);const h=['Date','Time','Employee ID','Name','Status','Photo URL','Trade','Company','Department','Nationality','Phone','Site','Joining Date','Face Match Distance','Type','Gate','Saved At'];s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);return s;}
function getLeaveSheet(){const ss=SpreadsheetApp.getActiveSpreadsheet();let s=ss.getSheetByName(LEAVE_SHEET);if(!s)s=ss.insertSheet(LEAVE_SHEET);const h=['Record ID','Date','Employee ID','Employee Name','Company','Leave Type','Hours','Reason','Approved','Created At'];s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);return s;}
function getHolidaySheet(){const ss=SpreadsheetApp.getActiveSpreadsheet();let s=ss.getSheetByName(HOLIDAY_SHEET);if(!s)s=ss.insertSheet(HOLIDAY_SHEET);const h=['Record ID','Date','Holiday Name','Government Holiday','Created At'];s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);return s;}
function getDailySheet(){const ss=SpreadsheetApp.getActiveSpreadsheet();let s=ss.getSheetByName(DAILY_SHEET);if(!s)s=ss.insertSheet(DAILY_SHEET);const h=['Date','Employee ID','Name','Company','Status','Working Hours','Leave Hours','Holiday Extra Hours','Leave Type','Holiday Name','Reason','Finalized At','Shift','Note'];s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);return s;}
function getMonthlySheet(){const ss=SpreadsheetApp.getActiveSpreadsheet();let s=ss.getSheetByName(MONTHLY_SHEET);if(!s)s=ss.insertSheet(MONTHLY_SHEET);const h=['Month','Employee ID','Name','Company','Working Days','Leave Days','Holiday Days','Absent Days','Working Hours','Leave Hours','Holiday Extra Hours','Total Hours','Email'];s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);return s;}
function getCompanyMonthlySheet(){const ss=SpreadsheetApp.getActiveSpreadsheet();let s=ss.getSheetByName(COMPANY_MONTHLY_SHEET);if(!s)s=ss.insertSheet(COMPANY_MONTHLY_SHEET);const h=['Month','Company','Employees','Working Days','Leave Days','Holiday Days','Absent Days','Working Hours','Leave Hours','Holiday Extra Hours','Total Hours'];s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);return s;}
function getEmailLogSheet(){const ss=SpreadsheetApp.getActiveSpreadsheet();let s=ss.getSheetByName(EMAIL_LOG_SHEET);if(!s)s=ss.insertSheet(EMAIL_LOG_SHEET);const h=['Month','Employee ID','Email','Sent At','Status','Error'];s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);return s;}
function normalizeSheetDate_(v){if(!v)return '';if(Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v))return Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy-MM-dd');return String(v).trim().slice(0,10);}
function formatDateValue(v){return normalizeSheetDate_(v);}
function formatTimeValue_(v){if(!v)return '';if(Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v))return Utilities.formatDate(v,Session.getScriptTimeZone(),'HH:mm:ss');return String(v);}
function monthKey_(d){return Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM');}
function monthName_(m){const p=m.split('-');return Utilities.formatDate(new Date(Number(p[0]),Number(p[1])-1,1),Session.getScriptTimeZone(),'MMMM yyyy');}
function isLastDay_(d){const n=new Date(d);n.setDate(n.getDate()+1);return n.getMonth()!==d.getMonth();}
function round2_(n){return Math.round(Number(n||0)*100)/100;}
function esc_(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];});}
