import { validateQuantusAddress, validateEvmAddress } from './address-checks.mjs';
export { validateQuantusAddress, validateEvmAddress };
export const SETTLEMENT_POLICY = 'qtc_usdt_bsc_v1';
export const LEGACY_SETTLEMENT_POLICY = 'legacy_instructions';
export const PAYMENT_NETWORK = 'bsc';
export const PAYMENT_FLOW = 'platform_usdt_bsc_v1';
export const LEGACY_PAYMENT_FLOW = 'legacy_direct';
export const PLATFORM_USDT_ADDRESS = '0xC1D5795e4dCfa601c9E93944A98Ac03a0c5eDbE6';
export const MAX_OPEN_ORDERS = 3;
export function platformPaymentTerms(p) {
  // A missing value must never silently upgrade an old client's payment path.
  if (p.paymentFlow !== PAYMENT_FLOW || p.platformUsdtAddress !== PLATFORM_USDT_ADDRESS) throw new Error('付款流程已更新，请核对平台 BSC USDT 收款地址后重新下单。');
  return {paymentFlow: PAYMENT_FLOW, platformUsdtAddress: PLATFORM_USDT_ADDRESS};
}
export function receivingTerms(p) {
  if (!['buy', 'sell'].includes(p.side)) throw new Error('请选择买入或卖出。');
  if (p.settlementPolicy !== SETTLEMENT_POLICY || p.paymentNetwork !== PAYMENT_NETWORK) throw new Error('收款规则已更新，请选择 BSC（BNB Smart Chain）并重新确认。');
  return { settlementPolicy: SETTLEMENT_POLICY, paymentNetwork: PAYMENT_NETWORK, receiveAddress: p.side === 'buy' ? validateQuantusAddress(p.receiveAddress) : validateEvmAddress(p.receiveAddress) };
}
export function reviewedAddresses(p) {
  if (p.settlementPolicy !== SETTLEMENT_POLICY || p.paymentNetwork !== PAYMENT_NETWORK) throw new Error('收款规则或网络不正确，请重新核对。');
  if (p.addressesChecked !== true) throw new Error('请先核对双方收款地址与结算网络。');
  return { settlementPolicy: SETTLEMENT_POLICY, paymentNetwork: PAYMENT_NETWORK, buyerQtcAddress: validateQuantusAddress(p.buyerQtcAddress), sellerUsdtAddress: validateEvmAddress(p.sellerUsdtAddress), addressesChecked: true };
}
