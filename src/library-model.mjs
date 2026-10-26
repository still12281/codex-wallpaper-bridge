// Pure and serializable: shared by the host and the embedded settings panel.
export function libraryGroups(entries,selectedId){
 const groups=[],byIdentity=new Map();
 for(const entry of entries){
  const identities=[];
  if(entry.workshopId)identities.push('workshop:'+entry.workshopId);
  if(entry.sourceKey)identities.push('source:'+entry.sourceKey);
  if(entry.projectRoot)identities.push('project:'+entry.projectRoot.replace(/\\/g,'/').replace(/\/$/,'').toLowerCase());
  if(!identities.length&&entry.contentHash)identities.push('hash:'+entry.contentHash);
  if(!identities.length)identities.push('entry:'+entry.id);
  const linked=[...new Set(identities.map(key=>byIdentity.get(key)).filter(Boolean))];let group=linked[0];
  if(!group){group={key:identities[0],entries:[]};groups.push(group);}
  for(const other of linked.slice(1)){group.entries.push(...other.entries);groups.splice(groups.indexOf(other),1);for(const [key,value]of byIdentity)if(value===other)byIdentity.set(key,group);}
  group.entries.push(entry);for(const key of identities)byIdentity.set(key,group);
 }
 return groups.map(group=>{const preferred=group.entries.find(e=>e.id===selectedId)||group.entries.find(e=>e.mode==='webwallgl')||group.entries.find(e=>e.mode==='realtime')||group.entries[0];return {...group,entry:preferred,id:preferred.id,name:String(preferred.name||'未命名壁纸').replace(/ · (?:视频层|WebGL|实时)$/,'')};});
}
