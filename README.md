# QTC Market 钱包代码审阅包

访问网站：[QTC Market](https://uniqtc.xyz/)。

这里公开 QTC Market 的**钱包创建、恢复、备份、本地存储与签名相关代码**，便于逐行检查和运行测试。它是从市场项目提取的独立代码快照，不包含市场后台、生产数据库、环境变量或原私密仓库的历史。

对应市场源码版本：`234affd3e01f75bcd7d7b1628a50c32732768c11`（2026-09-11）。已逐项核对该精确提交中的选中源文件和源码 ZIP 成员，字节、长度与 SHA-256 均与快照一致。原市场仓库保持私密；公众可以直接查看本仓库的选中源码。每个原样复制或从源码包解出的文件都有 [SHA-256 清单](snapshot.json)。本次线上资产比对状态见 [验证记录](VERIFICATION.md)。这不是第三方安全审计报告，也不是“绝对安全”证书。

## 可以检查什么

| 要检查的行为 | 对应实现 | 准确含义 |
| --- | --- | --- |
| 新钱包的随机来源 | [wallet-worker.js](public/crypto/wallet-worker.js) | 浏览器 `crypto.getRandomValues(new Uint8Array(32))` 提供 256 位随机输入；没有用时间戳、`Math.random()`、服务器返回的种子或预置助记词代替。 |
| 助记词和地址如何产生 | [Rust 密码学源码](crypto-source/src/lib.rs) | 将随机熵转成 24 词 BIP39 助记词，再按固定路径派生 ML-DSA-65 密钥和 Quantus 地址。**相同助记词与路径会恢复相同地址**；随机的是创建新钱包时的熵。 |
| 助记词如何备份 | [vault.mjs](public/crypto/vault.mjs) | PBKDF2-SHA256、600,000 次迭代，AES-256-GCM；每次加密使用随机 16 字节盐和 12 字节 IV。加密文件包含公开地址和路径，助记词在密文中。 |
| 浏览器保存了什么 | [wallet.ts](lib/market/wallet.ts) / [use-wallet.ts](lib/market/use-wallet.ts) | 应用自己生成的备份只包含加密钱包及公开元数据，不把生成的明文助记词或钱包解锁密码写入 `localStorage`。导入文件的额外字段见下方限制。 |
| 加载、取消与锁定 | [wallet-worker.js](public/crypto/wallet-worker.js) / [wallet.ts](lib/market/wallet.ts) / [use-wallet.ts](lib/market/use-wallet.ts) | Worker 明确报告加载成功或失败；WASM 下载在 15 秒后中止，客户端分别限制加载等待和已开始的操作为 20 秒、30 秒。取消或锁定会终止 Worker，过期会话结果不能重新保存或解锁钱包。浏览器调度可能延后计时器执行。 |
| 显示、复制和下载 | [wallet-dialog.tsx](components/market/wallet-dialog.tsx) | 备份期间助记词会出现在页面内存；点击复制会写入系统剪贴板。下载使用本地 Blob 生成加密 JSON 文件。 |
| 交易操作如何认证 | [wallet-worker.js](public/crypto/wallet-worker.js) / [domain.mjs](public/crypto/domain.mjs) | 密钥句柄留在 Worker 内签名；Worker 先核对操作、来源、到期时间和内容，返回签名。这里的市场认证签名不等同于链上转账。 |
| 浏览器向外发送什么 | [client.mjs](lib/market/client.mjs) / [wallet.ts](lib/market/wallet.ts) | 市场请求发送公开地址、公钥、操作内容和签名；余额查询向官方索引服务发送公开地址。选中的调用路径没有上传钱包助记词、密文备份或本地解锁密码。 |

管理员审核密码与用户的本地钱包解锁密码是不同的东西。审核密码会发送服务器验证；不能因此声称“任何密码都不会发送服务器”。公开签名协议中的平台收款地址、手续费等是用户已经能看到的交易条款，不是私钥。

`getRandomValues` 是浏览器提供的密码学随机接口，见 [MDN 文档](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)。少量生成样本不重复不能证明随机熵质量、地址永不碰撞或密码学实现没有缺陷；这些还依赖浏览器、操作系统、算法与依赖库。

## 自己运行验证

需要 Node.js 24 或更新版本；测试仅使用 Node 标准库和仓库内的实际 Worker/WASM，不需要 `npm install`，不连接市场数据库，不广播交易。

```sh
git clone https://github.com/kkmoat/qtc-wallet-audit.git
cd qtc-wallet-audit
npm test
```

测试覆盖生成、解密恢复、错误密码、篡改备份、域隔离签名、锁定、Worker 加载成功与失败、15 秒下载中止、处理阶段消息、随机接口调用及拒绝意外网络请求。生成的测试钱包只存在于测试进程内，不输出助记词、私钥、密码或地址。客户端及 React 生命周期代码在此供源码审阅，当前无依赖的测试不执行完整 React 界面；它们不能代替实际浏览器、整站或第三方独立审计。

### 比对线上钱包文件

```sh
npm run verify:site -- https://uniqtc.xyz/
```

脚本只下载公开 `/crypto/` 文件做 SHA-256 比对，不执行下载的代码，不读取钱包，不发送账户数据。结果仅代表**请求发生时，该来源返回的这些文件**与快照一致。网络失败或文件变化均会退出失败，不会忽略差异。

哈希相同不是整站安全证明：页面 HTML、其他脚本、React UI 构建文件、浏览器扩展、服务端处理以及不同用户/时间收到的内容均不在这个文件比对范围。旧快照在网站升级后可能不再匹配；发布者必须更新快照，用户应选择明确的版本查看。

### 阅读或重建密码学核心

[crypto-source/](crypto-source/) 提供可直接在 GitHub 阅读的 Rust 主源码、锁文件和原始重建说明。完整源码、依赖、测试及各依赖许可证保存在 [源码 ZIP](public/source/qtc-market-crypto-source.zip) 中。

```sh
unzip public/source/qtc-market-crypto-source.zip -d /tmp/qtc-wallet-crypto-review
cd /tmp/qtc-wallet-crypto-review/qtc-market-crypto-asset
bash build.sh
```

请先阅读 [REBUILD.md](crypto-source/REBUILD.md)，安装其要求的 Rust 工具链、WASM target 与 wasm-bindgen 版本。Cargo 使用锁文件和包内 vendor 离线构建；这些构建工具本身不包含在源码包里。本次整理没有重新独立构建 Rust/WASM，也未声称跨平台构建必然字节一致。地址校验模块另有 [重建说明](public/source/receiving-address-REBUILD.md)。

## 公开代码能证明到哪里

- 它能让人检查所列代码是否读取密码学随机数、是否进行本地加密，以及相关调用是否把助记词放进请求或存储。
- 它**不能证明运营方过去从未收集任何秘密，或线上所有代码永远等于这个快照**。没有公开后台和完整部署链时，也不能独立验证服务器的全部处理方式。增加数据库结构或一句声明同样不足以证明这一点。
- Worker 不是隔离同源恶意代码的安全边界：备份界面本就需要接收和显示助记词，其他恶意页面脚本、浏览器扩展、设备木马或被替换的发布内容仍可能读取它。
- JavaScript 字符串、React 状态和浏览器内存不能保证被立即、完整擦除。代码尽量清空可变缓冲区并在锁定时终止 Worker，不应宣传“完全无内存痕迹”。
- 此版本导入通过验证的加密 JSON 后，会保留对象中的额外字段。如果人为在有效文件中加入明文或其他信息，这些额外字段也会被本地保存和再次导出；它不会自动清洗用户导入的额外数据。“只保存密文”的说明限定于应用自己生成的备份。这不构成向服务器上传文件的路径。
- GitHub CI 成功和 SHA-256 清单是可复查证据的一部分，不是第三方背书。独立审阅、完整构建/部署比对和浏览器测试可以增加信任，但不能消除全部风险。

更准确的对外表述是：**“钱包相关源码公开，所列代码在浏览器内生成、加密和签名；欢迎检查数据流并比对公开钱包文件。”** 不建议写成“GitHub 已证明平台绝不保存任何人的助记词”。

## 文件范围与许可

这个快照包含当前中英文钱包备份界面及其语言状态、错误文案模块（`lib/i18n.tsx`、`lib/i18n-messages.mjs`）；语言模块只处理界面文案与本地语言偏好。

本次更新仅在已有文件范围内同步 `desk` 管理员查询的可选 `status` 签名字段及错误文案（包括此前每页记录数校验文案）。管理员查询省略状态或使用 `all` 时，规范化结果保留原来的 `{scope,page}`；其他受支持状态写入签名载荷，未知状态和个人 `mine` 查询附带状态会被拒绝。原有 `history_add` 签名协议仍在选中代码范围内；没有加入市场工作台、管理员后台鉴权或查询实现、数据库写入实现、历史成交数据、私有测试或生产配置。现有本地测试覆盖钱包回归和随机输入行为，不代表已经验证管理员筛选的完整请求、整站弹窗挂载、服务器流程或线上部署。

这个快照不是可直接部署的完整市场项目。`lib/market/` 和 `components/market/` 中的文件保留原始源码用于审阅，未打包其完整 React/Next.js UI 依赖。测试执行的是 `public/crypto/` 的实际钱包逻辑；新增审阅脚本位于 `scripts/`，新增随机性测试与原 Worker 回归测试位于 `tests/`。

市场应用选中文件沿用原项目 `GPL-3.0-or-later` 声明；密码学核心的 `Cargo.toml` 明确为 `GPL-3.0-only`，第三方组件保留各自许可证。组合分发按 GPLv3 提供，不能覆盖各组件原有声明。见 [LICENSE](LICENSE)、[核心许可证](crypto-source/LICENSE) 和 [地址校验依赖许可证](public/crypto/address-checks.LICENSE.txt)。

独立社区项目，由 [kkmoat](https://x.com/kkmoat) 维护，非 Quantus 官方产品。报告问题请提供文件、版本和复现步骤；不要提交真实助记词、私钥、钱包密码、加密备份或生产凭据。
