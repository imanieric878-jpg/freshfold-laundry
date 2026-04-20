/**
 * profile.js
 * Manages the User Account view, Supabase Email/Password Auth, and settings.
 */

window.ProfileModule = {
    state: {
        isLoggedIn: false,
        currentUser: null,
        isLoginView: true
    },

    init: async function() {
        if(this._initialized) return;
        this._initialized = true;
        
        // Initial session check
        const { data: { session } } = await window.supabase.auth.getSession();
        this.handleAuthState(session?.user ?? null);

        // Listen to Supabase Auth state
        window.supabase.auth.onAuthStateChange((_event, session) => {
            this.handleAuthState(session?.user ?? null);
        });
    },

    handleAuthState: function(user) {
        if (user) {
            this.state.isLoggedIn = true;
            this.state.currentUser = user;
            
            // Sync user profile in DB
            window.supabase.from('profiles').upsert({
                id: user.id,
                email: user.email,
                last_seen: new Date().toISOString()
            });

        } else {
            this.state.isLoggedIn = false;
            this.state.currentUser = null;
        }
        
        if (window.location.hash.includes('profile')) this.render();
    },

    render: function() {
        this.init();

        const container = document.getElementById('app-content');
        
        if (!this.state.isLoggedIn) {
            this.renderAuth(container);
            return;
        }

        const user = this.state.currentUser;

        container.innerHTML = `
            <div class="fade-in pb-20">
                <div class="flex items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6 mt-2 relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 w-24 h-24 bg-primary opacity-5 rounded-full blur-xl z-0"></div>
                    <div class="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold border-4 border-white shadow-sm z-10 shrink-0">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <div class="z-10 flex-1">
                        <h2 class="text-base font-bold text-gray-900 truncate">${user.email}</h2>
                        <p class="text-xs font-bold text-primary mt-1"><i class="fa-solid fa-star mr-1"></i> 0 Points</p>
                    </div>
                </div>

                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                    ${this.menuItem('fa-location-dot', 'Saved Addresses', 'Add an address')}
                    ${this.menuItem('fa-wallet', 'Payment Methods', 'M-PESA Standard')}
                </div>

                <div class="space-y-3">
                    <button onclick="window.ProfileModule.logout()" class="w-full bg-red-50 text-red-600 font-bold py-4 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition">
                        <i class="fa-solid fa-right-from-bracket"></i> Logout
                    </button>
                </div>
            </div>
        `;
        document.getElementById('fab-booking').style.display = 'none';
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('hidden')); 
    },

    menuItem: function(icon, title, subtitle = '') {
        return `
            <div class="flex items-center gap-4 p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition active:bg-gray-100">
                <div class="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="flex-1">
                    <h4 class="font-bold text-sm text-gray-800">${title}</h4>
                    ${subtitle ? `<p class="text-xs text-gray-500">${subtitle}</p>` : ''}
                </div>
                <i class="fa-solid fa-chevron-right text-gray-300 text-sm"></i>
            </div>
        `;
    },

    renderAuth: function(container) {
        document.getElementById('fab-booking').style.display = 'none';
        document.querySelectorAll('.nav-link').forEach(link => link.classList.add('hidden')); 
        
        container.innerHTML = `
            <div class="fade-in pt-10 px-4 min-h-screen bg-white">
                <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-3xl mb-6 mx-auto">
                    <i class="fa-solid fa-shirt"></i>
                </div>
                <h2 class="text-2xl font-black text-center mb-2">Welcome to FreshFold</h2>
                <p class="text-center text-gray-500 text-sm mb-10">${this.state.isLoginView ? 'Login to your account.' : 'Create a new account.'}</p>

                <div class="space-y-4 mb-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                        <input type="email" id="auth-email" placeholder="you@example.com" class="block w-full rounded-xl bg-gray-50 border border-gray-200 py-3 px-4 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <input type="password" id="auth-password" placeholder="••••••••" class="block w-full rounded-xl bg-gray-50 border border-gray-200 py-3 px-4 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition">
                    </div>
                </div>

                <button onclick="window.ProfileModule.submitAuth()" id="auth-btn" class="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg hover:bg-opacity-90 active:scale-[0.98] transition">
                    ${this.state.isLoginView ? 'Login' : 'Register'}
                </button>
                
                <p class="text-center mt-6 text-sm text-gray-500">
                    ${this.state.isLoginView ? 'Need an account?' : 'Already have an account?'} 
                    <button onclick="window.ProfileModule.toggleAuthView()" class="text-primary font-bold hover:underline">
                        ${this.state.isLoginView ? 'Register' : 'Login'}
                    </button>
                </p>
            </div>
        `;
    },

    toggleAuthView: function() {
        this.state.isLoginView = !this.state.isLoginView;
        this.render();
    },

    submitAuth: async function() {
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        
        if (!email || password.length < 6) {
            AppUtils.showToast("Enter a valid email and a 6+ char password.", "error");
            return;
        }

        const btn = document.getElementById('auth-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';

        try {
            let result;
            if (this.state.isLoginView) {
                result = await window.supabase.auth.signInWithPassword({ email, password });
            } else {
                result = await window.supabase.auth.signUp({ email, password });
            }

            if (result.error) throw result.error;

            AppUtils.showToast(this.state.isLoginView ? "Login Successful!" : "Check your email for confirmation!");
            
        } catch (error) {
            AppUtils.showToast(error.message, "error");
            btn.disabled = false;
            btn.innerHTML = this.state.isLoginView ? 'Login' : 'Register';
        }
    },

    logout: async function() {
        await window.supabase.auth.signOut();
    }
};

window.ProfileModule.init();
