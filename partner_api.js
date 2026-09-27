(function(root){
  'use strict';
  const INDEX='partners/index.json';
  function settings(){let common={},own={};try{common=JSON.parse(localStorage.getItem('bd-weekly-github-settings')||'{}');own=JSON.parse(localStorage.getItem('bd-partner-settings')||'{}');}catch(_){}
    return {owner:own.owner||common.owner||'asymptote-mhx',repo:own.repo||'BD-Partner',branch:own.branch||'main',token:common.token||'',ledgerOwner:common.owner||'asymptote-mhx',ledgerRepo:common.repo||'BD-weekly-data',ledgerBranch:common.branch||'main'};
  }
  async function request(config,path,options={}){
    if(!config.token)throw Error('请填写可访问伙伴仓库的 GitHub Token');
    const url='https://api.github.com/repos/'+encodeURIComponent(config.owner)+'/'+encodeURIComponent(config.repo)+'/contents/'+path.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(config.branch);
    const response=await fetch(url,{cache:'no-store',...options,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+config.token,'Content-Type':'application/json',...(options.headers||{})}});
    if(!response.ok){if(response.status===409||response.status===422)throw Error('保存冲突：档案已被另一端修改，请刷新后重新关联');if(response.status===404)throw Error('未找到资料或无访问权限，请检查仓库及 Token 授权');if(response.status===401||response.status===403)throw Error('GitHub 拒绝访问，请检查 Token 权限或请求额度');throw Error('GitHub 请求失败（'+response.status+'）');}
    return response.json();
  }
  async function read(config,path){const r=await request(config,path);if(r.encoding!=='base64'||typeof r.content!=='string')throw Error('无法读取文件正文');const bytes=Uint8Array.from(atob(r.content.replace(/\s/g,'')),c=>c.charCodeAt(0));return {text:new TextDecoder().decode(bytes),sha:r.sha};}
  async function readIndex(config){const r=await read(config,INDEX);return {data:PartnerCore.validate(JSON.parse(r.text)),sha:r.sha};}
  async function saveIndex(config,data,sha){PartnerCore.validate(data);const bytes=new TextEncoder().encode(JSON.stringify(data,null,2)+'\n');let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);const r=await request(config,INDEX,{method:'PUT',body:JSON.stringify({message:'更新伙伴与项目关联',branch:config.branch,sha,content:btoa(binary)})});return {sha:r.content.sha,commit:r.commit.sha};}
  async function sourceVersions(config){const rows=await request(config,'');if(!Array.isArray(rows))throw Error('无法读取档案目录');return Object.fromEntries(rows.filter(r=>r.type==='file').map(r=>[r.path,r.sha]));}
  root.PartnerAPI={settings,read,readIndex,saveIndex,sourceVersions};
})(globalThis);
