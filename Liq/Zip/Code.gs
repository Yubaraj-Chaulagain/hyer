const OWNER='Yubaraj-Chaulagain',REPO='Zip-Stroge',FOLDER='files';
function setup(){
 const ui=SpreadsheetApp.getUi();
 const t=ui.prompt('GitHub Token','Paste NEW fine-grained token:',ui.ButtonSet.OK_CANCEL);
 if(t.getSelectedButton()!=ui.Button.OK)return;
 const p=ui.prompt('Admin PIN','Set Admin PIN:',ui.ButtonSet.OK_CANCEL);
 if(p.getSelectedButton()!=ui.Button.OK)return;
 PropertiesService.getScriptProperties().setProperties({GITHUB_TOKEN:t.getResponseText().trim(),ADMIN_PIN:p.getResponseText().trim()});
 ui.alert('✅ Setup complete');
}
function doGet(){return HtmlService.createHtmlOutputFromFile('Index').setTitle('GitHub ZIP Storage').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)}
function auth(pin){if(pin!==PropertiesService.getScriptProperties().getProperty('ADMIN_PIN'))throw Error('गलत Admin PIN');}
function gh(m,path,body){
 const t=PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN'); if(!t)throw Error('setup() चलाउनुहोस्');
 const o={method:m,muteHttpExceptions:true,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+t,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'Zip-Stroge-GAS'}};
 if(body!==undefined){o.contentType='application/json';o.payload=JSON.stringify(body)}
 const r=UrlFetchApp.fetch('https://api.github.com/repos/'+OWNER+'/'+REPO+path,o),c=r.getResponseCode(),x=r.getContentText();
 let j={};try{j=JSON.parse(x)}catch(e){}
 if(c<200||c>=300)throw Error('GitHub '+c+': '+(j.message||x)); return j;
}
function nm(n){n=String(n||'').split('/').pop();if(!/^[A-Za-z0-9._-]+\.zip$/i.test(n))throw Error('Invalid ZIP filename');return n}
function listFiles(pin){
 auth(pin);try{let a=gh('get','/contents/'+FOLDER);return a.filter(x=>x.type==='file'&&/\.zip$/i.test(x.name)).map(x=>({name:x.name,path:x.path,size:x.size||0,sha:x.sha,download_url:x.download_url}))}catch(e){if(String(e).includes('GitHub 404'))return[];throw e}
}
function uploadZip(pin,name,b64){
 auth(pin);name=nm(name);try{gh('get','/contents/'+FOLDER+'/'+encodeURIComponent(name));throw Error('यो ZIP पहिले नै छ')}catch(e){if(!String(e).includes('GitHub 404'))throw e}
 gh('put','/contents/'+FOLDER+'/'+encodeURIComponent(name),{message:'Add '+name,content:b64});return'Upload सफल';
}
function updateZip(pin,oldPath,oldSha,name,b64){
 auth(pin);name=nm(name);let np=FOLDER+'/'+name;
 if(np===oldPath)gh('put','/contents/'+np,{message:'Update '+name,content:b64,sha:oldSha});
 else{let ex=null;try{ex=gh('get','/contents/'+np)}catch(e){if(!String(e).includes('GitHub 404'))throw e}
 let b={message:'Add '+name,content:b64};if(ex)b.sha=ex.sha;gh('put','/contents/'+np,b);gh('delete','/contents/'+oldPath,{message:'Delete old ZIP',sha:oldSha})}
 return'Update सफल';
}
function deleteZip(pin,path,sha){auth(pin);if(!path.startsWith(FOLDER+'/'))throw Error('Invalid path');gh('delete','/contents/'+path,{message:'Delete ZIP',sha:sha});return'Deleted'}
