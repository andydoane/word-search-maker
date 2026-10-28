"use strict";

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "word-search-maker-project-v1";
const MIN_GRID = 8;
const MAX_GRID = 20;
const MAX_WORDS = 30;
let puzzle = null;
let logoData = "";
let showingAnswer = false;

function setStatus(message, isError) {
  const el = $("status");
  el.textContent = message || "";
  el.classList.toggle("error", Boolean(isError));
}

function getConfig() {
  return {
    words: $("words").value,
    rows: Number($("rows").value),
    cols: Number($("cols").value),
    difficulty: $("difficulty").value,
    title: $("title").value,
    subtitle: $("subtitle").value,
    instructions: $("instructions").value,
    quote: $("quote").value,
    footer: $("footer").value,
    nameLine: $("name-line").checked,
    dateLine: $("date-line").checked,
    pageSize: $("page-size").value,
    orientation: $("orientation").value,
    font: $("font").value,
    wordColumns: Number($("word-columns").value),
    letterScale: Number($("letter-scale").value),
    checkboxes: $("checkboxes").checked,
    gridBorder: $("grid-border").checked
  };
}

const fieldMap = {
  words:"words", rows:"rows", cols:"cols", difficulty:"difficulty",
  title:"title", subtitle:"subtitle", instructions:"instructions",
  quote:"quote", footer:"footer", nameLine:"name-line", dateLine:"date-line",
  pageSize:"page-size", orientation:"orientation", font:"font",
  wordColumns:"word-columns", letterScale:"letter-scale",
  checkboxes:"checkboxes", gridBorder:"grid-border"
};

function applyConfig(config) {
  Object.keys(fieldMap).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      const element = $(fieldMap[key]);
      if (element.type === "checkbox") element.checked = Boolean(config[key]);
      else element.value = String(config[key]);
    }
  });
}

function normalizeWord(value) {
  return String(value).normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "").toUpperCase();
}

function parseWords(text) {
  const lines = String(text).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!lines.length) throw Error("Add at least one word or phrase.");
  if (lines.length > MAX_WORDS) throw Error("Use at most " + MAX_WORDS + " words.");
  const seen = new Set();
  return lines.map((label) => {
    const value = normalizeWord(label);
    if (!value) throw Error("Each word must contain at least one English letter: " + label);
    if (value.length > 20) throw Error("A word or phrase has more than 20 letters: " + label);
    if (seen.has(value)) throw Error("Duplicate word or phrase: " + label);
    seen.add(value);
    return {label:label, value:value};
  });
}

function validateConfig(config) {
  if (!Number.isInteger(config.rows) || config.rows < MIN_GRID || config.rows > MAX_GRID ||
      !Number.isInteger(config.cols) || config.cols < MIN_GRID || config.cols > MAX_GRID) {
    throw Error("Grid height and width must each be between 8 and 20.");
  }
  if (config.difficulty !== "easy" && config.difficulty !== "medium") {
    throw Error("Choose Easy or Medium difficulty.");
  }
  const words = parseWords(config.words);
  const maxSide = Math.max(config.rows, config.cols);
  const tooLong = words.find((w) => w.value.length > maxSide);
  if (tooLong) throw Error('"' + tooLong.label + '" is too long for this grid. Increase its dimensions.');
  return words;
}

