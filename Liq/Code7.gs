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
    else if (action === 'setupAttendanceSystem') result = setupAttendanceSystem();
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
    else if(action==='setupAttendanceSystem') result=setupAttendanceSystem();
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
  // Daily Status is a SMALL temporary sheet. Only the latest fully completed
  // day (yesterday) is kept. Monthly history is calculated directly from
  // Attendance + Leave + Holidays, so Daily Status never grows month after month.
  const lock=LockService.getScriptLock();
  try{
    lock.waitLock(20000);
    const now=new Date(),tz=Session.getScriptTimeZone();
    const cursor=new Date(now.getTime()-24*60*60*1000);
    const endKey=Utilities.formatDate(cursor,tz,'yyyy-MM-dd');
    const employees=getEmployees();
    const daily=getDailySheet();

    // Remove previous temporary data and keep only yesterday.
    clearDailyStatus_();

    let count=0;
    employees.forEach(emp=>{
      if(!emp.joiningDate || emp.joiningDate>endKey) return;
      writeDaily_(daily,calculateDayStatus_(emp,endKey));
      count++;
    });
    SpreadsheetApp.flush();
    return {date:endKey,created:count,keptDays:1,message:'Daily Status keeps only the latest finalized day. Monthly history is stored in Monthly Summary.'};
  }finally{try{lock.releaseLock();}catch(e){}}
}

