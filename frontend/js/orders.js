/**
 * orders.js
 * Manages rendering the Orders list and real-time tracking via Supabase.
 */

window.OrdersModule = {
    state: {
        activeTab: 'active',
        orders: []
    },

    channel: null,

    initListener: async function() {
        const { data: { user } } = await window.supabase.auth.getUser();
        if (!user) return;

        // Fetch initial orders
        const { data, error } = await window.supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (data) this.state.orders = data;
        
        // Re-render if we are on the orders page
        if (window.location.hash === '#orders') this.render();

        // Setup real-time subscription
        if (this.channel) this.channel.unsubscribe();

        this.channel = window.supabase
            .channel('orders-realtime')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'orders',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    this.state.orders.unshift(payload.new);
                } else if (payload.eventType === 'UPDATE') {
                    const index = this.state.orders.findIndex(o => o.id === payload.new.id);
                    if (index !== -1) this.state.orders[index] = payload.new;
                    
                    // Show toast for status updates
                    if (payload.old.status !== payload.new.status) {
                        AppUtils.showToast(`Order Status: ${payload.new.status}`);
                    }
                }
                
                if (window.location.hash === '#orders') this.render();
                if (window.location.hash.startsWith('#tracking')) this.renderTracking();
            })
            .subscribe();
    },

    render: async function() {
        const { data: { user } } = await window.supabase.auth.getUser();
        if (!user) {
            window.location.hash = '#profile';
            return;
        }

        if (!this.channel) this.initListener();

        const container = document.getElementById('app-content');
        const activeOrders = this.state.orders.filter(o => o.status !== 'Delivered');
        const completedOrders = this.state.orders.filter(o => o.status === 'Delivered');
        const displayOrders = this.state.activeTab === 'active' ? activeOrders : completedOrders;

        let ordersHtml = '';
        if (displayOrders.length === 0) {
            ordersHtml = `
                <div class="text-center py-20 px-4 fade-in">
                    <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-200 text-3xl">
                        <i class="fa-solid fa-box-open"></i>
                    </div>
                    <h3 class="font-bold text-lg text-gray-800 mb-2">No ${this.state.activeTab} orders</h3>
                    <p class="text-gray-400 text-sm mb-8">Your laundry history will appear here.</p>
                    <a href="#home" class="bg-primary text-white font-bold py-3 px-10 rounded-full shadow-lg inline-block">Order Now</a>
                </div>
            `;
        } else {
            ordersHtml = displayOrders.map(order => {
                const srv = (window.AppServices || []).find(s => s.id === order.service_id);
                const statusColors = {
                    'Requested': 'bg-blue-50 text-blue-600',
                    'Picked Up': 'bg-purple-50 text-purple-600',
                    'In Processing': 'bg-yellow-50 text-yellow-600',
                    'Out for Delivery': 'bg-orange-50 text-orange-600',
                    'Delivered': 'bg-green-50 text-green-600'
                };

                return `
                    <div onclick="window.location.hash='#tracking?id=${order.id}'" class="bg-white rounded-3xl p-5 shadow-sm border border-gray-50 mb-4 cursor-pointer hover:border-primary/20 transition-all active:scale-[0.98]">
                        <div class="flex justify-between items-start mb-4">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 rounded-2xl ${srv?.color || 'bg-gray-100'} flex items-center justify-center text-xl shrink-0">
                                    <i class="fa-solid ${srv?.icon || 'fa-shirt'}"></i>
                                </div>
                                <div>
                                    <h4 class="font-bold text-gray-900">${srv?.name || 'Laundry'}</h4>
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">${AppUtils.formatDate(order.created_at)}</p>
                                </div>
                            </div>
                            <span class="text-[10px] font-black uppercase px-3 py-1.5 rounded-full ${statusColors[order.status] || 'bg-gray-100 text-gray-500'}">${order.status}</span>
                        </div>
                        <div class="flex justify-between items-center pt-3 border-t border-gray-50">
                            <div class="text-xs font-bold text-gray-500">${order.weight} kg</div>
                            <div class="font-black text-primary">${AppUtils.formatCurrency(order.total_amount)}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = `
            <div class="fade-in pb-20">
                <div class="mb-6">
                    <h2 class="text-2xl font-bold text-gray-900">Your Activity</h2>
                </div>

                <div class="bg-gray-50 p-1 rounded-2xl flex mb-8">
                    <button onclick="window.OrdersModule.switchTab('active')" class="flex-1 py-3 text-xs font-bold rounded-xl transition-all ${this.state.activeTab === 'active' ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}">Active Orders</button>
                    <button onclick="window.OrdersModule.switchTab('completed')" class="flex-1 py-3 text-xs font-bold rounded-xl transition-all ${this.state.activeTab === 'completed' ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}">History</button>
                </div>

                <div class="space-y-2">${ordersHtml}</div>
            </div>
        `;
    },

    switchTab: function(tab) {
        this.state.activeTab = tab;
        this.render();
    },

    renderTracking: function() {
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
        const orderId = hashParams.get('id');
        const order = this.state.orders.find(o => o.id === orderId);

        if (!order) {
            document.getElementById('app-content').innerHTML = `<div class="p-20 text-center"><i class="fa-solid fa-spinner fa-spin text-primary text-3xl"></i></div>`;
            return;
        }

        const stages = ['Requested', 'Rider Assigned', 'Picked Up', 'In Processing', 'Out for Delivery', 'Delivered'];
        const currentStageIndex = stages.indexOf(order.status);

        let timelineHtml = stages.map((stage, index) => {
            const isCompleted = index <= currentStageIndex;
            const isCurrent = index === currentStageIndex;
            const isLast = index === stages.length - 1;

            return `
                <div class="relative flex gap-5 ${isLast ? '' : 'pb-10'}">
                    ${!isLast ? `<div class="absolute left-4 top-8 bottom-0 w-0.5 ${isCompleted ? 'bg-primary' : 'bg-gray-100'}"></div>` : ''}
                    <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${isCompleted ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-100 text-gray-300'}">
                        ${isCompleted ? '<i class="fa-solid fa-check text-[10px]"></i>' : `<span class="text-[10px] font-bold">${index + 1}</span>`}
                    </div>
                    <div class="-mt-1 flex-1">
                        <h4 class="font-bold text-sm ${isCurrent ? 'text-primary' : isCompleted ? 'text-gray-900' : 'text-gray-300'}">${stage}</h4>
                        ${isCurrent ? `<p class="text-[10px] font-medium text-gray-400 mt-1 uppercase tracking-wider">In Progress</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('app-content').innerHTML = `
            <div class="fade-in pb-10">
                <div class="flex flex-col items-center justify-center bg-white rounded-b-[40px] -mx-4 -mt-4 p-8 shadow-sm mb-8 relative">
                    <button onclick="window.location.hash='#orders'" class="absolute left-6 top-8 w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-gray-900 transition">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div class="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4">Tracking ID: ${order.id.slice(0,8)}</div>
                    <h2 class="text-3xl font-black text-gray-900 mb-2">${AppUtils.formatCurrency(order.total_amount)}</h2>
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full ${order.payment_status === 'Paid' ? 'bg-green-500' : 'bg-orange-500'} animate-pulse"></div>
                        <p class="text-xs font-bold ${order.payment_status === 'Paid' ? 'text-green-600' : 'text-orange-600'}">${order.payment_status === 'Paid' ? 'Payment Confirmed' : 'Waiting for M-PESA Payment'}</p>
                    </div>
                </div>

                <div class="bg-white rounded-[32px] p-8 shadow-sm border border-gray-50 mb-6">
                    <div class="mb-8 flex justify-between items-end">
                        <h3 class="font-bold text-lg text-gray-900">Order Progress</h3>
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${Math.round(((currentStageIndex + 1) / stages.length) * 100)}% Complete</span>
                    </div>
                    <div class="px-2">${timelineHtml}</div>
                </div>

                <div class="bg-primary/5 rounded-[32px] p-6 border border-primary/10">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center"><i class="fa-solid fa-headset"></i></div>
                        <div>
                            <h4 class="text-sm font-bold text-gray-900">Need help with this order?</h4>
                            <p class="text-xs text-gray-500">Contact our support 24/7</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('fab-booking').style.display = 'none';
        document.querySelectorAll('.nav-link').forEach(link => link.classList.add('hidden')); 
    }
};

window.addEventListener('load', () => {
    setTimeout(() => { window.OrdersModule.initListener(); }, 1500);
});
