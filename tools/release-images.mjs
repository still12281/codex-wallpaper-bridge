// Only these manually reviewed documentation captures may enter a release.
export const reviewedImages=new Set([
 '01-overview','02-library','03-import-gallery','04-appearance','05-author-properties',
 '06-presets-rotation','07-batch-save','08-system-media','09-playback-quality',
 '10-light-theme','11-narrow-panel',
].map(name=>'docs/images/'+name+'.png'));
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0});
export function pngCrc(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0}
export function inspectReviewedImage(file,bytes){
 if(!reviewedImages.has(file))throw Error('Image path has not been reviewed');
 if(bytes.length>4*1024*1024||bytes.length<45||!bytes.subarray(0,8).equals(signature))throw Error('Invalid PNG signature or size');
 let offset=8,width=0,height=0,hasData=false,ended=false;
 while(offset<bytes.length){
  if(offset+12>bytes.length)throw Error('Truncated PNG chunk');
  const size=bytes.readUInt32BE(offset),end=offset+12+size,type=bytes.toString('ascii',offset+4,offset+8);
  if(end>bytes.length)throw Error('Truncated PNG payload');
  if(!['IHDR','IDAT','IEND'].includes(type))throw Error('PNG metadata or unreviewed chunk: '+type);
  if(pngCrc(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4))throw Error('PNG checksum mismatch');
  if(type==='IHDR'){
   if(offset!==8||size!==13)throw Error('Invalid PNG header');
   width=bytes.readUInt32BE(offset+8);height=bytes.readUInt32BE(offset+12);
   if(!width||!height||width>8192||height>8192||width*height>16*1024*1024||bytes[offset+16]!==8||![2,6].includes(bytes[offset+17])||bytes[offset+18]||bytes[offset+19]||bytes[offset+20])throw Error('Unsupported PNG dimensions or format');
  }else if(!width)throw Error('Missing PNG header');
  else if(type==='IDAT'){hasData=true;}
  else {if(size||!hasData||end!==bytes.length)throw Error('Invalid PNG end or trailing data');ended=true;}
  offset=end;
 }
 if(!ended)throw Error('Missing PNG end');
 return {width,height,bytes:bytes.length};
}