function generateGrid(words, rows, cols, difficulty) {
  const directions = [{dr:0,dc:1}, {dr:1,dc:0}];
  if (difficulty === "medium") {
    directions.push({dr:1,dc:1}, {dr:-1,dc:1});
  }
  const source = words.slice().sort((a,b) => b.value.length - a.value.length);
  for (let attempt=0; attempt<65; attempt++) {
    const board = Array.from({length:rows}, () => Array(cols).fill(""));
    const placed = [];
    let failed = false;
    for (const word of source) {
      const candidates = [];
      for (const dir of directions) {
        for (let row=0; row<rows; row++) {
          for (let col=0; col<cols; col++) {
            const lastRow = row + (word.value.length-1) * dir.dr;
            const lastCol = col + (word.value.length-1) * dir.dc;
            if (lastRow<0 || lastRow>=rows || lastCol<0 || lastCol>=cols) continue;
            let overlap = 0;
            let works = true;
            for (let i=0; i<word.value.length; i++) {
              const existing = board[row+i*dir.dr][col+i*dir.dc];
              if (existing && existing!==word.value[i]) { works=false; break; }
              if (existing) overlap++;
            }
            if (works) candidates.push({row:row,col:col,dr:dir.dr,dc:dir.dc,overlap:overlap});
          }
        }
      }
      if (!candidates.length) { failed=true; break; }
      for (let i=candidates.length-1; i>0; i--) {
        const j=Math.floor(Math.random()*(i+1));
        [candidates[i], candidates[j]]=[candidates[j],candidates[i]];
      }
      candidates.sort((a,b) => b.overlap-a.overlap);
      const top = Math.min(12, candidates.length);
      const best = candidates[Math.floor(Math.random()*top)];
      for (let i=0; i<word.value.length; i++) {
        board[best.row+i*best.dr][best.col+i*best.dc]=word.value[i];
      }
      placed.push({label:word.label,value:word.value,
        row:best.row,col:best.col,dr:best.dr,dc:best.dc});
    }
    if (failed) continue;
    for (let r=0;r<rows;r++) {
      for (let c=0;c<cols;c++) {
        if (!board[r][c]) board[r][c]=String.fromCharCode(65+Math.floor(Math.random()*26));
      }
    }
    return {rows:rows,cols:cols,board:board,placements:placed,words:words};
  }
  return null;
}

function xml(value) {
  return String(value == null ? "" : value).replace(/&/g,"&amp;")
    .replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

function svgText(x,y,value,size,extras) {
  return '<text x="'+x+'" y="'+y+'" font-size="'+size+'" fill="#111" '+(extras||"")+'>'+xml(value)+'</text>';
}

function wrapText(text, maxChars, maxLines) {
  const words = String(text||"").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line && (line+" "+word).length>maxChars) {
      lines.push(line);
      line = word;
    } else {
      line += (line?" ":"")+word;
    }
  }
  if (line) lines.push(line);
  if (maxLines && lines.length>maxLines) {
    const result = lines.slice(0,maxLines);
    result[maxLines-1] += "…";
    return result;
  }
  return lines;
}

function getPage(config) {
  let w=config.pageSize==="a4"?794:816;
  let h=config.pageSize==="a4"?1123:1056;
  if (config.orientation==="landscape") [w,h]=[h,w];
  return {w:w,h:h};
}

const FONT_FAMILIES = {
  "alegreya-extra-bold":"Alegreya ExtraBold",
  "anek-devanagari-extra-bold":"Anek Devanagari ExtraBold",
  "baloo-2-extra-bold":"Baloo 2 ExtraBold",
  "cabin-sketch-bold":"Cabin Sketch Bold",
  "cherry-bomb-one":"Cherry Bomb One",
  "dela-gothic-one":"Dela Gothic One",
  "domine-bold":"Domine Bold",
  "itim":"Itim",
  "mouse-memoirs":"Mouse Memoirs",
  "nunito-sans":"Nunito Sans",
  "peralta":"Peralta",
  "press-start-2p":"Press Start 2P",
  "ribeye-marrow":"Ribeye Marrow",
  "shantell-sans-bold":"Shantell Sans Bold",
  "special-elite":"Special Elite",
  "spicy-rice":"Spicy Rice",
  "teko-semi-bold":"Teko SemiBold",
  "zilla-slab-bold":"Zilla Slab Bold"
};
function pageFont(config) {
  if (FONT_FAMILIES[config.font]) return '"' + FONT_FAMILIES[config.font] + '", sans-serif';
  if (config.font==="classic") return 'Georgia, "Times New Roman", serif';
  if (config.font==="clean") return 'Arial, Helvetica, sans-serif';
  return '"Comic Sans MS", "Trebuchet MS", cursive';
}
function pageWeight(config) {
  return config.font==="nunito-sans"?1000:700;
}

