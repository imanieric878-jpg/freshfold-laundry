/**
 * booking.js
 * Manages the multi-step booking flow, stores in Supabase, 
 * and calls the Node.js Backend for Daraja STK Push.
 */

window.BookingModule = {
    state: {
        step: 1,
        serviceId: '',
        weightOrQty: 3,
        pickupAddress: '',
        dateSlot: '',
        phone: '', 
        totalAmount: 0,
        isInitializing: false
    },

    init: async function() {
        if (this.state.isInitializing) return;
        this.state.isInitializing = true;

        const { data: { user } } = await window.supabase.auth.getUser();
        if (!user) {
            window.location.hash = '#profile';
            AppUtils.showToast("Please login first to book.", "info");
            return;
        }

        if (!window.AppServices || window.AppServices.length === 0) {
            const { data } = await window.supabase.from('services').select('*');
            window.AppServices = data || [];
        }

        const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
        this.state.serviceId = hashParams.get('service') || window.AppServices[0]?.id || 'srv_1';

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.state.dateSlot = tomorrow.toISOString().split('T')[0];

        this.updateTotal();
        this.state.isInitializing = false;
        this.initialized = true;
        this.render(); 
    },

    updateTotal: function() {
        const srv = (window.AppServices || []).find(s => s.id === this.state.serviceId);
        if (srv) {
            this.state.totalAmount = srv.price * this.state.weightOrQty;
        }
    },

    nextStep: function() {
        if (this.state.step === 2 && !this.state.pickupAddress) {
            AppUtils.showToast("Please enter a pickup address", "error");
            return;
        }
        
        if (this.state.step < 4) {
            this.state.step++;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            this.render();
        }
    },

    prevStep: function() {
        if (this.state.step > 1) {
            this.state.step--;
            this.render();
        } else {
            window.location.hash = '#home';
        }
    },

    render: function() {
        if (this.state.step === 1 && !this.initialized) {
            this.init();
        }

        const container = document.getElementById('app-content');
        if (!container) return;

        if (this.state.isInitializing) {
            container.innerHTML = `<div class="flex items-center justify-center min-h-[50vh]"><i class="fa-solid fa-spinner fa-spin text-primary text-3xl"></i></div>`;
            return;
        }

        container.innerHTML = `
            <div class="fade-in pb-24">
                <div class="h-10 flex items-center justify-between mb-6 mt-2">
                    <button onclick="window.BookingModule.prevStep()" class="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm">
                        <i class="fa-solid fa-arrow-left text-gray-700"></i>
                    </button>
                    <h2 class="font-bold text-lg text-gray-900">Step ${this.state.step} of 4</h2>
                    <div class="w-10"></div>
                </div>

                <div class="flex justify-between items-center mb-10 relative px-2">
                    <div class="absolute top-1/2 left-0 right-0 h-1 bg-gray-100 -z-10 rounded"></div>
                    <div class="absolute top-1/2 left-0 h-1 bg-primary -z-10 rounded transition-all duration-500" style="width: ${(this.state.step - 1) * 33.33}%"></div>
                    
                    ${[1, 2, 3, 4].map(s => `
                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${s === this.state.step ? 'bg-primary text-white scale-125 shadow-lg shadow-primary/30' : s < this.state.step ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-400'}">
                            ${s < this.state.step ? '<i class="fa-solid fa-check"></i>' : s}
                        </div>
                    `).join('')}
                </div>

                <div id="step-content">
                    ${this.renderStepContent()}
                </div>
            </div>
        `;
        
        document.getElementById('fab-booking').style.display = 'none';
        if (this.state.step === 1) this.attachStep1Listeners();
        if (this.state.step === 2) this.attachStep2Listeners();
        if (this.state.step === 3) this.attachStep3Listeners();
    },

    renderStepContent: function() {
        switch(this.state.step) {
            case 1: return this.renderStep1();
            case 2: return this.renderStep2();
            case 3: return this.renderStep3();
            case 4: return this.renderStep4();
            case 5: return this.renderSuccess();
        }
    },

    renderStep1: function() {
        const services = window.AppServices || [];
        const srvObj = services.find(s => s.id === this.state.serviceId) || services[0];
        
        return `
            <div class="space-y-6">
                <h3 class="font-bold text-xl text-gray-800">What do you need?</h3>
                <div class="space-y-3">
                    ${services.map(s => `
                        <label class="flex items-center gap-4 p-5 rounded-2xl border-2 ${this.state.serviceId === s.id ? 'border-primary bg-primary/5' : 'border-gray-50 bg-white'} cursor-pointer transition-all">
                            <input type="radio" name="service" value="${s.id}" ${this.state.serviceId === s.id ? 'checked' : ''} class="hidden">
                            <div class="w-14 h-14 rounded-2xl ${s.color} flex items-center justify-center text-3xl shrink-0">
                                <i class="fa-solid ${s.icon}"></i>
                            </div>
                            <div class="flex-1">
                                <h4 class="font-bold text-base text-gray-900">${s.name}</h4>
                                <p class="text-xs text-gray-500 font-medium">${AppUtils.formatCurrency(s.price)} / ${s.unit}</p>
                            </div>
                            <div class="w-6 h-6 rounded-full border-2 ${this.state.serviceId === s.id ? 'border-primary bg-primary' : 'border-gray-200'} flex items-center justify-center">
                                ${this.state.serviceId === s.id ? '<i class="fa-solid fa-check text-[10px] text-white"></i>' : ''}
                            </div>
                        </label>
                    `).join('')}
                </div>

                <div id="weight-section" class="bg-white p-8 rounded-3xl border border-gray-50 shadow-sm">
                    <h4 class="font-bold text-xs text-gray-400 text-center uppercase tracking-widest mb-6">Estimated ${srvObj?.unit === 'kg' ? 'Weight' : 'Quantity'}</h4>
                    <div class="flex items-center justify-center gap-10">
                        <button id="qty-minus" class="w-14 h-14 rounded-2xl border border-gray-100 text-2xl font-bold bg-gray-50 hover:bg-gray-100 transition">-</button>
                        <div class="text-5xl font-black text-gray-900" id="qty-display">${this.state.weightOrQty}<span class="text-xl font-medium text-gray-300 ml-1">${srvObj?.unit || 'kg'}</span></div>
                        <button id="qty-plus" class="w-14 h-14 rounded-2xl border border-gray-100 text-2xl font-bold bg-gray-50 hover:bg-gray-100 transition">+</button>
                    </div>
                </div>

                <div class="pt-6" id="next-btn-container">
                    <div class="flex justify-between items-center mb-6 px-2">
                        <span class="text-gray-500 font-bold">Estimated Total</span>
                        <span class="text-2xl font-black text-primary">${AppUtils.formatCurrency(this.state.totalAmount)}</span>
                    </div>
                    <button onclick="window.BookingModule.nextStep()" class="w-full bg-primary text-white font-bold py-5 rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all">
                        Next: Pickup Details
                    </button>
                </div>
            </div>
        `;
    },

    attachStep1Listeners: function() {
        document.querySelectorAll('input[name="service"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.state.serviceId = e.target.value;
                this.updateTotal();
                this.render();
                // Auto scroll to weight section
                setTimeout(() => {
                    document.getElementById('weight-section')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            });
        });
        const minus = document.getElementById('qty-minus');
        const plus = document.getElementById('qty-plus');
        if (minus) minus.onclick = () => { if (this.state.weightOrQty > 1) { this.state.weightOrQty--; this.updateTotal(); this.render(); } };
        if (plus) plus.onclick = () => { this.state.weightOrQty++; this.updateTotal(); this.render(); };
    },

    renderStep2: function() {
        return `
            <div class="space-y-8">
                <h3 class="font-bold text-xl text-gray-800">Where & When?</h3>
                <div class="space-y-6">
                    <div>
                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Pickup Address</label>
                        <input type="text" id="pickup-input" value="${this.state.pickupAddress}" placeholder="Building, Street, House No." class="w-full bg-gray-50 border border-gray-100 rounded-2xl py-5 px-4 text-sm focus:bg-white focus:border-primary transition-all outline-none">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Preferred Date</label>
                        <input type="date" id="date-input" value="${this.state.dateSlot}" class="w-full bg-gray-50 border border-gray-100 rounded-2xl py-5 px-4 text-sm focus:bg-white focus:border-primary transition-all outline-none">
                    </div>
                </div>

                <div class="pt-10">
                    <button onclick="window.BookingModule.nextStep()" class="w-full bg-primary text-white font-bold py-5 rounded-2xl shadow-xl transition-all">
                        Next: Review & Pay
                    </button>
                </div>
            </div>
        `;
    },

    attachStep2Listeners: function() {
        const pInput = document.getElementById('pickup-input');
        const dInput = document.getElementById('date-input');
        if (pInput) pInput.oninput = (e) => this.state.pickupAddress = e.target.value;
        if (dInput) dInput.onchange = (e) => this.state.dateSlot = e.target.value;
    },

    renderStep3: function() {
        const srv = (window.AppServices || []).find(s => s.id === this.state.serviceId);
        return `
            <div class="space-y-8">
                <h3 class="font-bold text-xl text-gray-800">Final Review</h3>
                <div class="bg-white rounded-[32px] p-8 border border-gray-50 shadow-sm space-y-6">
                    <div class="flex justify-between items-center pb-6 border-b border-gray-50">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl ${srv?.color} flex items-center justify-center text-white text-xl"><i class="fa-solid ${srv?.icon}"></i></div>
                            <div>
                                <p class="font-bold text-gray-900">${srv?.name}</p>
                                <p class="text-xs text-gray-500 font-medium">${this.state.weightOrQty} ${srv?.unit}</p>
                            </div>
                        </div>
                        <p class="font-black text-lg text-primary">${AppUtils.formatCurrency(this.state.totalAmount)}</p>
                    </div>

                    <div>
                        <p class="text-xs font-bold text-gray-300 uppercase tracking-widest mb-2">Delivery To</p>
                        <p class="text-sm font-semibold text-gray-700 leading-relaxed">${this.state.pickupAddress}</p>
                    </div>

                    <div>
                        <p class="text-xs font-bold text-gray-300 uppercase tracking-widest mb-3">M-PESA Number</p>
                        <div class="flex">
                            <span class="inline-flex items-center px-4 rounded-l-2xl border border-r-0 border-gray-100 bg-gray-50 text-gray-400 font-bold">+254</span>
                            <input type="tel" id="mpesa-phone" value="${this.state.phone}" placeholder="712 345 678" class="w-full rounded-r-2xl border border-gray-100 bg-white py-5 px-5 font-black text-xl tracking-[0.2em] focus:border-primary outline-none">
                        </div>
                    </div>
                </div>

                <div class="pt-6">
                    <button onclick="window.BookingModule.processPayment()" id="pay-btn" class="w-full bg-green-500 text-white font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3">
                        <i class="fa-solid fa-shield-check"></i>
                        <span>Confirm & Pay ${AppUtils.formatCurrency(this.state.totalAmount)}</span>
                    </button>
                </div>
            </div>
        `;
    },

    attachStep3Listeners: function() {
        const phone = document.getElementById('mpesa-phone');
        if (phone) phone.oninput = (e) => this.state.phone = e.target.value;
    },

    processPayment: async function() {
        const phone = this.state.phone.trim();
        if (phone.length < 9) { AppUtils.showToast("Enter valid M-PESA phone", "error"); return; }

        const btn = document.getElementById('pay-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

        try {
            const { data: { user } } = await window.supabase.auth.getUser();
            if (!user) throw new Error("User session expired. Please log in again.");

            const { data, error } = await window.supabase.from('orders').insert([{
                user_id: user.id, service_id: this.state.serviceId, weight: this.state.weightOrQty,
                total_amount: this.state.totalAmount, status: 'Requested', payment_status: 'Pending',
                address: this.state.pickupAddress, phone: phone
            }]).select();

            if (error) {
                if (error.message.includes('row-level security')) {
                    throw new Error("Database Security Error: Please run the RLS SQL script in Supabase.");
                }
                throw error;
            }
            
            this.newOrderId = data[0].id;

            const response = await fetch('https://freshfold-api.vercel.app/api/mpesa/stkpush', {

                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phone, amount: this.state.totalAmount, orderId: this.newOrderId })
            });

            if (!response.ok) throw new Error("M-Pesa Backend Server is Offline.");
            const result = await response.json();

            if (result.success) {
                AppUtils.showToast("M-PESA prompt sent!");
                this.state.step = 5;
                this.render();
            } else {
                throw new Error("STK Push failed: " + (result.error || "Unknown error"));
            }
        } catch (error) {
            AppUtils.showToast(error.message, "error");
            btn.disabled = false;
            btn.innerHTML = `Confirm & Pay ${AppUtils.formatCurrency(this.state.totalAmount)}`;
        }
    },

    renderSuccess: function() {
        return `
            <div class="fade-in text-center py-20">
                <div class="w-24 h-24 bg-primary text-white rounded-full flex items-center justify-center text-4xl mb-8 mx-auto shadow-2xl shadow-primary/30"><i class="fa-solid fa-check"></i></div>
                <h2 class="font-black text-3xl mb-4 text-gray-900">Success!</h2>
                <p class="text-gray-500 mb-12 px-6">Your order has been placed. Please complete the M-PESA payment on your phone.</p>
                <div class="px-4 space-y-4">
                    <a href="#tracking?id=${this.newOrderId}" class="block bg-gray-900 text-white font-bold py-5 rounded-2xl shadow-xl transition active:scale-95">Track Order</a>
                    <a href="#home" class="block bg-gray-100 text-gray-700 font-bold py-5 rounded-2xl transition active:scale-95">Go to Homepage</a>
                </div>
            </div>
        `;
    }
};
