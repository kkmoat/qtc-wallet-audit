import { receivingTerms, reviewedAddresses, platformPaymentTerms, SETTLEMENT_POLICY, LEGACY_SETTLEMENT_POLICY } from './settlement.mjs';
export { SETTLEMENT_POLICY, LEGACY_SETTLEMENT_POLICY, PAYMENT_NETWORK, PAYMENT_FLOW, LEGACY_PAYMENT_FLOW, PLATFORM_USDT_ADDRESS, MAX_OPEN_ORDERS, validateQuantusAddress, validateEvmAddress } from './settlement.mjs';
export const SCHEME='ml-dsa-65';
export const GENESIS='0xfb5487c0be6ae4ade2d41d16e50465129861636c2b8d61fa94d7a19631626fba';
export const DOMAIN='QTC_MARKET_MANUAL_V5';
export const FEE_POLICY='seller_usd_2pct_v1';
export const LEGACY_FEE_POLICY='legacy_no_fee';
export const LISTING_HOURS=Object.freeze([1,3,6,12,24]);
export const ADMIN_DESK_STATUSES=Object.freeze(['all','pending_review','in_progress','completed','cancelled','rejected','expired','disputed']);
// Immutable policies: future fee changes must introduce a new policy identifier.
export function feeTerms(total,policy,storedFee){
 if(![FEE_POLICY,LEGACY_FEE_POLICY].includes(policy))throw new Error('手续费规则已更新，请刷新并重新确认。');
 if(typeof total!=='string'||!/^\d{1,16}$/.test(total)||BigInt(total)<1n||BigInt(total)>2100000000000000n)throw new Error('成交总价无效。');
 const gross=BigInt(total),bps=policy===FEE_POLICY?200:0;
 const fee=storedFee===undefined?(gross*BigInt(bps)+5000n)/10000n:typeof storedFee==='string'&&/^\d{1,16}$/.test(storedFee)?BigInt(storedFee):-1n;
 if(fee<0n||fee>gross||(policy===LEGACY_FEE_POLICY&&fee!==0n))throw new Error('手续费记录无效。');
 return{feePolicy:policy,feeBps:bps,feePayer:bps?'seller':'none',feeCents:fee.toString(),buyerPayCents:gross.toString(),sellerReceiveCents:(gross-fee).toString()};
}
export function validAddress(value){return typeof value==='string'&&/^qz[1-9A-HJ-NP-Za-km-z]{40,62}$/.test(value)}
export function decimal(value,places,max){if(typeof value!=='string'||value.length>35||!new RegExp('^(0|[1-9][0-9]*)(\\.[0-9]{1,'+places+'})?$').test(value))throw new Error('请输入有效的正数，不支持科学计数法。');const [a,b='']=value.split('.');const n=BigInt(a)*10n**BigInt(places)+BigInt(b.padEnd(places,'0'));if(n<=0n||n>max)throw new Error('数量或单价超出允许范围。');return n;}
export function units(n,places){n=BigInt(n);const base=10n**BigInt(places),f=(n%base).toString().padStart(places,'0').replace(/0+$/,'');return(n/base).toString()+(f?'.'+f:'')}
function text(value,min,max,label){if(typeof value!=='string')throw new Error('请填写'+label);value=value.trim();if(value.length<min||value.length>max||/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(value))throw new Error(label+'长度或格式不正确。');return value;}
function id(value){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value))throw new Error('订单编号无效。');return value;}
function version(value){if(!Number.isSafeInteger(value)||value<0)throw new Error('订单版本无效，请刷新。');return value;}
function transactionHash(value,label){if(typeof value!=='string'||value.length!==66||!/^0x[0-9a-fA-F]{64}$/.test(value))throw new Error('请输入完整的 '+label+' 交易哈希。');return value.toLowerCase();}
export function totalCents(quantity,price){const n=decimal(quantity,12,21000000n*10n**12n)*decimal(price,6,1000000n*10n**6n);const cents=(n+5n*10n**15n)/10n**16n;if(cents<1n)throw new Error('整单总价至少为 0.01 USD。');return cents.toString();}
function quote(p,policy){const quantity=units(decimal(p.quantity,12,21000000n*10n**12n),12),price=units(decimal(p.price,6,1000000n*10n**6n),6),total=totalCents(quantity,price);const out={quantity,price,currency:'USD',totalCents:total,...feeTerms(total,policy)};for(const key of ['currency','totalCents','feePolicy','feeBps','feePayer','feeCents','buyerPayCents','sellerReceiveCents'])if(p[key]!==undefined&&p[key]!==out[key])throw new Error('费用与报价不一致，请重新确认。');return out;}
export function normalize(action,p){if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('无效的订单内容。');
 if(action==='history_add'){
  if(!['buy','sell'].includes(p.side))throw new Error('请选择买入或卖出。');
  if(p.currency!=='USD'||p.paymentMethod!=='USDT')throw new Error('历史成交仅支持 USD 报价、USDT 支付。');
  if(p.checked!==true)throw new Error('请先核实这笔历史成交已完成。');
  if(p.completedAt!==null&&(!Number.isSafeInteger(p.completedAt)||p.completedAt<0||p.completedAt>8640000000000000))throw new Error('实际成交时间无效。');
  const quantity=units(decimal(p.quantity,12,21000000n*10n**12n),12),price=units(decimal(p.price,6,1000000n*10n**6n),6),total=totalCents(quantity,price);
  if(p.totalCents!==undefined&&p.totalCents!==total)throw new Error('历史成交总额与数量、单价不一致。');
  return{entryId:id(p.entryId),side:p.side,quantity,price,totalCents:total,currency:'USD',paymentMethod:'USDT',completedAt:p.completedAt,note:text(p.note,0,240,'补录备注'),checked:true};
 }
 if(action==='publish'){if(Object.hasOwn(p,'days'))throw new Error('挂单有效期已改为小时，请刷新页面后重新确认。');if(!['buy','sell'].includes(p.side))throw new Error('请选择买入或卖出。');if(!LISTING_HOURS.includes(p.hours))throw new Error('请选择 1、3、6、12 或 24 小时有效期。');return{side:p.side,...quote(p,FEE_POLICY),hours:p.hours,...receivingTerms(p)};}
 if(action==='cancel')return{id:id(p.id),version:version(p.version)};
 if(action==='reserve')return{id:id(p.id),version:version(p.version),side:p.side,...quote(p,p.feePolicy),...receivingTerms(p),...platformPaymentTerms(p)};
 if(action==='set_receiving')return{id:id(p.id),version:version(p.version),side:p.side,...receivingTerms(p)};
 if(action==='desk'){
  if(!['mine','admin'].includes(p.scope)||!Number.isSafeInteger(p.page)||p.page<0||p.page>1000)throw new Error('查询范围无效。');
  const hasStatus=Object.hasOwn(p,'status');
  if(hasStatus&&p.scope!=='admin')throw new Error('状态筛选仅用于管理员查询。');
  if(hasStatus&&!ADMIN_DESK_STATUSES.includes(p.status))throw new Error('订单状态筛选无效。');
  return{scope:p.scope,page:p.page,...(hasStatus&&p.status!=='all'?{status:p.status}:{})};
 }
 if(action==='sell_capacity'){if(Object.keys(p).length)throw new Error('余额仅查询当前签名钱包，请刷新后重试。');return{};}
 if(action==='listing_review'){if(!['approve','reject'].includes(p.decision))throw new Error('审核操作无效。');return{id:id(p.id),version:version(p.version),decision:p.decision,reason:text(p.reason,p.decision==='reject'?2:0,240,'审核说明')};}
 if(action==='submit_evidence')return{id:id(p.id),version:version(p.version),evidence:text(p.evidence,5,1000,'结算凭证或说明')};
 if(action==='buyer_paid')return{id:id(p.id),version:version(p.version),paymentTxHash:transactionHash(p.paymentTxHash,'BSC USDT 付款')};
 if(action==='seller_sent')return{id:id(p.id),version:version(p.version),qtcTxHash:transactionHash(p.qtcTxHash,'QTC')};
 if(action==='escrow_review'){
  if(!['confirm_payment','confirm_qtc','complete','dispute','resume','close'].includes(p.decision))throw new Error('平台结算审核操作无效。');
  const out={id:id(p.id),version:version(p.version),decision:p.decision,reason:text(p.reason,2,500,'审核说明')};
  if(['confirm_payment','confirm_qtc','complete','close'].includes(p.decision)){if(p.checked!==true)throw new Error('请先核实本步骤的实际到账或退款情况。');out.checked=true;}
  if(p.decision==='confirm_payment')out.buyerPaymentTxHash=transactionHash(p.buyerPaymentTxHash,'买方 BSC USDT 付款');
  if(p.decision==='confirm_qtc')out.sellerQtcTxHash=transactionHash(p.sellerQtcTxHash,'卖方 QTC');
  if(p.decision==='complete'){out.platformPayoutTxHash=transactionHash(p.platformPayoutTxHash,'平台 BSC USDT 付款');out.feeChecked=p.feeChecked===true;out.feeReference=p.feeReference?text(p.feeReference,3,160,'手续费收取或扣款凭证'):'';}
  return out;
 }
 if(action==='trade_review'){
  if(!['approve','reject','dispute','complete','close'].includes(p.decision))throw new Error('审核操作无效。');
  const out={id:id(p.id),version:version(p.version),decision:p.decision,reason:text(p.reason,2,500,'审核说明')};
  if(p.decision==='approve'){out.buyerInstructions=text(p.buyerInstructions,5,1000,'买方结算指引');out.sellerInstructions=text(p.sellerInstructions,5,1000,'卖方结算指引');if(p.settlementPolicy===SETTLEMENT_POLICY)Object.assign(out,reviewedAddresses(p));else if(p.settlementPolicy!==undefined&&p.settlementPolicy!==LEGACY_SETTLEMENT_POLICY)throw new Error('未知收款规则，请刷新订单。');else if(['paymentNetwork','buyerQtcAddress','sellerUsdtAddress','addressesChecked'].some(key=>p[key]!==undefined))throw new Error('旧订单不可附加未经确认的收款地址。');}
  if(['complete','close'].includes(p.decision)){if(p.checked!==true)throw new Error('请先核实双方资金情况。');out.checked=true;}
  if(p.decision==='complete'){out.qtcTxHash=transactionHash(p.qtcTxHash,'QTC');out.paymentRef=text(p.paymentRef,3,160,'唯一付款凭证编号').toLowerCase();out.feeChecked=p.feeChecked===true;out.feeReference=p.feeReference?text(p.feeReference,3,160,'手续费收取或扣款凭证'):'';}
  return out;
 }
 throw new Error('旧版或未知操作，请刷新页面。');
}
export function messageFor(c){return JSON.stringify({domain:DOMAIN,genesis:GENESIS,origin:c.origin,address:c.address,action:c.action,payload:c.payload,nonce:c.id,expiresAt:c.expiresAt});}
export function validateChallenge(c,{address,action,payload,origin}){if(!c||!/^[-a-f0-9]{36}$/.test(c.id)||c.address!==address||c.origin!==origin||c.action!==action||!Number.isSafeInteger(c.expiresAt)||c.expiresAt<Date.now()||c.expiresAt>Date.now()+310000||JSON.stringify(c.payload)!==JSON.stringify(normalize(action,payload))||c.message!==messageFor(c))throw new Error('签名请求与确认的操作不一致，已停止。');return c;}
export const toHex=b=>Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');
export function fromHex(s,len){if(typeof s!=='string'||s.length!==len*2||!/^[0-9a-f]+$/.test(s))throw new Error('签名格式无效。');return Uint8Array.from(s.match(/../g),x=>parseInt(x,16));}
