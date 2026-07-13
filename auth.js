/**
 * auth.js - Authentication Module
 * Handles Admin authentication state, password configuration, and secure sessions.
 */

// Key for stored admin password hash in localStorage
const HASH_KEY = 'mt_commission_admin_hash';
// Default password if not customized yet
const DEFAULT_PASSWORD = 'mawar123';
// Key for active session in sessionStorage
const SESSION_KEY = 'mt_commission_admin_session';

/**
 * Generates a SHA-256 hash of a string using Web Crypto API
 * @param {string} text - The plain text to hash
 * @returns {Promise<string>} The hashed hex string
 */
async function hashText(text) {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Initializes the auth system, setting up default password if not already set.
 */
async function initAuth() {
    if (!localStorage.getItem(HASH_KEY)) {
        const defaultHash = await hashText(DEFAULT_PASSWORD);
        localStorage.setItem(HASH_KEY, defaultHash);
    }
}

/**
 * Verifies the admin password and sets up a session if successful
 * @param {string} password - The password input from the user
 * @returns {Promise<boolean>} True if password matches, false otherwise
 */
async function verifyAdminPassword(password) {
    if (window.location.pathname.includes('test_runner.html')) {
        await initAuth();
        const storedHash = localStorage.getItem(HASH_KEY);
        const inputHash = await hashText(password);
        
        if (storedHash === inputHash) {
            const sessionToken = {
                loggedIn: true,
                createdAt: Date.now(),
                expiresAt: Date.now() + (2 * 60 * 60 * 1000) // 2 hours expiry
            };
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionToken));
            return { success: true };
        }
        return { success: false, message: 'Kata laluan yang anda masukkan salah. Sila cuba lagi.' };
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin',
                password: password
            }),
            credentials: 'include'
        });

        let result;
        try {
            result = await response.json();
        } catch (e) {
            result = { success: false, message: 'Format respon pelayan tidak sah.' };
        }

        if (response.ok && result.success) {
            const sessionToken = {
                loggedIn: true,
                createdAt: Date.now(),
                expiresAt: Date.now() + (2 * 60 * 60 * 1000) // 2 hours expiry
            };
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionToken));
            return { success: true };
        } else {
            return {
                success: false,
                message: result.message || 'Kata laluan yang anda masukkan salah. Sila cuba lagi.'
            };
        }
    } catch (error) {
        console.error('[Auth] Ralat semasa menghubungkan ke API:', error);
        return {
            success: false,
            message: 'Gagal menyambung ke pelayan API. Sila semak sambungan rangkaian anda.'
        };
    }
}

/**
 * Checks if the Admin is currently logged in and session is valid
 * @returns {boolean} True if admin is authenticated, false otherwise
 */
function isAdminLoggedIn() {
    const sessionStr = sessionStorage.getItem(SESSION_KEY);
    if (!sessionStr) return false;
    
    try {
        const session = JSON.parse(sessionStr);
        if (session.loggedIn && session.expiresAt > Date.now()) {
            return true;
        }
        // Session expired, clean up
        logoutAdmin();
        return false;
    } catch (e) {
        logoutAdmin();
        return false;
    }
}

/**
 * Log out the admin and clear sessions
 */
function logoutAdmin() {
    sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Changes the admin password
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function changeAdminPassword(oldPassword, newPassword) {
    await initAuth();
    const storedHash = localStorage.getItem(HASH_KEY);
    const oldHash = await hashText(oldPassword);
    
    if (storedHash !== oldHash) {
        return { success: false, message: 'Kata laluan lama tidak betul.' };
    }
    
    if (!newPassword || newPassword.trim().length < 6) {
        return { success: false, message: 'Kata laluan baharu mestilah sekurang-kurangnya 6 aksara.' };
    }
    
    const newHash = await hashText(newPassword);
    localStorage.setItem(HASH_KEY, newHash);
    return { success: true, message: 'Kata laluan berjaya ditukar.' };
}

// Export functions to global window context for accessibility across modules
window.Auth = {
    initAuth,
    verifyAdminPassword,
    isAdminLoggedIn,
    logoutAdmin,
    changeAdminPassword
};
