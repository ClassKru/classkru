'use strict';
const {Document,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,BorderStyle,ShadingType,AlignmentType,HeightRule} = require('docx');
const {normalize} = require('../../js/worksheet-layout');
const BODY_FONT = 'TH SarabunPSK';
const BODY_SIZE = 28; // 14 pt
const SUBHEADING_SIZE = 32; // 16 pt
const TITLE_SIZE = 36; // 18 pt
function createWorksheetDocument(d) {
  const w = normalize(d.worksheet, {...d, itemCount:undefined});
  const p = (text,options={}) => new Paragraph({...options, children:[new TextRun({text:String(text || ''),font:BODY_FONT,size:options.size || BODY_SIZE,bold:!!options.bold})]});
  const heading = text => p(text,{size:SUBHEADING_SIZE,bold:true,keepNext:true,spacing:{before:240,after:100}});
  const blocks = [];
  w.blocks.forEach((b,i) => {
    blocks.push(heading(`${i+1}. ${b.title}`),p(b.instruction,{keepNext:true,spacing:{after:120}}));
    if (b.type === 'question') {
      for (let n=0;n<b.lines;n++) blocks.push(p('................................................................................................................',{spacing:{after:100,line:360}}));
      return;
    }
    const widths = b.columns.map((_,j)=>Math.floor(9638/b.columns.length)+(j===0 ? 9638 % b.columns.length : 0));
    const border = {style:BorderStyle.SINGLE,size:4,color:'666666'};
    blocks.push(new Table({width:{size:9638,type:WidthType.DXA},columnWidths:widths,rows:[b.columns,...b.rows].map((row,j)=>new TableRow({tableHeader:j===0,cantSplit:true,height:j ? {value:b.lines*340,rule:HeightRule.ATLEAST}:undefined,children:row.map((cell,k)=>new TableCell({width:{size:widths[k],type:WidthType.DXA},borders:{top:border,bottom:border,left:border,right:border},margins:{top:100,bottom:100,left:120,right:120},shading:j===0?{fill:'F1F3F5',type:ShadingType.CLEAR}:undefined,children:[p(cell===null?' ':cell,{bold:j===0})]}))}))}));
    blocks.push(p(''));
  });
  const teacher = w.blocks.some(b=>b.answer) ? [p('เฉลย / แนวทางตรวจสำหรับครู',{size:TITLE_SIZE,pageBreakBefore:true,bold:true}),p(w.title,{size:SUBHEADING_SIZE,bold:true}),...w.blocks.flatMap((b,i)=>[heading(`${i+1}. ${b.title}`),p(b.answer)])] : [];
  return new Document({styles:{default:{document:{run:{font:BODY_FONT,size:BODY_SIZE}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,bottom:1134,left:1134,right:1134}}},children:[p('ใบงาน',{size:TITLE_SIZE,bold:true,alignment:AlignmentType.CENTER}),p(w.title,{size:TITLE_SIZE,bold:true,alignment:AlignmentType.CENTER,spacing:{after:180}}),p(`วิชา ${d.subject || ''}    ระดับชั้น ${d.grade || ''}    เวลา ${d.duration || ''}`),p('ชื่อ–สกุล ................................................ ชั้น ........ เลขที่ ........'),p(`ตัวชี้วัด: ${(d.indicators || []).map(i=>i.code).join(' · ')}`),heading('คำชี้แจง'),...w.directions.map(t=>p(t)),...blocks,...teacher]}]});
}
module.exports = {createWorksheetDocument};
