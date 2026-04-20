/**
 * utils.js
 * Contains shared helpers for formatting, local storage management, and global UI functions (toasts)
 */

window.AppUtils = {
    // ---- Storage Helpers (Where Supabase would normally query) ----
    
    // Get item from local storage with auto JSON parsing
    getStorage: (key, defaultValue = null) => {
        const item = localStorage.getItem(key);
        if (!item) return defaultValue;
        try {
            return JSON.parse(item);
        } catch (e) {
            return item;
        }
    },

    // Set item to local storage with auto JSON stringification
    setStorage: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    },

    // ---- Formats ----

    formatCurrency: (amount) => {
        return `KSh ${amount.toLocaleString('en-KE')}`;
    },

    formatDate: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    },
    
    generateId: () => {
        return 'FF-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    },

    // ---- UI Component Helpers ----

    showToast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-primary' : type === 'error' ? 'bg-red-500' : 'bg-gray-800';
        const icon = type === 'success' ? 'fa-check' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info';
        
        toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 transform -translate-y-full opacity-0 transition-all duration-300`;
        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span class="font-medium text-sm">${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Trigger reflow for transition
        toast.offsetHeight;
        toast.classList.remove('-translate-y-full', 'opacity-0');
        
        setTimeout(() => {
            toast.classList.add('-translate-y-full', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Generates a mock delay for simulated network requests
    simulateNetworkRequest: (ms = 1000) => new Promise(resolve => setTimeout(resolve, ms))
};
