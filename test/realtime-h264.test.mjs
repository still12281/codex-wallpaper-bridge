import assert from 'node:assert/strict';
import test from 'node:test';
import {createH264Reader} from '../src/realtime-h264.mjs';

function box(type,...parts){
 const payload=Buffer.concat(parts),header=Buffer.alloc(8);
 header.writeUInt32BE(8+payload.length);header.write(type,4,'ascii');
 return Buffer.concat([header,payload]);
}
function frame(ticks,nal){
 const time=Buffer.alloc(12);time[0]=1;time.writeBigUInt64BE(BigInt(ticks),4);
 const sample=Buffer.from([0,0,0,2,nal,1]);
 return Buffer.concat([box('moof',box('traf',box('tfdt',time))),box('mdat',sample)]);
}

test('hardware stream assembles partial boxes, retains AVC configuration and distinguishes keyframes',()=>{
 const avc=Buffer.from([1,0x4d,0x04,0x2a,0xff,0xe1]);
 const input=Buffer.concat([box('ftyp'),box('moov',box('avcC',avc)),frame(9000,0x65),frame(12000,0x41)]);
 const configs=[],frames=[],read=createH264Reader(config=>configs.push(config),value=>frames.push(value));
 for(let i=0;i<input.length;i+=7)read(input.subarray(i,i+7));
 assert.deepEqual(configs,[{codec:'avc1.4d042a',description:avc.toString('base64')}]);
 assert.deepEqual(frames.map(({timestamp,key})=>({timestamp,key})),[{timestamp:100000,key:true},{timestamp:133333,key:false}]);
 assert.deepEqual(Buffer.from(frames[0].data,'base64'),Buffer.from([0,0,0,2,0x65,1]));
});

test('hardware stream rejects unbounded or uninitialized packets',()=>{
 const read=createH264Reader(()=>{},()=>{});
 const invalid=Buffer.alloc(8);invalid.writeUInt32BE(8*1024*1024);
 assert.throws(()=>read(invalid),/封装尺寸/);
 assert.throws(()=>read(frame(9000,0x65)),/解码配置尚未/);
});