function buildWorksheetSVG(isAnswer) {
  if (!puzzle) throw Error("Generate a puzzle before downloading.");
  const config=getConfig();
  const page=getPage(config);
  const W=page.w, H=page.h, margin=44;
  const family=pageFont(config);
  const weight=pageWeight(config);
  const parts=[
    '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+(isAnswer?"Answer key":"Word search worksheet")+'">',
    '<defs><filter id="logo-gray"><feColorMatrix type="saturate" values="0"/></filter></defs>',
    '<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="white"/>',
    '<g font-family="'+xml(family)+'" font-weight="'+(config.font==="nunito-sans"?1000:400)+'">'
  ];
  let titleSize=Math.max(20,Math.min(36,46-(config.title||"Word Search").length*0.37));
  const heading=(config.title||"Word Search")+(isAnswer?" — Answer Key":"");
  if (heading.length>35) titleSize=Math.min(titleSize,25);
  parts.push(svgText(margin,55,heading,titleSize,'font-weight="'+weight+'"'));
  if (!logoData) parts.push(svgText(W-margin,46,"WORD SEARCH",11,'font-weight="'+weight+'" text-anchor="end" letter-spacing="1"'));
  if (logoData) parts.push('<image x="'+(W-138)+'" y="15" width="94" height="76" preserveAspectRatio="xMidYMid meet" filter="url(#logo-gray)" href="'+xml(logoData)+'"/>');
  let lineY=75;
  if (config.subtitle.trim()) {
    parts.push(svgText(margin,78,config.subtitle.trim(),15,'font-style="italic"'));
    lineY=92;
  }
  if (logoData) lineY=Math.max(lineY,104);
  parts.push('<line x1="'+margin+'" y1="'+lineY+'" x2="'+(W-margin)+'" y2="'+lineY+'" stroke="#222" stroke-width="1.6"/>');
  let cursor=lineY+20;
  if (config.nameLine || config.dateLine) {
    if (config.nameLine) parts.push(svgText(margin,cursor,"Name __________________________",13));
    if (config.dateLine) parts.push(svgText(W-margin,cursor,"Date ______________",13,'text-anchor="end"'));
    cursor+=19;
  }
  if (config.quote.trim()) {
    const lines=wrapText(config.quote.trim(),Math.max(34,Math.floor((W-2*margin)/7)),3);
    lines.forEach((l) => {parts.push(svgText(W/2,cursor,l,12,'font-style="italic" text-anchor="middle"'));cursor+=16;});
    cursor+=2;
  }
  if (config.instructions.trim()) {
    const lines=wrapText(config.instructions.trim(),Math.max(36,Math.floor((W-2*margin)/7)),2);
    lines.forEach((l) => {parts.push(svgText(W/2,cursor,l,13,'text-anchor="middle"'));cursor+=17;});
  }
  cursor+=11;
  const bankColumns=Math.min(Math.max(2,config.wordColumns||4),5);
  const bankRows=Math.ceil(puzzle.words.length/bankColumns);
  const bankLine=Math.max(18,Math.min(25,29-bankRows*.42));
  const footerHeight=config.footer.trim()?45:23;
  const reservedBank=bankRows*bankLine+24+footerHeight;
  const availableHeight=H-cursor-reservedBank-16;
  const cell=Math.min((W-2*margin)/puzzle.cols,availableHeight/puzzle.rows,58);
  if (cell<14) throw Error("The page cannot fit this puzzle. Try fewer words, a larger paper orientation, or fewer grid rows.");
  const gridWidth=cell*puzzle.cols,gridHeight=cell*puzzle.rows;
  const gridLeft=(W-gridWidth)/2;
  const gridTop=cursor+Math.max(0,(availableHeight-gridHeight)*.25);
  if (config.gridBorder) {
    parts.push('<rect x="'+gridLeft+'" y="'+gridTop+'" width="'+gridWidth+'" height="'+gridHeight+'" fill="none" stroke="#333" stroke-width="1"/>');
  }
  if (isAnswer) {
    puzzle.placements.forEach((p) => {
      const x1=gridLeft+(p.col+.5)*cell, y1=gridTop+(p.row+.5)*cell;
      const x2=gridLeft+(p.col+(p.value.length-1)*p.dc+.5)*cell;
      const y2=gridTop+(p.row+(p.value.length-1)*p.dr+.5)*cell;
      parts.push('<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#888" opacity=".65" stroke-width="'+Math.max(4,cell*.18)+'" stroke-linecap="round"/>');
    });
  }
  const letterSize=Math.min(46,Math.max(10,cell*(config.letterScale/100)));
  for (let r=0;r<puzzle.rows;r++) {
    for (let c=0;c<puzzle.cols;c++) {
      const x=gridLeft+(c+.5)*cell, y=gridTop+(r+.5)*cell;
      parts.push(svgText(x,y,puzzle.board[r][c],letterSize,
        'font-weight="'+weight+'" text-anchor="middle" dominant-baseline="central"'));
    }
  }
  const bankY=gridTop+gridHeight+35;
  const bankWidth=(W-2*margin)/bankColumns;
  puzzle.words.forEach((word,i) => {
    const c=Math.floor(i/bankRows),r=i%bankRows;
    const x=margin+c*bankWidth;
    const y=bankY+r*bankLine;
    if (config.checkboxes) {
      parts.push('<rect x="'+x+'" y="'+(y-10)+'" width="9" height="9" stroke="#333" stroke-width="1" fill="white"/>');
    }
    const textX=x+(config.checkboxes?18:1);
    const fontSize=Math.max(9,Math.min(14,(bankWidth-(config.checkboxes?20:2))/Math.max(1,word.label.length*.55)));
    parts.push(svgText(textX,y,word.label,fontSize));
  });
  if (config.footer.trim()) {
    parts.push(svgText(W/2,H-27,config.footer.trim(),11,'text-anchor="middle"'));
  }
  parts.push("</g></svg>");
  return {svg:parts.join(""),width:W,height:H};
}

