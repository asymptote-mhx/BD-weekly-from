(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PartnerCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const STAGES=['合作意向','合作中','合作成功','合作失败'];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function validate(data){
    if(data?.schema_version!==1||!Array.isArray(data.partners))throw Error('伙伴数据格式不受支持');
    const ids=new Set();
    for(const p of data.partners){
      if(!p.id||ids.has(p.id)||!Array.isArray(p.project_links))throw Error('伙伴编号重复或关联数据缺失');
      ids.add(p.id);const projects=new Set();
      for(const link of p.project_links){if(!link.project_id||projects.has(link.project_id)||(link.cooperation_stage!==undefined?!STAGES.includes(link.cooperation_stage):!Number.isInteger(link.stage)||link.stage<0||link.stage>3))throw Error('项目关联重复或阶段无效');projects.add(link.project_id);}
    }return data;
  }
  function stageFor(link){if(STAGES.includes(link.cooperation_stage))return link.cooperation_stage;if(link.stage===3)return '合作成功';if(link.stage===2)return '合作中';return '合作意向';}
  function counts(partner){return STAGES.map(stage=>new Set(partner.project_links.filter(l=>stageFor(l)===stage).map(l=>l.project_id)).size);}
  function projectCount(partner){return new Set(partner.project_links.map(l=>l.project_id)).size;}
  function forProject(data,id){return data.partners.flatMap(partner=>partner.project_links.filter(l=>l.project_id===id).map(link=>({partner,link})));}
  function upsertLink(data,partnerId,link){
    const copy=JSON.parse(JSON.stringify(data)),partner=copy.partners.find(p=>p.id===partnerId);
    if(!partner)throw Error('伙伴不存在');const i=partner.project_links.findIndex(l=>l.project_id===link.project_id);
    if(i<0)partner.project_links.push(link);else partner.project_links[i]={...partner.project_links[i],...link};
    copy.updated_at=new Date().toISOString();return validate(copy);
  }
  function href(page,params){const q=new URLSearchParams(params);return page+'?'+q.toString();}
  function informationStats(records){
    const facts=records.filter(r=>r.kind==='事实'&&r.verification_status==='已验证');
    const accuracy=facts.filter(r=>['准确','部分准确','不准确'].includes(r.accuracy));
    const timing=facts.filter(r=>typeof r.timely==='boolean'&&r.provided_at&&r.decision_deadline&&r.evidence);
    const sharing=records.filter(r=>['主动提供','询问后回复'].includes(r.sharing));
    return {accuracyTotal:accuracy.length,accurate:accuracy.filter(r=>r.accuracy==='准确').length,timingTotal:timing.length,timely:timing.filter(r=>r.timely).length,sharingTotal:sharing.length,proactive:sharing.filter(r=>r.sharing==='主动提供').length};
  }
  function boardRelations(board,partnerId){
    if(!board)return null;
    const nodes=board.nodes||[],edges=board.edges||[],starts=nodes.filter(n=>n.type==='合作方'&&(n.partner_id===partnerId||n.name===partnerId));
    if(!starts.length)return null;
    const results=new Map(),byId=new Map(nodes.map(n=>[n.id,n]));
    const visited=new Set(starts.map(n=>n.id));const queue=starts.map(n=>({node:n,path:[n.id],edges:[]}));
    while(queue.length){const item=queue.shift();for(const edge of edges){if(edge.kind==='决策链条')continue;const other=edge.from===item.node.id?edge.to:edge.to===item.node.id?edge.from:null;if(!other||item.path.includes(other))continue;const target=byId.get(other);if(!target)continue;const pathEdges=[...item.edges,edge],path=[...item.path,other];if(target.type==='合作方'){if(!visited.has(other)){visited.add(other);queue.push({node:target,path,edges:pathEdges});}continue;}
      const text=(target.name||'')+' '+(target.position||'');
      const level=/副区长|区长|区委书记|区书记/.test(text)?'区级政府领导':/副市长|市长|市委书记/.test(text)?'市级政府领导':['使用方','招标代理'].includes(target.type)?'实操平台':/政府|卫健|卫生|局|委|处/.test(text)||['主管部门','分管部门'].includes(target.type)?'政府职能部门':'实操平台';
      const record={from:partnerId,to:[target.name,target.person,target.position].filter(Boolean).join(' · '),level,category:level==='实操平台'?'其他机构':'政府',distance:pathEdges.length===1&&edge.distance!=='间接'?'直接':'间接',verification:pathEdges.every(e=>e.verification==='已验证')?'已验证':pathEdges.some(e=>e.verification==='存疑')?'存疑':'待验证',label:pathEdges.map(e=>e.evidence||e.label).filter(Boolean).join('；'),path:path.map(id=>byId.get(id)?.name).join(' → '),board_node_id:target.id};
      const previous=results.get(other);if(!previous||record.distance==='直接'&&previous.distance!=='直接')results.set(other,record);
    }}return [...results.values()];
  }
  return {boardRelations,STAGES,stageFor,projectCount,informationStats,esc,validate,counts,forProject,upsertLink,href};
});
