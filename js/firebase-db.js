"use strict";

const FirebaseDB = (() => {
  if (!window.firebase) {
    console.warn("Firebase SDK não carregado");
    return { loadAll: async () => [], savePerson: async () => null, deletePerson: async () => {} };
  }

  if (typeof FIREBASE_CONFIG === "undefined" || !FIREBASE_CONFIG.projectId) {
    console.error("FirebaseDB: FIREBASE_CONFIG não encontrado. Verifique config/config.js");
    return { loadAll: async () => [], savePerson: async () => null, deletePerson: async () => {} };
  }
  const _config = FIREBASE_CONFIG;

  if (!firebase.apps.length) {
    firebase.initializeApp(_config);
  }

  const db = firebase.firestore();
  const COLLECTION = "localdb";

  async function loadAll() {
    try {
      const snapshot = await db.collection(COLLECTION).orderBy("registeredAt", "desc").get();
      return snapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
    } catch (e) {
      console.warn("FirebaseDB.loadAll:", e);
      return [];
    }
  }

  async function savePerson(person) {
    try {
      const docRef = await db.collection(COLLECTION).add(person);
      return docRef.id;
    } catch (e) {
      console.warn("FirebaseDB.savePerson:", e);
      return null;
    }
  }

  async function deletePerson(firestoreId) {
    try {
      await db.collection(COLLECTION).doc(firestoreId).delete();
    } catch (e) {
      console.warn("FirebaseDB.deletePerson:", e);
    }
  }

  return { loadAll, savePerson, deletePerson };
})();