function renderPreview() {
  $("paper-placeholder").hidden=Boolean(puzzle);
  $("paper-preview").hidden=!puzzle;
  ["download-pdf","download-png","download-answer-png","shuffle"].forEach(
    (id) => {$(id).disabled=!puzzle;}
  );
  if (!puzzle) { $("paper-preview").innerHTML="";return; }
  try {
    $("paper-preview").innerHTML=buildWorksheetSVG(showingAnswer).svg;
  } catch (err) {
    $("paper-preview").innerHTML="";
    setStatus(err.message,true);
  }
  $("view-worksheet").classList.toggle("active",!showingAnswer);
  $("view-answer").classList.toggle("active",showingAnswer);
}

function generate() {
  try {
    const config=getConfig();
    const words=validateConfig(config);
    const result=generateGrid(words,config.rows,config.cols,config.difficulty);
    if (!result) throw Error("These words could not all fit. Use a larger grid or fewer words.");
    puzzle=result;
    showingAnswer=false;
    renderPreview();
    setStatus("Generated "+words.length+" hidden words. Ready to download.");
  } catch (err) {
    setStatus(err.message,true);
  }
}

function invalidatePuzzle() {
  puzzle=null;
  showingAnswer=false;
  renderPreview();
  setStatus("Puzzle settings changed. Generate again to place every word.");
}

function safeFilename() {
  return ($("title").value||"word-search").toLowerCase()
    .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55)||"word-search";
}

function downloadBlob(blob,filename) {
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;
  document.body.append(a);a.click();a.remove();
  setTimeout(() => URL.revokeObjectURL(url),1500);
}

