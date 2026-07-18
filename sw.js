// Service Worker ─ 頭頂葉（空間認識）トレーナー（周辺視野で数字を読む / Functional Neuro Training）
// 戦略：Network First（新しいコードを最優先で拾う → 開発ナレッジ準拠）。
//       オフライン時のみキャッシュへフォールバック。
// index.html 側で controllerchange を検知して location.reload() する前提。
const CACHE_NAME = 'shiya-v1.0.2';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './FNT512.png',
  './FNT512-transparent.png',
  './audio/guide-intro.mp3',
  './audio/guide-done.mp3',
  './audio/dir-1-up.mp3',
  './audio/dir-2-ur.mp3',
  './audio/dir-3-right.mp3',
  './audio/dir-4-dr.mp3',
  './audio/dir-5-down.mp3',
  './audio/dir-6-dl.mp3',
  './audio/dir-7-left.mp3',
  './audio/dir-8-ul.mp3',
  'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;700;800&display=swap'
];

// インストール：app shell をプリキャッシュし即 skipWaiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] precache failed', err))
  );
});

// アクティベート：古いキャッシュを削除して即 claim
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.map((name) => (name !== CACHE_NAME) ? caches.delete(name) : null)
      ))
      .then(() => self.clients.claim())
  );
});

// フェッチ：Network First
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // 対象は同一オリジン ＋ Google Fonts のみ
  const url = req.url;
  const sameOrigin = url.startsWith(self.location.origin);
  const isFont = url.startsWith('https://fonts.');
  if (!sameOrigin && !isFont) return;

  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        // 取得できたら最新をキャッシュへ反映（オフライン用）
        if (networkRes && networkRes.status === 200 &&
            (networkRes.type === 'basic' || networkRes.type === 'cors')) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkRes;
      })
      .catch(() =>
        // オフライン：キャッシュ → navigate は index.html にフォールバック
        caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        })
      )
  );
});

// メッセージ（将来のSKIP_WAITING手動更新に備える／無害）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ─────────────────────────────────────────────
// Web Push（送信サーバは別途／VAPID・cronは宮崎インフラ待ち）
// 送信元が無くても以下は発火しないだけで無害。
// ─────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || '頭頂葉トレーナー';
  const options = {
    body: data.body || '1〜2分、周辺視野で数字を読むトレーニングの時間です。',
    icon: './FNT512.png',
    badge: './FNT512.png',
    vibrate: [80, 40, 80],
    tag: 'shiya-daily',
    renotify: false,
    data: { url: data.url || './index.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
