// WebWallGL 3.0.0 already validates font bytes with sanitizeFontForBrowser.
// FontFace also accepts those bytes directly, without a URL fetch. Codex permits
// font-src self/data but not blob. Keep the installed MIT runtime unchanged and
// adapt only this exact pinned constructor in the sandbox's in-memory source.
export function codexRuntimeSource(source){
 const before='Ie=new FontFace(me,`url(${We})`)',after='Ie=new FontFace(me,ge)';
 const fontBuffers=source.includes('const ge=rE(ee),me="wefont_"')&&source.split(before).length===2;
 const adaptations=[
  ['const G=R.gainFor(B.left,B.right,z,H);nr.current=G;', 'const G=B.normalized?1:R.gainFor(B.left,B.right,z,H);nr.current=G;'],
  ['const se=Math.min(1,(B.left[Z]||0)*G),D=Math.min(1,(B.right[Z]||0)*G);', 'const se=B.normalized?(B.left[Z]||0):Math.min(1,(B.left[Z]||0)*G),D=B.normalized?(B.right[Z]||0):Math.min(1,(B.right[Z]||0)*G);'],
  ['P(y.left32,y.left64),P(y.right32,y.right64),P(y.left16,y.left64),P(y.right16,y.right64),y.level=', 'B.normalized?(Y(y.left32,y.left64),Y(y.right32,y.right64),Y(y.left16,y.left64),Y(y.right16,y.right64)):(P(y.left32,y.left64),P(y.right32,y.right64),P(y.left16,y.left64),P(y.right16,y.right64)),y.level='],
  ['R=Oh();let C=0;return{active:!1,snapshot:y,pump(){', 'Y=(to,from)=>{const width=from.length/to.length;for(let index=0;index<to.length;index++){let peak=0;for(let step=0;step<width;step++)peak=Math.max(peak,from[index*width+step]);to[index]=peak}},R=Oh();let C=0;return{active:!1,snapshot:y,pump(){'],
 ];
 const nativeAudio=adaptations.every(([pattern])=>source.split(pattern).length===2);
 let adapted=fontBuffers?source.replace(before,after):source;
 if(nativeAudio)for(const [pattern,replacement] of adaptations)adapted=adapted.replace(pattern,replacement);
 return {source:adapted,fontBuffers,nativeAudio};
}
