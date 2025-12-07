// Service Worker for PWA
const CACHE_NAME = 'time-recorder-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/manifest.json'
];

// 安装事件 - 缓存资源
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('缓存资源');
                return cache.addAll(urlsToCache);
            })
    );
});

// 获取事件 - 返回缓存的资源或从网络获取
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 如果在缓存中找到响应，返回缓存的版本
                if (response) {
                    return response;
                }
                // 否则从网络获取
                return fetch(event.request);
            })
    );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('删除旧缓存:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
