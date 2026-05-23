
const token = process.env.BOT_TOKEN;
const domainExpirations = process.env.DOMAIN_EXPIRATIONS; // 格式: '域名:YYYY-MM-DD:提前天数,域名2:YYYY-MM-DD:提前天数'
const domainExpirationsUrl = process.env.DOMAIN_EXPIRATIONS_URL;
const chatId = process.env.CHAT_ID;
const bbt = process.env.BBT;


async function parseDomainExpirations() {
  // 优先使用环境变量提供的列表
  if (domainExpirations) {
    return domainExpirations.split(',').map(item => {
      const [domain, dateStr, daysStr] = item.split(':');
      const targetDate = new Date(dateStr);
      const days = parseInt(daysStr, 10) || 30;
      return { domain, targetDate, days };
    });
  }
  // 若未设置，尝试从指定的 URL 获取（可通过 DOMAIN_EXPIRATIONS_URL 环境变量指定）
  if (!domainExpirationsUrl) return [];
  try {
    const resp = await fetch(domainExpirationsUrl);
    const text = await resp.text();
    // 期望返回与环境变量相同格式的字符串列表
    return text.split(',').map(item => {
      const [domain, dateStr, daysStr] = item.split(':');
      const targetDate = new Date(dateStr);
      const days = parseInt(daysStr, 10) || 30;
      return { domain, targetDate, days };
    });
  } catch (e) {
    console.error('获取域名过期列表失败:', e);
    return [];
  }
}

async function checkDomainExpirations() {
  const configs = await parseDomainExpirations();
  const now = new Date();
  const messages = [];
  for (const cfg of configs) {
    const diffDays = Math.floor((cfg.targetDate - now) / (1000 * 60 * 60 * 24));
    if (diffDays <= cfg.days) {
      const domainClean = cfg.domain.trim();
      messages.push(`⚠️ 域名 ${domainClean} 将于 ${cfg.targetDate.toISOString().split('T')[0]} 过期，剩余 ${diffDays} 天`);
    }
  }
  return messages;
}

async function sendTelegram(message) {
  if (!token || !chatId) return;

  const now = new Date();
  const hkTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  const timeStr = hkTime.toISOString().replace('T', ' ').substr(0, 19) + " HKT";

  const fullMessage = `🎉 Netlib(auth-domain) 登录通知\n\n登录时间：${timeStr}\n\n教程：${bbt}\n\n${message}`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: fullMessage
      }),
      signal: AbortSignal.timeout(10000)
    });
    console.log('✅ Telegram 通知发送成功');
  } catch (e) {
    console.log('⚠️ Telegram 发送失败');
  }
}

async function main() {
  
  if (!domainExpirations && !domainExpirationsUrl) {
    console.log('❌ 未配置域名');
    process.exit(1);
  }
  
  // 获取域名过期警告
  const domainWarnings = await checkDomainExpirations();
  if (domainWarnings.length > 0) {
    const totalCount = domainWarnings.length;
    let summaryMessage = `📊 域名过期汇总: ${totalCount} 个域名\n\n`;
    summaryMessage += '\n⚠️ 域名过期警告:\n';
    domainWarnings.forEach(w => {
      summaryMessage += `${w}\n`;
    });
    // console.log('summaryMessage>>>', summaryMessage);
    await sendTelegram(summaryMessage);
  } else {
    console.log('✅ 没有域名即将过期，无需发送通知。');
  }
  
  console.log('\n✅ 所有域名处理完成！');
}

main().catch(console.error);
