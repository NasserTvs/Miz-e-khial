let nearbyGame=null,playMode=null,scanStream=null,scanGeneration=0,pairGeneration=0
const onlineEndpoint=location.hostname==='nassertvs.github.io'?'https://stozhit-mah-khial.leapingknack64.chatgpt.site/api/game':'/api/game'
async function nearby(){
  if(!nearbyGame){
    nearbyGame=await import('./nearby.mjs')
    nearbyGame.configure(s=>{if(playMode==='local'&&state)receive(s)},notify)
  }
  return nearbyGame
}
function chooseOnline(){
  playMode='online'
  openModal('<h2>بازی آنلاین</h2><p>با دوستانت از هر اینترنتی بازی کن.</p><div class="actions"><button class="primary" id="netCreate">ساخت میز آنلاین</button><button class="secondary" id="netJoin">ورود با کد میز</button></div>')
  $('#netCreate').onclick=()=>entry(false);$('#netJoin').onclick=()=>entry(true)
}
async function chooseLocal(offer=''){
  playMode='local'
  const lan=await nearby()
  openModal('<h2>بازی حضوری</h2><p>همه به یک وای‌فای وصل شوید. صفحهٔ میزبان باید در طول بازی باز بماند.</p><label>نام بازیکن<input id="nearName" maxlength="20" autocomplete="nickname"></label><div class="actions">'+(offer?'':'<button class="primary" id="nearCreate">ساخت میز حضوری</button>')+'<button class="secondary" id="nearJoin">'+(offer?'پاسخ به دعوت میزبان':'پیوستن به میز')+'</button></div>'+(lan.canResume()&&!offer?'<button class="textbutton" id="nearResume">ادامهٔ میز حضوری قبلی</button>':''))
  function name(){const el=$('#nearName');const v=el.value.trim();if(!v){el.focus();notify('نامت را وارد کن.')}return v}
  if($('#nearCreate'))$('#nearCreate').onclick=()=>{const v=name();if(v)enterLocal(lan.start(v))}
  if($('#nearResume'))$('#nearResume').onclick=()=>enterLocal(lan.resume())
  $('#nearJoin').onclick=()=>{const v=name();if(v)guestPair(v,offer)}
}
function enterLocal(d){playMode='local';session={code:d.code,local:true};signature='';modal.close();receive(d.state)}
function stopScan(){scanGeneration++;scanStream?.getTracks().forEach(t=>t.stop());scanStream=null}
function endPair(){pairGeneration++;stopScan()}
const loadedScripts=new Map()
function loadScript(file){
  if(!loadedScripts.has(file))loadedScripts.set(file,new Promise((resolve,reject)=>{
    const el=document.createElement('script');el.src=file;el.onload=resolve
    el.onerror=()=>{loadedScripts.delete(file);reject(Error('بارگذاری ابزار کد تصویری انجام نشد.'))};document.head.append(el)
  }))
  return loadedScripts.get(file)
}
async function drawQR(payload,canvas){
  try{
    await loadScript('./qr-writer.js')
    const qr=new KhialQR(-1,1);qr.addData(payload);qr.make()
    const n=qr.getModuleCount(),scale=Math.max(4,Math.floor(800/(n+8)))
    canvas.width=canvas.height=(n+8)*scale
    const c=canvas.getContext('2d');c.fillStyle='white';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#111'
    for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))c.fillRect((x+4)*scale,(y+4)*scale,scale,scale)
  }catch{canvas.hidden=true;notify('برای این دعوت از گزینهٔ کپی استفاده کن.')}
}
function codePanel(label){return '<canvas class="pairQR" aria-label="'+label+'"></canvas><button class="secondary" id="copyPair">'+label+'</button><textarea class="pairText" id="copyFallback" dir="ltr" readonly hidden></textarea>'}
async function displayCode(payload){
  const copy=$('#copyPair'),canvas=content.querySelector('.pairQR'),fallback=$('#copyFallback')
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(payload);notify('کپی شد.')}catch{fallback.hidden=false;fallback.value=payload;fallback.select()}}
  await drawQR(payload,canvas)
}
function readerPanel(label){return '<div class="actions"><button id="camera" class="secondary">اسکن با دوربین</button></div><video id="scanVideo" playsinline autoplay muted hidden></video><details><summary>ورود دستی</summary><textarea class="pairText" id="scanText" dir="ltr" placeholder="کد یا لینک را جای‌گذاری کن"></textarea><button class="secondary" id="useText">'+label+'</button></details><p class="error" id="pairError" role="status"></p>'}
function bindReader(handle){
  const err=$('#pairError'),video=$('#scanVideo'),button=$('#camera')
  const submit=async raw=>{stopScan();video.hidden=true;button.disabled=false;try{await handle(raw)}catch(e){err.textContent=e.message||'اتصال برقرار نشد.'}}
  $('#useText').onclick=()=>submit($('#scanText').value)
  button.onclick=async()=>{
    stopScan();const generation=scanGeneration;button.disabled=true
    try{
      await loadScript('./qr-reader.js')
      if(generation!==scanGeneration)return
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false})
      if(generation!==scanGeneration){stream.getTracks().forEach(t=>t.stop());return}
      scanStream=stream;video.srcObject=stream;video.hidden=false;await video.play()
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true})
      function frame(){
        if(generation!==scanGeneration||!modal.open)return
        if(video.readyState>=2&&video.videoWidth){
          const scale=Math.min(1,920/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale)
          ctx.drawImage(video,0,0,canvas.width,canvas.height)
          const data=ctx.getImageData(0,0,canvas.width,canvas.height),qr=jsQR(data.data,data.width,data.height)
          if(qr){submit(qr.data);return}
        }
        setTimeout(frame,130)
      }frame()
    }catch{stopScan();video.hidden=true;button.disabled=false;err.textContent='دوربین در دسترس نیست. مجوز دوربین را بده یا از ورود دستی استفاده کن.'}
  }
}
async function hostPair(){
  endPair();const generation=pairGeneration
  openModal('<h2>دعوت حضوری</h2><p>در حال آماده کردن کد اتصال…</p>')
  try{
    const lan=await nearby(),link=await lan.invite()
    if(generation!==pairGeneration||!modal.open)return
    openModal('<h2>دعوت یک بازیکن</h2><p>۱. مهمان این کد را با دوربین گوشی‌اش اسکن کند و نامش را وارد کند.</p>'+codePanel('کپی لینک دعوت')+'<p>۲. پاسخ روی گوشی مهمان را با دوربین میزبان اسکن کن.</p>'+readerPanel('ثبت پاسخ مهمان'))
    bindReader(async text=>{await lan.accept(text);openModal('<h2>اتصال مهمان</h2><p>پس از اتصال، نام مهمان در میز دیده می‌شود. برای نفر بعد دعوت تازه بساز.</p><button class="primary" id="returnTable">بازگشت به میز</button>');$('#returnTable').onclick=()=>modal.close()})
    await displayCode(link)
  }catch(e){if(generation===pairGeneration)openModal('<h2>اتصال حضوری</h2><p>'+esc(e.message)+'</p>')}
}
function guestPair(name,offer){
  endPair();const gen=pairGeneration
  openModal('<h2>دعوت میزبان</h2><p>کد روی دستگاه میزبان را اسکن کن یا لینک دعوت او را وارد کن.</p>'+readerPanel('استفاده از دعوت'))
  const read=async text=>{
    const lan=await nearby()
    const answer=await lan.connect(text,name,d=>{if(gen===pairGeneration){history.replaceState(null,'',location.pathname);enterLocal(d)}})
    if(gen!==pairGeneration||!modal.open)return
    openModal('<h2>پاسخ اتصال شما</h2><p>میزبان این کد را اسکن کند. این صفحه تا ورود به میز باز بماند.</p>'+codePanel('کپی پاسخ اتصال'))
    await displayCode(answer)
    setTimeout(()=>{if(gen===pairGeneration&&modal.open&&$('#copyPair'))notify('اگر هنوز وصل نشده‌ای، وای‌فای مشترک را بررسی کن و از میزبان دعوت تازه بگیر.')},45000)
  }
  bindReader(read);if(offer)read(offer).catch(e=>{if($('#pairError'))$('#pairError').textContent=e.message})
}