function clearDailyStatus_(){
  const s=getDailySheet(),last=s.getLastRow();
  if(last>=2) s.getRange(2,1,last-1,14).clearContent();
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

function getReportEndDate_(year,mon,tz){
  const today=new Date();
  const todayYear=Number(Utilities.formatDate(today,tz,'yyyy'));
  const todayMonth=Number(Utilities.formatDate(today,tz,'MM'));
  const lastDay=new Date(year,mon,0);
  // Current month: calculate only through today.
  // Previous month: calculate the complete month.
  if(year===todayYear && mon===todayMonth){
    return new Date(todayYear,todayMonth-1,today.getDate());
  }
  return lastDay;
}

function getMonthlySummary(month){
  // SINGLE SOURCE OF TRUTH for the monthly report.
  // The email summary and PDF summary must use exactly these rules:
  // 1) Sunday = weekly holiday; never Absent/Working Day.
  // 2) Government Holiday = holiday; work on it gets 8 extra hours.
  // 3) Approved Leave = Leave Hours; Sunday/Government Holiday keeps holiday status.
  // 4) Normal Working Day requires a valid ENTRY + later OUT pair.
  // 5) No complete pair on an eligible date = Absent, but only through the report end date.
  // 6) Current month is calculated only through today; past months use the full month.

  const parts=String(month||'').split('-').map(Number);
  if(parts.length!==2 || !parts[0] || !parts[1]) {
    return {success:false,error:'Invalid month. Use YYYY-MM.'};
  }

  const year=parts[0],mon=parts[1];
  const tz=Session.getScriptTimeZone();
  const first=new Date(year,mon-1,1);
  const end=getReportEndDate_(year,mon,tz);

  if(end<first){
    const empty=[];
    writeMonthlyRows_(empty);
    return {success:true,month,rows:empty};
  }

  const endKey=Utilities.formatDate(end,tz,'yyyy-MM-dd');
  const emps=getEmployees();
  const attendanceMap=buildAttendanceMap_(first,end);
  const leaveMap=buildApprovedLeaveMap_(first,end);
  const holidayMap=buildGovernmentHolidayMap_(first,end);
  const rows=[];

  emps.forEach(e=>{
    let working=0,leave=0,holiday=0,absent=0;
    let workedHours=0,leaveHours=0,extra=0;
    const join=String(e.joiningDate||'');

    for(let d=new Date(first);d<=end;d.setDate(d.getDate()+1)){
      const date=Utilities.formatDate(d,tz,'yyyy-MM-dd');
      if(join && join>date) continue;

      const h=holidayMap[date];
      const l=leaveMap[date+'|'+String(e.id).toLowerCase()];
      const logs=attendanceMap[date+'|'+String(e.id).toLowerCase()]||[];
      const paired=hasEntryOutPair_(logs);
      const worked=paired ? calculateWorkedHours_(logs) : 0;
      const sunday=d.getDay()===0;

      // Weekly Sunday holiday has priority.
      if(sunday){
        if(paired){
          workedHours+=worked;
          extra+=STANDARD_DAILY_HOURS;
        }
        continue;
      }

      // Government holiday has priority over leave/presence.
      if(h){
        holiday++;
        if(paired){
          workedHours+=worked;
          extra+=STANDARD_DAILY_HOURS;
        }
        continue;
      }

      // Approved leave on a normal working day.
      if(l){
        leave++;
        leaveHours+=Number(l.hours||STANDARD_DAILY_HOURS);
        continue;
      }

      // Normal working day requires ENTRY + OUT.
      if(paired){
        working++;
        workedHours+=worked;
      }else{
        absent++;
      }
    }

    const total=workedHours+leaveHours+extra;
    rows.push({
      month,
      employeeId:e.id,
      name:e.name,
      company:e.company,
      workingDays:working,
      leaveDays:leave,
      holidayDays:holiday,
      absentDays:absent,
      workingHours:round2_(workedHours),
      leaveHours:round2_(leaveHours),
      holidayExtraHours:round2_(extra),
      totalHours:round2_(total),
      email:e.email||''
    });
  });

  writeMonthlyRows_(rows);
  return {success:true,month,reportEnd:endKey,rows};
}

function hasEntryOutPair_(logs){
  const entries=(logs||[])
    .filter(x=>String(x.type||'').toUpperCase()==='ENTRY')
    .map(x=>timeMinutes_(x.time))
    .filter(x=>x>=0)
    .sort((a,b)=>a-b);

  const outs=(logs||[])
    .filter(x=>String(x.type||'').toUpperCase()==='OUT')
    .map(x=>timeMinutes_(x.time))
    .filter(x=>x>=0)
    .sort((a,b)=>a-b);

  let oi=0;
  for(const en of entries){
    while(oi<outs.length && outs[oi]<=en) oi++;
    if(oi<outs.length) return true;
  }
  return false;
}

function buildAttendanceMap_(first,end){
  const s=getAttendanceSheet(),last=s.getLastRow(),map={};
  if(last<2)return map;
  const vals=s.getRange(2,1,last-1,17).getValues();
  vals.forEach(r=>{
    const date=normalizeSheetDate_(r[0]);
    if(!date)return;
    const d=new Date(date+'T00:00:00');
    if(isNaN(d)||d<first||d>end)return;
    const id=String(r[2]||'').trim().toLowerCase();
    const type=String(r[14]||'').trim().toUpperCase();
    if(!id || (type!=='ENTRY' && type!=='OUT'))return;
    const key=date+'|'+id;
    if(!map[key])map[key]=[];
    map[key].push({date,time:formatTimeValue_(r[1]),type});
  });
  return map;
}

function buildApprovedLeaveMap_(first,end){
  const s=getLeaveSheet(),last=s.getLastRow(),map={};
  if(last<2)return map;
  const vals=s.getRange(2,1,last-1,10).getValues();
  vals.forEach(r=>{
    const date=normalizeSheetDate_(r[1]);
    if(!date)return;
    const d=new Date(date+'T00:00:00');
    if(isNaN(d)||d<first||d>end)return;
    if(String(r[8]||'').toUpperCase()!=='YES')return;
    const id=String(r[2]||'').trim().toLowerCase();
    if(!id)return;
    const key=date+'|'+id;
    const item={leaveType:String(r[5]||''),hours:Number(r[6]||STANDARD_DAILY_HOURS),reason:String(r[7]||'')};
    if(!map[key] || item.hours>map[key].hours)map[key]=item;
  });
  return map;
}

function buildGovernmentHolidayMap_(first,end){
  const s=getHolidaySheet(),last=s.getLastRow(),map={};
  if(last<2)return map;
  const vals=s.getRange(2,1,last-1,5).getValues();
  vals.forEach(r=>{
    const date=normalizeSheetDate_(r[1]);
    if(!date)return;
    const d=new Date(date+'T00:00:00');
    if(isNaN(d)||d<first||d>end)return;
    if(String(r[3]||'').toUpperCase()!=='YES')return;
    map[date]={name:String(r[2]||'')};
  });
  return map;
}
function getCompanyMonthlySummary(month){const r=getMonthlySummary(month);const map={};r.rows.forEach(x=>{const c=x.company||'No Company';if(!map[c])map[c]={month,company:c,employees:0,workingDays:0,leaveDays:0,holidayDays:0,absentDays:0,workingHours:0,leaveHours:0,holidayExtraHours:0,totalHours:0};const o=map[c];o.employees++;['workingDays','leaveDays','holidayDays','absentDays','workingHours','leaveHours','holidayExtraHours','totalHours'].forEach(k=>o[k]+=Number(x[k]||0));});const rows=Object.values(map).map(x=>{['workingHours','leaveHours','holidayExtraHours','totalHours'].forEach(k=>x[k]=round2_(x[k]));return x;});writeCompanyRows_(rows);return {success:true,month,rows};}
function ensureDailyMonth_(month){
  // Kept only for backward compatibility with older calls.
  // Monthly summaries no longer populate Daily Status.
  return;
}
function getDailyForMonth_(month){const s=getDailySheet(),last=s.getLastRow();if(last<2)return [];const vals=s.getRange(2,1,last-1,14).getValues();return vals.filter(r=>String(r[0]).slice(0,7)===month).map(dailyObject);}
function dailyObject(r){return {date:normalizeSheetDate_(r[0]),employeeId:String(r[1]||''),name:String(r[2]||''),company:String(r[3]||''),status:String(r[4]||''),hours:Number(r[5]||0),leaveHours:Number(r[6]||0),holidayExtraHours:Number(r[7]||0),leaveType:String(r[8]||''),holidayName:String(r[9]||''),reason:String(r[10]||''),finalizedAt:String(r[11]||''),shift:String(r[12]||''),note:String(r[13]||'')};}
function findDaily_(date,id){const s=getDailySheet(),last=s.getLastRow();if(last<2)return null;const vals=s.getRange(2,1,last-1,2).getDisplayValues();for(let i=0;i<vals.length;i++)if(vals[i][0]===date&&vals[i][1].toLowerCase()===String(id).toLowerCase())return {row:i+2};return null;}
function writeDaily_(s,o){s.appendRow([o.date,o.employeeId,o.name,o.company,o.status,o.hours,o.leaveHours,o.holidayExtraHours,o.leaveType,o.holidayName,o.reason,o.finalizedAt,'','']);}
function writeMonthlyRows_(rows){const s=getMonthlySheet();const last=s.getLastRow();if(last>=2)s.getRange(2,1,last-1,13).clearContent();if(rows.length)s.getRange(2,1,rows.length,13).setValues(rows.map(x=>[x.month,x.employeeId,x.name,x.company,x.workingDays,x.leaveDays,x.holidayDays,x.absentDays,x.workingHours,x.leaveHours,x.holidayExtraHours,x.totalHours,x.email]));}
function writeCompanyRows_(rows){const s=getCompanyMonthlySheet();const last=s.getLastRow();if(last>=2)s.getRange(2,1,last-1,11).clearContent();if(rows.length)s.getRange(2,1,rows.length,11).setValues(rows.map(x=>[x.month,x.company,x.employees,x.workingDays,x.leaveDays,x.holidayDays,x.absentDays,x.workingHours,x.leaveHours,x.holidayExtraHours,x.totalHours]));}

function sendMonthEndReports(force){
  const now=new Date(),tz=Session.getScriptTimeZone();
  if(!force&&!isLastDay_(now)) return {success:true,sent:0,message:'Not the last day of the month.'};

  const month=Utilities.formatDate(now,tz,'yyyy-MM');
  const summary=getMonthlySummary(month);
  const log=getEmailLogSheet();
  let sent=0,skipped=0,failed=0;

  summary.rows.forEach(r=>{
    if(!r.email){skipped++;return;}
    if(emailAlreadySent_(log,month,r.employeeId)){skipped++;return;}

    try{
      const subject=monthName_(month)+' Attendance Report - '+r.name;
      const body='Dear '+r.name+',\n\n'+
        'Monthly Attendance Report\n'+
        'Month: '+monthName_(month)+'\n'+
        'Employee ID: '+r.employeeId+'\n'+
        'Company: '+(r.company||'-')+'\n\n'+
        'Working Days: '+r.workingDays+'\n'+
        'Leave Days: '+r.leaveDays+'\n'+
        'Government Holiday Days: '+r.holidayDays+'\n'+
        'Absent Days: '+r.absentDays+'\n'+
        'Working Hours: '+r.workingHours+'\n'+
        'Leave Hours: '+r.leaveHours+'\n'+
        'Holiday Extra Hours: '+r.holidayExtraHours+'\n'+
        'Total Hours: '+r.totalHours+'\n\n'+
        'Detailed monthly Time Sheet is attached as PDF.\n'+
        'Leave is credited at 8 hours by default. Government-holiday work receives 8 extra hours.\n\n'+
        'Regards,\nFAR Face Attendance Pro';

      const html='<h2>FAR Face Attendance Pro</h2>'+
        '<p><b>Monthly Attendance Report</b></p>'+
        '<p>Month: '+esc_(monthName_(month))+'<br>'+
        'Employee ID: '+esc_(r.employeeId)+'<br>'+
        'Company: '+esc_(r.company||'-')+'</p>'+
        '<table border="1" cellpadding="6" cellspacing="0">'+
        '<tr><td>Working Days</td><td>'+r.workingDays+'</td></tr>'+
        '<tr><td>Leave Days</td><td>'+r.leaveDays+'</td></tr>'+
        '<tr><td>Government Holiday Days</td><td>'+r.holidayDays+'</td></tr>'+
        '<tr><td>Absent Days</td><td>'+r.absentDays+'</td></tr>'+
        '<tr><td>Working Hours</td><td>'+r.workingHours+'</td></tr>'+
        '<tr><td>Leave Hours</td><td>'+r.leaveHours+'</td></tr>'+
        '<tr><td>Holiday Extra Hours</td><td>'+r.holidayExtraHours+'</td></tr>'+
        '<tr><td><b>Total Hours</b></td><td><b>'+r.totalHours+'</b></td></tr>'+
        '</table><p>Detailed monthly Time Sheet is attached as PDF.</p>';

      const pdf=createEmployeeTimeSheetPdf_(r.employeeId,month,r.name);

      MailApp.sendEmail({
        to:r.email,
        subject:subject,
        body:body,
        htmlBody:html,
        attachments:[pdf]
      });

      log.appendRow([month,r.employeeId,r.email,new Date(),'SENT','']);
      sent++;
    }catch(e){
      log.appendRow([month,r.employeeId,r.email,new Date(),'FAILED',String(e)]);
      failed++;
    }
  });

  return {success:true,month,sent,skipped,failed};
}
function createEmployeeTimeSheetPdf_(employeeId, month, employeeName){
  const parts=String(month||'').split('-').map(Number);
  if(parts.length!==2||!parts[0]||!parts[1]) throw new Error('Invalid month: '+month);

  const year=parts[0],mon=parts[1];
  const tz=Session.getScriptTimeZone();
  const first=new Date(year,mon-1,1);
  const end=getReportEndDate_(year,mon,tz);
  const attendanceMap=buildAttendanceMap_(first,end);
  const leaveMap=buildApprovedLeaveMap_(first,end);
  const holidayMap=buildGovernmentHolidayMap_(first,end);

  // Use the exact same monthly calculation as the email/Monthly Summary.
  const summary=getMonthlySummary(month);
  const summaryRow=(summary.rows||[]).find(x=>String(x.employeeId).toLowerCase()===String(employeeId).toLowerCase()) || {
    workingDays:0,leaveDays:0,holidayDays:0,absentDays:0,
    workingHours:0,leaveHours:0,holidayExtraHours:0,totalHours:0
  };

  let rowsHtml='';

  for(let d=new Date(first);d<=end;d.setDate(d.getDate()+1)){
    const date=Utilities.formatDate(d,tz,'yyyy-MM-dd');
    const dayName=Utilities.formatDate(d,tz,'EEE');
    const key=date+'|'+String(employeeId).toLowerCase();
    const logs=attendanceMap[key]||[];
    const paired=hasEntryOutPair_(logs);
    const worked=paired ? calculateWorkedHours_(logs) : 0;
    const entries=logs.filter(x=>x.type==='ENTRY').map(x=>x.time).sort();
    const outs=logs.filter(x=>x.type==='OUT').map(x=>x.time).sort();
    const h=holidayMap[date];
    const l=leaveMap[key];
    const sunday=d.getDay()===0;

    let status='',hours=0,extra=0,note='';

    // Same priority/rules as getMonthlySummary().
    if(sunday){
      status=paired?'Sunday Worked':'Sunday';
      hours=worked;
      if(paired) extra=STANDARD_DAILY_HOURS;
      note='Weekly Holiday';
    }else if(h){
      status=paired?'Holiday Worked':'Holiday';
      hours=worked;
      if(paired) extra=STANDARD_DAILY_HOURS;
      note=h.name||'Government Holiday';
    }else if(l){
      status='Leave';
      hours=0;
      note=l.leaveType||'Approved Leave';
    }else if(paired){
      status='Present';
      hours=worked;
    }else{
      status='Absent';
    }

    rowsHtml+='<tr>'+
      '<td>'+esc_(date)+'</td>'+
      '<td>'+esc_(dayName)+'</td>'+
      '<td>'+esc_(status)+'</td>'+
      '<td>'+esc_(entries[0]||'')+'</td>'+
      '<td>'+esc_(outs[outs.length-1]||'')+'</td>'+
      '<td>'+round2_(hours)+'</td>'+
      '<td>'+round2_(extra)+'</td>'+
      '<td>'+esc_(note)+'</td>'+
      '</tr>';
  }

  const html='<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'+
    'body{font-family:Arial,sans-serif;font-size:10px;color:#222;margin:24px}'+
    'h1{font-size:20px;margin:0 0 6px}h2{font-size:13px;margin:18px 0 6px}'+
    'table{border-collapse:collapse;width:100%;margin-top:8px}'+
    'th,td{border:1px solid #777;padding:5px;text-align:left}'+
    'th{font-weight:bold;background:#eee}'+
    '.summary td:first-child{font-weight:bold;width:55%}'+
    '.meta{margin-bottom:12px}'+
    '</style></head><body>'+
    '<h1>Monthly Attendance Time Sheet</h1>'+
    '<div class="meta"><b>Month:</b> '+esc_(monthName_(month))+'<br>'+
    '<b>Report up to:</b> '+esc_(Utilities.formatDate(end,tz,'yyyy-MM-dd'))+'<br>'+
    '<b>Employee ID:</b> '+esc_(employeeId)+'<br>'+
    '<b>Employee Name:</b> '+esc_(employeeName||'')+'</div>'+
    '<table class="summary"><tr><td>Working Days</td><td>'+summaryRow.workingDays+'</td></tr>'+
    '<tr><td>Leave Days</td><td>'+summaryRow.leaveDays+'</td></tr>'+
    '<tr><td>Government Holiday Days</td><td>'+summaryRow.holidayDays+'</td></tr>'+
    '<tr><td>Absent Days</td><td>'+summaryRow.absentDays+'</td></tr>'+
    '<tr><td>Working Hours</td><td>'+summaryRow.workingHours+'</td></tr>'+
    '<tr><td>Leave Hours</td><td>'+summaryRow.leaveHours+'</td></tr>'+
    '<tr><td>Holiday Extra Hours</td><td>'+summaryRow.holidayExtraHours+'</td></tr>'+
    '<tr><td>Total Hours</td><td><b>'+summaryRow.totalHours+'</b></td></tr></table>'+
    '<h2>Daily Time Sheet</h2>'+
    '<table><tr><th>Date</th><th>Day</th><th>Status</th><th>ENTRY</th><th>OUT</th><th>Hours</th><th>Extra</th><th>Remarks</th></tr>'+rowsHtml+'</table>'+
    '<p style="margin-top:14px">Leave = 8 hours by default. Sunday and government-holiday work = 8 extra hours. Current month is reported through today; future dates are not counted.</p>'+
    '</body></html>';

  return HtmlService.createHtmlOutput(html).getBlob()
    .setName(employeeId+'_'+month+'_Time_Sheet.pdf')
    .getAs(MimeType.PDF);
}

function emailAlreadySent_(s,month,id){const last=s.getLastRow();if(last<2)return false;const vals=s.getRange(2,1,last-1,2).getDisplayValues();return vals.some(r=>r[0]===month&&String(r[1]).toLowerCase()===String(id).toLowerCase());}
function setupAttendanceSystem(){
  // Run this ONCE after replacing Face2.gs. It creates/updates all required
  // sheets and installs the automatic triggers.
  getEmployeeSheet();
  getAttendanceSheet();
  getLeaveSheet();
  getHolidaySheet();
  getDailySheet();
  getMonthlySheet();
  getCompanyMonthlySheet();
  getEmailLogSheet();
  const triggers=installAutomationTriggers();
  return {success:true,message:'System setup complete. Daily Status keeps only the latest finalized day; Monthly Summary uses one shared monthly calculation for email and PDF.',triggers:triggers};
}

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
