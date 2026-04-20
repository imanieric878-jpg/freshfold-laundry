/**
 * app.js
 * Main entry point. Handles routing, navigation state, and Supabase data syncing.
 */

const AppContent = document.getElementById('app-content');
const FabButton = document.getElementById('fab-booking');

// Global cache for services
window.AppServices = [];

// ---- Initialization ----

async function initApp() {
    AppContent.innerHTML = `<div class="flex items-center justify-center min-h-[50vh]"><i class="fa-solid fa-spinner fa-spin text-primary text-3xl"></i></div>`;
    
    try {
        // 1. Check for current session
        const { data: { session } } = await window.supabase.auth.getSession();
        
        // 2. Fetch services from Supabase
        const { data: services, error } = await window.supabase
            .from('services')
            .select('*');
        
        if (error) throw error;
        
        if (!services || services.length === 0) {
            console.warn("DB is empty, using fallback services.");
            window.AppServices = AppUtils.getStorage('ff_services', []);
        } else {
            window.AppServices = services;
        }

        handleRoute();
    } catch (error) {
        console.error("Initialization Failed:", error);
        AppContent.innerHTML = `
            <div class="p-10 text-center">
                <i class="fa-solid fa-triangle-exclamation text-red-500 text-4xl mb-4"></i>
                <h3 class="font-bold text-lg">Connection Failed</h3>
                <p class="text-sm text-gray-500 mb-6">We couldn't connect to the database. Please check your internet or Supabase keys.</p>
                <button onclick="location.reload()" class="bg-primary text-white px-6 py-2 rounded-full font-bold">Retry</button>
            </div>
        `;
    }
}

// ---- Routing System ----

async function handleRoute() {
    const hash = window.location.hash || '#home';
    const view = hash.substring(1).split('?')[0];
    
    const { data: { session } } = await window.supabase.auth.getSession();
    const isLoggedIn = !!session;

    // Protected Routes Check
    const protectedRoutes = ['booking', 'orders', 'tracking'];
    if (protectedRoutes.includes(view) && !isLoggedIn) {
        window.location.hash = '#profile';
        AppUtils.showToast("Please login to continue", "info");
        return;
    }
    
    // Update active state on bottom nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('text-primary');
        link.classList.add('text-gray-400');
        if(link.getAttribute('href') === `#${view}`) {
            link.classList.remove('text-gray-400');
            link.classList.add('text-primary');
        }
    });

    // Toggle FAB visibility
    if (view === 'home' || view === 'orders') {
        FabButton.style.display = 'flex';
    } else {
        FabButton.style.display = 'none';
    }

    AppContent.innerHTML = ''; 
    AppContent.className = 'w-full min-h-screen relative p-4 max-w-lg mx-auto md:max-w-xl fade-in';
    
    switch(view) {
        case 'home':
            renderHome();
            break;
        case 'services':
            renderServices();
            break;
        case 'booking':
            if (window.BookingModule) window.BookingModule.render();
            break;
        case 'orders':
            if (window.OrdersModule) window.OrdersModule.render();
            break;
        case 'tracking': 
            if (window.OrdersModule) window.OrdersModule.renderTracking();
            break;
        case 'profile':
            if (window.ProfileModule) window.ProfileModule.render();
            break;
        default:
            renderHome();
    }
}

window.addEventListener('hashchange', handleRoute);
window.addEventListener('load', () => {
    initApp();
    setupNotificationToggle();
});

// ---- Utility: Notifications & Header ----

function setupNotificationToggle() {
    const bell = document.getElementById('notification-bell');
    const dropdown = document.getElementById('notif-dropdown');
    
    if (bell && dropdown) {
        bell.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
            document.getElementById('notif-badge').classList.add('hidden');
        };
        
        document.addEventListener('click', () => dropdown.classList.add('hidden'));
        dropdown.onclick = (e) => e.stopPropagation();
    }
}

window.AppUtils.addNotification = function(title, msg) {
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    
    if (!list) return;

    // Remove empty state if present
    if (list.innerText.includes('No new notifications')) list.innerHTML = '';

    const div = document.createElement('div');
    div.className = 'p-4 border-b border-gray-50 hover:bg-gray-50 transition fade-in';
    div.innerHTML = `
        <h4 class="font-bold text-xs text-gray-900">${title}</h4>
        <p class="text-[10px] text-gray-500 mt-1">${msg}</p>
    `;
    list.prepend(div);
    badge.classList.remove('hidden');
};

