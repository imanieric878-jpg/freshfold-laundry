/**
 * admin.js
 * Order Management Dashboard for FreshFold Staff.
 * Only accessible by authorized emails.
 */

window.AdminModule = {
    state: {
        orders: []
    },

    render: async function() {
        const { data: { user } } = await window.supabase.auth.getUser();
        
        // SECURITY: Only you can access this
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

        // Fetch ALL orders
        const { data, error } = await window.supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            AppUtils.showToast("Failed to fetch orders", "error");
            return;
        }

        this.state.orders = data;
        this.renderList(container);
    },

    renderList: function(container) {
        const ordersHtml = this.state.orders.map(order => {
            const stages = ['Requested', 'Rider Assigned', 'Picked Up', 'In Processing', 'Out for Delivery', 'Delivered'];
            
            return `
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h4 class="font-bold text-gray-900">Order #${order.id.slice(0,8)}</h4>
                            <p class="text-[10px] text-gray-400 font-bold uppercase">${order.phone} | ${order.weight}kg</p>
                        </div>
                        <span class="text-[10px] font-black uppercase px-3 py-1 bg-primary/10 text-primary rounded-full">${order.status}</span>
                    </div>

                    <div class="mb-4 p-3 bg-gray-50 rounded-xl text-[11px] text-gray-600 italic">
                        <i class="fa-solid fa-location-dot mr-1"></i> ${order.address}
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <select onchange="window.AdminModule.updateStatus('${order.id}', this.value)" class="col-span-2 bg-gray-50 border-none rounded-xl py-3 px-4 text-xs font-bold focus:ring-2 focus:ring-primary">
                            ${stages.map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                        <button onclick="window.AdminModule.togglePayment('${order.id}', '${order.payment_status}')" class="py-3 rounded-xl text-[10px] font-black uppercase ${order.payment_status === 'Paid' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}">
                            ${order.payment_status === 'Paid' ? 'Mark Unpaid' : 'Mark Paid'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="fade-in pb-20">
                <div class="flex justify-between items-center mb-8">
                    <h2 class="text-2xl font-black text-gray-900">Admin Panel</h2>
                    <span class="bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">Staff</span>
                </div>
                ${ordersHtml || '<p class="text-center py-20 text-gray-400">No orders found.</p>'}
            </div>
        `;
    },

    updateStatus: async function(id, newStatus) {
        const { error } = await window.supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) AppUtils.showToast(error.message, "error");
        else {
            AppUtils.showToast("Status Updated!");
            this.render();
        }
    },

    togglePayment: async function(id, currentStatus) {
        const newStatus = currentStatus === 'Paid' ? 'Pending' : 'Paid';
        const { error } = await window.supabase
            .from('orders')
            .update({ payment_status: newStatus })
            .eq('id', id);

        if (error) AppUtils.showToast(error.message, "error");
        else {
            AppUtils.showToast("Payment Status Updated!");
            this.render();
        }
    }
};