// Render SVG primitives directly to Canvas so locally hosted fonts are reliably
// included in PNG and PDF exports. SVG-as-an-image drops custom web fonts in
// some browsers, even when the inline SVG preview looks correct.
async function svgCanvas(isAnswer) {
  const data=buildWorksheetSVG(isAnswer);
  const config=getConfig();
  const selected=FONT_FAMILIES[config.font];
  if (selected && document.fonts && document.fonts.load) {
    // Wait for both regular word-bank text and the title/grid's heavier face.
    await Promise.all([
      document.fonts.load('400 18px "'+selected+'"'),
      document.fonts.load(pageWeight(config)+' 18px "'+selected+'"')
    ]);
  }
  const scale=300/96;
  const canvas=document.createElement("canvas");
  canvas.width=Math.round(data.width*scale);
  canvas.height=Math.round(data.height*scale);
  const ctx=canvas.getContext("2d");
  if (!ctx) throw Error("This browser cannot create the worksheet image.");
  ctx.scale(scale,scale);
  ctx.fillStyle="white";
  ctx.fillRect(0,0,data.width,data.height);

  const documentSVG=new DOMParser().parseFromString(data.svg,"image/svg+xml");
  if (documentSVG.querySelector("parsererror")) throw Error("Invalid worksheet drawing.");
  const group=documentSVG.querySelector("svg > g");
  if (!group) throw Error("The worksheet has no drawing elements.");
  const family=group.getAttribute("font-family") || "sans-serif";
  const parentWeight=group.getAttribute("font-weight") || "400";

  // Draw order follows SVG document order: grid highlights before letters.
  for (const item of group.children) {
    const tag=item.localName;
    const attr=(name,defaultValue) => item.getAttribute(name) ?? defaultValue;
    const num=(name,defaultValue=0) => Number(attr(name,String(defaultValue)));
    ctx.save();
    if (tag==="text") {
      const weight=attr("font-weight",parentWeight);
      const size=num("font-size",14);
      const style=attr("font-style","normal");
      ctx.font=style+" "+weight+" "+size+"px "+family;
      ctx.fillStyle=attr("fill","#111");
      ctx.textAlign=attr("text-anchor","start")==="end"?"right":
        attr("text-anchor","start")==="middle"?"center":"left";
      ctx.textBaseline=attr("dominant-baseline","auto")==="central"?"middle":"alphabetic";
      ctx.fillText(item.textContent||"",num("x"),num("y"));
    } else if (tag==="line") {
      ctx.globalAlpha=num("opacity",1);
      ctx.strokeStyle=attr("stroke","#111");
      ctx.lineWidth=num("stroke-width",1);
      ctx.lineCap=attr("stroke-linecap","butt");
      ctx.beginPath();
      ctx.moveTo(num("x1"),num("y1"));
      ctx.lineTo(num("x2"),num("y2"));
      ctx.stroke();
    } else if (tag==="rect") {
      const fill=attr("fill","none");
      if (fill!=="none") {
        ctx.fillStyle=fill;ctx.fillRect(num("x"),num("y"),num("width"),num("height"));
      }
      const stroke=attr("stroke","none");
      if (stroke!=="none") {
        ctx.strokeStyle=stroke;
        ctx.lineWidth=num("stroke-width",1);
        ctx.strokeRect(num("x"),num("y"),num("width"),num("height"));
      }
    } else if (tag==="image") {
      const href=item.getAttribute("href") || item.getAttribute("xlink:href");
      if (href) {
        const image=new Image();
        await new Promise((resolve,reject) => {
          image.onload=resolve;
          image.onerror=()=>reject(Error("Could not render uploaded picture."));
          image.src=href;
        });
        const x=num("x"),y=num("y"),w=num("width"),h=num("height");
        const ratio=Math.min(w/image.naturalWidth,h/image.naturalHeight);
        const drawW=image.naturalWidth*ratio,drawH=image.naturalHeight*ratio;
        ctx.filter="grayscale(1)";
        ctx.drawImage(image,x+(w-drawW)/2,y+(h-drawH)/2,drawW,drawH);
        ctx.filter="none";
      }
    }
    ctx.restore();
  }
  return canvas;
}

async function canvasBlob(canvas) {
  return new Promise((resolve,reject) => canvas.toBlob(
    (blob) => blob?resolve(blob):reject(Error("Could not create PNG.")),"image/png"));
}

async function downloadPNG(isAnswer) {
  if (!puzzle) return;
  setStatus("Creating high-resolution PNG…");
  try {
    const canvas=await svgCanvas(isAnswer);
    downloadBlob(await canvasBlob(canvas),safeFilename()+(isAnswer?"-answer-key":"")+".png");
    setStatus("PNG saved.");
  } catch (err) {setStatus(err.message,true);}
}

async function jpegBytes(canvas) {
  const blob=await new Promise((resolve,reject) => canvas.toBlob(
    (file) => file?resolve(file):reject(Error("Could not create PDF image.")),
    "image/jpeg",0.94));
  return new Uint8Array(await blob.arrayBuffer());
}

