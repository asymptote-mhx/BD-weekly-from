(function(){
'use strict';
const text=v=>String(v??'').trim();
function region(row){const explicit=text(row.province||row['省份']);const p=MarketPlatformSort.provinceOf({'省份':explicit,'地区':text(row.region||row['地区']||row.city)});return p.name==='待确认省份'?'地区待确认':p.name;}
function options(rows,selected=''){const groups=new Map();for(const row of rows){const key=row.region||'地区待确认';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}const rank=r=>r==='湖北'?0:r==='浙江'?1:r==='地区待确认'?3:2;return [...groups].sort(([a],[b])=>rank(a)-rank(b)||a.localeCompare(b,'zh-CN')).map(([group,items])=>`<optgroup label="${PartnerCore.esc(group)}">${items.map(p=>`<option value="${PartnerCore.esc(p.id)}" ${p.id===selected?'selected':''}>${PartnerCore.esc(p.name)}</option>`).join('')}</optgroup>`).join('');}
// Match the ledger's default project-progress ordering.
const stages=['需求获取','关键人接触','项目确认','资料收集','初步方案','方案确认','标前准备','投标中','定标阶段','建设期','建成','衔接下阶段招标'];
const progresses=['维护服务','招标流程','前期方案','项目接触'];
const aliases={'线索获取':'需求获取','需求确认':'项目确认','合同签署':'定标阶段'};
const index=(values,v)=>{const i=values.indexOf(v);return i<0?values.length:i;};
const stage=p=>{const s=text(p['当前细分阶段']);return aliases[s]||s;};
const stageRank=p=>{const i=stages.indexOf(stage(p));return i<0?stages.length:stages.length-1-i;};
const progressRank=p=>{const i=stages.indexOf(stage(p));return index(progresses,text(p['当前进度'])||(i<0?'':['项目接触','前期方案','招标流程','维护服务'][Math.floor(i/3)]));};
function compareProjects(a,b){return progressRank(a)-progressRank(b)||index(['S','A','B','C'],text(a['项目优先级']).toUpperCase())-index(['S','A','B','C'],text(b['项目优先级']).toUpperCase())||stageRank(a)-stageRank(b)||text(a['项目名称']).localeCompare(text(b['项目名称']),'zh-CN');}
window.PartnerSelections={region,options,compareProjects};
})();

