(function(root){
  'use strict';
  const INDEX='partners/index.json';
  function settings(){let common={},own={};try{common=JSON.parse(localStorage.getItem('bd-weekly-github-settings')||'{}');own=JSON.parse(localStorage.getItem('bd-partner-settings')||'{}');}catch(_){}
    return {owner:own.owner||common.owner||'asymptote-mhx',repo:own.repo||'BD-Partner',branch:own.branch||'main',token:common.token||'',ledgerOwner:common.owner||'asymptote-mhx',ledgerRepo:common.repo||'BD-weekly-data',ledgerBranch:common.branch||'main'};
  }
  async function request(config,path,options={}){
    if(!config.token)throw Error('请在资料连接设置中填写可访问 BD-Partner 和 BD-weekly-data 的 GitHub Token');if(config.token==='local-preview-no-credential'&&!globalThis.PARTNER_LOCAL_PREVIEW)throw Error('当前是本地预览占位凭据，请在资料连接设置中填写正式 GitHub Token');
    const url='https://api.github.com/repos/'+encodeURIComponent(config.owner)+'/'+encodeURIComponent(config.repo)+'/contents/'+path.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(config.branch);
    const response=await fetch(url,{cache:'no-store',...options,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+config.token,'Content-Type':'application/json',...(options.headers||{})}});
    if(!response.ok){
      const repo=config.owner+'/'+config.repo;
      if(response.status===409||response.status===422)throw Error('保存冲突：档案已被另一端修改，请刷新后重试');
      if(response.status===401)throw Error('Token 无效、已过期或已撤销（401）。请在资料连接设置中更换有效 Token。');
      if(response.status===403||response.status===429){
        let reason='';try{reason=(await response.json()).message||'';}catch(_){}
        if(response.headers.get('x-ratelimit-remaining')==='0'){const reset=Number(response.headers.get('x-ratelimit-reset'));throw Error('GitHub 请求额度已用完（'+response.status+'）'+(reset?'，预计 '+new Date(reset*1000).toLocaleString('zh-CN')+' 恢复':'，请稍后再试'));}
        if(/rate limit|abuse/i.test(reason)||response.status===429)throw Error('GitHub 暂时限制请求频率，请稍后重试（'+response.status+'）');
        throw Error('Token 无权访问 '+repo+'（403）。请确认该仓库已授权，并具有 Contents 读取权限；保存还需要写入权限。组织仓库可能还需审批或 SSO 授权。');
      }
      if(response.status===404)throw Error('无法读取 '+repo+'：文件不存在或 Token 未获该私有仓库授权（404）。请检查仓库、分支和授权范围。');
      throw Error('GitHub 请求失败（'+response.status+'）');
    }
    return response.json();
  }
  async function read(config,path){const r=await request(config,path);if(r.encoding!=='base64'||typeof r.content!=='string')throw Error('无法读取文件正文');const bytes=Uint8Array.from(atob(r.content.replace(/\s/g,'')),c=>c.charCodeAt(0));return {text:new TextDecoder().decode(bytes),sha:r.sha};}
  async function readIndex(config){const r=await read(config,INDEX);return {data:PartnerCore.validate(JSON.parse(r.text)),sha:r.sha};}
  async function saveIndex(config,data,sha){PartnerCore.validate(data);const bytes=new TextEncoder().encode(JSON.stringify(data,null,2)+'\n');let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);const r=await request(config,INDEX,{method:'PUT',body:JSON.stringify({message:'更新伙伴与项目关联',branch:config.branch,sha,content:btoa(binary)})});return {sha:r.content.sha,commit:r.commit.sha};}
  async function sourceVersions(config){const rows=await request(config,'');if(!Array.isArray(rows))throw Error('无法读取档案目录');return Object.fromEntries(rows.filter(r=>r.type==='file').map(r=>[r.path,r.sha]));}
  root.PartnerAPI={settings,read,readIndex,saveIndex,sourceVersions};
})(globalThis);