// A tiny, standards-compliant image-PDF writer. Each worksheet page is a
// 300-dpi JPEG image on a correctly sized PDF page. There is no external
// JavaScript PDF library, so CDN errors cannot break PDF downloads.
function buildPDF(pages,widthPoints,heightPoints) {
  const encoder=new TextEncoder();
  const bytes=(value)=>encoder.encode(value);
  const objects=Array(3*pages.length+3);
  objects[1]=bytes("<< /Type /Catalog /Pages 2 0 R >>");
  const refs=pages.map((_,index)=>(3+index*3)+" 0 R");
  objects[2]=bytes("<< /Type /Pages /Kids ["+refs.join(" ")+"] /Count "+pages.length+" >>");
  pages.forEach((page,index) => {
    const id=3+index*3;
    const dimensions=widthPoints+" "+heightPoints;
    objects[id]=bytes("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+
      dimensions+"] /Resources << /XObject << /Im0 "+(id+2)+
      " 0 R >> >> /Contents "+(id+1)+" 0 R >>");
    const instructions="q\n"+widthPoints+" 0 0 "+heightPoints+" 0 0 cm\n/Im0 Do\nQ\n";
    const instructionBytes=bytes(instructions);
    objects[id+1]=bytes("<< /Length "+instructionBytes.length+
      " >>\nstream\n"+instructions+"endstream");
    const header=bytes("<< /Type /XObject /Subtype /Image /Width "+page.width+
      " /Height "+page.height+" /ColorSpace /DeviceRGB /BitsPerComponent 8 "+
      "/Filter /DCTDecode /Length "+page.jpeg.length+" >>\nstream\n");
    const tail=bytes("\nendstream");
    const result=new Uint8Array(header.length+page.jpeg.length+tail.length);
    result.set(header,0);
    result.set(page.jpeg,header.length);
    result.set(tail,header.length+page.jpeg.length);
    objects[id+2]=result;
  });
  const parts=[];
  let position=0;
  const add=(piece) => {parts.push(piece);position+=piece.length;};
  add(new Uint8Array([37,80,68,70,45,49,46,52,10,37,226,227,207,211,10]));
  const offsets=[0];
  for (let id=1;id<objects.length;id++) {
    offsets[id]=position;
    add(bytes(id+" 0 obj\n"));
    add(objects[id]);
    add(bytes("\nendobj\n"));
  }
  const xrefPosition=position;
  add(bytes("xref\n0 "+objects.length+"\n0000000000 65535 f \n"));
  for (let id=1;id<objects.length;id++) {
    add(bytes(String(offsets[id]).padStart(10,"0")+" 00000 n \n"));
  }
  add(bytes("trailer\n<< /Size "+objects.length+
    " /Root 1 0 R >>\nstartxref\n"+xrefPosition+"\n%%EOF\n"));
  return new Blob(parts,{type:"application/pdf"});
}

async function downloadPDF() {
  if (!puzzle) return;
  setStatus("Creating PDF…");
  try {
    const config=getConfig();
    const page=getPage(config);
    const widthPoints=+(page.w*.75).toFixed(4);
    const heightPoints=+(page.h*.75).toFixed(4);
    const pages=[];
    const worksheet=await svgCanvas(false);
    pages.push({width:worksheet.width,height:worksheet.height,
      jpeg:await jpegBytes(worksheet)});
    if ($("include-answer").checked) {
      const answer=await svgCanvas(true);
      pages.push({width:answer.width,height:answer.height,
        jpeg:await jpegBytes(answer)});
    }
    downloadBlob(buildPDF(pages,widthPoints,heightPoints),safeFilename()+".pdf");
    setStatus("PDF saved.");
  } catch (err) {setStatus(err.message,true);}
}

function exportProject() {
  return {version:1,config:getConfig(),puzzle:puzzle,logo:logoData};
}

function validPuzzle(data,config) {
  if (!data || data.rows!==config.rows || data.cols!==config.cols ||
    !Array.isArray(data.board) || data.board.length!==config.rows ||
    !Array.isArray(data.words) || !Array.isArray(data.placements)) return false;
  let expected;
  try { expected=parseWords(config.words); } catch { return false; }
  if (JSON.stringify(data.words)!==JSON.stringify(expected) ||
      data.placements.length!==expected.length) return false;
  if (!data.board.every((row) => Array.isArray(row) && row.length===config.cols &&
    row.every((ch) => typeof ch==="string" && /^[A-Z]$/.test(ch)))) return false;
  return data.placements.every((p) => {
    if (!p || !/^[A-Z]+$/.test(p.value||"") ||
      !Number.isInteger(p.row) || !Number.isInteger(p.col) ||
      !Number.isInteger(p.dr) || !Number.isInteger(p.dc)) return false;
    const allowed=config.difficulty==="easy"?[[0,1],[1,0]]:[[0,1],[1,0],[1,1],[-1,1]];
    if (!allowed.some((d) => d[0]===p.dr && d[1]===p.dc)) return false;
    for (let i=0;i<p.value.length;i++) {
      const r=p.row+i*p.dr,c=p.col+i*p.dc;
      if (r<0 || c<0 || r>=config.rows || c>=config.cols ||
          data.board[r][c]!==p.value[i]) return false;
    }
    return true;
  });
}

