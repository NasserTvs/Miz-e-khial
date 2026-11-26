import {env} from 'cloudflare:workers'
import {act,create,join,view,requireRule} from './game.mjs'
function headers(req: Request){
  const h=new Headers({'Cache-Control':'no-store','Vary':'Origin'})
  if(req.headers.get('Origin')==='https://nassertvs.github.io'){
    h.set('Access-Control-Allow-Origin','https://nassertvs.github.io')
    h.set('Access-Control-Allow-Methods','POST, OPTIONS')
    h.set('Access-Control-Allow-Headers','Content-Type')
  }
  return h
}
export function OPTIONS(req:Request){return new Response(null,{status:204,headers:headers(req)})}
export async function POST(req:Request){
  const json=(x:unknown,status=200)=>Response.json(x,{status,headers:headers(req)})
  try{
    const b=await req.json(),db=env.DB!
    const now=Date.now(),expires=now+86400000
    if(b.action==='create'){
      const g=create(b.name)
      await db.prepare('DELETE FROM rooms WHERE expires < ?').bind(now).run()
      for(let n=0;n<5;n++){
        const code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000)
        const saved=await db.prepare('INSERT OR IGNORE INTO rooms VALUES (?,?,?,?)').bind(code,JSON.stringify(g),0,expires).run()
        if(saved.meta.changes)return json({code,token:g.players[0].token,state:view(g,0)})
      }
      return json({error:'دوباره میز بسازید.'},409)
    }
    for(let n=0;n<10;n++){
      const r=await db.prepare('SELECT body,version FROM rooms WHERE code=? AND expires>?').bind(String(b.code),now).first<{body:string,version:number}>()
      requireRule(r,'میزی با این کد پیدا نشد یا زمان آن گذشته است.')
      const g=JSON.parse(r!.body)
      const token=b.action==='join'?join(g,b.name):b.token
      const i=g.players.findIndex((p:{token:string})=>p.token===token)
      requireRule(i>=0,'این دستگاه به میز وارد نشده است.')
      if(b.action==='state')return json({state:view(g,i)})
      if(b.action!=='join')act(g,i,b)
      const saved=await db.prepare('UPDATE rooms SET body=?,version=version+1,expires=? WHERE code=? AND version=?').bind(JSON.stringify(g),expires,b.code,r!.version).run()
      if(saved.meta.changes)return json({code:b.code,token,state:view(g,i)})
    }
    return json({error:'میز در حال به‌روزرسانی است. دوباره تلاش کنید.'},409)
  }catch(e){const msg=e instanceof Error&&/[آ-ی]/.test(e.message)?e.message:'ارتباط با میز برقرار نشد. دوباره تلاش کنید.';return json({error:msg},400)}
}
