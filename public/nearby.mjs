import {create, join, act, view} from './local-rules.mjs?v=6'

const hostKey='khial.nearby.host.v1'
const ticketPrefix='khial2.'
let game,table,guestChannel,waitingOffer,notifyState,notifyError
let latest,guestPeer,serial=0
const peers=new Map(), requests=new Map()
export function configure(onState,onError){notifyState=onState;notifyError=onError}
export function canResume(){return !!sessionStorage.getItem(hostKey)}
export function hosting(){return !!game}
function persist(){sessionStorage.setItem(hostKey,JSON.stringify({game,table}))}
function hostView(){return {code:table,state:view(game,0)}}
export function start(name){const next=create(name);shutdown();game=next;table=crypto.randomUUID();persist();return hostView()}
export function resume(){const saved=JSON.parse(sessionStorage.getItem(hostKey));game=saved.game;table=saved.table;return hostView()}
export function shutdown(){
  cancelOffer();guestPeer?.close();guestPeer=null;guestChannel=null
  for(const {pc} of peers.values())pc.close()
  peers.clear();game=null;latest=null
  for(const x of requests.values()){clearTimeout(x.timer);x.reject(Error('اتصال بسته شد.'))}requests.clear()
}
function send(ch,msg){if(ch.readyState==='open')ch.send(JSON.stringify(msg))}
function refresh(){
  persist()
  for(const [i,{channel}] of peers)send(channel,{kind:'state',state:view(game,i)})
  notifyState(view(game,0))
}
function newPC(){
  if(!globalThis.RTCPeerConnection)throw Error('این مرورگر اتصال حضوری را پشتیبانی نمی‌کند.')
  return new RTCPeerConnection({iceServers:[]})
}
async function gather(pc,description){
  const candidates=new Set()
  const record=event=>{
    if(event.candidate?.candidate)candidates.add('a='+event.candidate.candidate)
  }
  pc.addEventListener('icecandidate',record)
  try{
    await pc.setLocalDescription(description)
    if(pc.iceGatheringState!=='complete')await new Promise(resolve=>{
      const finish=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',change);resolve()}
      const change=()=>{if(pc.iceGatheringState==='complete')finish()}
      const timer=setTimeout(finish,12000)
      pc.addEventListener('icegatheringstatechange',change);change()
    })
    // The game negotiates a single data channel (one media section).
    const sdp=pc.localDescription.sdp
    const lines=sdp.trimEnd().split(/\r?\n/)
    const end=lines.indexOf('a=end-of-candidates')
    lines.splice(end<0?lines.length:end,0,...[...candidates].filter(c=>!lines.includes(c)))
    return lines.join('\r\n')+'\r\n'
  }finally{pc.removeEventListener('icecandidate',record)}
}
async function ticket(data){
  const bytes=new TextEncoder().encode(JSON.stringify(data))
  const zipped=typeof CompressionStream==='function'
  const raw=zipped?new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer()):bytes
  return ticketPrefix+(zipped?'z':'u')+btoa(String.fromCharCode(...raw)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
}
async function parse(text,kind){
  try{
    let input=text.trim()
    if(input.includes('#local='))input=input.slice(input.indexOf('#local=')+7)
    if(!input.startsWith(ticketPrefix)||input.length>16000)throw Error()
    const payload=input.slice(ticketPrefix.length),bytes=Uint8Array.from(atob(payload.slice(1).replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))
    const body=new Blob([bytes]).stream()
    const data=await new Response(payload[0]==='z'?body.pipeThrough(new DecompressionStream('deflate')):body).json()
    if(data.kind!==kind||typeof data.sdp!=='string'||typeof data.id!=='string'||typeof data.table!=='string')throw Error()
    return data
  }catch{throw Error('کد اتصال معتبر نیست. کد همین دعوت را دوباره اسکن یا جای‌گذاری کن.')}
}
export function cancelOffer(){waitingOffer?.pc.close();waitingOffer=null}
export async function invite(){
  if(!game)throw Error('ابتدا میز حضوری بساز.')
  cancelOffer()
  const pc=newPC(),id=crypto.randomUUID(),ch=pc.createDataChannel('میز خیال')
  const offer={pc,id,ch};waitingOffer=offer
  let index=-1
  ch.onmessage=e=>{
    let m
    try{
      if(typeof e.data!=='string'||e.data.length>5000)return
      m=JSON.parse(e.data)
      if(index<0){
        if(m.kind!=='join'||waitingOffer!==offer)throw Error('دعوت منقضی شده است.')
        index=game.players.findIndex((p,i)=>i>0&&p.token===m.token)
        if(index<0){const token=join(game,m.name);index=game.players.findIndex(p=>p.token===token)}
        peers.get(index)?.pc.close();peers.set(index,{pc,channel:ch})
        waitingOffer=null
        send(ch,{kind:'welcome',code:table,token:game.players[index].token,state:view(game,index)})
        refresh();return
      }
      if(peers.get(index)?.channel!==ch||m.kind!=='act')return
      act(game,index,m.body);send(ch,{kind:'reply',id:m.id,state:view(game,index)});refresh()
    }catch(err){send(ch,{kind:index<0?'denied':'reply',id:m?.id,error:err.message})}
  }
  ch.onclose=()=>{if(index>0&&peers.get(index)?.channel===ch){peers.delete(index);notifyError('اتصال '+game.players[index].name+' قطع شد. با دعوت تازه می‌تواند برگردد.')}}
  const sdp=await gather(pc,await pc.createOffer())
  const url=new URL('game.html',location.href);url.hash='local='+await ticket({kind:'offer',id,table,sdp})
  return url.href
}
export async function accept(text){
  const d=await parse(text,'answer'),o=waitingOffer
  if(!o||d.id!==o.id||d.table!==table)throw Error('این پاسخ برای دعوت فعلی نیست.')
  await o.pc.setRemoteDescription({type:'answer',sdp:d.sdp})
}
export async function connect(text,name,onWelcome){
  if(!name.trim()||name.trim().length>20)throw Error('نام بازیکن را وارد کن.')
  const d=await parse(text,'offer');shutdown();table=d.table
  const pc=newPC();guestPeer=pc
  pc.ondatachannel=e=>{
    const ch=e.channel;guestChannel=ch
    const hello=()=>send(ch,{kind:'join',name,token:localStorage.getItem('khial.peer.'+table)})
    ch.onopen=hello
    ch.onmessage=ev=>{
      const m=JSON.parse(ev.data)
      if(m.kind==='denied'){notifyError(m.error);return}
      if(m.kind==='welcome'){latest=m.state;localStorage.setItem('khial.peer.'+table,m.token);onWelcome(m);return}
      if(m.kind==='reply'){
        const req=requests.get(m.id);if(!req)return
        clearTimeout(req.timer);requests.delete(m.id)
        if(m.error)req.reject(Error(m.error));else {latest=m.state;req.resolve({state:m.state})}
      }
      if(m.kind==='state'){latest=m.state;notifyState(latest)}
    }
    ch.onclose=()=>{if(guestChannel===ch)notifyError('ارتباط با میزبان قطع شد. برای اتصال دوباره دعوت تازه بگیر.')}
    if(ch.readyState==='open')hello()
  }
  await pc.setRemoteDescription({type:'offer',sdp:d.sdp})
  const sdp=await gather(pc,await pc.createAnswer())
  if(!sdp.includes('a=candidate:')&&!d.sdp.includes('a=candidate:')){
    pc.close()
    throw Error('هیچ‌کدام از دو مرورگر نشانی محلی اعلام نکرد. هر دو گوشی را به یک وای‌فای وصل کن، یا هات‌اسپات را روی گوشی دیگری روشن کن و پس از اتصال دستگاه‌ها دعوت تازه بساز.')
  }
  return ticket({kind:'answer',id:d.id,table,sdp})
}
export async function action(body){
  if(game){if(body.action!=='state'){act(game,0,body);refresh()}return hostView()}
  if(guestChannel?.readyState!=='open')throw Error('اتصال به میزبان برقرار نیست.')
  if(body.action==='state')return {state:latest}
  const id=++serial
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{requests.delete(id);reject(Error('میزبان پاسخ نداد. اتصال وای‌فای را بررسی کن.'))},8000)
    requests.set(id,{resolve,reject,timer});send(guestChannel,{kind:'act',id,body})
  })
}
