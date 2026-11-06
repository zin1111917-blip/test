// 失眠剧本社 · 加载器
// jsDelivr 对 @main 的地址缓存很久、刷新还会被限流，更新了也可能拿到旧版。
// 这里每次先问 GitHub 最新一次提交的编号，再按编号去 jsDelivr 取插件：按编号的地址内容固定，不会是旧缓存。
// 问不到（断网、被限流）就用上次记下的编号，再不行退回 @main。
// jsDelivr 有几条线路，某条线路有时对大文件卡住不动（一直下不完）：一条超时就换下一条，下完了再执行，不会加载两份。
const REPO = 'zin1111917-blip/test';
const FILE = 'dist/insomnia/index.js';
const KEY = 'insomnia-release-sha';
const HOSTS = ['testingcf.jsdelivr.net', 'fastly.jsdelivr.net', 'cdn.jsdelivr.net', 'gcore.jsdelivr.net'];
const TIMEOUT = 25000;

function remembered() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

async function latestSha() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
      headers: { Accept: 'application/vnd.github.sha' },
      cache: 'no-store',
    });
    const sha = res.ok ? (await res.text()).trim() : '';
    if (/^[0-9a-f]{40}$/.test(sha)) {
      try {
        localStorage.setItem(KEY, sha);
      } catch {
        /* 存不了就下次再问 */
      }
      return sha;
    }
  } catch {
    /* 落到下面 */
  }
  return remembered();
}

/** 按顺序试每条线路，整个文件下完才算；超时或出错换下一条 */
async function download(ref) {
  for (const host of HOSTS) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const res = await fetch(`https://${host}/gh/${REPO}@${ref}/${FILE}`, { signal: ctl.signal });
      if (res.ok) {
        const code = await res.text();
        if (code.length > 1000) return { code, host };
      }
    } catch {
      /* 换下一条 */
    } finally {
      clearTimeout(timer);
    }
    console.warn(`[失眠剧本社] ${host} 没取到，换下一条线路`);
  }
  return null;
}

const sha = await latestSha();
const ref = sha ?? 'main';
console.info(`[失眠剧本社] 加载版本 ${sha ? sha.slice(0, 7) : 'main'}`);
const got = await download(ref);
if (got) {
  console.info(`[失眠剧本社] 线路 ${got.host}`);
  const url = URL.createObjectURL(new Blob([got.code], { type: 'text/javascript' }));
  try {
    await import(url);
  } finally {
    URL.revokeObjectURL(url);
  }
} else {
  await import(`https://testingcf.jsdelivr.net/gh/${REPO}@${ref}/${FILE}`);
}
