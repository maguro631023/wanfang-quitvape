PWA 檔案說明

manifest.json  應用程式資訊與圖示定義
sw.js          Service Worker：離線快取
icons/         192 / 512 / maskable / apple-touch

index.html 已完成 <head> 標籤與 SW 註冊，不需再手動修改。

⚠️ 每次更新 index.html 部署前，請先修改 sw.js 中的
   const VERSION = 'v1';
   否則已安裝的使用者會持續看到舊版本。

原始向量圖檔位於 ../assets-src/
