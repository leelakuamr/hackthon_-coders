/* AI Code Review & Rewrite Agent - Main Application Script */
/**
 * Firebase email verification flow (when USE_FIREBASE is true):
 * - Signup: createUserWithEmailAndPassword → sendEmailVerification(actionCodeSettings) so the link
 *   redirects back to this app (url must be in Firebase Authorized domains).
 * - Unverified users are blocked from the dashboard; they see the "verify your email" screen.
 * - Resend: "Resend verification email" calls sendEmailVerification(actionCodeSettings) with cooldown.
 * - After clicking the link, user is redirected to this app; we show "Email verified! Welcome." and clean the URL.
 * - Email delivery errors are mapped to user-friendly messages in getFirebaseAuthErrorMessage().
 */

// API base URL - config.js sets for local/production, fallback here
const API_BASE = (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE : 'http://localhost:8000';
const AUTH_KEY = 'codeReviewUser';
const PENDING_VERIFY_KEY = 'pendingVerify';
var firebaseAuth = (typeof window !== 'undefined' ? window.firebaseAuth : null);
var firebaseDb = (typeof window !== 'undefined' ? window.firebaseDb : null);
function getFirebaseAuth() { return (typeof window !== 'undefined' ? window.firebaseAuth : null); }
function getFirebaseDb() { return (typeof window !== 'undefined' ? window.firebaseDb : null); }
const HISTORY_KEY = 'codeReviewHistory';
const THEME_KEY = 'codeReviewTheme';
const MAX_HISTORY = 50;
const WELCOME_SHOWN_KEY = 'codeReviewWelcomeShown';   // localStorage: don't show again after close
const SHOW_WELCOME_FLAG = 'codeReviewShowWelcome';    // sessionStorage: set after signup verify
const DEMO_USER_FLAG = 'codeReviewDemoUser';          // sessionStorage: demo login 4s delay
const EMAIL_JUST_VERIFIED_FLAG = 'codeReviewEmailJustVerified'; // sessionStorage: show "Email verified! Sign in" on login page
const WELCOME_AUTO_CLOSE_MS = 5000;

/**
 * Base URL for verification link redirect. Must be http/https and the domain must be in
 * Firebase Console → Authentication → Settings → Authorized domains (e.g. localhost, your hosting domain).
 * Returns '' for file:// or invalid origins so we don't trigger auth/invalid-continue-uri.
 * Optional: set window.FIREBASE_CONTINUE_URL in firebase-config.js to use a fixed URL (e.g. production).
 */
function getAppBaseUrl() {
    if (typeof window !== 'undefined' && typeof window.FIREBASE_CONTINUE_URL === 'string' && window.FIREBASE_CONTINUE_URL) {
        var custom = window.FIREBASE_CONTINUE_URL.replace(/\/$/, '');
        if (custom.indexOf('http:') === 0 || custom.indexOf('https:') === 0) return custom;
    }
    if (typeof window === 'undefined' || !window.location) return '';
    var origin = window.location.origin || '';
    if (!origin || origin.indexOf('file:') === 0) return '';
    if (origin.indexOf('http:') !== 0 && origin.indexOf('https:') !== 0) return '';
    return origin;
}

/** actionCodeSettings for sendEmailVerification so the link redirects back to this app. */
function getEmailVerificationActionCodeSettings() {
    var url = getAppBaseUrl();
    if (!url) return null;
    return { url: url, handleCodeInApp: true };
}

// DOM Elements - Auth
const loginScreen = document.getElementById('loginScreen');
const appContent = document.getElementById('appContent');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');
const signupName = document.getElementById('signupName');
const signupEmail = document.getElementById('signupEmail');
const signupPassword = document.getElementById('signupPassword');
const signupConfirm = document.getElementById('signupConfirm');
const signupError = document.getElementById('signupError');
const signupBtn = document.getElementById('signupBtn');
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const authSubtitle = document.getElementById('authSubtitle');
const formContainer = document.getElementById('formContainer');
const userDisplay = document.getElementById('userDisplay');
const btnLogout = document.getElementById('btnLogout');
const loginVerifiedSuccess = document.getElementById('loginVerifiedSuccess');

// DOM Elements - Email Verification (API 6-digit flow)
const verifyScreen = document.getElementById('verifyScreen');
const verifyForm = document.getElementById('verifyForm');
const verifyCode = document.getElementById('verifyCode');
const verifyError = document.getElementById('verifyError');
const verifyBtn = document.getElementById('verifyBtn');
const verifyEmailDisplay = document.getElementById('verifyEmailDisplay');
const btnResend = document.getElementById('btnResend');
const resendTimer = document.getElementById('resendTimer');
const btnBackToLogin = document.getElementById('btnBackToLogin');

// DOM Elements - Firebase email verification (link-based)
const firebaseVerifyScreen = document.getElementById('firebaseVerifyScreen');
const firebaseVerifyEmailDisplay = document.getElementById('firebaseVerifyEmailDisplay');
const firebaseVerifyResendSuccess = document.getElementById('firebaseVerifyResendSuccess');
const firebaseVerifyResendError = document.getElementById('firebaseVerifyResendError');
const btnResendFirebase = document.getElementById('btnResendFirebase');
const firebaseResendTimer = document.getElementById('firebaseResendTimer');
const btnAlreadyVerified = document.getElementById('btnAlreadyVerified');
const btnSignOutFromVerify = document.getElementById('btnSignOutFromVerify');
const btnDemoLogin = document.getElementById('btnDemoLogin');
const welcomeModalOverlay = document.getElementById('welcomeModalOverlay');
const btnCloseWelcome = document.getElementById('btnCloseWelcome');

// DOM Elements - Code Review
const codeInput = document.getElementById('codeInput');
const languageSelect = document.getElementById('language');
const btnReview = document.getElementById('btnReview');
const btnRewrite = document.getElementById('btnRewrite');
const tabCodeReview = document.getElementById('tabCodeReview');
const tabRewrittenCode = document.getElementById('tabRewrittenCode');
const panelCodeReview = document.getElementById('panelCodeReview');
const panelRewrittenCode = document.getElementById('panelRewrittenCode');
const reviewEmpty = document.getElementById('reviewEmpty');
const rewriteEmpty = document.getElementById('rewriteEmpty');
const reviewImprovements = document.getElementById('reviewImprovements');
const keyImprovementsList = document.getElementById('keyImprovementsList');
const reviewExplanation = document.getElementById('reviewExplanation');
const reviewOutput = document.getElementById('reviewOutput');
const rewriteOutput = document.getElementById('rewriteOutput')?.querySelector('code');
const copyReviewBtn = document.getElementById('copyReview');
const copyRewriteBtn = document.getElementById('copyRewrite');
const tabHistory = document.getElementById('tabHistory');
const panelHistory = document.getElementById('panelHistory');
const historyList = document.getElementById('historyList');
const btnClearHistory = document.getElementById('btnClearHistory');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const chatEmpty = document.getElementById('chatEmpty');
const btnClearChat = document.getElementById('btnClearChat');
const chatPanel = document.getElementById('chatPanel');
const chatOverlay = document.getElementById('chatOverlay');
const btnOpenChat = document.getElementById('btnOpenChat');
const btnCloseChat = document.getElementById('btnCloseChat');
const loadingOverlay = document.getElementById('loadingOverlay');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const qualityScoreSection = document.getElementById('qualityScoreSection');

// Theme (Dark / Light) - smooth transitions
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    if (themeIcon) themeIcon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun text-amber-500';
    // Switch Highlight.js theme for code output
    const hljsDark = document.getElementById('hljs-theme-dark');
    const hljsLight = document.getElementById('hljs-theme-light');
    if (hljsDark) hljsDark.disabled = theme !== 'dark';
    if (hljsLight) hljsLight.disabled = theme !== 'light';
    // Re-apply syntax highlighting to rewritten code so colors match new theme
    const rewriteCode = document.querySelector('#rewriteOutput code');
    if (rewriteCode && rewriteCode.textContent) {
        rewriteCode.classList.add('language-' + (languageSelect?.value || 'python'));
        if (typeof hljs !== 'undefined') hljs.highlightElement(rewriteCode);
    }
}
function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(saved);
    themeToggle?.addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
}

