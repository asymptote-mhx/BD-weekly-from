(function(){
  'use strict';
  const body=document.getElementById('detailBody');if(!body)return;
  let index=null,error='',pending=null,loadedAt=0;
  const esc=PartnerCore.esc;
  function projectId(){return typeof state!=='undefined'?state.selectedProjectId:new URLSearchParams(location.search).get('project');}
  function render(){const id=projectId();if(!id)return;let panel=document.getElementById('partnerLedgerPanel');if(!panel){panel=document.createElement('section');panel.id='partnerLedgerPanel';panel.className='partner-bridge';body.append(panel);}
    const fingerprint=id+'|'+loadedAt+'|'+error+'|'+Boolean(pending);if(panel.dataset.view===fingerprint)return;panel.dataset.view=fingerprint;
    const rows=index?PartnerCore.forProject(index,id):[];
    panel.innerHTML=`<header><h3>合作伙伴关系</h3><a href="${esc(PartnerCore.href('partners.html',{project:id}))}">关系图 / 对比 / 关联 ↗</a></header>${error?`<p>${esc(error)}</p>`:index?rows.length?`<div class="partner-bridge-links">${rows.map(({partner:p,link:l})=>`<a href="${esc(PartnerCore.href('partners.html',{partner:p.id}))}">${esc(p.name)} · ${esc(l.status)}</a>`).join('')}</div>`:'<p>暂无伙伴关联，可进入伙伴页面建立。</p>':'<p>正在读取伙伴关联…</p>'}<p><button type="button" data-refresh-partners>刷新伙伴关联</button></p>`;
  }
  async function load(force=false){if(pending)return pending;if(!force&&Date.now()-loadedAt<30000){render();return;}error='';pending=Promise.resolve();render();pending=(async()=>{try{const config=PartnerAPI.settings();const input=document.getElementById('githubTokenInput');if(input?.value.trim())config.token=input.value.trim();index=(await PartnerAPI.readIndex(config)).data;error='';}catch(e){index=null;error='伙伴关联未读取：'+e.message;}finally{loadedAt=Date.now();pending=null;render();}})();return pending;}
  const observer=new MutationObserver(()=>{if(!projectId())return;if(!document.getElementById('partnerLedgerPanel')){render();load();}});observer.observe(body,{childList:true});
  body.addEventListener('click',e=>{if(e.target.closest('[data-refresh-partners]'))load(true);});
  document.getElementById('loadLedgerButton')?.addEventListener('click',()=>load(true));
  if(projectId())load();
})();