function loadProject(data) {
  if (!data || data.version!==1 || !data.config || typeof data.config!=="object") {
    throw Error("This is not a supported Word Search Maker project file.");
  }
  applyConfig(data.config);
  const config=getConfig();
  validateConfig(config);
  logoData=typeof data.logo==="string" &&
    /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(data.logo) ? data.logo : "";
  $("logo").value="";
  $("remove-logo").hidden=!logoData;
  puzzle=validPuzzle(data.puzzle,config)?data.puzzle:null;
  showingAnswer=false;
  renderPreview();
  setStatus(puzzle?"Project loaded with its original puzzle.":"Settings loaded. Generate the puzzle to continue.");
}

$("worksheet-form").addEventListener("submit",(e)=>e.preventDefault());
$("generate").addEventListener("click",generate);
$("shuffle").addEventListener("click",generate);
["words","rows","cols","difficulty"].forEach((id) => {
  $(id).addEventListener("input",invalidatePuzzle);
  $(id).addEventListener("change",invalidatePuzzle);
});
document.querySelectorAll(".size-preset").forEach((button) => {
  button.addEventListener("click",() => {
    $("rows").value=button.dataset.size;
    $("cols").value=button.dataset.size;
    invalidatePuzzle();
  });
});
Object.values(fieldMap).filter((id) => !["words","rows","cols","difficulty"].includes(id))
  .forEach((id) => {
    $(id).addEventListener("input",renderPreview);
    $(id).addEventListener("change",renderPreview);
  });
$("view-worksheet").addEventListener("click",()=>{showingAnswer=false;renderPreview();});
$("view-answer").addEventListener("click",()=>{showingAnswer=true;renderPreview();});
$("download-pdf").addEventListener("click",downloadPDF);
$("download-png").addEventListener("click",()=>downloadPNG(false));
$("download-answer-png").addEventListener("click",()=>downloadPNG(true));

$("logo").addEventListener("change",async () => {
  const file=$("logo").files[0];
  if (!file) return;
  if (!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size>1024*1024) {
    $("logo").value="";
    setStatus("Choose a PNG, JPEG or WebP image smaller than 1 MB.",true);
    return;
  }
  try {
    logoData=await new Promise((resolve,reject) => {
      const reader=new FileReader();
      reader.onload=() => resolve(reader.result);
      reader.onerror=() => reject(Error("Could not read image."));
      reader.readAsDataURL(file);
    });
    $("remove-logo").hidden=false;
    renderPreview();
  } catch (err) {setStatus(err.message,true);}
});
$("remove-logo").addEventListener("click",()=> {
  logoData="";$("logo").value="";$("remove-logo").hidden=true;renderPreview();
});

$("save-browser").addEventListener("click",()=> {
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(exportProject()));
    setStatus("Project saved in this browser.");
  } catch {setStatus("Browser storage is full or unavailable. Download a project file instead.",true);}
});
$("load-browser").addEventListener("click",()=> {
  try {
    const raw=localStorage.getItem(STORAGE_KEY);
    if (!raw) throw Error("No project has been saved in this browser.");
    loadProject(JSON.parse(raw));
  } catch (err) {setStatus(err.message,true);}
});
$("save-json").addEventListener("click",()=> {
  downloadBlob(new Blob([JSON.stringify(exportProject(),null,2)],
    {type:"application/json"}),safeFilename()+".json");
  setStatus("Project file saved.");
});
$("import-file").addEventListener("change",async () => {
  const file=$("import-file").files[0];
  if (!file) return;
  try {
    if (file.size>3*1024*1024) throw Error("Project file exceeds the 3 MB limit.");
    loadProject(JSON.parse(await file.text()));
  } catch (err) {setStatus(err.message,true);}
  $("import-file").value="";
});
renderPreview();
