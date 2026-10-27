import {parseUserPropDefs} from '../vendor/dsh-wallpaper/we-props.js';
import {weCondParse,weCondTokenize} from '../vendor/dsh-wallpaper/we-cond.js';
import {createProjectReader} from './webwallgl-source.mjs';
const editable=new Set(['bool','color','slider','combo']);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function propertyDefinitions(project,overrides={}){
 const raw=project.general?.properties||{};
 // Adapt the upstream parser's documented editable:false difference in memory;
 // hidden defaults are still supplied to scripts and condition evaluation.
 const properties=Object.fromEntries(Object.entries(raw).map(([name,def])=>[name,def&&typeof def==='object'?{...def,editable:true}:def]));
 const defs=parseUserPropDefs({...project,general:{...project.general,properties}},overrides).map(def=>({...def,hidden:raw[def.name]?.editable===false,editable:raw[def.name]?.editable!==false&&editable.has(def.ptype)}));
 const values=Object.fromEntries(Object.entries(raw).filter(([,def])=>def&&Object.hasOwn(def,'value')&&!['text','group'].includes(def.type)).map(([name,def])=>[name,structuredClone(Object.hasOwn(overrides,name)&&def.editable!==false?overrides[name]:def.value)]));
 for(const def of defs){def.visible=!def.hidden;if(def.condition&&def.condition.length<=512)try{def.visible=def.visible&&!!weCondParse(weCondTokenize(def.condition))(values);}catch{}if(def.options)def.options=def.options.filter(option=>{if(!option.condition||option.condition.length>512)return true;try{return !!weCondParse(weCondTokenize(option.condition))(values);}catch{return true;}});}
 return {definitions:defs,values};
}
export function validatePropertyPatch(project,patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).length>200)throw Error('壁纸属性无效');
 const {definitions}=propertyDefinitions(project),result=Object.create(null);
 for(const [name,value]of Object.entries(patch)){
  const def=definitions.find(d=>d.name===name);if(!def?.editable||['__proto__','constructor','prototype'].includes(name))throw Error('此壁纸属性不可编辑：'+name);
  let valid=false;
  if(def.ptype==='bool')valid=typeof value==='boolean';
  if(def.ptype==='slider')valid=typeof value==='number'&&Number.isFinite(value)&&(def.min===undefined||value>=def.min)&&(def.max===undefined||value<=def.max);
  if(def.ptype==='color'){const parts=typeof value==='string'?value.trim().split(/\s+/).map(Number):[];valid=parts.length===3&&parts.every(n=>Number.isFinite(n)&&n>=0&&n<=1);}
  if(def.ptype==='combo')valid=project.general?.properties?.[name]?.options?.some(option=>same(option.value,value));
  if(!valid)throw Error('壁纸属性类型或范围无效：'+name);result[name]=structuredClone(value);
 }
 return result;
}
export function effectivePropertyValues(project,overrides={}){
 const safe=Object.create(null);for(const [key,value]of Object.entries(overrides))try{Object.assign(safe,validatePropertyPatch(project,{[key]:value}));}catch{}
 return propertyDefinitions(project,safe).values;
}
export async function readWallpaperProperties(entry){
 if(!entry?.projectRoot)throw Error('当前壁纸没有完整项目引用');const reader=await createProjectReader(entry.projectRoot);return {project:reader.project,...propertyDefinitions(reader.project,entry.userProperties||{})};
}
