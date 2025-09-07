const CACHE_NAME = 'genba-photo-print-v1.36'; // キャッシュ名。バージョンアップ時に変更してください
const urlsToCache = [
    './genba_photo_1.36.html',
    './manifest.json',
    './service-worker.js',
    './files/app-preview.css',
    './files/print-layout.css',
    './files/app-script.js',
    './files/print-script.js',
    './icon-192x192.png', // 使用するアイコンのパスを追加
    './icon-512x512.png'  // 使用するアイコンのパスを追加
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
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // キャッシュにレスポンスがあればそれを返す
                if (response) {
                    return response;
                }
                // キャッシュになければネットワークから取得
                return fetch(event.request).catch(() => {
                    // ネットワークが利用できない場合のフォールバック（オフラインページなど）
                    // このアプリの場合は、メインHTMLがキャッシュされていれば十分
                    // または、特定のパス（例: index.html）に対してオフラインページを返すことも可能
                    // 現状はオフラインでもHTMLが表示されることを目的とする
                    console.log('Fetch failed for:', event.request.url);
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