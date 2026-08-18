const DB_NAME = 'my-life-db';
const DB_VERSION = 1;
const STORES = ['notes', 'expenses', 'reminders', 'files'];

let dbPromise;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          if (name === 'notes') {
            store.createIndex('updatedAt', 'updatedAt');
            store.createIndex('category', 'category');
          }
          if (name === 'expenses') store.createIndex('date', 'date');
          if (name === 'reminders') store.createIndex('dateTime', 'dateTime');
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function reqAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll(storeName) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  return reqAsPromise(tx.objectStore(storeName).getAll());
}

export async function getById(storeName, id) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  return reqAsPromise(tx.objectStore(storeName).get(id));
}

export async function put(storeName, value) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const result = await reqAsPromise(tx.objectStore(storeName).put(value));
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return result;
}

export async function remove(storeName, id) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  await reqAsPromise(tx.objectStore(storeName).delete(id));
}

export async function clearStore(storeName) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  await reqAsPromise(tx.objectStore(storeName).clear());
}

export async function exportDatabase() {
  const data = { version: 1, exportedAt: new Date().toISOString(), stores: {} };
  for (const name of STORES) data.stores[name] = await getAll(name);
  data.settings = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    data.settings[key] = localStorage.getItem(key);
  }
  return data;
}

export async function importDatabase(data) {
  if (!data || !data.stores) throw new Error('Invalid backup file');
  for (const name of STORES) {
    await clearStore(name);
    const items = Array.isArray(data.stores[name]) ? data.stores[name] : [];
    for (const item of items) await put(name, item);
  }
  if (data.settings && typeof data.settings === 'object') {
    for (const [key, value] of Object.entries(data.settings)) localStorage.setItem(key, value);
  }
}

export { STORES };
