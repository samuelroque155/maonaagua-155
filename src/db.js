const DB_NAME = "MaoNaAguaDB";
const STORE_NAME = "pendingVisits";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePendingVisit(visitData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(visitData);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onabort = () => { db.close(); reject(tx.error || request.error || new Error('Gravação local interrompida.')); };
    tx.onerror = () => { db.close(); reject(tx.error || request.error); };
  });
}

export async function getPendingVisits() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    tx.oncomplete = () => { db.close(); resolve(request.result || []); };
    tx.onabort = () => { db.close(); reject(tx.error || request.error); };
    tx.onerror = () => { db.close(); reject(tx.error || request.error); };
  });
}

export async function removePendingVisit(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onabort = () => { db.close(); reject(tx.error || request.error || new Error('Remoção local interrompida.')); };
    tx.onerror = () => { db.close(); reject(tx.error || request.error); };
  });
}
