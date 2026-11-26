export function requireRule(test, message){if(!test) throw new Error(message)}
export function shuffle(values){
  const result=[...values]
  for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}
  return result
}
function player(name){
  requireRule(typeof name==='string' && name.trim().length>0 && name.trim().length<=20,'نامی بین یک تا بیست حرف وارد کنید.')
  return {name:name.trim(),token:crypto.randomUUID(),score:0,hand:[]}
}
export function create(name){return {players:[player(name)],phase:'lobby',round:0,narrator:0}}
export function join(g,name){
  requireRule(g.phase==='lobby'&&g.players.length<8,'میز پر است یا بازی شروع شده است.')
  const p=player(name)
  requireRule(!g.players.some(x=>x.name===p.name),'این نام روی میز هست. نام دیگری انتخاب کنید.')
  g.players.push(p);return p.token
}
function draw(g){if(!g.deck.length){g.deck=shuffle(g.discard);g.discard=[]}return g.deck.pop()}
function begin(g){
  g.phase='clue';g.clue='';g.picks={};g.votes={};g.board=[];g.gains=[]
  for(const p of g.players)while(p.hand.length<5)p.hand.push(draw(g))
}
function moveCard(g,i,id){
  const hand=g.players[i].hand, at=hand.indexOf(id)
  requireRule(at>=0,'کارت انتخاب‌شده در دست شما نیست.')
  hand.splice(at,1);g.picks[i]=id
}
function score(g){
  const correct=g.picks[g.narrator], votes=Object.entries(g.votes)
  const count=votes.filter(([,id])=>id===correct).length, duo=g.players.length===2
  g.gains=g.players.map((p,i)=>{
    if(duo)return count?2:0
    if(i===g.narrator)return count>0&&count<votes.length?3:0
    const base=count===0||count===votes.length?2:g.votes[i]===correct?3:0
    return base+votes.filter(([,id])=>id===g.picks[i]).length
  })
  g.players.forEach((p,i)=>p.score+=g.gains[i]);g.phase='result'
}
export function act(g,i,b){
  const host=i===0, narrator=i===g.narrator
  requireRule(i>=0,'ورود دوباره لازم است.')
  if(b.action==='start'||b.action==='replay'){
    requireRule(host&&g.players.length>=2&&g.phase===(b.action==='start'?'lobby':'end'),'اکنون امکان شروع بازی نیست.')
    g.edition=2;g.deck=shuffle(Array.from({length:80},(_,i)=>i));g.discard=[];g.round=1;g.narrator=0
    for(const p of g.players){p.hand=[];p.score=0}begin(g);return
  }
  requireRule(b.round===g.round,'دور بازی تغییر کرده است.')
  if(b.action==='clue'){
    requireRule(g.phase==='clue'&&narrator,'اکنون نوبت قصه‌گو است.')
    requireRule(typeof b.clue==='string'&&b.clue.trim().length>=1&&b.clue.trim().length<=100,'سرنخ را در یک تا صد حرف بنویسید.')
    moveCard(g,i,b.card);g.clue=b.clue.trim();g.phase=g.players.length===2?'vote':'submit'
    if(g.phase==='vote')g.board=shuffle([b.card,draw(g),draw(g)])
  }else if(b.action==='submit'){
    requireRule(g.phase==='submit'&&!narrator&&!(i in g.picks),'انتخاب کارت در این مرحله ممکن نیست.')
    moveCard(g,i,b.card)
    if(Object.keys(g.picks).length===g.players.length){g.board=shuffle(Object.values(g.picks));g.phase='vote'}
  }else if(b.action==='vote'){
    requireRule(g.phase==='vote'&&!narrator&&!(i in g.votes)&&g.board.includes(b.card)&&b.card!==g.picks[i],'این رأی قابل ثبت نیست.')
    g.votes[i]=b.card
    if(Object.keys(g.votes).length===g.players.length-1)score(g)
  }else if(b.action==='next'){
    requireRule(g.phase==='result'&&host,'میزبان دور بعد را آغاز می‌کند.')
    if(g.round===g.players.length*2){g.phase='end';return}
    g.discard.push(...g.board);g.round++;g.narrator=(g.narrator+1)%g.players.length;begin(g)
  }else throw new Error('درخواست ناشناخته است.')
}
export function view(g,i){
  const reveal=['result','end'].includes(g.phase)
  return {edition:g.edition??1,me:i,phase:g.phase,round:g.round,narrator:g.narrator,clue:g.clue,hand:g.players[i].hand,board:g.board||[],own:g.picks?.[i],voted:i in (g.votes||{}),
    players:g.players.map((p,k)=>({name:p.name,score:p.score,ready:g.phase==='vote'?k===g.narrator||k in g.votes:k in (g.picks||{}),gain:reveal?g.gains[k]:0})),
    answer:reveal?g.picks[g.narrator]:undefined,
    reveal:reveal?g.board.map(card=>({
      card,owner:g.players.findIndex((_,k)=>g.picks[k]===card),
      voters:g.players.flatMap((_,k)=>g.votes[k]===card?[k]:[])
    })):undefined}
}
