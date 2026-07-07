/*
  健身助手 - Service Worker
  离线缓存核心资源，GIF 不缓存（已下载到本地，按需加载）
*/

const CACHE_NAME = 'fitness-app-v1';
const CACHE_CORE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './data/exercises.js'
];

// 安装: 缓存核心文件
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_CORE))
  );
  self.skipWaiting();
});

// 激活: 清除旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keyList => Promise.all(keyList
      .filter(key => key !== CACHE_NAME)
      .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// 网络优先，缓存回退
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 跳过 GIF 不缓存，已经下载到本地
  if (request.url.includes('/gifs/')) {
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
