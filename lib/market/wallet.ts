export interface WalletAccount{address:string;publicKey:string;scheme:string;path:string}
export interface Vault{kind:string;version:number;address:string;scheme:string;path:string;kdf:{name:string;hash:string;iterations:number};cipher:string;salt:string;iv:string;data:string}
export const VAULT_KEY='qtc-market.wallet.v1';
export type WalletProgress='idle'|'loading'|'ready'|'decrypting'|'deriving'|'encrypting'|'signing';
const LOAD_TIMEOUT=20000,OPERATION_TIMEOUT=30000;
const operationStages=new Set<WalletProgress>(['decrypting','deriving','encrypting','signing']);
export class WalletClient{
 private worker:Worker|null=null;
 private seq=0;private closed=false;private loaded=false;private active=false;
 private failure='钱包已锁定。';
 private startupTimer:ReturnType<typeof setTimeout>|undefined;
 private ready:Promise<void>;private resolveReady!:()=>void;private rejectReady!:(error:Error)=>void;
 private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 constructor(private onProgress:(stage:WalletProgress)=>void=()=>{},private onClosed:(reason:string)=>void=()=>{}){
  this.ready=new Promise<void>((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject});
  // Preloading may fail before a form submits; attach a rejection handler now.
  void this.ready.catch(()=>{});
  this.startupTimer=setTimeout(()=>this.close('本地钱包组件加载超时，请检查网络后重试。'),LOAD_TIMEOUT);
  try{
   this.worker=new Worker('/crypto/wallet-worker.js',{type:'module'});
   this.worker.onmessage=e=>{
    if(this.closed)return;
    const data=e.data;if(!data||typeof data!=='object')return;
    if(data.type==='ready'){
     if(!this.loaded){this.loaded=true;clearTimeout(this.startupTimer);this.onProgress('ready');this.resolveReady()}
     return;
    }
    if(data.type==='fatal'){this.close('本地钱包组件加载失败，请检查网络后重试。');return}
    const pending=this.pending.get(data.id);if(!pending)return;
    if(data.type==='progress'){
     if(operationStages.has(data.stage))this.onProgress(data.stage);
     return;
    }
    if(typeof data.ok!=='boolean')return;
    clearTimeout(pending.timer);this.pending.delete(data.id);this.onProgress('ready');
    data.ok?pending.resolve(data.result):pending.reject(new Error(typeof data.error==='string'?data.error:'本地钱包操作失败。'));
   };
   this.worker.onerror=()=>this.close('本地钱包组件加载失败，请检查网络后重试。');
   this.worker.onmessageerror=()=>this.close('本地钱包通信失败，请重试。');
  }catch{this.close('本地钱包组件加载失败，请检查网络后重试。')}
 }
 get isClosed(){return this.closed}
 prepare():Promise<void>{return this.closed?Promise.reject(new Error(this.failure)):this.ready}
 async request<T>(type:string,rest:Record<string,unknown>={}):Promise<T>{
  if(this.closed)throw new Error(this.failure);
  if(this.active)throw new Error('本地钱包正在处理，请等待或取消后重试。');
  this.active=true;
  try{
   await this.prepare();if(this.closed)throw new Error(this.failure);
   return await new Promise<T>((resolve,reject)=>{
    const id=++this.seq,timer=setTimeout(()=>this.close('本地钱包处理超时，已停止本次操作，请重试。'),OPERATION_TIMEOUT);
    this.pending.set(id,{resolve,reject,timer});
    try{this.worker!.postMessage({...rest,type,id})}catch{this.close('本地钱包通信失败，请重试。')}
   });
  }finally{this.active=false}
 }
 close(reason='钱包已锁定。'){
  if(this.closed)return;this.closed=true;this.failure=reason;clearTimeout(this.startupTimer);
  this.worker?.terminate();this.worker=null;this.rejectReady(new Error(reason));
  for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error(reason))}this.pending.clear();
  this.onProgress('idle');this.onClosed(reason);
 }
}
export function saveVault(v:Vault){const raw=JSON.stringify(v);localStorage.setItem(VAULT_KEY,raw);if(localStorage.getItem(VAULT_KEY)!==raw)throw new Error('浏览器无法保存钱包，请检查存储权限。')}
export function readVault():Vault|null{const raw=localStorage.getItem(VAULT_KEY);if(!raw)return null;if(raw.length>12000)throw new Error('本地钱包文件异常。');const v=JSON.parse(raw);if(v.kind!=='qtc-market-wallet'||v.version!==1)throw new Error('本地钱包版本不受支持。');return v;}
export async function readBalance(address:string){const r=await fetch('https://sqm.quantus.com/v1/graphql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'query Balance($id:String!){account:account_by_pk(id:$id){free reserved frozen} stats:chain_stats_by_pk(id:"global"){block_height}}',variables:{id:address}}),credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('余额查询暂不可用。');const j=await r.json() as {errors?:unknown;data?:{account?:{free?:string;reserved?:string;frozen?:string};stats?:{block_height:number}}};if(j.errors||!j.data?.stats)throw new Error('无法取得余额。');const free=j.data.account?.free??'0';if(!/^\d+$/.test(free))throw new Error('余额格式不正确。');return{free,block:j.data.stats.block_height}}
