const $=s=>document.querySelector(s), fa=n=>Number(n).toLocaleString('fa-IR',{useGrouping:false})
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const digits=s=>s.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
let labels=[],oldLabels=[],state=null,session=null,chosen=null,busy=false,polling=false,seq=0,signature='',noticeTimer
const modal=$('#modal'),content=$('#content')
function notify(s){$('#status').textContent=s;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#status').textContent='',4500)}
function openModal(html,wide=false){content.innerHTML=html;modal.classList.toggle('wide',wide);if(!modal.open)modal.showModal()}
$('#close').onclick=()=>modal.close()
modal.addEventListener('click',e=>{if(e.target===modal&&e.offsetX<0)modal.close()})
function classic(){return state && state.phase!=='lobby' && state.edition!==2}
function title(id){return (classic()?oldLabels:labels)[id]||'کارت '+fa(id+1)}
function asset(id,thumbnail=false){
  const directory=classic()?'./cards/':thumbnail?'./paintings/thumb/':'./paintings/'
  return directory+id+'.webp'
}
const lens='<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6M7 10h6m-3-3v6"/></svg>'
function tile(id,attr=''){
  const label=esc(title(id))
  return '<div class="cardframe"><button type="button" class="art" data-card="'+id+'" '+attr+'><img loading="lazy" src="'+asset(id,true)+'" alt=""><span>'+label+'</span></button><button class="lens" type="button" data-zoom="'+id+'" aria-label="بزرگ‌نمایی '+label+'">'+lens+'</button></div>'
}
const viewer=$('#viewer')
function showArt(id){
  $('#viewTitle').textContent=title(id);$('#viewImage').alt=title(id);$('#viewImage').src=asset(id)
  if(!viewer.open)viewer.showModal()
}
$('#closeView').onclick=()=>viewer.close()
viewer.onclick=e=>{if(e.target===viewer)viewer.close()}
document.addEventListener('click',e=>{
  const zoom=e.target.closest('[data-zoom]')
  if(zoom){e.stopPropagation();showArt(+zoom.dataset.zoom)}
},true)
function gallery(){openModal('<h2>نگارخانهٔ کارت‌ها</h2><div class="grid">'+Array.from({length:80},(_,i)=>tile(i)).join('')+'</div>',true)}
$('#gallery').onclick=gallery
content.addEventListener('click',e=>{const b=e.target.closest('[data-card]');if(b)showArt(+b.dataset.card)})
$('#samples').onclick=e=>{const b=e.target.closest('[data-card]');if(b)showArt(+b.dataset.card)}
function samples(){$('#samples').innerHTML=[16,22,72,76,79].map(id=>tile(id)).join('')}
fetch('./cards/names.json').then(r=>r.json()).then(x=>{oldLabels=x}).catch(()=>{})
samples();fetch('./paintings/names.json').then(r=>r.json()).then(x=>{labels=x;samples()}).catch(()=>{})
$('#rules').onclick=()=>openModal('<h2>راهنمای بازی</h2><p><b>آماده شدن</b> — میزبان میز می‌سازد و لینک دعوت را برای دوستانش می‌فرستد. هر نفر پنج کارت خصوصی دارد و دو بار قصه‌گو می‌شود.</p><p><b>سه تا هشت نفر</b> — قصه‌گو یک کارت و یک سرنخ انتخاب می‌کند. دیگران هر کدام یک کارت هم‌خوان می‌گذارند. کارت‌ها بُر می‌خورند و همه به‌جز قصه‌گو، کارت او را حدس می‌زنند. رأی به کارت خودت مجاز نیست.</p><p><b>امتیاز</b> — اگر بعضی درست حدس بزنند، قصه‌گو و هر حدس‌زنِ درست سه امتیاز می‌گیرند. اگر همه یا هیچ‌کس درست نگویند، هر حدس‌زن دو امتیاز می‌گیرد. هر رأی به کارت گمراه‌کننده هم یک امتیاز برای صاحب آن دارد.</p><p><b>بازی دونفره</b> — با هم یک تیم هستید. دو کارت تصادفی کنار کارت قصه‌گو می‌آید. هر حدس درست برای هر دو نفر دو امتیاز دارد. هدف چهار حدس درست از چهار دور است.</p>')
async function api(body){if(playMode==='local')return (await nearby()).action(body);return serverApi(body)}
async function serverApi(body){const response=await fetch(onlineEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const d=await response.json().catch(()=>({error:'سرور پاسخ نداد. دوباره تلاش کنید.'}));if(!response.ok||d.error)throw Error(d.error||'ارتباط برقرار نشد.');return d}
const invited=new URL(location.href).searchParams.get('room')
function entry(join=false){
  playMode='online'
  openModal('<h2>'+(join?'ورود به میز':'ساخت میز جدید')+'</h2><form id="entry"><label>نام بازیکن<input name="name" maxlength="20" autocomplete="nickname" placeholder="نام شما" required></label>'+(join?'<label>کد شش‌رقمی میز<input name="code" inputmode="numeric" dir="ltr" maxlength="6" required value="'+esc(invited&&/^\d{6}$/.test(invited)?invited:'')+'"></label>':'')+'<p role="alert" class="error"></p><button class="primary">'+(join?'ورود به بازی':'ساخت میز')+'</button></form>')
  $('#entry').onsubmit=async e=>{e.preventDefault();const f=e.target,b=f.querySelector('button');b.disabled=true
    try{const d=await api({action:join?'join':'create',name:f.elements.name.value,code:join?digits(f.elements.code.value.trim()):undefined})
      session={code:d.code,token:d.token};localStorage.setItem('khial.session',JSON.stringify(session));modal.close();receive(d.state)
    }catch(err){f.querySelector('.error').textContent=err.message||'اتصال برقرار نشد.'}finally{b.disabled=false}}
}
$('#make').onclick=()=>chooseLocal().catch(e=>notify(e.message));$('#enter').onclick=chooseOnline
modal.addEventListener('close',endPair)
function receive(s){const sig=JSON.stringify(s);if(signature===sig)return
  const fresh=!state||state.round!==s.round||state.phase!==s.phase
  if(fresh && state && !document.hidden)playCue(s.phase)
  const expanded=fresh?[]:[...document.querySelectorAll('#room details[open] summary')].map(x=>x.textContent)
  state=s;signature=sig;if(fresh)chosen=null
  const draft=$('#clue')?.value,focus=document.activeElement?.id==='clue'
  render();for(const summary of document.querySelectorAll('#room details summary')){if(expanded.includes(summary.textContent))summary.parentElement.open=true}
  if(!fresh&&draft&&$('#clue')){$('#clue').value=draft;if(focus)$('#clue').focus()}
}
const actionButton=(a,t,disabled=false)=>'<button class="primary" data-action="'+a+'" '+(disabled?'disabled':'')+'>'+t+'</button>'
function render(){
  const local=playMode==='local'
  $('#home').hidden=true;const room=$('#room');room.hidden=false
  const s=state,host=s.me===0,story=s.me===s.narrator,n=s.players.length,duo=n===2
  const chips=s.players.map((p,i)=>'<span class="chip">'+esc(p.name)+(i===s.me?' · شما':'')+(s.phase==='lobby'?(i===0?' · میزبان':''):' · '+fa(p.score)+' امتیاز')+(['vote','submit'].includes(s.phase)&&p.ready?' ✓':'')+'</span>').join('')
  let inner='',cards=[],canPick=false,action=''
  if(s.phase==='lobby')inner='<h2>انتظار برای بازیکنان</h2><p>'+(local?'برای هر مهمان، دعوت تصویری جدا بساز. همه به یک وای‌فای وصل باشید.':'لینک دعوت یا کد میز را برای دوستانت بفرست.')+'</p>'+(host?actionButton('start','شروع بازی',n<2):'منتظر شروع بازی توسط میزبان باشید.')
  if(s.phase==='clue'){inner='<h2>'+(story?'نوبت قصه‌گویی توست':'قصه‌گو در حال انتخاب کارت است')+'</h2>'
    if(story){inner+='<p>از دست خودت یک تصویر انتخاب کن و سرنخی برای آن بنویس.</p><label>سرنخ شما<input id="clue" maxlength="100" placeholder="یک واژه یا یک جمله…"></label>';cards=s.hand;canPick=true;action='clue'}}
  if(s.phase==='submit'){inner='<h2>یک کارت برای این سرنخ</h2><p>«'+esc(s.clue)+'»</p>';if(!story&&s.own===undefined){cards=s.hand;canPick=true;action='submit'}else inner+='<p>منتظر انتخاب بقیهٔ بازیکنان هستیم.</p>'}
  if(s.phase==='vote'){inner='<h2>کدام کارت مال قصه‌گوست؟</h2><p>سرنخ «'+esc(s.clue)+'»</p>';cards=s.board;canPick=!story&&!s.voted
    if(canPick)action='vote';else inner+='<p>'+(s.voted?'رأی شما ثبت شد. ':'')+'منتظر پایان رأی‌گیری هستیم.</p>'}
  if(s.phase==='result'){inner='<h2>نتیجهٔ این دور</h2><p>کارت قصه‌گو برای سرنخ «'+esc(s.clue)+'»</p><div class="answer">'+tile(s.answer,'disabled')+'</div><p>'+s.players.map(p=>esc(p.name)+' ‌'+fa(p.gain)+' امتیاز').join('، ')+'</p>'+(host?actionButton('next',s.round===2*n?'دیدن نتیجهٔ نهایی':'دور بعد'):'میزبان بازی را ادامه می‌دهد.')}
  if(s.phase==='result'&&s.reveal){
    const revealed=s.reveal.map(({card,owner,voters})=>{
      const ownerName=owner===-1?'از دستهٔ کارت‌ها':esc(s.players[owner].name)
      const caption=(card===s.answer?'✦ کارت قصه‌گو · ':'')+ownerName
      const votes=voters.length?'رأی '+voters.map(i=>esc(s.players[i].name)).join('، '):'بدون رأی'
      return '<div class="revealcard">'+tile(card,'disabled')+'<strong>'+caption+'</strong><small>'+votes+'</small></div>'
    })
    inner+='<details class="help"><summary>کارت‌ها و رأی‌های این دور</summary><div class="grid">'+revealed.join('')+'</div></details>'
  }
  if(s.phase==='end'){const best=Math.max(...s.players.map(p=>p.score));inner='<h2>پایان بازی</h2><p>'+(duo?'با هم '+fa(best/2)+' بار از چهار دور درست حدس زدید.':'برنده'+(s.players.filter(p=>p.score===best).length>1?'‌های مشترک':'')+' با '+fa(best)+' امتیاز '+s.players.filter(p=>p.score===best).map(p=>esc(p.name)).join(' و '))+'</p>'+(host?actionButton('replay','بازی دوباره'):'منتظر شروع دوباره توسط میزبان باشید.')}
  if(cards.length)inner+='<div class="grid">'+cards.map(id=>tile(id,(!canPick||s.phase==='vote'&&id===s.own?'disabled':'')+(id===chosen?' aria-pressed="true"':''))).join('')+'</div>'
  if(action)inner+='<div class="actions">'+actionButton(action,{clue:'ثبت کارت و سرنخ',submit:'ثبت کارت',vote:'ثبت رأی'}[action],chosen===null)+'</div>'
  if(['vote','result','submit','clue'].includes(s.phase)&&!(canPick&&s.phase!=='vote'))inner+='<details class="help"><summary>کارت‌های دست من</summary><div class="grid">'+s.hand.map(id=>tile(id,'disabled')).join('')+'</div></details>'
  if(['submit','vote'].includes(s.phase)&&s.own!==undefined&&!cards.includes(s.own)){
    inner+='<details class="help"><summary>کارت انتخاب‌شدهٔ من</summary><div class="answer">'+tile(s.own,'disabled')+'</div></details>'
  }
  room.innerHTML='<div class="panel"><div class="roomhead"><h2>میز <b class="code">'+(local?'حضوری':fa(session.code))+'</b></h2><button class="secondary" id="invite" '+(local&&!host?'hidden':'')+'>'+(local?'دعوت با کد تصویری':'کپی لینک دعوت')+'</button>'+(!local?'<button class="secondary" id="showQR">نمایش کد تصویری</button>':'')+'</div><p>'+(s.phase==='lobby'?fa(n)+' نفر از ۸ نفر حاضرند':'دور '+fa(s.round)+' از '+fa(n*2)+' · قصه‌گو '+esc(s.players[s.narrator].name))+'</p><div class="players">'+chips+'</div></div><div class="panel">'+inner+'</div><button class="textbutton" id="leave">بازگشت به صفحهٔ میزها</button>'
  const stageTitles={clue:'قصه‌گویی',submit:'انتخاب کارت',vote:'رأی‌گیری',result:'نتیجهٔ دور'}
  if(stageTitles[s.phase]){
    const stages=Object.keys(stageTitles).filter(key=>!duo||key!=='submit')
    const marker=document.createElement('ol');marker.className='stages';marker.setAttribute('aria-label','مراحل دور')
    marker.innerHTML=stages.map((key,i)=>'<li '+(key===s.phase?'aria-current="step"':i<stages.indexOf(s.phase)?'class="done"':'')+'>'+stageTitles[key]+'</li>').join('')
    room.querySelectorAll('.panel')[1].prepend(marker)
  }
  room.querySelector('[aria-pressed="true"]')?.classList.add('selected')
  if($('#showQR'))$('#showQR').onclick=onlineInvitation
  $('#invite').onclick=async()=>{if(local){await hostPair();return}const u=new URL('game.html',location.href);u.searchParams.set('room',session.code);try{await navigator.clipboard.writeText(u.href);notify('لینک دعوت کپی شد.')}catch{openModal('<h2>لینک دعوت</h2><input readonly dir="ltr" value="'+esc(u.href)+'">');content.querySelector('input').select()}}
  $('#leave').onclick=()=>{openModal('<h2>بازگشت به میزها؟</h2><p>جای شما روی میز حفظ می‌شود. با گزینهٔ «ادامهٔ بازی» برمی‌گردید.</p><button class="primary" id="confirm">بازگشت</button>');$('#confirm').onclick=()=>{seq++;state=null;signature='';room.hidden=true;$('#home').hidden=false;modal.close();resumeButton()}}
}
$('#room').onclick=async e=>{const card=e.target.closest('[data-card]');if(card&&!card.disabled){chosen=+card.dataset.card;$('#room').querySelectorAll('[data-card]').forEach(x=>{x.classList.toggle('selected',x===card);x.setAttribute('aria-pressed',String(x===card))});const confirm=$('#room [data-action]');if(confirm)confirm.disabled=false;return}
  const btn=e.target.closest('[data-action]');if(!btn||busy)return;busy=true;seq++;btn.disabled=true
  try{const d=await api({...session,action:btn.dataset.action,round:state.round,card:chosen,clue:$('#clue')?.value});receive(d.state)}
  catch(err){notify(err.message);btn.disabled=false}finally{busy=false}}
function resumeButton(){if(!session||$('#resume'))return;const b=document.createElement('button');b.id='resume';b.className='secondary';b.textContent='ادامهٔ بازی';$('#home .actions').append(b);b.onclick=restore}
async function restore(){playMode=session?.local?'local':'online';try{const d=await api({...session,action:'state'});receive(d.state)}catch(e){notify(e.message);resumeButton()}}
try{session=JSON.parse(localStorage.getItem('khial.session'))}catch{}
if(location.hash.startsWith('#local='))chooseLocal(location.hash.slice(7)).catch(e=>notify(e.message));else if(invited){if(invited===session?.code){playMode='online';restore()}else entry(true)}else if(session)resumeButton()
setInterval(async()=>{if(playMode==='local'||!state||!session||busy||polling||document.hidden)return;polling=true;const id=seq;try{const d=await api({...session,action:'state'});if(id===seq&&!busy)receive(d.state)}catch{if(state)notify('ارتباط با میز قطع است. در حال اتصال دوباره…')}finally{polling=false}},1850)

// صداهای کوتاه با ساز مجازی روی دستگاه بازیکن پخش می‌شوند.
const motifs={clue:[392,523.25,659.25],submit:[523.25,440],vote:[440,554.37,440],result:[392,493.88,587.33],end:[392,493.88,587.33,783.99]}
let audioContext, soundOn=localStorage.getItem('khial.sound')!=='off'
function unlockSound(){
  if(!soundOn)return
  const AudioEngine=window.AudioContext||window.webkitAudioContext
  if(!AudioEngine)return
  try{audioContext??=new AudioEngine();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{})}catch{}
}
function playCue(phase){
  const notes=motifs[phase]
  if(!soundOn||!notes||audioContext?.state!=='running')return
  notes.forEach((frequency,i)=>{
    const start=audioContext.currentTime+i*.13,osc=audioContext.createOscillator(),gain=audioContext.createGain()
    osc.type='sine';osc.frequency.value=frequency
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.075,start+.018);gain.gain.exponentialRampToValueAtTime(.0001,start+.36)
    osc.connect(gain);gain.connect(audioContext.destination);osc.start(start);osc.stop(start+.38)
    osc.onended=()=>{osc.disconnect();gain.disconnect()}
  })
}
function soundLabel(){
  const btn=$('#sound');btn.textContent=soundOn?'♫  صدا روشن':'♫  صدا خاموش';btn.setAttribute('aria-pressed',String(soundOn))
}
soundLabel()
document.addEventListener('click',unlockSound,true)
$('#sound').onclick=async()=>{soundOn=!soundOn;soundLabel();localStorage.setItem('khial.sound',soundOn?'on':'off')
  if(soundOn){unlockSound();try{await audioContext?.resume();playCue('submit')}catch{}}
  else if(audioContext?.state==='running')audioContext.suspend().catch(()=>{})
}
