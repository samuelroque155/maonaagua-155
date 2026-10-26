/* global clients */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // This worker does not cache app assets. Clear only Cache Storage from old
    // app workers; push subscriptions and IndexedDB records remain untouched.
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter(name => /^maonaagua(?:-|$)/i.test(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

function marcarAviso(id, remover = false) {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open('MaoNaAguaAvisos', 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore('exibidos');
    pedido.onerror = () => reject(pedido.error);
    pedido.onsuccess = () => {
      const banco = pedido.result;
      const tx = banco.transaction('exibidos', 'readwrite');
      const loja = tx.objectStore('exibidos');
      // add e a chave única impedem duas entregas simultâneas do mesmo aviso.
      if (remover) loja.delete(id); else loja.add(true, id);
      tx.oncomplete = () => { banco.close(); resolve(true); };
      tx.onabort = tx.onerror = () => {
        banco.close();
        if (tx.error?.name === 'ConstraintError') resolve(false);
        else reject(tx.error);
      };
    };
  });
}

self.addEventListener('push', event => {
  let aviso = {};
  try { aviso = event.data?.json() || {}; } catch { /* Mensagem inválida: aviso genérico. */ }
  event.waitUntil((async () => {
    const id = typeof aviso.id === 'string' && aviso.id.length <= 100 ? aviso.id : null;
    if (id && !await marcarAviso(id)) return;
    try {
      await self.registration.showNotification(typeof aviso.title === 'string' ? aviso.title.slice(0, 80) : 'Mão Na Água — limpeza', {
        body: typeof aviso.body === 'string' ? aviso.body.slice(0, 650) : 'Confira as piscinas pendentes na agenda de hoje.',
        icon: '/logo.png', badge: '/favicon.svg', tag: typeof aviso.tag === 'string' ? aviso.tag.slice(0, 100) : 'limpezas-do-dia', renotify: false
      });
    } catch (erro) {
      if (id) await marcarAviso(id, true);
      throw erro;
    }
  })());
});

// To handle clicks on the notification
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // Focus or open the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(windowClients => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
