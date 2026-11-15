import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
function csv(value: unknown): string {
  const str = value == null ? "" : String(value);
  const safe = /^[=+\-@]/.test(str) ? "'" + str : str;
  return '"' + safe.replace(/"/g, '""') + '"';
}
export async function GET(req: NextRequest) {
  const agency = (req.nextUrl.searchParams.get("agency") || "").slice(0, 100);
  const columns = ["agency","sourcePath","rowNumber","sheetName","o2Percent","o2FinalPercent","pressurePsi","airflowCmS","temperatureC","gravityRegime","hardware","environment"];
  const chunks: string[] = [columns.map(csv).join(",")];
  try {
    const batch = 1000;
    let cursor: number | undefined;
    let exported = 0;
    do {
      const rows = await db.normalizedObservation.findMany({
        where: agency ? {sourceAsset: {agency}} : {},
        take:batch, ...(cursor ? {skip:1,cursor:{id:cursor}} : {}),
        orderBy:{id:"asc"}, select:{id:true,rowNumber:true,sheetName:true,o2Percent:true,o2FinalPercent:true,pressurePsi:true,airflowCmS:true,temperatureC:true,gravityRegime:true,hardware:true,environment:true,sourceAsset:{select:{agency:true,sourcePath:true}}}
      });
      for(const row of rows) chunks.push([row.sourceAsset.agency,row.sourceAsset.sourcePath,row.rowNumber,row.sheetName,row.o2Percent,row.o2FinalPercent,row.pressurePsi,row.airflowCmS,row.temperatureC,row.gravityRegime,row.hardware,row.environment].map(csv).join(","));
      exported+=rows.length;
      if (!rows.length || rows.length<batch || exported>=200000) break;
      cursor=rows[rows.length-1].id;
    } while(true);
    return new NextResponse("\ufeff"+chunks.join("\r\n")+"\r\n",{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=sices-observaciones.csv","Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Exportación no disponible."},{status:500});
  }
}
