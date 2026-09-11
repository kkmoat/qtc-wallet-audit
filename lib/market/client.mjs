import {normalize,validateChallenge} from './domain.mjs';
const REVIEW_ACTIONS=new Set(['listing_review','trade_review','escrow_review','history_add']);
async function send(url,body,credentials='omit'){
 const r=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials,signal:AbortSignal.timeout(25000),cache:!body&&/^\/api\/market\/(orders|history)(?:\?|$)/.test(url)?'default':'no-store'});
 if(r.status===429)throw new Error('访问过于频繁，请约一分钟后重试。');
 const d=await r.json();if(!d||typeof d!=="object"||Array.isArray(d))throw new Error("响应格式错误。");
 if(!r.ok)throw Object.assign(new Error(d.error||'暂时无法连接市场服务。'),{status:r.status});return d;
}
// Ordinary reads, challenges and actions never carry browser cookies.
export async function api(url,body){return send(url,body)}
export async function signRequest(wallet,action,payload,reviewPassword=''){
 try{
 if(!wallet.account)throw new Error('请先解锁钱包。');
 const session=wallet.getSession(),check=()=>{if(!wallet.isSession(session))throw new Error('钱包会话已改变，原操作已停止。请重新确认。')};
 const expected={address:wallet.account.address,origin:location.origin,action,payload:normalize(action,payload)};
 const c=await api('/api/market/challenge',{...expected,publicKey:wallet.account.publicKey});check();validateChallenge(c,expected);
 const signature=await wallet.sign(c,expected);check();
 const reviewing=REVIEW_ACTIONS.has(action),legacy=reviewing&&!!reviewPassword;
 // The current UI uses the HttpOnly session only for this fixed same-origin
 // review endpoint. Explicit legacy passwords remain compatible with old clients.
 const extra=legacy?{reviewPassword}:{};
 const result=await send('/api/market/commit',{id:c.id,...signature,...extra},reviewing&&!legacy?'same-origin':'omit');check();return result;
 }finally{reviewPassword=''}
}
