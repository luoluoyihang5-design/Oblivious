import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, patchPreferences, activeOpacity, windowSize, dockBounds, undockBounds, edgeAt } from '../src/model.mjs';
const area = {x:0,y:0,width:1707,height:1013};
test('old opacity migrates to both modes; mode values stay independent',()=>{
 let p=normalize({opacity:.65});assert.equal(p.orbOpacity,.65);assert.equal(p.petOpacity,.65);
 p=patchPreferences(p,{orbOpacity:.4});assert.equal(activeOpacity(p),.65);
 p=patchPreferences(p,{mode:'orb'});assert.equal(activeOpacity(p),.4);
 assert.equal(normalize(JSON.parse(JSON.stringify(p))).orbOpacity,.4);
});
test('left and right docking reveal half of the smaller icon',()=>{
 const p=normalize({mode:'orb'});const size=windowSize(p,'left');assert.equal(size.width,Math.ceil(size.height/2));assert.ok(size.height<p.orbSize);
 assert.equal(dockBounds({x:0,y:250},p,area,'left').x,0);
 const right=dockBounds({x:1700,y:250},p,area,'right');assert.equal(right.x+right.width,area.width);
});
test('negative-coordinate secondary monitor docking stays inside that monitor',()=>{
 const a={x:-1920,y:-220,width:1920,height:1080};const p=normalize({mode:'orb',dockEdge:'right'});
 const b=dockBounds({x:-10,y:2000},p,a);assert.equal(b.x+b.width,0);assert.equal(b.y+b.height,860);
});
test('drag detaches with cursor inside restored full-sized window',()=>{
 const p=normalize({mode:'orb',dockEdge:'right'});const b=dockBounds({x:1700,y:300},p,area);
 const c={x:b.x+10,y:320};const u=undockBounds(b,p,c);
 assert.deepEqual({width:u.width,height:u.height},windowSize(p,null));assert.ok(c.x>u.x&&c.x<u.x+u.width);assert.ok(c.y>u.y&&c.y<u.y+u.height);
});
test('snap threshold only docks when enabled and near a horizontal edge',()=>{
 assert.equal(edgeAt({x:1500,y:0,width:92,height:92},area),null);
 assert.equal(edgeAt({x:17,y:300,width:92,height:92},area),'left');
 assert.equal(edgeAt({x:1610,y:300,width:92,height:92},area),'right');
 assert.equal(edgeAt({x:0,y:0,width:92,height:92},area,false),null);
});
test('turning off snap removes persisted dock state',()=>{
 assert.equal(patchPreferences(normalize({dockEdge:'left'}),{snapToEdge:false}).dockEdge,null);
});
test('pet edge art preserves aspect and custom imports retain their own size',()=>{
 const p=normalize({mode:'pet',dockEdge:'left'}), size=windowSize(p);assert.ok(Math.abs(size.width/size.height-287/341)<.01);
 assert.deepEqual(windowSize({...p,customPet:true}),windowSize(p,null));
});
test('settings validation clamps opacity and rejects malformed/untrusted patches',()=>{
 assert.equal(normalize({orbOpacity:0}).orbOpacity,.2);assert.equal(normalize({petOpacity:10}).petOpacity,1);
 assert.throws(()=>patchPreferences(normalize(),{dockEdge:'left'}));assert.throws(()=>patchPreferences(normalize(),{orbOpacity:NaN}));
 assert.equal(normalize({breathing:false}).breathing,false);
});

test('dragging partially beyond a screen boundary still docks',()=>{
 assert.equal(edgeAt({x:1571,y:396,width:196,height:228},area),'right');
 assert.equal(edgeAt({x:-80,y:200,width:196,height:228},area),'left');
});
