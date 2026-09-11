import init,{deriveAccount,mnemonicFromEntropy,verifyMessage} from './quantus_browser_crypto.js';
import {encryptVault,decryptVault} from './vault.mjs';
import {validateChallenge,toHex} from './domain.mjs';

const STARTUP_ERROR='本地钱包组件加载失败，请检查网络后重试。';
let handle=null;
let startupError=null;
const ready=(async()=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(new URL('./quantus_browser_crypto_bg.wasm',import.meta.url),{
      signal:controller.signal,credentials:'same-origin',redirect:'error'
    });
    if(!response.ok)throw new Error('WASM load failed');
    await init({module_or_path:response});
    self.postMessage({type:'ready'});
  }catch{
    startupError=STARTUP_ERROR;
    self.postMessage({type:'fatal',error:STARTUP_ERROR});
  }finally{
    clearTimeout(timer);
  }
})();

function release(){if(handle){handle.clear();handle.free();handle=null;}}
function account(){return{address:handle.address,publicKey:toHex(handle.publicKey),scheme:handle.scheme,path:handle.path}}
function progress(id,stage){self.postMessage({id,type:'progress',stage});}

let chain=Promise.resolve();
self.onmessage=e=>{
  chain=chain.then(async()=>{
    const d=e.data;
    let phrase='',password=d.password;
    delete d.password;
    try{
      await ready;
      if(startupError)throw new Error(startupError);
      if(d.type==='create'){
        release();
        const entropy=crypto.getRandomValues(new Uint8Array(32));
        try{phrase=mnemonicFromEntropy(entropy)}finally{entropy.fill(0)}
        progress(d.id,'deriving');
        handle=deriveAccount(phrase,'ml-dsa-65',0);
        const a=account();
        progress(d.id,'encrypting');
        const vault=await encryptVault(phrase,password,a);
        self.postMessage({id:d.id,ok:true,result:{account:a,vault,phrase}});
      }else if(d.type==='unlock'){
        release();
        progress(d.id,'decrypting');
        phrase=await decryptVault(d.vault,password);
        progress(d.id,'deriving');
        handle=deriveAccount(phrase,'ml-dsa-65',0);
        if(handle.address!==d.vault.address||handle.path!==d.vault.path){
          release();
          throw new Error('钱包地址与备份不一致。');
        }
        self.postMessage({id:d.id,ok:true,result:account()});
      }else if(d.type==='recover'){
        release();
        phrase=String(d.phrase||'').trim().replace(/\s+/g,' ');
        delete d.phrase;
        if(phrase.split(' ').length!==24)throw new Error('请填写完整的 24 个助记词。');
        progress(d.id,'deriving');
        handle=deriveAccount(phrase,'ml-dsa-65',0);
        const a=account();
        progress(d.id,'encrypting');
        const vault=await encryptVault(phrase,password,a);
        self.postMessage({id:d.id,ok:true,result:{account:a,vault}});
      }else if(d.type==='sign'){
        if(!handle)throw new Error('请先解锁钱包。');
        const c=validateChallenge(d.challenge,{...d.expected,address:handle.address});
        progress(d.id,'signing');
        const msg=new TextEncoder().encode(c.message),sig=handle.signMessage(msg);
        if(!verifyMessage(handle.publicKey,msg,sig,'ml-dsa-65'))throw new Error('本地签名校验失败。');
        self.postMessage({id:d.id,ok:true,result:{signature:toHex(sig)}});
      }else if(d.type==='close'){
        release();
        self.postMessage({id:d.id,ok:true,result:null});
      }else throw new Error('未知的钱包操作。');
    }catch(err){
      if(d.type!=='sign')release();
      self.postMessage({id:d.id,ok:false,error:err instanceof Error?err.message:'本地钱包操作失败。'});
    }finally{
      phrase='';password='';delete d.phrase;
    }
  });
};
