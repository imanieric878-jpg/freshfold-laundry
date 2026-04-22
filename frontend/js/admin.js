/**
 * admin.js
 * Order Management Dashboard for FreshFold Staff.
 * Only accessible by authorized emails.
 */

window.AdminModule = {
    state: {
        orders: [],
        filter: 'active' // 'active', 'completed', 'all'
    },

    channel: null,

    render: async function() {
        const { data: { user } } = await window.supabase.auth.getUser();
        
        if (!user || user.email !== 'imanieric878@gmail.com') {
            document.getElementById('app-content').innerHTML = `
                <div class="p-20 text-center">
                    <i class="fa-solid fa-lock text-red-500 text-4xl mb-4"></i>
                    <h3 class="font-bold">Access Denied</h3>
                    <p class="text-sm text-gray-500">You do not have admin privileges.</p>
                </div>
            `;
            return;
        }

        const container = document.getElementById('app-content');
        container.innerHTML = `<div class="p-20 text-center"><i class="fa-solid fa-spinner fa-spin text-primary text-3xl"></i></div>`;

        const { data, error } = await window.supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            AppUtils.showToast("Failed to fetch orders", "error");
            return;
        }

        this.state.orders = data;
        this.renderLayout(container);

        if (this.channel) this.channel.unsubscribe();
        this.channel = window.supabase
            .channel('admin-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    this.state.orders.unshift(payload.new);
                    AppUtils.showToast("New Order Received!", "info");
                } else if (payload.eventType === 'UPDATE') {
                    const index = this.state.orders.findIndex(o => o.id === payload.new.id);
                    if (index !== -1) this.state.orders[index] = payload.new;
                }
                this.renderLayout(document.getElementById('app-content'));
            })
            .subscribe();
    },

    renderLayout: function(container) {
        // Calculate Stats
        const today = new Date().toISOString().split('T')[0];
        const todayOrders = this.state.orders.filter(o => o.created_at.startsWith(today));
        const totalRev = todayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const totalWeight = todayOrders.reduce((sum, o) => sum + (o.weight || 0), 0);

        // Filter Orders
        const filtered = this.state.orders.filter(o => {
            if (this.state.filter === 'active') return o.status !== 'Delivered';
            if (this.state.filter === 'completed') return o.status === 'Delivered';
            return true;
        });

        const ordersHtml = filtered.map(order => {
            const stages = ['Requested', 'Rider Assigned', 'Picked Up', 'In Processing', 'Out for Delivery', 'Delivered'];
            
            return `
                <div class="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 mb-4 fade-in">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <h4 class="font-bold text-gray-900 text-sm">Order #${order.id.slice(0,6)}</h4>
                                ${order.payment_status === 'Paid' ? '<i class="fa-solid fa-circle-check text-green-500 text-[10px]"></i>' : ''}
                            </div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">${AppUtils.formatDate(order.created_at)}</p>
                        </div>
                        <a href="https://wa.me/${order.phone.replace(/\D/g,'')}" target="_blank" class="w-8 h-8 bg-green-50 text-green-500 rounded-full flex items-center justify-center text-xs">
                            <i class="fa-brands fa-whatsapp"></i>
                        </a>
                    </div>

                    <div class="grid grid-cols-2 gap-3 mb-4">
                        <div class="bg-gray-50 p-3 rounded-2xl">
                            <p class="text-[9px] text-gray-400 font-bold uppercase">Customer</p>
                            <p class="text-[11px] font-bold text-gray-700 truncate">${order.phone}</p>
                        </div>
                        <div class="bg-gray-50 p-3 rounded-2xl">
                            <p class="text-[9px] text-gray-400 font-bold uppercase">Load</p>
                            <p class="text-[11px] font-bold text-gray-700">${order.weight} KG</p>
                        </div>
                    </div>

                    <div class="flex gap-2">
                        <select onchange="window.AdminModule.updateStatus('${order.id}', this.value)" class="flex-1 bg-gray-900 text-white rounded-2xl py-3 px-4 text-[10px] font-black uppercase appearance-none cursor-pointer">
                            ${stages.map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                        <button onclick="window.AdminModule.togglePayment('${order.id}', '${order.payment_status}')" class="w-12 h-12 rounded-2xl flex items-center justify-center ${order.payment_status === 'Paid' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}">
                            <i class="fa-solid fa-money-bill-wave"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="fade-in pb-20">
                <!-- Stats Header -->
                <div class="grid grid-cols-3 gap-3 mb-8">
                    <div class="bg-primary rounded-3xl p-4 text-white">
                        <p class="text-[8px] font-black uppercase opacity-60">Orders</p>
                        <p class="text-xl font-black">${todayOrders.length}</p>
                    </div>
                    <div class="bg-gray-900 rounded-3xl p-4 text-white">
                        <p class="text-[8px] font-black uppercase opacity-60">Cash</p>
                        <p class="text-xl font-black">${totalRev / 1000}k</p>
                    </div>
                    <div class="bg-accent rounded-3xl p-4 text-white">
                        <p class="text-[8px] font-black uppercase opacity-60">KGs</p>
                        <p class="text-xl font-black">${totalWeight}</p>
                    </div>
                </div>

                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-xl font-black text-gray-900">Order Management</h2>
                </div>

                <!-- Tabs -->
                <div class="flex gap-2 mb-6">
                    <button onclick="window.AdminModule.setFilter('active')" class="flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all ${this.state.filter === 'active' ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}">Active</button>
                    <button onclick="window.AdminModule.setFilter('completed')" class="flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all ${this.state.filter === 'completed' ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}">History</button>
                    <button onclick="window.AdminModule.setFilter('all')" class="flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all ${this.state.filter === 'all' ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}">All</button>
                </div>

                <div class="space-y-2">
                    ${ordersHtml || '<div class="p-20 text-center text-gray-400 text-xs font-bold">No orders in this category</div>'}
                </div>
            </div>
        `;
    },

    setFilter: function(f) {
        this.state.filter = f;
        this.renderLayout(document.getElementById('app-content'));
    },

    updateStatus: async function(id, newStatus) {
        AppUtils.showToast("Updating...", "info");
        try {
            const response = await fetch('https://freshfold-api.vercel.app/api/admin/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus, adminEmail: 'imanieric878@gmail.com' })
            });
            if (!response.ok) throw new Error("Update failed");
            AppUtils.showToast("Status Updated!");
            this.render();
        } catch (error) {
            AppUtils.showToast(error.message, "error");
        }
    },

    togglePayment: async function(id, currentStatus) {
        const newStatus = currentStatus === 'Paid' ? 'Pending' : 'Paid';
        AppUtils.showToast("Updating...", "info");
        try {
            const response = await fetch('https://freshfold-api.vercel.app/api/admin/toggle-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, payment_status: newStatus, adminEmail: 'imanieric878@gmail.com' })
            });
            if (!response.ok) throw new Error("Payment update failed");
            AppUtils.showToast("Payment Status Updated!");
            this.render();
        } catch (error) {
            AppUtils.showToast(error.message, "error");
        }
    }
};