window.AppUtils.clearNotifications = function() {
    const list = document.getElementById('notif-list');
    if (list) list.innerHTML = '<div class="p-8 text-center text-gray-400 text-xs">No new notifications</div>';
};

window.AppUtils.updateLocationHeader = function(address) {
    const el = document.getElementById('header-location');
    if (el && address) el.innerText = address.split(',')[0];
};

// ---- Views: Home & Services ----

function renderHome() {
    const services = window.AppServices;
    
    const serviceCardsHTML = services.slice(0, 3).map(s => `
        <div onclick="window.location.hash='#booking?service=${s.id}'" class="min-w-[140px] bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center text-center cursor-pointer hover:shadow-md transition active:scale-95 flex-shrink-0">
            <div class="w-12 h-12 rounded-full ${s.color} flex items-center justify-center text-xl mb-3">
                <i class="fa-solid ${s.icon}"></i>
            </div>
            <h3 class="font-bold text-sm text-gray-900">${s.name}</h3>
            <p class="text-xs text-gray-500 mt-1">From ${AppUtils.formatCurrency(s.price)}/${s.unit}</p>
        </div>
    `).join('');

    AppContent.innerHTML = `
        <div class="bg-primary rounded-3xl p-6 text-white text-center mt-2 shadow-lg relative overflow-hidden">
            <h2 class="text-2xl font-bold mb-2 relative z-10">Fresh Fold Laundry</h2>
            <p class="text-sm opacity-90 mb-6 relative z-10">We Pick It Up • We Clean It • We Bring It Back Fresh</p>
            <button onclick="window.location.hash='#booking'" class="bg-white text-primary font-bold py-3 px-8 rounded-full shadow transition-transform w-full relative z-10">
                Book Pickup Now
            </button>
        </div>

        <div class="mt-8">
            <div class="flex justify-between items-end mb-4">
                <h3 class="font-bold text-lg">Quick Services</h3>
                <a href="#services" class="text-sm text-primary font-medium">See All</a>
            </div>
            <div class="flex gap-4 overflow-x-auto pb-4 hide-scroll -mx-4 px-4 snap-x">
                ${serviceCardsHTML || '<p class="text-gray-400 text-sm p-4">Loading services...</p>'}
            </div>
        </div>

        <div class="mt-4 bg-white rounded-3xl p-6 shadow-sm border border-gray-50 mb-10">
            <h3 class="font-bold text-lg mb-6">How It Works</h3>
            <div class="space-y-6">
                <div class="flex gap-4">
                    <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">1</div>
                    <p class="text-sm text-gray-700">Schedule your pickup time.</p>
                </div>
                <div class="flex gap-4">
                    <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">2</div>
                    <p class="text-sm text-gray-700">We collect your laundry from your doorstep.</p>
                </div>
                <div class="flex gap-4">
                    <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">3</div>
                    <p class="text-sm text-gray-700">Returned fresh and clean within 48 hours.</p>
                </div>
            </div>
        </div>
    `;
}

function renderServices() {
    const services = window.AppServices;
    
    const serviceListHTML = services.map(s => `
        <div onclick="window.location.hash='#booking?service=${s.id}'" class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex gap-4 cursor-pointer hover:shadow-md transition active:scale-95 items-center mb-4">
            <div class="w-16 h-16 rounded-xl ${s.color} flex items-center justify-center text-3xl flex-shrink-0">
                <i class="fa-solid ${s.icon}"></i>
            </div>
            <div class="flex-1">
                <h3 class="font-bold text-base text-gray-900">${s.name}</h3>
                <div class="mt-2 text-primary font-bold text-sm">${AppUtils.formatCurrency(s.price)} <span class="text-xs font-normal text-gray-500">/ ${s.unit}</span></div>
            </div>
            <div class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                <i class="fa-solid fa-chevron-right text-sm"></i>
            </div>
        </div>
    `).join('');

    AppContent.innerHTML = `
        <div class="mb-6 mt-2">
            <h2 class="text-2xl font-bold">Our Services</h2>
            <p class="text-sm text-gray-500 mt-1">Select a service to start booking.</p>
        </div>
        
        <div class="pb-6">
            ${serviceListHTML || '<p class="text-center py-10 text-gray-400">No services found in database.</p>'}
        </div>
    `;
}
