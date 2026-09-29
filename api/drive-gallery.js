const SOURCES = {
  wrestling: { selects:"1j7Om_OkDs-IIHCYNeHD4uAjN7-8l89G7", gallery:"11iLL6uhCn-ctWZYQylsvNsDH7ewLN3Mr" },
  live: { folder:"1wJrA4njM9c1XI4UNRWtH4As89TPBHvjZ" },
  portraits: { folder:"1s8CS71oDMLP3MX8cSVdPE0xFLjFGVyvx" },
  creative: { folder:"1d8dYF7zzvNZqEp4aTs9Gcjr2Wge_rYFG" },
  family: { selects:"1Sp__XAvH-w4J7UCRG18P5nmoYvzIpfnU", gallery:"1Mi0rDi3mKZjXChS7bH-Aa6JdBE7FeDRE" }
};

function decodeHtml(s=""){
  return s.replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">");
}
async function listFolder(folderId){
  const url=`https://drive.google.com/u/0/embeddedfolderview?id=${folderId}#list`;
  const response=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36"},redirect:"follow"});
  if(!response.ok) throw new Error("Drive folder request failed: "+response.status);
  const html=await response.text(),files=[];
  const entry=/<a href="https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/view\?usp=drive_web"[^>]*>[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/g;
  let m;
  while((m=entry.exec(html))!==null) files.push({id:m[1],name:decodeHtml(m[2].replace(/<[^>]+>/g,"").trim())});
  if(!files.length){
    const ids=[...html.matchAll(/https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/view\?usp=drive_web/g)].map(x=>x[1]);
    return [...new Set(ids)].map(id=>({id,name:""}));
  }
  return files.filter((f,i,a)=>a.findIndex(x=>x.id===f.id)===i);
}
function hashId(s){
  let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
}
function mixed(files){
  return [...files].sort((a,b)=>hashId(a.id)-hashId(b.id));
}
async function loadSource(source,key){
  if(source.folder){
    const raw=await listFolder(source.folder);
    const files=key==="portraits"?raw:mixed(raw);
    return {selects:[],gallery:files,ids:files.map(x=>x.id)};
  }
  const [selects,gallery]=await Promise.all([listFolder(source.selects),listFolder(source.gallery)]);
  return {selects,gallery,ids:[...selects.map(x=>x.id),...gallery.map(x=>x.id).filter(id=>!selects.some(x=>x.id===id))]};
}
export default async function handler(req,res){
  try{
    const entries=await Promise.all(Object.entries(SOURCES).map(async([key,source])=>[key,await loadSource(source,key)]));
    res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=3600");
    res.status(200).json({updatedAt:new Date().toISOString(),categories:Object.fromEntries(entries)});
  }catch(error){
    res.status(500).json({error:"Could not sync Drive galleries",detail:String(error?.message||error)});
  }
}
