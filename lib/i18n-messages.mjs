// Display-only translations for known application errors. Never use this on
// signed payloads, stored order instructions, user notes, or wallet secrets.
// Unknown strings are returned byte-for-byte; no network or storage is used.
const messages = new Map([
  // API, authentication, and request validation.
  ["本地钱包组件加载失败，请检查网络后重试。", "The local wallet component could not load. Check your connection and retry."],
  ["本地钱包组件加载超时，请检查网络后重试。", "Loading the local wallet component timed out. Check your connection and retry."],
  ["本地钱包通信失败，请重试。", "Communication with the local wallet failed. Try again."],
  ["本地钱包正在处理，请等待或取消后重试。", "The local wallet is processing. Wait, or cancel before trying again."],
  ["本地钱包处理超时，已停止本次操作，请重试。", "Local wallet processing timed out. This operation was stopped; try again."],
  ["本次本地钱包操作已取消。", "This local wallet operation was cancelled."],
  ['请在平台页面内执行操作。', 'Perform this action on the platform website.'],
  ['请求格式错误。', 'Invalid request format.'],
  ['请求为空。', 'The request is empty.'],
  ['请求内容过长。', 'The request is too large.'],
  ['请求无效。', 'Invalid request.'],
  ['查询无效。', 'Invalid query.'],
  ['响应格式错误。', 'Invalid response format.'],
  ['操作过于频繁，请一分钟后重试。', 'Too many requests. Try again in one minute.'],
  ['访问过于频繁，请约一分钟后重试。', 'Too many requests. Try again in about one minute.'],
  ['市场服务暂时不可用，请稍后重试。', 'The market service is temporarily unavailable. Try again later.'],
  ['暂时无法连接市场服务。', 'Unable to connect to the market service right now.'],
  ['地址格式错误。', 'Invalid address format.'],
  ['公钥与地址不匹配。', 'The public key does not match the address.'],
  ['签名请求无效。', 'Invalid signing request.'],
  ['签名请求已过期，请重新确认。', 'The signing request has expired. Review and confirm again.'],
  ['该操作已处理，请刷新订单核对结果。', 'This action has already been processed. Refresh the order to check the result.'],
  ['签名协议已更新或来源不匹配，请刷新后重试。', 'The signing protocol has changed or the origin does not match. Refresh and try again.'],
  ['钱包签名验证失败。', 'Wallet signature verification failed.'],
  ['签名请求与确认的操作不一致，已停止。', 'The signing request does not match the confirmed action. The operation has been stopped.'],
  ['签名格式无效。', 'Invalid signature format.'],
  ['当前钱包无权执行此操作。', 'This wallet is not authorized to perform this action.'],
  ['审核服务暂不可用，暂不接受新挂单或下单。', 'The review service is unavailable. New listings and orders are temporarily disabled.'],
  ['审核密码尚未配置，审核操作暂不可用。', 'The review password is not configured. Review actions are temporarily unavailable.'],
  ['请输入正确的审核密码。', 'Enter the correct review password.'],
  ['审核密码不正确，本次审核没有执行。', 'Incorrect review password. This review action was not performed.'],
  ['请输入审核密码。', 'Enter the review password.'],
  ['后台登录已过期，请重新登录后再确认。', 'Your administrator session has expired. Sign in again before confirming.'],
  ['旧版或未知操作，请刷新页面。', 'This action is outdated or unknown. Refresh the page.'],
  ['未知操作。', 'Unknown action.'],

  // Administrator history workspace.
  ["历史成交分页无效。", "Invalid trade history pagination."],
  ["历史成交筛选无效。", "Invalid trade history filter."],
  ["历史成交来源无效。", "Invalid trade history source."],
  ["历史成交数量无效。", "Invalid historical trade quantity."],
  ["历史成交单价无效。", "Invalid historical trade unit price."],
  ["历史成交总额无效。", "Invalid historical trade total."],
  ["历史成交版本无效，请刷新。", "Invalid historical trade version. Refresh the history."],
  ["历史成交记录无效。", "Invalid historical trade record."],
  ["历史删除记录无效。", "Invalid history deletion record."],
  ["历史成交记录已变化，请刷新后重新确认。", "This historical trade has changed. Refresh and confirm again."],

  // Listings, quotes, fees, settlement, and public queries.
  ["历史成交仅支持 USD 报价、USDT 支付。", "Historical trades support USD quotes and USDT payment only."],
  ["请先核实这笔历史成交已完成。", "Verify that this historical trade is complete first."],
  ["实际成交时间无效。", "The actual completion time is invalid."],
  ["实际成交时间不能晚于当前时间。", "The actual completion time cannot be in the future."],
  ["历史成交总额与数量、单价不一致。", "The historical trade total does not match its quantity and unit price."],
  ["该补录编号已有不同记录，请核对历史成交后重新录入。", "A different record already uses this entry ID. Check the trade history before starting a new entry."],
  ["补录备注长度或格式不正确。", "The entry note has an invalid length or format."],
  ["请填写补录备注", "Enter an entry note."],
  ['手续费规则已更新，请刷新并重新确认。', 'The fee policy has changed. Refresh and review the details again.'],
  ['成交总价无效。', 'Invalid order total.'],
  ['手续费记录无效。', 'Invalid fee record.'],
  ['请输入有效的正数，不支持科学计数法。', 'Enter a valid positive number. Scientific notation is not supported.'],
  ['数量或单价超出允许范围。', 'The quantity or unit price is outside the allowed range.'],
  ['订单编号无效。', 'Invalid order ID.'],
  ['删除记录类型无效。', 'Invalid record type for removal.'],
  ['仅可从管理列表删除已关闭的订单。', 'Only closed orders can be removed from the administrator list.'],
  ['订单金额无法核对，请刷新挂单。', 'Unable to verify the order amount. Refresh the listing.'],
  ['订单版本无效，请刷新。', 'Invalid order version. Refresh the order.'],
  ['费用与报价不一致，请重新确认。', 'The fees do not match the quote. Review and confirm again.'],
  ['无效的订单内容。', 'Invalid order details.'],
  ['挂单有效期已改为小时，请刷新页面后重新确认。', 'Listing durations now use hours. Refresh the page and confirm again.'],
  ['请选择买入或卖出。', 'Select buy or sell.'],
  ['请选择 1、3、6、12 或 24 小时有效期。', 'Select a duration of 1, 3, 6, 12, or 24 hours.'],
  ['查询范围无效。', 'Invalid query scope.'],
  ['审核操作无效。', 'Invalid review action.'],
  ['平台结算审核操作无效。', 'Invalid platform settlement review action.'],
  ['请先核实本步骤的实际到账或退款情况。', 'Verify the actual payment received or refund for this step first.'],
  ['请先核实双方资金情况。', 'Verify both parties\' funds first.'],
  ['未知收款规则，请刷新订单。', 'Unknown receiving policy. Refresh the order.'],
  ['旧订单不可附加未经确认的收款地址。', 'Unconfirmed receiving addresses cannot be added to a legacy order.'],
  ['付款流程已更新，请核对平台 BSC USDT 收款地址后重新下单。', 'The payment flow has changed. Check the platform\'s BSC USDT receiving address and place the order again.'],
  ['收款规则已更新，请选择 BSC（BNB Smart Chain）并重新确认。', 'The receiving policy has changed. Select BSC (BNB Smart Chain) and confirm again.'],
  ['收款规则或网络不正确，请重新核对。', 'The receiving policy or network is incorrect. Check the details again.'],
  ['请先核对双方收款地址与结算网络。', 'Check both parties\' receiving addresses and the settlement network first.'],
  ['请输入有效的 Quantus 主网收款地址（qz 开头），并检查地址校验码。', 'Enter a valid Quantus mainnet receiving address beginning with qz and check its checksum.'],
  ['请输入有效的 USDT EVM 收款地址（0x 开头、40 位十六进制），并检查混合大小写校验码。', 'Enter a valid USDT EVM receiving address (0x followed by 40 hexadecimal characters) and check its mixed-case checksum.'],
  ['订单状态已变化，请刷新后重新确认。', 'The order status has changed. Refresh and confirm again.'],
  ['该交易哈希已经用于核验收付，请勿重复结算。', 'This transaction hash has already been used to verify a payment. Do not settle it again.'],
  ['你不能撤销这笔挂单。', 'You cannot cancel this listing.'],
  ['你不能修改这笔挂单的收款地址。', 'You cannot change this listing\'s receiving address.'],
  ['请先由挂单人设置有效的收款地址，再重新审核。', 'The listing owner must set a valid receiving address before another review.'],
  ['不能与自己的挂单成交。', 'You cannot trade with your own listing.'],
  ['只有本订单买方可以提交付款交易哈希。', 'Only this order\'s buyer can submit the payment transaction hash.'],
  ['只有本订单卖方可以提交 QTC 交易哈希。', 'Only this order\'s seller can submit the QTC transaction hash.'],
  ['你不能提交这笔订单的凭证。', 'You cannot submit evidence for this order.'],
  ['请核实卖方手续费已收取或扣除，并填写手续费凭证。', 'Verify that the seller\'s fee has been collected or deducted, and enter the fee reference.'],
  ['本订单使用平台收付流程，请按当前结算步骤操作。', 'This order uses platform settlement. Follow its current settlement steps.'],
  ['订单已被处理，或成交凭证已用于其他订单。请刷新核对。', 'The order has already been processed, or its settlement reference was used for another order. Refresh to check.'],
  ['挂单仅支持方向和页码查询。', 'Listings can only be queried by side and page number.'],
  ['方向无效。', 'Invalid order side.'],
  ['页码无效。', 'Invalid page number.'],
  ['每页记录数无效。', 'Invalid number of records per page.'],
  ['状态筛选仅用于管理员查询。', 'Status filtering is only available for administrator queries.'],
  ['订单状态筛选无效。', 'Invalid order status filter.'],
  ['成交历史仅支持按页查询。', 'Trade history can only be queried by page number.'],
  ['成交历史记录无效。', 'Invalid trade history record.'],
  ['已成交金额统计无效。', 'Invalid completed trade volume statistics.'],
  ['已成交金额记录无效。', 'Invalid completed trade volume record.'],
  ['我的挂单需要解锁钱包并签名查询。', 'Unlock your wallet and sign the query to view your listings.'],

  // Balance checks must not imply that a listing locks funds on chain.
  ['余额核验结果无效，请刷新后重试。', 'Invalid balance verification result. Refresh and try again.'],
  ['无法核验余额，请稍后重试。', 'Unable to verify the balance. Try again later.'],
  ['余额核验已过期，请刷新余额。', 'Balance verification has expired. Refresh the balance.'],
  ['余额仅查询当前签名钱包，请刷新后重试。', 'Balance queries are limited to the current signing wallet. Refresh and try again.'],
  ['当前签名钱包 QTC 可支配余额不足，需覆盖已有未交付卖单及本次卖出数量。请先充值或撤销其他卖单后刷新。', 'The current signing wallet has insufficient spendable QTC to cover its existing undelivered sell orders and this sale. Deposit QTC or cancel other sell orders, then refresh.'],
  ['挂单卖方签名钱包的 QTC 可支配余额不足，暂不可下单或批准。请刷新挂单，等待卖方补足余额。', 'The listing seller\'s signing wallet has insufficient spendable QTC. This order cannot be placed or approved yet. Refresh the listing and wait for the seller to add funds.'],
  ['暂时无法核实当前签名钱包的 Quantus 主网可支配余额，请稍后刷新。', 'Unable to verify the current signing wallet\'s spendable Quantus mainnet balance. Refresh later.'],
  ['暂时无法核实 Quantus 主网可支配余额，请稍后刷新。', 'Unable to verify the spendable Quantus mainnet balance. Refresh later.'],
  ['余额核验已超时，请刷新后重新确认。', 'Balance verification has timed out. Refresh and confirm again.'],
  ['余额查询暂不可用。', 'Balance queries are temporarily unavailable.'],
  ['余额查询失败。', 'Unable to retrieve the balance.'],
  ['无法取得余额。', 'Unable to retrieve the balance.'],
  ['余额格式不正确。', 'Invalid balance format.'],
  ['请先充值到当前钱包并刷新余额，卖出数量不可超过可挂单余额。', 'Deposit QTC into the current wallet and refresh its balance. The sell quantity cannot exceed the available listing balance.'],
  ['余额不足或核验已过期，请返回刷新余额。', 'The balance is insufficient or verification has expired. Go back and refresh the balance.'],

  // Browser-local wallet, worker, encrypted backup, and receiving settings.
  ['钱包地址与备份不一致。', 'The wallet address does not match the backup.'],
  ['请先解锁钱包。', 'Unlock your wallet first.'],
  ['本地签名校验失败。', 'Local signature verification failed.'],
  ['未知的钱包操作。', 'Unknown wallet action.'],
  ['本地钱包操作失败。', 'The local wallet operation failed.'],
  ['备份文件格式不正确。', 'Invalid backup file format.'],
  ['备份文件过大。', 'The backup file is too large.'],
  ['不是支持的 QTC Market 加密备份。', 'This is not a supported QTC Market encrypted backup.'],
  ['密码不正确，或加密备份已经损坏。', 'The password is incorrect or the encrypted backup is damaged.'],
  ['本地钱包文件无法读取。请保留浏览器数据，使用已保存的加密备份恢复。', 'Unable to read the local wallet file. Keep your browser data and restore from a saved encrypted backup.'],
  ['本地钱包已改变，请刷新页面。', 'The local wallet has changed. Refresh the page.'],
  ['这个浏览器已有钱包，请先解锁。', 'This browser already has a wallet. Unlock it first.'],
  ['钱包已锁定，请重新创建。', 'The wallet is locked. Restart wallet creation.'],
  ['没有本地钱包。', 'There is no local wallet.'],
  ['助记词对应的地址与当前钱包不同，原钱包没有被覆盖。', 'The recovery phrase belongs to a different address. The existing wallet was not overwritten.'],
  ['备份地址与本地钱包不同，原钱包没有被覆盖。', 'The backup address differs from the local wallet. The existing wallet was not overwritten.'],
  ['钱包会话已改变，原操作已停止。请重新确认。', 'The wallet session has changed and the previous operation was stopped. Confirm again.'],
  ['本地钱包组件加载失败，请刷新页面后重试。', 'The local wallet component failed to load. Refresh the page and try again.'],
  ['钱包已锁定。', 'The wallet is locked.'],
  ['钱包操作超时，请重新解锁。', 'The wallet operation timed out. Unlock the wallet again.'],
  ['浏览器无法保存钱包，请检查存储权限。', 'The browser could not save the wallet. Check its storage permissions.'],
  ['本地钱包文件异常。', 'The local wallet file is invalid.'],
  ['本地钱包版本不受支持。', 'This local wallet version is not supported.'],
  ['收款设置无法读取，请重新核对并保存。', 'Unable to read the receiving settings. Check and save them again.'],
  ['收款设置版本或网络不匹配，请重新核对并保存。', 'The receiving settings version or network does not match. Check and save them again.'],
  ['请至少填写一个收款地址。', 'Enter at least one receiving address.'],
  ['请核对完整收款地址。', 'Check the full receiving address.'],
  ['无法保存收款设置，请检查浏览器存储权限。', 'Unable to save receiving settings. Check your browser\'s storage permissions.'],
  ['两次输入的密码不一致。', 'The two passwords do not match.'],
  ['复制失败，请检查浏览器剪贴板权限，或手动抄写助记词。', 'Copy failed. Check your browser\'s clipboard permissions or write down the recovery phrase manually.'],
  ['无法下载加密文件，请检查浏览器下载设置后重试。', 'Unable to download the encrypted file. Check your browser\'s download settings and try again.'],
  ['请重新创建。', 'Restart wallet creation.'],
  ['请完成助记词备份核对。', 'Complete the recovery phrase backup check.'],
  ['请选择加密备份文件。', 'Select an encrypted backup file.'],
  ['文件过大，不是有效的加密钱包备份。', 'The file is too large to be a valid encrypted wallet backup.'],
  ['无法读取备份文件。', 'Unable to read the backup file.'],
  ['复制失败，请选中完整地址手动复制。', 'Copy failed. Select the full address and copy it manually.'],
  ['复制失败，请选中文本手动复制。', 'Copy failed. Select the text and copy it manually.'],
  ['无法下载，请检查浏览器设置。', 'Unable to download. Check your browser settings.'],
  ['读取失败。', 'Unable to load the data.'],
  ['请检查输入。', 'Check your input.'],
  ['提交结果待核对。', 'The submission result needs to be checked.'],
]);

