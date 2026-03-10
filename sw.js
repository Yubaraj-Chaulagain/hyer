self.addEventListener('install', (e) => {
  console.log('Service Worker Installed');
});

self.addEventListener('fetch', (e) => {
  // यो खाली छोड्दा पनि इन्स्टल बटन आउँछ
});
