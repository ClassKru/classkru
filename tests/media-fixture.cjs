module.exports={
  title:'ห้องทดลองพลังงาน',summary:'ปรับความสูง แล้วทำนายความเร็ว โดยไม่คิดแรงเสียดทาน',
  html:'<main><h1>ห้องทดลองพลังงาน</h1><p>ไม่คิดแรงเสียดทาน · g = 9.81 m/s²</p><label for="height">ความสูง (เมตร)</label><input id="height" type="range" min="0" max="20" value="5"><p id="readout"></p><button id="reset" type="button">เริ่มใหม่</button><canvas id="track" width="320" height="160"></canvas></main>',
  css:'main{max-width:800px;margin:auto;padding:16px}h1{font-size:24px}canvas{max-width:100%;display:block}button{padding:12px}input{max-width:100%}',
  js:'const slider=document.getElementById("height"); const out=document.getElementById("readout"); function update(){out.textContent="ความเร็ว "+Math.sqrt(2*9.81*Number(slider.value)).toFixed(2)+" m/s";}slider.addEventListener("input",update); document.getElementById("reset").addEventListener("click",()=>{slider.value=5;update();});update();'
};
