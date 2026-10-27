// 失眠剧本社 · 加载器
// jsDelivr 对 @main 的地址缓存很久、刷新还会被限流，更新了也可能拿到旧版。
// 这里每次先问 GitHub 最新一次提交的编号，再按编号去 jsDelivr 取插件：按编号的地址内容固定，不会是旧缓存。
// 问不到（断网、被限流）就用上次记下的编号，再不行退回 @main。
const REPO = 'zin1111917-blip/test';
const FILE = 'dist/insomnia/index.js';
const KEY = 'insomnia-release-sha';

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

const sha = await latestSha();
console.info(`[失眠剧本社] 加载版本 ${sha ? sha.slice(0, 7) : 'main'}`);
await import(`https://testingcf.jsdelivr.net/gh/${REPO}@${sha ?? 'main'}/${FILE}`);