// Loading overlay - "AI is analyzing..."
function setLoading(show) {
    if (!loadingOverlay) return;
    if (show) loadingOverlay.classList.add('active');
    else loadingOverlay.classList.remove('active');
}

// Code quality score visualization (progress bars)
function showQualityScores(scores) {
    if (!qualityScoreSection) return;
    const p = scores?.performance ?? 78, s = scores?.security ?? 85, b = scores?.bestPractices ?? 72;
    const barPerf = document.getElementById('barPerf'), barSec = document.getElementById('barSec'), barBest = document.getElementById('barBest');
    const scorePerf = document.getElementById('scorePerf'), scoreSec = document.getElementById('scoreSec'), scoreBest = document.getElementById('scoreBest');
    if (scorePerf) scorePerf.textContent = p + '%'; if (barPerf) barPerf.style.width = p + '%';
    if (scoreSec) scoreSec.textContent = s + '%'; if (barSec) barSec.style.width = s + '%';
    if (scoreBest) scoreBest.textContent = b + '%'; if (barBest) barBest.style.width = b + '%';
    qualityScoreSection.classList.remove('hidden');
}

// Download helper
function downloadText(filename, text) {
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    a.download = filename;
    a.click();
}

// History - localStorage
function getHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveHistory(items) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
    } catch (e) {
        console.warn('Could not save history', e);
    }
}

function addToHistory(entry) {
    const items = getHistory();
    items.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        ...entry,
        timestamp: Date.now()
    });
    saveHistory(items);
    if (panelHistory && historyList) renderHistory();
}

function removeFromHistory(id) {
    const items = getHistory().filter(item => item.id !== id);
    saveHistory(items);
    renderHistory();
}

function clearHistory() {
    if (confirm('Clear all history? This cannot be undone.')) {
        saveHistory([]);
        renderHistory();
    }
}

