import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {inspectReviewedImage,pngCrc} from '../tools/release-images.mjs';
const file='docs/images/01-overview.png';
function chunk(type,data){const name=Buffer.from(type),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(pngCrc(Buffer.concat([name,data])),out.length-4);return out}
function image(extra=[]){const header=Buffer.alloc(13);header.writeUInt32BE(1);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),...extra,chunk('IDAT',deflateSync(Buffer.from([0,0,0,0,255]))),chunk('IEND',Buffer.alloc(0))])}
test('only explicitly reviewed paths accept valid RGB/RGBA PNGs',()=>{assert.deepEqual(inspectReviewedImage(file,image()),{width:1,height:1,bytes:image().length});assert.throws(()=>inspectReviewedImage('docs/images/private.png',image()),/not been reviewed/)});
test('PNG metadata and appended private data are rejected',()=>{assert.throws(()=>inspectReviewedImage(file,image([chunk('tEXt',Buffer.from('private\0data'))])),/metadata/);assert.throws(()=>inspectReviewedImage(file,Buffer.concat([image(),Buffer.from('private')])),/trailing/)});
test('corrupt or truncated PNGs are rejected',()=>{const bytes=image();bytes[45]^=1;assert.throws(()=>inspectReviewedImage(file,bytes),/checksum/);assert.throws(()=>inspectReviewedImage(file,image().subarray(0,-2)),/Truncated/)});
