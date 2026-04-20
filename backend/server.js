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

        // Lipana.dev Payload Structure
        const payload = {
            msisdn: formattedPhone,
            amount: Math.ceil(amount),
            callback_url: `${process.env.APP_URL}/api/mpesa/callback`,
            account_reference: `FF-${orderId.substring(0, 8)}`, // Prefix to distinguish from other projects
            transaction_description: "Payment for FreshFold Laundry"
        };

        const response = await axios.post(
            "https://api.lipana.dev/v1/mpesa/stk/push",
            payload,
            { 
                headers: { 
                    'Authorization': `Bearer ${process.env.LIPANA_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                } 
            }
        );

        // Update order with checkout ID (Lipana returns 'checkout_id')
        if (response.data.checkout_id) {
            const { error } = await supabase
                .from('orders')
                .update({ checkout_id: response.data.checkout_id })
                .eq('id', orderId);
            
            if (error) console.error("❌ Supabase Update Error:", error.message);
        }

        console.log(`✅ Lipana Request Accepted: ${response.data.checkout_id}`);
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
    
    // Lipana.dev usually passes the raw M-Pesa Body or a flattened version.
    // We handle both for maximum reliability.
    const body = req.body.Body || req.body; 
    const stkCallback = body.stkCallback || body;
    
    const checkoutRequestId = stkCallback.CheckoutRequestID || stkCallback.checkout_id;
    const resultCode = stkCallback.ResultCode !== undefined ? stkCallback.ResultCode : (stkCallback.status === 'Success' ? 0 : 1);

    console.log(`\n📩 Received M-PESA Callback [${checkoutRequestId}]`);

    try {
        if (resultCode === 0) {
            // Success: Update the order payment_status in Supabase
            const { data, error } = await supabase
                .from('orders')
                .update({ 
                    payment_status: 'Paid',
                    status: 'Requested'
                })
                .eq('checkout_id', checkoutRequestId)
                .select();

            if (error) throw error;
            console.log(`✅ Payment SUCCESS: Updated Order ID ${data[0]?.id}`);
        } else {
            // Failure
            await supabase
                .from('orders')
                .update({ payment_status: 'Failed' })
                .eq('checkout_id', checkoutRequestId);
            
            console.log(`❌ Payment FAILED: ${stkCallback.ResultDesc || stkCallback.message}`);
        }
    } catch (e) {
        console.error("❌ Error processing callback:", e.message);
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
