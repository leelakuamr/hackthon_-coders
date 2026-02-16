;(function () {
  if (typeof window === 'undefined') return;
  if (typeof firebase === 'undefined' || !firebase || !firebase.initializeApp) {
    window.firebaseAuth = null;
    window.firebaseDb = null;
    return;
  }
  var cfg = null;
  try {
    if (window.FIREBASE_CONFIG && typeof window.FIREBASE_CONFIG === 'object') cfg = window.FIREBASE_CONFIG;
  } catch (e) {}
  if (!cfg) {
    try {
      var raw = localStorage.getItem('firebaseConfig');
      if (raw) cfg = JSON.parse(raw);
    } catch (e) {}
  }
  if (!cfg || !cfg.apiKey) {
    window.firebaseAuth = null;
    window.firebaseDb = null;
    return;
  }
  try {
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(cfg);
    }
  } catch (e) {}
  try {
    window.firebaseAuth = firebase.auth();
  } catch (e) {
    window.firebaseAuth = null;
  }
  try {
    window.firebaseDb = firebase.database ? firebase.database() : null;
  } catch (e) {
    window.firebaseDb = null;
  }
  try {
    if (firebase.analytics) window.firebaseAnalytics = firebase.analytics();
  } catch (e) {}
})(); 
