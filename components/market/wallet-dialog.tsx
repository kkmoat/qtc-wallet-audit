'use client';
import {useEffect,useEffectEvent,useLayoutEffect,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {ShieldCheck,KeyRound,Copy,Download,LoaderCircle} from 'lucide-react';
import type {WalletState} from '@/lib/market/use-wallet';
import type {Vault,WalletAccount} from '@/lib/market/wallet';
import {useI18n} from '@/lib/i18n';
export function downloadVault(v:Vault){const url=URL.createObjectURL(new Blob([JSON.stringify(v,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`QTC-wallet-${v.address.slice(-8)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
type Mode='start'|'backup'|'recover'|'file';
type StagedWallet={account:WalletAccount;vault:Vault;phrase:string};
export function WalletDialog({open,onClose,wallet,recoveryFirst=false}:{open:boolean;onClose:()=>void;wallet:WalletState;recoveryFirst?:boolean}){
 const {t,error:translateError}=useI18n();
 const initialMode=():Mode=>!wallet.vault&&recoveryFirst?'file':'start';
 const[mode,setMode]=useState<Mode>(initialMode),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[phrase,setPhrase]=useState(''),[answers,setAnswers]=useState(['','']),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[preparing,setPreparing]=useState(false),[preloadFailed,setPreloadFailed]=useState(false),[cancelled,setCancelled]=useState(false),[elapsed,setElapsed]=useState(0),[error,setError]=useState(''),[staged,setStaged]=useState<StagedWallet|null>(null),[file,setFile]=useState<Vault|null>(null);
 const[backupFeedback,setBackupFeedback]=useState<[string,string]|null>(null),[copying,setCopying]=useState(false);
 const mounted=useRef(false),closing=useRef(false),generation=useRef(0),inFlight=useRef(false),copyInFlight=useRef(false),startedAt=useRef(0),fileRead=useRef(0),fileInput=useRef<HTMLInputElement>(null),stagedRef=useRef<StagedWallet|null>(null),walletRef=useRef(wallet),openRef=useRef(open);
 useLayoutEffect(()=>{walletRef.current=wallet;openRef.current=open},[wallet,open]);
 const processing=busy||preparing;
 const current=(request:number)=>mounted.current&&!closing.current&&openRef.current&&generation.current===request;
 const clearPrivateFields=()=>{setBackupFeedback(null);setPassword('');setConfirmation('');setPhrase('');setAnswers(['','']);setSaved(false);setStaged(null);stagedRef.current=null;setFile(null);fileRead.current++;if(fileInput.current)fileInput.current.value='';copyInFlight.current=false;setCopying(false)};
 const reset=()=>{clearPrivateFields();setError('');setPreloadFailed(false);setCancelled(false);setMode(initialMode())};
 const invalidate=()=>{generation.current++;inFlight.current=false;setBusy(false);setPreparing(false)};
 const cancel=()=>{invalidate();walletRef.current.cancelOperation();clearPrivateFields();setError('');setPreloadFailed(false);setCancelled(true);if(mode==='backup')setMode(initialMode())};
 const close=()=>{if(closing.current)return;closing.current=true;const ownsWallet=inFlight.current||stagedRef.current!==null;invalidate();if(ownsWallet)walletRef.current.cancelOperation();reset();onClose()};
 const begin=()=>{if(inFlight.current||copyInFlight.current||closing.current||!mounted.current||!openRef.current)return null;inFlight.current=true;const request=++generation.current;startedAt.current=Date.now();setElapsed(0);setError('');setCancelled(false);return request};
 const prepare=async()=>{
  const request=begin();if(request===null)return;
  setPreparing(true);setPreloadFailed(false);
  try{await walletRef.current.prepare()}
  catch(e){if(current(request)){setPreloadFailed(true);setError(e instanceof Error?e.message:'本地钱包操作失败。')}}
  finally{if(current(request)){inFlight.current=false;setPreparing(false)}}
 };
 const initialize=useEffectEvent(()=>{closing.current=false;reset();setBusy(false);setPreparing(false);if(open)void prepare()});
 const dispose=useEffectEvent(()=>{mounted.current=false;generation.current++;fileRead.current++;if(inFlight.current||stagedRef.current)walletRef.current.cancelOperation();inFlight.current=false;stagedRef.current=null});
 useEffect(()=>{
  mounted.current=true;const request=generation.current;
  // A discarded mount must not start a worker or restore private form state.
  queueMicrotask(()=>{if(mounted.current&&generation.current===request)initialize()});
  return()=>dispose();
 },[open]);
 useEffect(()=>{if(!processing)return;const tick=()=>setElapsed(Math.max(0,Math.floor((Date.now()-startedAt.current)/1000)));tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer)},[processing]);
 const run=async(fn:(isCurrent:()=>boolean)=>Promise<void>)=>{
  const request=begin();if(request===null)return;
  setBusy(true);setPreloadFailed(false);
  try{await fn(()=>current(request))}
  catch(e){if(current(request))setError(e instanceof Error?e.message:'本地钱包操作失败。')}
  finally{if(current(request)){inFlight.current=false;setBusy(false)}}
 };
 const passwordCheck=()=>{if(password.length<12||password.length>256)throw new Error('请设置至少 12 个字符的密码。');if(password!==confirmation)throw new Error('两次输入的密码不一致。')};
 const copyBackup=async()=>{
  if(!staged||inFlight.current||copyInFlight.current)return;
  const request=generation.current;copyInFlight.current=true;setCopying(true);setBackupFeedback(null);setError('');
  try{await navigator.clipboard.writeText(staged.phrase);if(current(request))setBackupFeedback(['助记词已复制。请勿分享给他人，用后清理剪贴板。','Recovery phrase copied. Keep it private and clear your clipboard after use.'])}
  catch{if(current(request))setError('复制失败，请检查浏览器剪贴板权限，或手动抄写助记词。')}
  finally{if(current(request)){copyInFlight.current=false;setCopying(false)}}
 };
 const downloadBackup=()=>{
  if(!staged||inFlight.current||copyInFlight.current)return;
  setBackupFeedback(null);setError('');
  try{downloadVault(staged.vault);setBackupFeedback(['已下载加密文件。恢复时需要创建钱包时设置的密码，请妥善保存。','Encrypted backup downloaded. Keep it safe; restoring it requires the password you set when creating this wallet.'])}
  catch{setError('无法下载加密文件，请检查浏览器下载设置后重试。')}
 };
 const finish=()=>{closing.current=true;invalidate();reset();onClose()};
 const changeMode=(next:Mode)=>{if(inFlight.current)return;generation.current++;reset();setMode(next)};
 async function submit(){await run(async isCurrent=>{
  if(mode==='backup'){
   if(!staged)throw new Error('请重新创建。');const words=staged.phrase.split(' ');
   if(answers[0].trim().toLowerCase()!==words[2]||answers[1].trim().toLowerCase()!==words[17]||!saved)throw new Error('请完成助记词备份核对。');
   if(!isCurrent())return;walletRef.current.accept(staged);stagedRef.current=null;finish();return;
  }
  if(mode==='recover'){passwordCheck();await walletRef.current.recover(phrase,password);if(isCurrent())finish();return}
  if(mode==='file'){if(!file)throw new Error('请选择加密备份文件。');await walletRef.current.restore(file,password);if(isCurrent())finish();return}
  if(wallet.vault){await walletRef.current.unlock(password);if(isCurrent())finish();return}
  passwordCheck();const result=await walletRef.current.create(password);if(!isCurrent())return;
  stagedRef.current=result;setStaged(result);setPassword('');setConfirmation('');setMode('backup');
 })}
 const phases:Record<WalletState['progress'],[string,string]>={idle:['等待本地处理…','Waiting for local processing…'],loading:['加载安全组件…','Loading security components…'],ready:['安全组件已就绪','Security components ready'],decrypting:['本地解密…','Decrypting locally…'],deriving:['生成签名账户…','Deriving signing account…'],encrypting:['本地加密…','Encrypting locally…'],signing:['本地签名…','Signing locally…']};
 const phase=t(...phases[wallet.progress]);
 const title=mode==='backup'?t('备份你的 24 个助记词','Back up your 24-word recovery phrase'):mode==='recover'?t('从助记词恢复钱包','Restore from a recovery phrase'):mode==='file'?t('恢复加密备份','Restore an encrypted backup'):wallet.vault?t('解锁本地钱包','Unlock your local wallet'):t('创建你的 QTC 钱包','Create your QTC wallet');
 return <Dialog open={open} onOpenChange={v=>{if(!v)close()}}><DialogContent className="dialog-scroll wallet-dialog"><DialogHeader><DialogTitle className="flex items-center gap-2 text-xl"><KeyRound className="text-primary"/>{title}</DialogTitle><DialogDescription>{mode==='backup'?t('按顺序抄写到安全的离线位置。任何人拿到助记词都能控制钱包。','Write the words in order and store them safely offline. Anyone with this phrase can control your wallet.'):t('所有钱包操作都在此浏览器完成，平台不接收你的密码或助记词。','All wallet operations run in this browser. The platform does not receive your password or recovery phrase.')}</DialogDescription></DialogHeader><form className="form-stack" onSubmit={e=>{e.preventDefault();void submit()}}>
 {mode==='backup'&&staged?<><div className="seed-grid">{staged.phrase.split(' ').map((w,i)=><div key={i}><span>{i+1}</span>{w}</div>)}</div><div className="wallet-backup-actions"><Button type="button" variant="outline" onClick={()=>void copyBackup()} disabled={processing||copying}>{copying?<LoaderCircle className="busy-spin"/>:<Copy/>}{copying?t('正在复制…','Copying…'):t('复制助记词','Copy recovery phrase')}</Button><Button type="button" variant="outline" onClick={downloadBackup} disabled={processing||copying}><Download/>{t('下载加密文件','Download encrypted backup')}</Button></div>{backupFeedback&&<p className="wallet-backup-feedback" role="status">{t(...backupFeedback)}</p>}<p className="small muted">{t('加密文件仅在本地生成，需用创建钱包时设置的密码恢复。请将文件与密码分开保存。','The encrypted file is created locally and requires your wallet password to restore. Store the file and password separately.')}</p><p className="notice">{t('平台无法找回助记词或密码。清除浏览器数据或换设备后，需要助记词，或加密文件及其密码恢复。','The platform cannot recover your phrase or password. After clearing browser data or changing devices, restore with your recovery phrase or encrypted file and its password.')}</p><div className="form-two">{[3,18].map((n,i)=><label className="field" key={n}>{t('第 {number} 个助记词','Word {number}',{number:n})}<input value={answers[i]} onChange={e=>setAnswers(a=>a.map((x,j)=>j===i?e.target.value:x))} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={processing} required/></label>)}</div><label className="check-label"><Checkbox checked={saved} disabled={processing} onCheckedChange={x=>setSaved(x===true)}/>{t('我已离线保存全部助记词，明白平台无法恢复。','I have saved every word offline and understand that the platform cannot recover it.')}</label></>:<>
 {mode==='start'&&!wallet.vault&&<div className="notice"><ShieldCheck className="inline mr-2" size={18}/>{t('随机生成全新主网地址，采用 ML-DSA-65。无需导入已有钱包。','Generate a new mainnet address using ML-DSA-65. No existing wallet is required.')}</div>}
 {wallet.vault&&mode==='start'&&<div className="mono notice">{wallet.vault.address}</div>}
 {mode==='recover'&&<label className="field">{t('24 个助记词','24-word recovery phrase')}<textarea rows={4} autoComplete="off" spellCheck={false} value={phrase} onChange={e=>setPhrase(e.target.value)} disabled={processing} required placeholder={t('按原顺序输入，用空格分隔','Enter words in their original order, separated by spaces')}/></label>}
 {mode==='file'&&<label className="field">{t('本地加密备份文件','Local encrypted backup file')}<input ref={fileInput} type="file" accept=".json,application/json" disabled={processing} onChange={e=>{
  if(inFlight.current)return;const selected=e.target.files?.[0],read=++fileRead.current,request=generation.current;setFile(null);if(!selected)return;
  if(selected.size>12000){setError('文件过大，不是有效的加密钱包备份。');return}
  void selected.text().then(s=>{if(current(request)&&read===fileRead.current&&!inFlight.current){setFile(JSON.parse(s));setError('')}}).catch(()=>{if(current(request)&&read===fileRead.current&&!inFlight.current)setError('无法读取备份文件。')});
 }}/><small>{t('文件仅在浏览器内读取，不会上传。','The file is read only in your browser and is never uploaded.')}</small></label>}
 <label className="field">{mode==='file'?t('备份文件密码','Backup file password'):wallet.vault&&mode==='start'?t('本地密码','Local password'):t('设置本地密码','Set a local password')}<input type="password" autoComplete={wallet.vault&&mode==='start'?'current-password':'new-password'} value={password} minLength={12} maxLength={256} onChange={e=>setPassword(e.target.value)} disabled={processing} required placeholder={t('至少 12 个字符','At least 12 characters')}/></label>
 {(mode==='recover'||mode==='start'&&!wallet.vault)&&<label className="field">{t('再次输入密码','Confirm password')}<input type="password" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={processing} required minLength={12} maxLength={256}/><small>{t('本地密码只保护此设备上的钱包，不是链上密码。','This local password protects the wallet on this device; it is not an on-chain password.')}</small></label>}
 </>}
 {error&&<p className="error-box" role="alert">{translateError(error)}</p>}
 {preloadFailed&&<Button type="button" variant="outline" onClick={()=>void prepare()} disabled={processing}>{t('重新加载安全组件','Retry loading security components')}</Button>}
 {cancelled&&<p className="small muted" role="status">{t('已取消，本地钱包已锁定。可以重新输入后重试。','Cancelled. Your local wallet is locked. Enter your details again to retry.')}</p>}
 {processing&&<div className="wallet-operation-status"><div className="wallet-operation-heading"><LoaderCircle className="busy-spin" aria-hidden="true"/><span role="status">{phase}</span></div><p className="wallet-operation-elapsed">{t('已用时 {seconds} 秒','Elapsed: {seconds}s',{seconds:elapsed})}</p>{elapsed>=8&&<p className="wallet-operation-hint">{wallet.progress==='loading'?t('安全组件加载较慢，请检查网络，或取消后重试。','Security components are loading slowly. Check your connection, or cancel and retry.'):t('此设备处理时间较长，你可以继续等待或取消后重试。关闭此窗口也会停止当前操作。','This is taking longer on this device. You can keep waiting or cancel and retry. Closing this dialog also stops the current operation.')}</p>}<Button type="button" variant="outline" onClick={cancel}>{t('取消操作','Cancel operation')}</Button></div>}
 <Button type="submit" size="lg" disabled={processing||copying} className="w-full">{processing?<LoaderCircle className="busy-spin"/>:null}{processing?phase:mode==='backup'?t('备份完成，保存钱包','Backup complete — save wallet'):mode==='recover'||mode==='file'?t('恢复并加密保存','Restore and save encrypted wallet'):wallet.vault?t('解锁钱包','Unlock wallet'):t('生成新钱包','Generate new wallet')}</Button>
 {mode==='start'&&<div className="recovery-links"><button type="button" disabled={processing} onClick={()=>changeMode('recover')}>{wallet.vault?t('忘记密码？用助记词恢复','Forgot password? Restore with your recovery phrase'):t('已有备份？恢复助记词','Have a backup? Restore with your recovery phrase')}</button>{!wallet.vault&&<button type="button" disabled={processing} onClick={()=>changeMode('file')}>{t('恢复加密文件','Restore encrypted file')}</button>}</div>}
 {mode!=='start'&&mode!=='backup'&&(recoveryFirst&&!wallet.vault?<Button type="button" variant="ghost" disabled={processing} onClick={()=>changeMode(mode==='file'?'recover':'file')}>{mode==='file'?t('改用助记词恢复','Use a recovery phrase instead'):t('改用加密文件恢复','Use an encrypted file instead')}</Button>:<Button type="button" variant="ghost" disabled={processing} onClick={()=>changeMode(initialMode())}>{t('返回','Back')}</Button>)}
 </form></DialogContent></Dialog>
}
