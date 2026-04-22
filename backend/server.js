require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Initialize Supabase Admin (Service Role)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.get('/', (req, res) => {
    res.json({ status: "FreshFold API is LIVE 🚀", version: "2.1" });
});

console.log("⚡ Supabase Admin: Connection Established");

/**
 * 2. Lipana.dev STK Push Endpoint
 * This replaces the direct Daraja integration.
 * Lipana.dev handles the OAuth and Passkey complexity for you.
 */
app.post('/api/mpesa/stkpush', async (req, res) => {
    try {
        const { phone, amount, orderId } = req.body;
        console.log(`\n💸 Initiating Lipana STK Push for Order: ${orderId}`);
        
        // Format phone: must be 254...
        let formattedPhone = phone.replace(/\s+/g, '').replace('+', '');
        if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.substring(1);

        // Verified Lipana.dev Payload
        const payload = {
            phone: formattedPhone.startsWith('+') ? formattedPhone : `+${formattedPhone}`,
            amount: Math.max(10, Math.ceil(amount)) // Minimum Ksh 10 required
        };

        const response = await axios.post(
            "https://api.lipana.dev/v1/transactions/push-stk",
            payload,
            { 
                headers: { 
                    'x-api-key': process.env.LIPANA_SECRET_KEY,
                    'Content-Type': 'application/json'
                } 
            }
        );

        // Update order with checkout ID (Lipana returns 'checkout_id' or 'transaction_id')
        const checkoutId = response.data.checkout_id || response.data.transaction_id;
        
        if (checkoutId) {
            const { error } = await supabase
                .from('orders')
                .update({ checkout_id: checkoutId })
                .eq('id', orderId);
            
            if (error) console.error("❌ Supabase Update Error:", error.message);
        }

        console.log(`✅ Lipana Request Accepted: ${checkoutId}`);
        res.json({ success: true, data: response.data });
    } catch (error) {
        // Detailed error reporting for debugging
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error("❌ Lipana STK Push Failed:", errorMessage);
        res.status(500).json({ 
            success: false, 
            error: 'M-PESA Trigger Failed',
            details: errorMessage
        });
    }
});

/**
 * 3. M-Pesa Callback Webhook
 * Lipana.dev will POST to this URL once the user completes the payment.
 */
app.post('/api/mpesa/callback', async (req, res) => {
    // Send 200 OK immediately to acknowledge receipt
    res.status(200).send("OK");

    try {
        console.log("📥 Received M-Pesa Callback:", JSON.stringify(req.body));

        // Lipana.dev sends data nested in a 'data' object for events like 'payment.success'
        const event = req.body.event;
        const payload = req.body.data || req.body;
        
        // We look for the ID we saved (checkout_id, transactionId, or CheckoutRequestID)
        const checkoutId = payload.transactionId || payload.checkout_id || payload.CheckoutRequestID || payload.Body?.stkCallback?.CheckoutRequestID;
        const isSuccess = event === 'payment.success' || payload.status === 'success' || payload.status === 'Success' || payload.ResultCode === 0 || payload.Body?.stkCallback?.ResultCode === 0;

        if (isSuccess && checkoutId) {
            const { error } = await supabase
                .from('orders')
                .update({ 
                    payment_status: 'Paid',
                    status: 'Requested'
                })
                .eq('checkout_id', checkoutId);
            
            if (error) {
                console.error("❌ Failed to update Supabase on callback:", error.message);
            } else {
                console.log(`✅ Payment CONFIRMED for ID: ${checkoutId}`);
            }
        }
    } catch (e) {
        console.error("❌ Error processing callback:", e.message);
    }
});

/**
 * 4. Admin Endpoints
 * Used by the Admin Panel to update order statuses, bypassing RLS.
 */
app.post('/api/admin/update-status', async (req, res) => {
    const { id, status, adminEmail } = req.body;
    if (adminEmail !== 'imanieric878@gmail.com') return res.status(403).json({ error: "Unauthorized" });

    try {
        const { error } = await supabase.from('orders').update({ status }).eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/toggle-payment', async (req, res) => {
    const { id, payment_status, adminEmail } = req.body;
    if (adminEmail !== 'imanieric878@gmail.com') return res.status(403).json({ error: "Unauthorized" });

    try {
        const { error } = await supabase.from('orders').update({ payment_status }).eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// For Vercel Serverless compatibility
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`\n🚀 FreshFold Backend is LIVE on port ${PORT}`);
        console.log(`🔗 Webhook URL: ${process.env.APP_URL}/api/mpesa/callback`);
    });
}

module.exports = app;