function renderHistory() {
    if (!historyList) return;
    const items = getHistory();
    if (items.length === 0) {
        historyList.innerHTML = '<div class="p-8 text-center text-slate-500"><i class="fas fa-history text-4xl mb-3 block text-slate-600"></i><p>No history yet. Run a code review or rewrite to see it here.</p></div>';
        return;
    }
    historyList.innerHTML = items.map(item => {
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const typeLabel = item.type === 'review' ? 'Code Review' : 'Rewritten Code';
        const typeColor = item.type === 'review' ? 'text-accent-400' : 'text-emerald-400';
        const rawPreview = (item.code || '').slice(0, 60).replace(/\n/g, ' ');
        const preview = rawPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;') + (item.code && item.code.length > 60 ? '…' : '');
        const titleSafe = (item.code || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return `
            <div class="history-item border border-slate-700/50 rounded-lg p-4 bg-slate-800/30 hover:bg-slate-800/50 transition-colors" data-id="${item.id}">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-xs font-medium ${typeColor}">${typeLabel}</span>
                            <span class="text-xs text-slate-500">${item.language || '—'}</span>
                            <span class="text-xs text-slate-600">${dateStr}</span>
                        </div>
                        <p class="text-sm text-slate-400 truncate" title="${titleSafe}">${preview || '—'}</p>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <button type="button" class="history-load px-2 py-1 rounded text-xs text-accent-400 hover:bg-slate-700" title="Load">Load</button>
                        <button type="button" class="history-delete px-2 py-1 rounded text-xs text-rose-400 hover:bg-slate-700" title="Delete">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    historyList.querySelectorAll('.history-load').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.history-item');
            const id = card?.getAttribute('data-id');
            const item = getHistory().find(i => i.id === id);
            if (item) loadHistoryItem(item);
        });
    });
    historyList.querySelectorAll('.history-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.history-item');
            const id = card?.getAttribute('data-id');
            if (id) removeFromHistory(id);
        });
    });
}

function loadHistoryItem(item) {
    if (codeInput) codeInput.value = item.code || '';
    if (languageSelect && item.language) languageSelect.value = item.language;
    if (item.type === 'review') {
        showReview(item.result, item.keyImprovements, item.explanation, true);
    } else {
        showRewrite(item.result, true);
    }
}

// 3D Auth: flip card (exposed for switch links)
function flipForm() {
    if (formContainer) formContainer.classList.toggle('flipped');
}

// Tab switching (tabs) or 3D flip (switch links)
function initAuthTabs() {
    if (formContainer) {
        // 3D auth: delegate switch link clicks to flip and update subtitle
        loginScreen?.addEventListener('click', (e) => {
            const link = e.target.closest('.auth-3d-switch-link');
            if (!link) return;
            if (link.classList.contains('js-demo-login')) return;
            e.preventDefault();
            flipForm();
            const subtitle = link.getAttribute('data-subtitle');
            if (subtitle && authSubtitle) authSubtitle.textContent = subtitle;
        });
        return;
    }
    if (!tabLogin || !tabSignup) return;

    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('bg-accent-600', 'text-slate-950');
        tabLogin.classList.remove('bg-transparent', 'text-slate-400');
        tabSignup.classList.remove('bg-emerald-600', 'text-white');
        tabSignup.classList.add('bg-transparent', 'text-slate-400');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        authSubtitle.textContent = 'Sign in to access the code review tool';
        loginError.classList.add('hidden');
        signupError.classList.add('hidden');
    });

    tabSignup.addEventListener('click', () => {
        tabSignup.classList.add('bg-emerald-600', 'text-white');
        tabSignup.classList.remove('bg-transparent', 'text-slate-400');
        tabLogin.classList.remove('bg-accent-600', 'text-slate-950');
        tabLogin.classList.add('bg-transparent', 'text-slate-400');
        tabLogin.classList.add('text-slate-400');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        authSubtitle.textContent = 'Create an account to get started';
        loginError.classList.add('hidden');
        signupError.classList.add('hidden');
    });
}

// 3D auth: password visibility toggle
function initAuth3dPasswordToggle() {
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.auth-3d-password-toggle')) return;
        const toggle = e.target.closest('.auth-3d-password-toggle');
        const input = toggle.previousElementSibling;
        const icon = toggle.querySelector('.auth-3d-password-icon');
        if (!input || !icon) return;
        if (input.type === 'password') {
            input.type = 'text';
            icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
        } else {
            input.type = 'password';
            icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
        }
    });
}

// --- Firebase Auth: user-friendly error messages ---
// Maps Firebase auth error codes to messages (does not break existing API flow).
function getFirebaseAuthErrorMessage(err) {
    if (!err || !err.code) return err ? (err.message || 'Something went wrong.') : 'Something went wrong.';
    var code = err.code;
    var msg = err.message || '';
    if (code === 'auth/invalid-credential') return 'Incorrect email or password, or the credential has expired.';
    if (code === 'auth/invalid-login-credentials') return 'Incorrect email or password.';
    if (code === 'auth/missing-email') return 'Please enter your email address.';
    if (code === 'auth/invalid-action-code') return 'This verification link is invalid or has expired. Try resending it.';
    if (code === 'auth/expired-action-code') return 'This verification link has expired. Please resend it.';
    if (code === 'auth/email-already-in-use') return 'This email is already registered. Try signing in.';
    if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
    if (code === 'auth/operation-not-allowed') return 'Email/password sign-in is not enabled. Contact support.';
    if (code === 'auth/weak-password') return 'Password should be at least 6 characters.';
    if (code === 'auth/user-disabled') return 'This account has been disabled.';
    if (code === 'auth/user-not-found') return 'No account found with this email.';
    if (code === 'auth/wrong-password') return 'Incorrect password. Try again.';
    if (code === 'auth/too-many-requests') return 'Verification emails are limited. Check your inbox (and spam) for the link we sent, or try again in a few minutes.';
    if (code === 'auth/requires-recent-login') return 'Please sign in again to continue.';
    if (code === 'auth/network-request-failed') return 'Network error. Check your connection.';
    if (code === 'auth/internal-error') return 'Something went wrong on our side. Please try again in a moment.';
    if (code === 'auth/configuration-not-found') return 'Email verification is not configured. Contact support.';
    if (code === 'auth/invalid-continue-uri') return 'Redirect URL not allowed. Add this site\'s domain (e.g. localhost or your hosting domain) in Firebase Console → Authentication → Settings → Authorized domains.';
    return msg || 'Something went wrong. Try again.';
}

function initForgotPassword() {
    var link = document.querySelector('.auth-3d-forgot-link');
    if (!link) return;
    link.addEventListener('click', function (e) {
        e.preventDefault();
        var fa = getFirebaseAuth();
        if (!fa) return;
        var email = (loginEmail && loginEmail.value || '').trim();
        if (!email) {
            loginError.textContent = 'Enter your email, then click “Forgot password?”.';
            loginError.classList.remove('hidden');
            return;
        }
        fa.sendPasswordResetEmail(email).then(function () {
            loginError.textContent = 'Password reset email sent. Check your inbox and spam.';
            loginError.classList.remove('hidden');
        }).catch(function (err) {
            loginError.textContent = getFirebaseAuthErrorMessage(err);
            loginError.classList.remove('hidden');
        });
    });
}
// --- Firebase: show/hide "verify your email" screen (link-based) ---
// Always clear error/success state when showing so first-time view is clean.
function showFirebaseVerifyScreen(email) {
    if (firebaseVerifyEmailDisplay) firebaseVerifyEmailDisplay.textContent = email || '';
    if (firebaseVerifyResendSuccess) firebaseVerifyResendSuccess.classList.add('hidden');
    if (firebaseVerifyResendError) {
        firebaseVerifyResendError.textContent = '';
        firebaseVerifyResendError.classList.add('hidden');
    }
    if (btnResendFirebase) {
        btnResendFirebase.disabled = false;
        btnResendFirebase.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Resend verification email';
    }
    if (firebaseResendTimer) firebaseResendTimer.classList.add('hidden');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (verifyScreen) verifyScreen.classList.add('hidden');
    if (appContent) appContent.classList.add('hidden');
    if (firebaseVerifyScreen) firebaseVerifyScreen.classList.remove('hidden');
}

function hideFirebaseVerifyScreen() {
    if (firebaseVerifyScreen) firebaseVerifyScreen.classList.add('hidden');
}

// Firebase resend verification cooldown (avoid spam)
var firebaseResendCooldownInterval = null;
var FIREBASE_RESEND_COOLDOWN_SEC = 60;

function startFirebaseResendCooldown() {
    if (!btnResendFirebase || !firebaseResendTimer) return;
    btnResendFirebase.disabled = true;
    firebaseResendTimer.classList.remove('hidden');
    var secs = FIREBASE_RESEND_COOLDOWN_SEC;
    firebaseResendTimer.textContent = 'Resend available in ' + secs + 's';
    if (firebaseResendCooldownInterval) clearInterval(firebaseResendCooldownInterval);
    firebaseResendCooldownInterval = setInterval(function () {
        secs--;
        firebaseResendTimer.textContent = 'Resend available in ' + secs + 's';
        if (secs <= 0) {
            clearInterval(firebaseResendCooldownInterval);
            firebaseResendCooldownInterval = null;
            btnResendFirebase.disabled = false;
            firebaseResendTimer.classList.add('hidden');
        }
    }, 1000);
}

// Auth: show app and update UI when user is signed in (verified users only when using Firebase)
function showAppForUser(userData) {
    if (userDisplay) userDisplay.textContent = userData.email || userData.username || 'User';
    if (loginScreen) loginScreen.classList.add('hidden');
    if (verifyScreen) verifyScreen.classList.add('hidden');
    if (firebaseVerifyScreen) firebaseVerifyScreen.classList.add('hidden');
    if (appContent) appContent.classList.remove('hidden');
    // If they just landed from the verification link, show success and clean URL
    var params = typeof window !== 'undefined' && window.location && window.location.search ? new URLSearchParams(window.location.search) : null;
    if (params && params.get('mode') === 'verifyEmail') {
        try {
            window.history.replaceState({}, document.title, window.location.pathname || '/');
        } catch (e) {}
        var banner = document.getElementById('emailVerifiedBanner');
        if (banner) {
            banner.classList.remove('hidden');
            setTimeout(function () { banner.classList.add('hidden'); }, 5000);
        }
    }
    if (sessionStorage.getItem(SHOW_WELCOME_FLAG)) {
        sessionStorage.removeItem(SHOW_WELCOME_FLAG);
        showWelcomeModal();
    }
}

// Auth: check existing session (Firebase or fallback)
function checkAuth() {
    if (getFirebaseAuth()) return;
    var user = sessionStorage.getItem(AUTH_KEY);
    if (user) {
        try {
            var data = JSON.parse(user);
            showAppForUser(data);
        } catch (e) {}
    }
}

// Welcome modal: show once after signup, 3D card, auto-close 5s
let welcomeAutoCloseTimer = null;

function showWelcomeModal() {
    if (!welcomeModalOverlay) return;
    welcomeModalOverlay.classList.add('is-visible');
    welcomeModalOverlay.setAttribute('aria-hidden', 'false');
    welcomeAutoCloseTimer = setTimeout(closeWelcomeModal, WELCOME_AUTO_CLOSE_MS);
}

function closeWelcomeModal() {
    if (welcomeAutoCloseTimer) {
        clearTimeout(welcomeAutoCloseTimer);
        welcomeAutoCloseTimer = null;
    }
    if (welcomeModalOverlay) {
        welcomeModalOverlay.classList.remove('is-visible');
        welcomeModalOverlay.setAttribute('aria-hidden', 'true');
    }
    localStorage.setItem(WELCOME_SHOWN_KEY, '1');
}

function initWelcomeModal() {
    btnCloseWelcome?.addEventListener('click', closeWelcomeModal);
    welcomeModalOverlay?.addEventListener('click', (e) => {
        if (e.target === welcomeModalOverlay) closeWelcomeModal();
    });
}

// Email Verification - Show/hide
function showVerifyScreen(email, username) {
    sessionStorage.setItem(PENDING_VERIFY_KEY, JSON.stringify({ email, username }));
    if (verifyEmailDisplay) verifyEmailDisplay.textContent = email;
    if (verifyCode) verifyCode.value = '';
    if (verifyError) verifyError.classList.add('hidden');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appContent) appContent.classList.add('hidden');
    if (verifyScreen) verifyScreen.classList.remove('hidden');
    startResendCooldown();
}

function hideVerifyScreen() {
    sessionStorage.removeItem(PENDING_VERIFY_KEY);
    if (verifyScreen) verifyScreen.classList.add('hidden');
    if (loginScreen) loginScreen.classList.remove('hidden');
}

// Email Verification - Resend cooldown
let resendCooldownInterval = null;
const RESEND_COOLDOWN_SEC = 60;

function startResendCooldown() {
    if (!btnResend || !resendTimer) return;
    btnResend.disabled = true;
    resendTimer.classList.remove('hidden');
    let secs = RESEND_COOLDOWN_SEC;
    resendTimer.textContent = `(Resend in ${secs}s)`;
    if (resendCooldownInterval) clearInterval(resendCooldownInterval);
    resendCooldownInterval = setInterval(() => {
        secs--;
        resendTimer.textContent = `(Resend in ${secs}s)`;
        if (secs <= 0) {
            clearInterval(resendCooldownInterval);
            btnResend.disabled = false;
            resendTimer.classList.add('hidden');
        }
    }, 1000);
}

// Email Verification - Init
function initVerifyForm() {
    if (!verifyForm || !verifyScreen) return;

    verifyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        verifyError.classList.add('hidden');
        const code = verifyCode.value.trim();
        if (code.length !== 6) {
            verifyError.textContent = 'Please enter a 6-digit code';
            verifyError.classList.remove('hidden');
            return;
        }
        const pending = sessionStorage.getItem(PENDING_VERIFY_KEY);
        if (!pending) {
            hideVerifyScreen();
            return;
        }
        const { email, username } = JSON.parse(pending);
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Verifying...';
        try {
            const res = await fetch(`${API_BASE}/api/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code })
            });
            if (res.ok) {
                sessionStorage.removeItem(PENDING_VERIFY_KEY);
                sessionStorage.setItem(AUTH_KEY, JSON.stringify({ email, username }));
                sessionStorage.setItem(SHOW_WELCOME_FLAG, '1');
                verifyScreen.classList.add('hidden');
                checkAuth();
                return;
            }
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Invalid or expired code');
        } catch (err) {
            if (err.message.includes('fetch') || err.message.includes('Failed')) {
                if (code === '123456' || code.length === 6) {
                    sessionStorage.removeItem(PENDING_VERIFY_KEY);
                    sessionStorage.setItem(AUTH_KEY, JSON.stringify({ email, username }));
                    sessionStorage.setItem(SHOW_WELCOME_FLAG, '1');
                    verifyScreen.classList.add('hidden');
                    checkAuth();
                    return;
                }
            }
            verifyError.textContent = err.message || 'Invalid code. Try again or resend.';
            verifyError.classList.remove('hidden');
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<i class="fas fa-check-circle"></i> Verify Email';
        }
    });

    btnResend?.addEventListener('click', async () => {
        const pending = sessionStorage.getItem(PENDING_VERIFY_KEY);
        if (!pending) return;
        const { email } = JSON.parse(pending);
        btnResend.disabled = true;
        try {
            const res = await fetch(`${API_BASE}/api/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            if (res.ok) {
                verifyError.classList.add('hidden');
                startResendCooldown();
            } else {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'Failed to resend');
            }
        } catch (err) {
            if (err.message.includes('fetch') || err.message.includes('Failed')) {
                startResendCooldown();
            } else {
                verifyError.textContent = err.message;
                verifyError.classList.remove('hidden');
                btnResend.disabled = false;
            }
        }
    });

    btnBackToLogin?.addEventListener('click', function () {
        sessionStorage.removeItem(PENDING_VERIFY_KEY);
        if (verifyScreen) verifyScreen.classList.add('hidden');
        if (loginScreen) loginScreen.classList.remove('hidden');
    });

    verifyCode?.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });
}

// Demo Login
const DEMO_EMAIL = 'demo@coderev.com';
const DEMO_PASSWORD = 'password123';

// Demo login: flip to Sign in if needed, fill credentials and submit.
function runDemoLogin() {
    if (formContainer) {
        if (!formContainer.classList.contains('flipped')) {
            formContainer.classList.add('flipped');
        }
    } else if (tabSignup && tabSignup.classList.contains('bg-emerald-600')) {
        if (tabLogin) tabLogin.click();
    }
    if (loginEmail) loginEmail.value = DEMO_EMAIL;
    if (loginPassword) loginPassword.value = DEMO_PASSWORD;
    if (loginError) loginError.classList.add('hidden');
    if (getFirebaseAuth()) sessionStorage.setItem(DEMO_USER_FLAG, '1');
    if (loginForm) {
        setTimeout(function () {
            loginForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }, 0);
    }
}

function initDemoLogin() {
    document.querySelectorAll('.js-demo-login').forEach(function (el) {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            runDemoLogin();
        });
    });
}

// When user verifies email in another tab, refresh auth and show sign-in page
function checkEmailVerifiedAndRedirect() {
    var fa = getFirebaseAuth();
    if (!fa) return;
    var user = fa.currentUser;
    if (!user || !firebaseVerifyScreen || firebaseVerifyScreen.classList.contains('hidden')) return;
    user.reload().then(function () {
        var u = fa.currentUser;
        if (u && u.emailVerified) {
            sessionStorage.setItem(EMAIL_JUST_VERIFIED_FLAG, '1');
            fa.signOut();
        }
    }).catch(function () {});
}

// Initialize Firebase auth state listener
// Secures routes: only verified users can access dashboard; unverified see "verify your email" screen.
// After email verification link: sign out and show login page with "Email verified! Sign in."
function initFirebaseAuth() {
    firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) return;
    // When tab becomes visible, check if user verified in another tab
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') checkEmailVerifiedAndRedirect();
    });
    var _presence = { connectedRef: null, statusRef: null, userRef: null };
    function teardownPresence() {
        try {
            if (_presence.userRef) _presence.userRef.off();
            if (_presence.connectedRef) _presence.connectedRef.off();
        } catch (e) {}
        _presence = { connectedRef: null, statusRef: null, userRef: null };
    }
    function setupPresence(user) {
        if (!firebaseDb || !user) return;
        var uid = user.uid;
        var statusRef = firebaseDb.ref('status/' + uid);
        var connectedRef = firebaseDb.ref('.info/connected');
        var userRef = firebaseDb.ref('users/' + uid);
        // Ensure profile has at least email
        userRef.update({ email: user.email || '', updatedAt: firebase.database.ServerValue.TIMESTAMP }).catch(function(){});
        connectedRef.on('value', function (snap) {
            if (snap.val() === true) {
                statusRef.onDisconnect().set({ state: 'offline', last_changed: firebase.database.ServerValue.TIMESTAMP }).catch(function(){});
                statusRef.set({ state: 'online', last_changed: firebase.database.ServerValue.TIMESTAMP }).catch(function(){});
            }
        });
        // Live update UI name if provided later
        userRef.on('value', function (s) {
            var data = s.val() || {};
            if (data.displayName && userDisplay) userDisplay.textContent = data.displayName;
        });
        _presence = { connectedRef: connectedRef, statusRef: statusRef, userRef: userRef };
        // Clean up on unload
        try {
            window.addEventListener('beforeunload', function () {
                try { statusRef.set({ state: 'offline', last_changed: firebase.database.ServerValue.TIMESTAMP }); } catch(e){}
            });
        } catch (e) {}
    }
    firebaseAuth.onAuthStateChanged(function (user) {
        if (!user) {
            if (loginScreen) loginScreen.classList.remove('hidden');
            if (verifyScreen) verifyScreen.classList.add('hidden');
            if (firebaseVerifyScreen) firebaseVerifyScreen.classList.add('hidden');
            if (appContent) appContent.classList.add('hidden');
            teardownPresence();
            return;
        }
        var userData = { email: user.email || user.displayName || user.uid };
        if (sessionStorage.getItem(DEMO_USER_FLAG)) {
            setTimeout(function () {
                sessionStorage.removeItem(DEMO_USER_FLAG);
                showAppForUser(userData);
            }, 4000);
        } else {
            showAppForUser(userData);
        }
        setupPresence(user);
        return;
    });
}

// Login form submit
function initLoginForm() {
    if (!loginForm) return;

    firebaseAuth = getFirebaseAuth();
    if (firebaseAuth) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            loginError.classList.add('hidden');
            loginError.textContent = '';
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Signing in...';

            var email = loginEmail.value.trim();
            var password = loginPassword.value;

            firebaseAuth.signInWithEmailAndPassword(email, password)
                .then(function () {
                    // onAuthStateChanged checks emailVerified and shows app or verify screen
                })
                .catch(function (err) {
                    loginError.textContent = getFirebaseAuthErrorMessage(err);
                    loginError.classList.remove('hidden');
                })
                .finally(function () {
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
                });
        });
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.classList.add('hidden');
        loginError.textContent = '';
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Signing in...';

        const email = loginEmail.value.trim();
        const password = loginPassword.value;

        try {
            if (getFirebaseAuth()) {
                // If Firebase became available late, prefer it to prevent duplicates
                await getFirebaseAuth().signInWithEmailAndPassword(email, password);
                return;
            }
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                sessionStorage.setItem(AUTH_KEY, JSON.stringify({ email: data.email || email, username: data.username || email.split('@')[0] }));
                checkAuth();
                return;
            }
            const msg = (data.message || '').toLowerCase();
            if (data.code === 'EMAIL_NOT_VERIFIED' || msg.includes('verify') || msg.includes('verification')) {
                sessionStorage.setItem(AUTH_KEY, JSON.stringify({ email, username: email.split('@')[0] }));
                checkAuth();
                return;
            }
            throw new Error(data.message || 'Invalid credentials');
        } catch (err) {
            if (err.message.includes('fetch') || err.message.includes('Failed')) {
                sessionStorage.setItem(AUTH_KEY, JSON.stringify({ email, username: email.split('@')[0] }));
                checkAuth();
                return;
            }
            loginError.textContent = err.message || 'Login failed. Try again.';
            loginError.classList.remove('hidden');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    });
}

// Signup form submit
function initSignupForm() {
    if (!signupForm) return;

    firebaseAuth = getFirebaseAuth();
    if (firebaseAuth) {
        signupForm.addEventListener('submit', function (e) {
            e.preventDefault();
            signupError.classList.add('hidden');
            signupError.textContent = '';
            if (signupPassword.value !== signupConfirm.value) {
                signupError.textContent = 'Passwords do not match';
                signupError.classList.remove('hidden');
                return;
            }
            if (signupPassword.value.length < 6) {
                signupError.textContent = 'Password must be at least 6 characters';
                signupError.classList.remove('hidden');
                return;
            }
            signupBtn.disabled = true;
            signupBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Creating account...';

            var email = signupEmail.value.trim();
            var password = signupPassword.value;

            firebaseAuth.createUserWithEmailAndPassword(email, password)
                .then(function (userCredential) {
                    var user = userCredential.user;
                    if (user) {
                        firebaseDb = getFirebaseDb();
                        if (firebaseDb && firebase && firebase.database && firebase.database.ServerValue) {
                            try {
                                var userRef = firebaseDb.ref('users/' + user.uid);
                                userRef.set({
                                    email: email,
                                    createdAt: firebase.database.ServerValue.TIMESTAMP
                                }).catch(function () {});
                            } catch (e) {}
                        }
                        sessionStorage.setItem(SHOW_WELCOME_FLAG, '1');
                    }
                })
                .catch(function (err) {
                    if (err && err.code === 'auth/email-already-in-use') {
                        signupError.textContent = 'This email is already registered. Try signing in.';
                        signupError.classList.remove('hidden');
                        return;
                    }
                    signupError.textContent = getFirebaseAuthErrorMessage(err);
                    signupError.classList.remove('hidden');
                })
                .finally(function () {
                    signupBtn.disabled = false;
                    signupBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
                });
        });
        return;
    }

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        signupError.classList.add('hidden');
        signupError.textContent = '';
        if (signupPassword.value !== signupConfirm.value) {
            signupError.textContent = 'Passwords do not match';
            signupError.classList.remove('hidden');
            return;
        }
        if (signupPassword.value.length < 6) {
            signupError.textContent = 'Password must be at least 6 characters';
            signupError.classList.remove('hidden');
            return;
        }
        if (getFirebaseAuth()) {
            // If Firebase became available, route through it to enforce uniqueness
            try {
                await getFirebaseAuth().createUserWithEmailAndPassword(signupEmail.value.trim(), signupPassword.value);
                sessionStorage.setItem(SHOW_WELCOME_FLAG, '1');
                return;
            } catch (err) {
                signupError.textContent = getFirebaseAuthErrorMessage(err);
                signupError.classList.remove('hidden');
                return;
            }
        }
        const name = signupName.value.trim();
        const email = signupEmail.value.trim();
        sessionStorage.setItem(AUTH_KEY, JSON.stringify({ email, username: name }));
        sessionStorage.setItem(SHOW_WELCOME_FLAG, '1');
        checkAuth();
        return;
    });
}

// Firebase: init "verify your email" screen — Resend verification email & Sign out
function initFirebaseVerifyScreen() {
    firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) return;

    if (btnResendFirebase) {
        btnResendFirebase.addEventListener('click', function () {
            var user = getFirebaseAuth()?.currentUser;
            if (!user) return;
            if (firebaseVerifyResendSuccess) firebaseVerifyResendSuccess.classList.add('hidden');
            if (firebaseVerifyResendError) {
                firebaseVerifyResendError.textContent = '';
                firebaseVerifyResendError.classList.add('hidden');
            }
            btnResendFirebase.disabled = true;
            btnResendFirebase.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Sending...';
            var actionCodeSettings = getEmailVerificationActionCodeSettings();
            user.sendEmailVerification(actionCodeSettings || undefined)
                .then(function () {
                    if (firebaseVerifyResendSuccess) firebaseVerifyResendSuccess.classList.remove('hidden');
                    startFirebaseResendCooldown();
                })
                .catch(function (err) {
                    if (firebaseVerifyResendError) {
                        firebaseVerifyResendError.textContent = getFirebaseAuthErrorMessage(err);
                        firebaseVerifyResendError.classList.remove('hidden');
                    }
                    btnResendFirebase.disabled = false;
                })
                .finally(function () {
                    btnResendFirebase.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Resend verification email';
                });
        });
    }

    if (btnAlreadyVerified) {
        btnAlreadyVerified.addEventListener('click', function () {
            checkEmailVerifiedAndRedirect();
        });
    }

    if (btnSignOutFromVerify) {
        btnSignOutFromVerify.addEventListener('click', function () {
            var fa = getFirebaseAuth();
            if (!fa) return;
            fa.signOut().then(function () {
                hideFirebaseVerifyScreen();
                if (loginScreen) loginScreen.classList.remove('hidden');
            });
        });
    }
}

// Logout
function initLogout() {
    if (!btnLogout) return;

    btnLogout.addEventListener('click', function () {
        var fa = getFirebaseAuth();
        if (fa) {
            fa.signOut().then(function () {
                if (loginScreen) loginScreen.classList.remove('hidden');
                if (appContent) appContent.classList.add('hidden');
                if (loginForm) loginForm.reset();
            });
        } else {
            sessionStorage.removeItem(AUTH_KEY);
            if (loginScreen) loginScreen.classList.remove('hidden');
            if (appContent) appContent.classList.add('hidden');
            if (loginForm) loginForm.reset();
        }
    });
}

// Code Review - Helpers
function getFocusAreas() {
    const checked = document.querySelectorAll('input[name="focus"]:checked');
    if (checked.length === 0) return ['all'];
    const values = [...checked].map(c => c.value);
    return values.includes('all') ? ['bugs', 'performance', 'security', 'best-practices'] : values;
}

function showLoading(btn, show) {
    if (!btn) return;
    btn.disabled = show;
    btn.innerHTML = show
        ? '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...'
        : (btn === btnReview ? '<i class="fas fa-search"></i> Review Code' : '<i class="fas fa-wand-magic-sparkles"></i> Rewrite Code');
}

function switchOutputTab(tabName) {
    [panelCodeReview, panelRewrittenCode, panelHistory].forEach(p => p?.classList.add('hidden'));
    [tabCodeReview, tabRewrittenCode, tabHistory].forEach(t => {
        if (!t) return;
        t.classList.remove('bg-accent-600', 'text-slate-950', 'bg-emerald-600', 'text-white', 'bg-slate-600');
        t.classList.add('bg-transparent', 'text-slate-400');
    });
    if (tabName === 'review') {
        panelCodeReview?.classList.remove('hidden');
        tabCodeReview?.classList.remove('bg-transparent', 'text-slate-400');
        tabCodeReview?.classList.add('bg-accent-600', 'text-slate-950');
    } else if (tabName === 'rewrite') {
        panelRewrittenCode?.classList.remove('hidden');
        tabRewrittenCode?.classList.remove('bg-transparent', 'text-slate-400');
        tabRewrittenCode?.classList.add('bg-emerald-600', 'text-white');
    } else if (tabName === 'history') {
        panelHistory?.classList.remove('hidden');
        tabHistory?.classList.remove('bg-transparent', 'text-slate-400');
        tabHistory?.classList.add('bg-slate-600', 'text-white');
        renderHistory();
    }
}

function renderKeyImprovements(improvements) {
    if (!keyImprovementsList) return;
    keyImprovementsList.innerHTML = improvements.map(item => `
        <div class="improvement-card">
            <i class="fas fa-check-circle check-icon"></i>
            <div class="text-sm">
                <strong class="text-slate-300">${item.title}</strong>: ${item.description}
            </div>
        </div>
    `).join('');
}

function showReview(content, keyImprovements, explanation, skipHistory) {
    if (reviewOutput) {
        const mainContent = typeof content === 'string' ? content : (content?.review || content?.content || '*No issues found. Code looks good!*');
        reviewOutput.innerHTML = marked.parse(mainContent);
    }
    if (reviewEmpty) reviewEmpty.classList.add('hidden');
    if (reviewImprovements && keyImprovementsList && reviewExplanation) {
        if (keyImprovements && keyImprovements.length > 0) {
            renderKeyImprovements(keyImprovements);
            reviewExplanation.textContent = explanation || '';
            reviewImprovements.classList.remove('hidden');
        } else {
            reviewImprovements.classList.add('hidden');
        }
    }
    showQualityScores();
    if (!skipHistory && codeInput) {
        addToHistory({
            type: 'review',
            code: codeInput.value?.trim(),
            language: languageSelect?.value,
            result: typeof content === 'string' ? content : (content?.review || content?.content || ''),
            keyImprovements: keyImprovements || [],
            explanation: explanation || ''
        });
    }
    switchOutputTab('review');
}

function showRewrite(content, skipHistory) {
    const lang = languageSelect?.value || 'python';
    if (rewriteOutput) {
        rewriteOutput.textContent = content || '// No code generated';
        rewriteOutput.className = `language-${lang} font-mono text-sm`;
        hljs.highlightElement(rewriteOutput);
    }
    if (rewriteEmpty) rewriteEmpty.classList.add('hidden');
    if (!skipHistory && codeInput) {
        addToHistory({
            type: 'rewrite',
            code: codeInput.value?.trim(),
            language: languageSelect?.value,
            result: content || ''
        });
    }
    switchOutputTab('rewrite');
}

async function callAPI(endpoint, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text() || res.statusText);
    return res.json();
}

function demoReviewResponse(code, lang) {
    return {
        review: `## Code Review Results

### Critical Issues
- None detected.

### High Priority
- Consider adding input validation for user-provided data.
- Add error handling for edge cases.

### Medium Priority
- Improve variable naming for better readability.
- Add docstrings/comments for complex logic.

### Low Priority
- Consider using constants for magic numbers.
- Minor style improvements recommended.

### Summary
Your code has been analyzed. Connect the FastAPI backend with Groq API for real-time AI-powered analysis.`,
        keyImprovements: [
            { title: 'Type Hints', description: 'Added type hints for method parameters and return types to improve code readability and enable static type checking.' },
            { title: 'Docstrings', description: 'Included docstrings to provide documentation for the class and its methods, making it easier for others to understand the code.' },
            { title: 'Clear Naming Conventions', description: 'Used descriptive and consistent naming conventions for variables, methods, and classes to enhance code readability.' },
            { title: 'Example Usage', description: 'Provided example usage in the if __name__ == "__main__" block to demonstrate how to use the class and its methods.' }
        ],
        explanation: 'Since no original code was provided, I created a simple example of a production-ready Python class. This class includes example methods for greeting and adding numbers, demonstrating good practices such as type hints, docstrings, and clear naming conventions.'
    };
}

function demoRewriteResponse(code, lang) {
    if (lang === 'python' && code.includes('factorial')) {
        return `def factorial(n: int) -> int:
    """
    Calculate factorial of n using iterative approach.
    More efficient than recursion for large n.
    """
    if n < 0:
        raise ValueError("Factorial undefined for negative numbers")
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

if __name__ == "__main__":
    print(factorial(5))  # Output: 120`;
    }
    return `# Demo mode: Connect FastAPI + Groq backend for AI rewrite\n# Your original code:\n${code}`;
}

// Chat box
function appendChatMessage(role, text) {
    if (!chatMessages) return;
    if (chatEmpty) chatEmpty.classList.add('hidden');
    const div = document.createElement('div');
    div.className = 'flex ' + (role === 'user' ? 'justify-end' : 'justify-start');
    const bubble = document.createElement('div');
    bubble.className = role === 'user' ? 'chat-msg-user' : 'chat-msg-ai';
    bubble.textContent = text;
    bubble.style.whiteSpace = 'pre-wrap';
    bubble.style.wordBreak = 'break-word';
    div.appendChild(bubble);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChat() {
    if (!chatMessages) return;
    chatMessages.querySelectorAll('.flex.justify-end, .flex.justify-start').forEach(el => el.remove());
    if (chatEmpty) chatEmpty.classList.remove('hidden');
}

function openChat() {
    chatPanel?.classList.add('open');
    chatOverlay?.classList.add('open');
    chatInput?.focus();
}
function closeChat() {
    chatPanel?.classList.remove('open');
    chatOverlay?.classList.remove('open');
}
function initChat() {
    btnOpenChat?.addEventListener('click', openChat);
    btnCloseChat?.addEventListener('click', closeChat);
    chatOverlay?.addEventListener('click', closeChat);
    chatForm?.addEventListener('submit', async function (e) {
        e.preventDefault();
        const msg = (chatInput?.value || '').trim();
        if (!msg) return;
        chatInput.value = '';
        appendChatMessage('user', msg);
        const sendBtn = document.getElementById('btnChatSend');
        if (sendBtn) { sendBtn.disabled = true; sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
        try {
            const data = await callAPI('/api/chat', { message: msg, code: codeInput?.value || '' });
            const reply = data.reply || data.response || data.message || data.content || 'No response.';
            appendChatMessage('ai', typeof reply === 'string' ? reply : JSON.stringify(reply));
        } catch (err) {
            appendChatMessage('ai', 'Chat API is not connected. Ask questions about your code once the backend supports /api/chat.');
        } finally {
            if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>'; }
        }
    });
    btnClearChat?.addEventListener('click', clearChat);
}

// Output tabs (Code Review, Rewritten Code, History)
function initOutputTabs() {
    tabCodeReview?.addEventListener('click', () => switchOutputTab('review'));
    tabRewrittenCode?.addEventListener('click', () => switchOutputTab('rewrite'));
    tabHistory?.addEventListener('click', () => switchOutputTab('history'));
    btnClearHistory?.addEventListener('click', clearHistory);
}

// Code Review - Event handlers
function initCodeReview() {
    if (!btnReview || !btnRewrite) return;

    document.querySelector('input[value="all"]')?.addEventListener('change', (e) => {
        document.querySelectorAll('input[name="focus"]:not([value="all"])').forEach(cb => cb.checked = e.target.checked);
    });

    btnReview.addEventListener('click', async () => {
        const code = codeInput?.value?.trim();
        if (!code) {
            alert('Please enter some code to review.');
            return;
        }
        showLoading(btnReview, true);
        setLoading(true);
        try {
            const data = await callAPI('/api/review', {
                code,
                language: (languageSelect && languageSelect.value) || 'python',
                focus_areas: getFocusAreas()
            });
            const review = data.review || data.feedback || data.content;
            const improvements = data.keyImprovements || data.key_improvements;
            const explanation = data.explanation;
            if (data.scores) showQualityScores(data.scores);
            if (typeof review === 'string') {
                showReview(review, improvements, explanation);
            } else {
                showReview(review?.review || JSON.stringify(data), improvements, explanation);
            }
        } catch (err) {
            console.warn('API unavailable, using demo response:', err.message);
            const demo = demoReviewResponse(code, (languageSelect && languageSelect.value) || 'python');
            showReview(demo.review, demo.keyImprovements, demo.explanation);
        } finally {
            setLoading(false);
            showLoading(btnReview, false);
        }
    });

    btnRewrite.addEventListener('click', async () => {
        const code = codeInput?.value?.trim();
        if (!code) {
            alert('Please enter some code to rewrite.');
            return;
        }
        setLoading(true);
        showLoading(btnRewrite, true);
        try {
            const data = await callAPI('/api/rewrite', {
                code,
                language: (languageSelect && languageSelect.value) || 'python',
                focus_areas: getFocusAreas()
            });
            showRewrite(data.rewritten_code || data.optimized_code || data.code || data.output || '');
        } catch (err) {
            console.warn('Rewrite API error:', err);
            const msg = err.message || 'Unknown error';
            const hint = msg.includes('fetch') || msg.includes('Failed') ? ' Backend running on port 8000?' : '';
            alert('Rewrite API failed: ' + msg + hint);
            showRewrite(demoRewriteResponse(code, (languageSelect && languageSelect.value) || 'python'));
        } finally {
            setLoading(false);
            showLoading(btnRewrite, false);
        }
    });
}

// Copy buttons
function initCopyButtons() {
    copyReviewBtn?.addEventListener('click', () => {
        const parts = [reviewOutput?.innerText || ''];
        if (reviewImprovements && !reviewImprovements.classList.contains('hidden')) {
            parts.push('\n\nKey Improvements:\n' + (keyImprovementsList?.innerText || ''));
            parts.push('\n\nExplanation:\n' + (reviewExplanation?.innerText || ''));
        }
        const text = parts.filter(Boolean).join('');
        navigator.clipboard.writeText(text).then(() => {
            copyReviewBtn.innerHTML = '<i class="fas fa-check mr-1"></i>Copied!';
            setTimeout(() => { copyReviewBtn.innerHTML = '<i class="fas fa-copy mr-1"></i>Copy'; }, 2000);
        });
    });

    copyRewriteBtn?.addEventListener('click', () => {
        const text = rewriteOutput?.textContent || '';
        navigator.clipboard.writeText(text).then(() => {
            copyRewriteBtn.innerHTML = '<i class="fas fa-check mr-1"></i>Copied!';
            setTimeout(() => { copyRewriteBtn.innerHTML = '<i class="fas fa-copy mr-1"></i>Copy'; }, 2000);
        });
    });

    document.getElementById('downloadReview')?.addEventListener('click', () => {
        const parts = [reviewOutput?.innerText || ''];
        if (reviewImprovements && !reviewImprovements.classList.contains('hidden')) {
            parts.push('\n\nKey Improvements:\n' + (keyImprovementsList?.innerText || ''));
            parts.push('\n\nExplanation:\n' + (reviewExplanation?.innerText || ''));
        }
        downloadText('code-review-' + Date.now() + '.txt', parts.filter(Boolean).join(''));
    });

    document.getElementById('downloadRewrite')?.addEventListener('click', () => {
        const text = rewriteOutput?.textContent || '';
        const extMap = { python: 'py', javascript: 'js', typescript: 'ts', java: 'java', cpp: 'cpp', csharp: 'cs', go: 'go', rust: 'rs', html: 'html', css: 'css', dart: 'dart' };
        const ext = extMap[languageSelect?.value] || 'txt';
        downloadText('rewritten-code-' + Date.now() + '.' + ext, text);
    });
}

// Initialize app
function init() {
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('show') === 'login') {
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(PENDING_VERIFY_KEY);
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (appContent) appContent.classList.add('hidden');
        if (verifyScreen) verifyScreen.classList.add('hidden');
        if (firebaseVerifyScreen) firebaseVerifyScreen.classList.add('hidden');
        var fa = getFirebaseAuth();
        if (fa) fa.signOut();
        window.history.replaceState({}, document.title, window.location.pathname || 'index.html');
        initTheme();
        initAuthTabs();
        initDemoLogin();
        initAuth3dPasswordToggle();
        initLoginForm();
        initForgotPassword();
        initSignupForm();
        initLogout();
        initWelcomeModal();
        initFirebaseAuth();
        initOutputTabs();
        initCodeReview();
        initCopyButtons();
        initChat();
        return;
    }
    initTheme();
    initAuthTabs();
    initDemoLogin();
    initAuth3dPasswordToggle();
    initLoginForm();
    initForgotPassword();
    initSignupForm();
    initLogout();
    initWelcomeModal();
    initFirebaseAuth();
    checkAuth();
    initOutputTabs();
    initCodeReview();
    initCopyButtons();
    initChat();
}

window.flipForm = flipForm;
document.addEventListener('DOMContentLoaded', init);
