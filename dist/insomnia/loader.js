// 失眠剧本社 · 加载器
// jsDelivr 对 @main 的地址缓存很久、刷新还会被限流，更新了也可能拿到旧版。
// 这里每次先问 GitHub 最新一次提交的编号，再按编号去 jsDelivr 取插件：按编号的地址内容固定，不会是旧缓存。
// 问不到（断网、被限流）就用上次记下的编号，再不行退回 @main。
// jsDelivr 有几条线路，某条线路有时对大文件卡住不动（一直下不完）：几秒没下完就加开下一条，先下完的那份执行，不会加载两份。
const REPO = 'zin1111917-blip/test';
const FILE = 'dist/insomnia/index.js';
const KEY = 'insomnia-release-sha';
const HOSTS = ['testingcf.jsdelivr.net', 'fastly.jsdelivr.net', 'cdn.jsdelivr.net', 'gcore.jsdelivr.net'];
const STAGGER = 6000;

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

/**
 * 先走第一条线路；STAGGER 毫秒还没下完就加开下一条，哪条先把整个文件下完用哪条，其余取消。
 * 某条线路卡住不动时最多多等几秒，不会两份都执行（只 import 一次）
 */
function download(ref) {
  return new Promise(resolve => {
    const ctls = [];
    let left = HOSTS.length;
    let done = false;
    const fail = () => {
      if (--left === 0 && !done) resolve(null);
    };
    HOSTS.forEach((host, i) => {
      setTimeout(async () => {
        if (done) return fail();
        const ctl = new AbortController();
        ctls.push(ctl);
        try {
          const res = await fetch(`https://${host}/gh/${REPO}@${ref}/${FILE}`, { signal: ctl.signal });
          const code = res.ok ? await res.text() : '';
          if (code.length > 1000 && !done) {
            done = true;
            ctls.forEach(c => c !== ctl && c.abort());
            resolve({ code, host });
            return;
          }
        } catch {
          /* 换别的线路 */
        }
        fail();
      }, i * STAGGER);
    });
  });
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
