/*
  健身助手 - Service Worker v2
  网络优先策略: 始终拉取最新版本，断网时回退缓存
*/

const CACHE_NAME = 'fitness-app-v2';

// 安装: 预缓存核心文件
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        './',
        './index.html',
        './css/style.css',
        './js/app.js',
        './data/exercises.js'
      ]);
    })
  );
  // 立即激活，不等待旧 SW 释放
  self.skipWaiting();
});

// 激活: 清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      );
    })
  );
  // 立即接管所有页面
  self.clients.claim();
});

// 网络优先，缓存兜底
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // GIF 走 CDN，不缓存
  if (request.url.includes('/gifs/') || request.url.includes('static.exercisedb.dev')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        // 成功获取后更新缓存
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
        return response;
      })
      .catch(() => {
        // 断网时回退缓存
        return caches.match(request);
      })
  );
});

// 通知客户端有更新可用
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});