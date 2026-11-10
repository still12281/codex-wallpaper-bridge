import test from 'node:test';
import assert from 'node:assert/strict';
import {managedSurfaceTargets} from '../src/automatic-surfaces.mjs';

test('ownership follows trusted roots and complete parent chains, not hostnames or browser partitions',()=>{
 const inventory=[
  {targetId:'shell',type:'page',url:'app://-/index.html',browserContextId:'a'},
  {targetId:'notion',type:'iframe',parentId:'guest',url:'https://new-provider.example/'},
  {targetId:'guest',type:'webview',parentId:'shell',url:'https://new-sandbox.example/',browserContextId:'b'},
  {targetId:'ordinary',type:'page',url:'https://new-provider.example/',browserContextId:'a'},
  {targetId:'wallpaper',type:'iframe',parentId:'shell',url:'blob:app://-/wallpaper'},
  {targetId:'wallpaper-child',type:'iframe',parentId:'wallpaper',url:'https://example.com/'},
  {targetId:'orphan',type:'webview',url:'https://chatgpt.com/'},
  {targetId:'worker',type:'worker',parentId:'shell',url:'app://-/worker.js'}
 ];
 assert.deepEqual(managedSurfaceTargets(inventory,'app://-/index.html').map(t=>[t.targetId,t.shell]),[['shell',true],['notion',false],['guest',false]]);
});

test('new detached shells are roots; an unrelated app page is not',()=>{
 assert.deepEqual(managedSurfaceTargets([
  {targetId:'detached',type:'page',url:'app://-/detached-window.html?view=1'},
  {targetId:'other',type:'page',url:'app://-/unrelated.html'},
 ],'app://-/index.html').map(t=>t.targetId),['detached']);
});