// The domain's text()/transactionHash() labels are internal constants, not
// arbitrary user content. Expand only these finite labels into exact messages.
for (const [label, english] of [
  ['审核说明', 'review note'],
  ['结算凭证或说明', 'settlement evidence or explanation'],
  ['手续费收取或扣款凭证', 'fee collection or deduction reference'],
  ['买方结算指引', 'buyer settlement instructions'],
  ['卖方结算指引', 'seller settlement instructions'],
  ['唯一付款凭证编号', 'unique payment reference'],
]) {
  messages.set(`请填写${label}`, `Enter the ${english}.`);
  messages.set(`${label}长度或格式不正确。`, `The ${english} has an invalid length or format.`);
}
for (const [label, english] of [
  ['BSC USDT 付款', 'BSC USDT payment'],
  ['买方 BSC USDT 付款', 'buyer\'s BSC USDT payment'],
  ['卖方 QTC', 'seller\'s QTC'],
  ['平台 BSC USDT 付款', 'platform\'s BSC USDT payment'],
  ['QTC', 'QTC'],
]) {
  messages.set(`请输入完整的 ${label} 交易哈希。`, `Enter the complete ${english} transaction hash.`);
}

// Anchored application templates accept numeric parameters only. No arbitrary
// text, address, hash, name, or user instruction is captured and translated.
const numericMessages = [
  [/^挂单方已有 ([1-9]\d{0,2}) 笔未结束交易，暂不可下单。$/, n => `The listing owner already has ${n} unfinished trades. New orders are temporarily unavailable.`],
  [/^每个钱包最多同时保留 ([1-9]\d{0,2}) 笔未结束的挂单与买卖订单。请先完成或撤销已有订单。$/, n => `Each wallet may have at most ${n} unfinished listings and trades combined. Complete or cancel existing orders first.`],
  [/^订单状态已变化、交易哈希已核验使用，可用卖出余额已被其他订单占用，或已达到每钱包 ([1-9]\d{0,2}) 笔未结束订单上限。请刷新核对。$/, n => `The order status has changed, the transaction hash has already been verified, the available sell balance is committed to other orders, or the wallet has reached its limit of ${n} unfinished orders. Refresh to check.`],
  [/^请填写完整的 ([1-9]\d{0,2}) 个助记词。$/, n => `Enter all ${n} words of the recovery phrase.`],
  [/^请设置至少 ([1-9]\d{0,2}) 个字符的密码。$/, n => `Set a password with at least ${n} characters.`],
  [/^本地密码需为 ([1-9]\d{0,2})–([1-9]\d{0,2}) 个字符。$/, (min, max) => Number(min) <= Number(max) ? `The local password must be ${min}–${max} characters long.` : null],
  [/^整单总价至少为 ((?:0|[1-9]\d{0,6})(?:\.\d{1,2})?) USD。$/, amount => Number(amount) > 0 ? `The order total must be at least ${amount} USD.` : null],
  [/^余额不足，还需充值 ((?:0|[1-9]\d{0,7})(?:\.\d{1,12})?) QTC。$/, amount => Number(amount) > 0 ? `Insufficient balance. Deposit another ${amount} QTC.` : null],
];

/**
 * Translate only known application error messages for display.
 * @param {string} message
 * @param {'zh'|'en'} language
 * @returns {string}
 */
export function translateMessage(message, language) {
  if (language !== 'en' || typeof message !== 'string') return message;
  const exact = messages.get(message);
  if (exact !== undefined) return exact;
  for (const [pattern, format] of numericMessages) {
    const match = pattern.exec(message);
    if (match && match[0] === message) return format(...match.slice(1)) ?? message;
  }
  return message;
}
