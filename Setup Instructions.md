# Setup Instructions for JucoPipeline Stripe Integration

## Prerequisites
- Node.js (v16 or higher)
- MongoDB
- Stripe Account

---

## Step 1: Install Dependencies

```bash
npm install stripe
```

---

## Step 2: Create Stripe Products & Prices

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com/test/products

2. **Create Coach Yearly Plan:**
   - Click "Add Product"
   - Name: `4 YEAR COACH`
   - Price: `$9.99`
   - Billing period: `Yearly`
   - Click "Save"
   - Copy the **Price ID** (starts with `price_`)

3. **Create Coach Monthly Plan:**
   - Name: `MONTHLY COACH`
   - Price: `$1.99`
   - Billing period: `Monthly`
   - Copy the **Price ID**

4. **Create Scout Yearly Plan:**
   - Name: `MLD SCOUT`
   - Price: `$9.99`
   - Billing period: `Yearly`
   - Copy the **Price ID**

5. **Create Scout Monthly Plan:**
   - Name: `MONTHLY SCOUT`
   - Price: `$1.99`
   - Billing period: `Monthly`
   - Copy the **Price ID**

---

## Step 3: Configure Webhook

1. **Go to**: https://dashboard.stripe.com/test/webhooks

2. **Click "Add endpoint"**

3. **Endpoint URL**: 
   ```
   https://your-domain.com/api/webhook/stripe
   ```
   
   For local testing with Stripe CLI:
   ```
   http://localhost:5000/api/webhook/stripe
   ```

4. **Select events to listen to:**
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

5. **Click "Add endpoint"**

6. **Copy the Signing Secret** (starts with `whsec_`)

---

## Step 4: Update Environment Variables

Create or update your `.env` file:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/jucopipeline

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this

# Frontend
FRONTEND_URL=http://localhost:3000

# Stripe Keys (from dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Price IDs (from step 2)
STRIPE_COACH_YEARLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_COACH_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_SCOUT_YEARLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_SCOUT_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
```

---

## Step 5: File Structure

Organize your files like this:

```
jucopipeline-backend/
├── config/
│   └── stripe.js                    # ✅ NEW
├── controllers/
│   ├── payment.controller.js        # ✅ NEW
│   └── webhook.controller.js        # ✅ NEW
├── middleware/
│   ├── auth.middleware.js
│   └── subscription.middleware.js   # ✅ NEW
├── models/
│   ├── user.model.js
│   └── subscription.model.js        # You already have this
├── routes/
│   ├── auth.routes.js
│   ├── payment.routes.js            # ✅ NEW
│   └── webhook.routes.js            # ✅ NEW
├── .env
├── .env.example                     # ✅ NEW
├── server.js
└── package.json
```

---

## Step 6: Update server.js

**IMPORTANT**: Webhook route must come BEFORE `express.json()` middleware!

```javascript
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Import routes
import webhookRoutes from "./routes/webhook.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import authRoutes from "./routes/auth.routes.js";

dotenv.config();
const app = express();

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// ⚠️ WEBHOOK MUST COME FIRST (before express.json)
app.use("/api/webhook", webhookRoutes);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Other routes
app.use("/api/auth", authRoutes);
app.use("/api/payment", paymentRoutes);

// ... rest of server config
```

---

## Step 7: Test Locally with Stripe CLI

### Install Stripe CLI

**Mac:**
```bash
brew install stripe/stripe-cli/stripe
```

**Windows:**
Download from: https://github.com/stripe/stripe-cli/releases

### Login to Stripe
```bash
stripe login
```

### Forward webhooks to local server
```bash
stripe listen --forward-to localhost:5000/api/webhook/stripe
```

This will give you a webhook secret starting with `whsec_`. Use this in your `.env` file for local testing.

### Trigger test events
```bash
# Test successful payment
stripe trigger checkout.session.completed

