const CACHE_NAME = 'genba-photo-print-v1.36'; // キャッシュ名。バージョンアップ時に変更してください
const urlsToCache = [
    './genba.html',
    './manifest.json',
    './service-worker.js',
    './files/app-preview.css',
    './files/print-layout.css',
    './files/app-script-modular.js',  // ← 修正
    './files/print-script.js',
    './files/modules/config.js',       // ← 追加
    './files/modules/state-manager.js', // ← 追加
    './files/modules/file-validator.js', // ← 追加
    './files/modules/error-handler.js',  // ← 追加
    './files/modules/memory-manager.js', // ← 追加
    './files/modules/accessibility.js',  // ← 追加
    './files/icon-192x192.png', // 使用するアイコンのパスを追加
    './files/icon-512x512.png'  // 使用するアイコンのパスを追加
    // 必要に応じて、追加の画像やスクリプト、スタイルシートなどがあればここに追加
];

// インストールイベント: キャッシュを開き、指定されたファイルをキャッシュに追加
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// フェッチイベント: リクエストに対し、キャッシュがあればキャッシュから、なければネットワークから取得
self.addEventListener('fetch', (event) => {
    // favicon.icoなどの不要なリクエストは無視
    if (event.request.url.includes('favicon.ico')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // キャッシュにレスポンスがあればそれを返す
                if (response) {
                    return response;
                }
                // キャッシュになければネットワークから取得
                return fetch(event.request).catch(() => {
                    // ネットワークが利用できない場合のフォールバック
                    // HTMLファイルの場合はキャッシュされたものを返す
                    if (event.request.destination === 'document') {
                        return caches.match('./genba.html');
                    }
                    // その他の場合は空のレスポンスを返す
                    return new Response('', { status: 404, statusText: 'Not Found' });
                });
            })
    );
});

// アクティベートイベント: 古いキャッシュをクリア
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        // ホワイトリストにない古いキャッシュを削除
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});