/* ============================================================
   好好呼吸 — Service Worker

   說明：此 SW 只負責把「程式本體」送到裝置上（HTML、圖示、字型）。
   它不傳送任何使用者資料，與 INTENDED_USE.md 第 6 節的
   「資料不離開裝置」並不衝突——載入程式與上傳資料是兩回事。

   ⚠️ 每次更新 index.html 後，務必把下面的 VERSION 改掉再部署。
      沒改的話，已安裝的使用者會一直看到舊版本。
      這是 PWA 最常見的坑。
   ============================================================ */
const VERSION = 'v1';
const CACHE = `quitvape-${VERSION}`;

/* 應用程式外殼：單一 HTML 檔加圖示，全部預先快取 */
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      /* 立即接手，不等舊的 SW 結束 —— 搭配下方 controllerchange 讓更新即時生效 */
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  /* 只處理 GET 與同源請求 */
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  /* 導覽請求（開啟 app）：優先走網路，才拿得到新版本；
     離線時退回快取，這是「沒網路也打得開」的關鍵 */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* 其他靜態資源：快取優先，取不到再走網路並順手存起來 */
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }))
  );
});