# Test failed payment
stripe trigger invoice.payment_failed
```

---

## Step 8: Testing the API

### 1. Get Subscription Plans
```bash
curl http://localhost:5000/api/payment/plans?role=coach
```

### 2. Create Checkout Session (requires auth)
```bash
curl -X POST http://localhost:5000/api/payment/create-checkout-session \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "coach_yearly"}'
```

### 3. Get Subscription Status
```bash
curl http://localhost:5000/api/payment/subscription-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Step 9: Frontend Integration

### Option 1: Redirect to Stripe Checkout (Recommended)

```javascript
const handleSubscribe = async (plan) => {
  try {
    const response = await fetch('http://localhost:5000/api/payment/create-checkout-session', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ plan }) // e.g., "coach_yearly"
    });

    const data = await response.json();
    
    if (data.success) {
      // Redirect to Stripe Checkout
      window.location.href = data.sessionUrl;
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### Success & Cancel URLs

Create these pages in your frontend:

1. **Success Page** (`/payment/success`)
   - URL: `http://localhost:3000/payment/success?session_id=cs_test_xxx`
   - Verify session and show success message

2. **Cancel Page** (`/payment/cancel`)
   - URL: `http://localhost:3000/payment/cancel`
   - Show message that payment was canceled

---

## Step 10: Protect Routes (Optional)

Use the subscription middleware to protect routes:

```javascript
// routes/player.routes.js
import { authenticate } from "../middleware/auth.middleware.js";
import { requireActiveSubscription } from "../middleware/subscription.middleware.js";

// Only users with active subscription can access
router.get("/premium-players", 
  authenticate, 
  requireActiveSubscription, 
  getPremiumPlayers
);
```

---

## Common Issues & Solutions

### Issue 1: Webhook signature verification failed
**Solution**: Make sure you're using the correct webhook secret from Stripe CLI or Dashboard

### Issue 2: Price ID not found
**Solution**: Double-check Price IDs in .env match exactly with Stripe Dashboard

### Issue 3: "No authentication" error
**Solution**: Make sure JWT token is included in Authorization header

### Issue 4: Subscription not updating in database
**Solution**: Check webhook endpoint is accessible and Stripe CLI is running

### Issue 5: CORS errors
**Solution**: Add your frontend URL to CORS configuration in server.js

---

## Production Deployment

### 1. Switch to Live Mode

In Stripe Dashboard, toggle from "Test mode" to "Live mode" and:

1. Get **Live API keys** from: https://dashboard.stripe.com/apikeys
2. Create **Live products** with same names
3. Create **Live webhook** endpoint
4. Update `.env` with live keys

### 2. Update Environment Variables

```env
NODE_ENV=production
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_live_xxxxx
# Update all price IDs to live versions
```

### 3. Webhook URL

Make sure your production webhook URL is:
```
https://api.jucopipeline.com/api/webhook/stripe
```

And it's configured in Stripe Dashboard.

---

## Security Checklist

- [ ] Never commit `.env` file to Git
- [ ] Use environment variables for all secrets
- [ ] Verify webhook signatures
- [ ] Validate user roles before creating subscriptions
- [ ] Use HTTPS in production
- [ ] Rate limit payment endpoints
- [ ] Log all payment events
- [ ] Monitor failed payments

---

## Next Steps

1. ✅ Complete setup steps above
2. ✅ Test with Stripe test cards
3. ✅ Implement frontend payment flow
4. ✅ Test webhooks locally with Stripe CLI
5. ✅ Add email notifications (optional)
6. ✅ Deploy to production
7. ✅ Switch to live Stripe keys

---

## Support

- **Stripe Documentation**: https://stripe.com/docs
- **Stripe Testing**: https://stripe.com/docs/testing
- **Webhook Testing**: https://stripe.com/docs/webhooks/test

---

## Contact

For questions or issues:
- Email: support@jucopipeline.com
- Slack: #backend-team