import { NextRequest, NextResponse } from "next/server";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = resolve(process.cwd(), "cvs", "NASA_PSI");
const safeCode = /^PSI-\d{1,4}$/;
const maxPreviewBytes = 6 * 1024 * 1024;
const maxFiles = 180;
const previewRows = 85;

type FileInfo = { name:string;path:string;size:number;kind:string;previewable:boolean };
function kindOf(path:string){
  if(/\/Experimental table\//i.test(path)) return "EXPERIMENTAL_TABLE";
  if(/\/Analyzed Data\//i.test(path)) return "ANALYZED_DATA";
  if(/\/Science Documents\//i.test(path)) return "SCIENCE_DOCUMENT";
  if(/\/Reports\//i.test(path)) return "REPORT";
  if(/\/Modeling Data\//i.test(path)) return "MODEL";
  return "SOURCE_FILE";
}
function listFiles(directory:string, base:string, depth=0):FileInfo[]{
  if(depth>7)return [];
  const records:FileInfo[]=[];
  for(const entry of readdirSync(directory,{withFileTypes:true})){
    if(records.length>=maxFiles)break;
    const filepath=join(directory,entry.name);
    if(entry.isDirectory()){
      const nested=listFiles(filepath,base,depth+1);
      records.push(...nested.slice(0,maxFiles-records.length));
    }else if(entry.isFile()){
      const size=statSync(filepath).size;
      const path=relative(base,filepath).replace(/\\/g,"/");
      const ext=entry.name.split(".").pop()?.toLowerCase()||"";
      records.push({name:entry.name,path,size,kind:kindOf("/"+path),previewable:ext==="csv"&&size<=maxPreviewBytes});
    }
  }
  return records.slice(0,maxFiles);
}
function countRowsCSV(text:string):string[][]{
  const rows:string[][]=[];let row:string[]=[],field="",quoted=false;
  // Handles quoted commas, newlines, escaped double quotes and UTF-8 BOM.
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted&&text[i+1]==='"'){field+='"';i++}
      else quoted=!quoted;
    }else if(c===","&&!quoted){row.push(field);field=""}
    else if((c==="\r"||c==="\n")&&!quoted){
      if(c==="\r"&&text[i+1]==="\n")i++;
      row.push(field);field="";
      if(row.some(v=>v.trim())) rows.push(row);
      row=[];
    }else field+=c;
  }
  row.push(field);
  if(row.some(v=>v.trim()))rows.push(row);
  return rows;
}
function codeDir(code:string){return join(ROOT,code)}
function manifest(code:string){
  const all=listFiles(codeDir(code),ROOT);
  const files=all.filter(f=>/\.(csv|xlsx|xls|zip|dat|pdf|docx|txt)$/i.test(f.name));
  return {code, files, totalFiles:all.length,
    csvTables:files.filter(f=>f.previewable && f.kind==="EXPERIMENTAL_TABLE").length,
    readableCSV:files.filter(f=>f.previewable).length,
    hasFiles:files.length>0};
}
export async function GET(request:NextRequest){
  const code=request.nextUrl.searchParams.get("code");
  if(code && !safeCode.test(code))return NextResponse.json({error:"Código PSI inválido."},{status:400});
  try{
    if(!code){
      const codes=readdirSync(ROOT,{withFileTypes:true}).filter(f=>f.isDirectory()&&safeCode.test(f.name)).map(f=>f.name);
      return NextResponse.json({studies:codes.map(manifest).map(({code,totalFiles,csvTables,readableCSV,hasFiles})=>({code,totalFiles,csvTables,readableCSV,hasFiles}))},{headers:{"Cache-Control":"no-store"}});
    }
    const data=manifest(code);
    const idx=request.nextUrl.searchParams.get("file");
    if(idx===null)return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
    if(!/^\d+$/.test(idx)||Number(idx)>=data.files.length)return NextResponse.json({error:"Archivo inválido"},{status:400});
    const f=data.files[Number(idx)];
    if(!f.previewable)return NextResponse.json({error:"Este formato no admite vista tabular; abre el archivo de origen."},{status:422});
    const abs=resolve(ROOT,f.path);
    if(!abs.startsWith(ROOT+"/") && !abs.startsWith(ROOT+"\\"))return NextResponse.json({error:"Ruta no válida"},{status:400});
    const rows=countRowsCSV(readFileSync(abs,"utf8").replace(/^\uFEFF/,""));
    const head=rows[0]||[];
    const columns=head.map((v,i)=>v.trim()||"Columna "+(i+1));
    const dataRows=rows.slice(1,1+previewRows).map(row=>columns.map((_,i)=>row[i]||""));
    return NextResponse.json({
      code,file:f,columns,rows:dataRows,totalRows:Math.max(0,rows.length-1),
      isPreview:rows.length-1>previewRows,
      description:"CSV original NASA PSI. Los valores se conservan como cadenas del archivo sin inventar unidades ni mediciones."
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("GET /api/psi-raw",error);
    return NextResponse.json({error:"Los archivos originales PSI no están disponibles en esta instalación."},{status:500});
  }
}
