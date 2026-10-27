// WebWallGL 3.0.0 already validates font bytes with sanitizeFontForBrowser.
// FontFace also accepts those bytes directly, without a URL fetch. Codex permits
// font-src self/data but not blob. Keep the installed MIT runtime unchanged and
// adapt only this exact pinned constructor in the sandbox's in-memory source.
export function codexRuntimeSource(source){
 const before='Ie=new FontFace(me,`url(${We})`)',after='Ie=new FontFace(me,ge)';
 const fontBuffers=source.includes('const ge=rE(ee),me="wefont_"')&&source.split(before).length===2;
 return {source:fontBuffers?source.replace(before,after):source,fontBuffers};
}
