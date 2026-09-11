'use client';
import {useState,useRef,useEffect,useCallback} from 'react';
import {WalletClient,readVault,saveVault,VAULT_KEY,type WalletAccount,type Vault,type WalletProgress} from './wallet';
type WalletResult={account:WalletAccount;vault:Vault};
type Session={client:WalletClient;generation:number};
export function useWallet(){
 const client=useRef<WalletClient|null>(null),generation=useRef(0),mounted=useRef(true),active=useRef<Session|null>(null),authenticated=useRef(false);
 const staged=useRef<{result:WalletResult;session:Session}|null>(null);
 const [vault,setVault]=useState<Vault|null>(null),[account,setAccount]=useState<WalletAccount|null>(null),[error,setError]=useState(''),[lockVersion,setLockVersion]=useState(0),[progress,setProgress]=useState<WalletProgress>('idle');
 const stop=useCallback((reason='钱包已锁定。')=>{
  generation.current++;active.current=null;staged.current=null;authenticated.current=false;
  const previous=client.current;client.current=null;previous?.close(reason);
  if(mounted.current){setAccount(null);setProgress('idle')}
 },[]);
 const lock=useCallback(()=>{stop();if(mounted.current)setLockVersion(v=>v+1)},[stop]);
 const cancelOperation=useCallback(()=>stop('本次本地钱包操作已取消。'),[stop]);
 useEffect(()=>{
  mounted.current=true;
  try{setVault(readVault())}catch{setError('本地钱包文件无法读取。请保留浏览器数据，使用已保存的加密备份恢复。')}
  return()=>{mounted.current=false;stop()};
 },[stop]);
 useEffect(()=>{
  let idle:ReturnType<typeof setTimeout>,hidden:ReturnType<typeof setTimeout>;
  const touch=()=>{clearTimeout(idle);idle=setTimeout(lock,300000)},visibility=()=>{clearTimeout(hidden);if(document.hidden)hidden=setTimeout(lock,60000)};
  const storage=(e:StorageEvent)=>{if(e.key===VAULT_KEY||e.key===null){lock();try{setVault(readVault())}catch{setError('本地钱包已改变，请刷新页面。')}}};
  touch();for(const name of ['pointerdown','keydown'])window.addEventListener(name,touch);
  window.addEventListener('pagehide',lock);window.addEventListener('storage',storage);document.addEventListener('visibilitychange',visibility);
  return()=>{clearTimeout(idle);clearTimeout(hidden);for(const name of ['pointerdown','keydown'])window.removeEventListener(name,touch);window.removeEventListener('pagehide',lock);window.removeEventListener('storage',storage);document.removeEventListener('visibilitychange',visibility)};
 },[lock]);
 const ensureClient=useCallback(()=>{
  if(!mounted.current)throw new Error('钱包会话已改变，原操作已停止。请重新确认。');
  if(client.current&&!client.current.isClosed)return client.current;
  let next:WalletClient|undefined;
  next=new WalletClient(stage=>{if(mounted.current&&next&&client.current===next)setProgress(stage)},reason=>{
   if(mounted.current&&next&&client.current===next){
    const hadSession=authenticated.current||staged.current!==null;
    generation.current++;client.current=null;active.current=null;staged.current=null;authenticated.current=false;setAccount(null);setProgress('idle');setError(reason);
    if(hadSession)setLockVersion(value=>value+1);
   }
  });
  client.current=next;setProgress(next.isClosed?'idle':'loading');return next;
 },[]);
 const current=(session:Session)=>mounted.current&&generation.current===session.generation&&client.current===session.client;
 const guard=(session:Session)=>{if(!current(session))throw new Error('钱包会话已改变，原操作已停止。请重新确认。')};
 const prepare=useCallback(async()=>{
  const worker=ensureClient();
  try{await worker.prepare()}
  catch(e){if(client.current===worker){client.current=null;worker.close();if(mounted.current)setProgress('idle')}throw e}
 },[ensureClient]);
 const begin=()=>{
  if(active.current)throw new Error('本地钱包正在处理，请等待或取消后重试。');
  const worker=ensureClient();generation.current++;staged.current=null;
  const session={client:worker,generation:generation.current};active.current=session;authenticated.current=false;setAccount(null);setError('');return session;
 };
 const finish=(session:Session)=>{if(active.current===session)active.current=null};
 const create=async(password:string)=>{
  if(vault||localStorage.getItem(VAULT_KEY))throw new Error('这个浏览器已有钱包，请先解锁。');
  const session=begin();
  try{const result=await session.client.request<WalletResult&{phrase:string}>('create',{password});guard(session);staged.current={result,session};return result}finally{finish(session)}
 };
 const accept=(result:WalletResult)=>{
  const pending=staged.current;if(!pending||pending.result!==result)throw new Error('钱包已锁定，请重新创建。');
  guard(pending.session);saveVault(result.vault);staged.current=null;setVault(result.vault);authenticated.current=true;setAccount(result.account);setError('');
 };
 const unlock=async(password:string)=>{
  if(!vault)throw new Error('没有本地钱包。');
  const session=begin();
  try{const result=await session.client.request<WalletAccount>('unlock',{vault,password});guard(session);authenticated.current=true;setAccount(result);setError('')}finally{finish(session)}
 };
 const recover=async(phrase:string,password:string)=>{
  const session=begin();
  try{
   const result=await session.client.request<WalletResult>('recover',{phrase,password});guard(session);
   if(vault&&result.account.address!==vault.address){stop();throw new Error('助记词对应的地址与当前钱包不同，原钱包没有被覆盖。')}
   try{saveVault(result.vault)}catch(error){stop();throw error}setVault(result.vault);authenticated.current=true;setAccount(result.account);setError('');
  }finally{finish(session)}
 };
 const restore=async(value:Vault,password:string)=>{
  const session=begin();
  try{
   const result=await session.client.request<WalletAccount>('unlock',{vault:value,password});guard(session);
   if(vault&&result.address!==vault.address){stop();throw new Error('备份地址与本地钱包不同，原钱包没有被覆盖。')}
   try{saveVault(value)}catch(error){stop();throw error}setVault(value);authenticated.current=true;setAccount(result);setError('');
  }finally{finish(session)}
 };
 const sign=async(challenge:unknown,expected:unknown)=>{
  if(!account||!client.current)throw new Error('请先解锁钱包。');
  if(active.current)throw new Error('本地钱包正在处理，请等待或取消后重试。');
  const session={client:client.current,generation:generation.current};active.current=session;
  try{const result=await session.client.request<{signature:string}>('sign',{challenge,expected});guard(session);return result}finally{finish(session)};
 };
 return{vault,account,error,lockVersion,progress,getSession:()=>generation.current,isSession:(value:number)=>generation.current===value,lock,cancelOperation,prepare,create,accept,unlock,recover,restore,sign};
}
export type WalletState=ReturnType<typeof useWallet>;
