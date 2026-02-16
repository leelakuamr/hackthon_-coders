/**
 * API configuration
 */
(function () {
    var PRODUCTION_API_URL = 'https://aicodebackend-production.up.railway.app'; // ✅ no slash

    var host = typeof window !== 'undefined' && window.location
        ? window.location.hostname
        : '';

    window.API_BASE = (host === 'localhost' || host === '127.0.0.1')
        ? 'http://localhost:8000'
        : PRODUCTION_API_URL;

    if (typeof window !== 'undefined' && !window.FIREBASE_CONFIG) {
        window.FIREBASE_CONFIG = {
            apiKey: "AIzaSyATIjf7Ga2m7LzoW8VcjwClCts1ktv1Scc",
            authDomain: "aicodere.firebaseapp.com",
            projectId: "aicodere",
            storageBucket: "aicodere.firebasestorage.app",
            messagingSenderId: "861410273348",
            appId: "1:861410273348:web:718e7e65a3466beb487411",
            measurementId: "G-M68MJG1TYW"
        };
    }
})();
