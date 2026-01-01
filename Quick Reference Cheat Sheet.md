# Quick Reference Cheat Sheet

## 🚀 Essential Commands

```bash
# Install Stripe
npm install stripe

# Install Stripe CLI (Mac)
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks (development)
stripe listen --forward-to localhost:5000/api/webhook/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed

# Start server
npm start
```

---

## 📁 Files to Copy

```
✅ config/stripe.js                    ← stripe.config.js
✅ controllers/payment.controller.js    
✅ controllers/webhook.controller.js    
✅ middleware/subscription.middleware.js
✅ routes/payment.routes.js            
✅ routes/webhook.routes.js            
```

---

## ⚙️ Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_COACH_YEARLY_PRICE_ID=price_...
STRIPE_COACH_MONTHLY_PRICE_ID=price_...
STRIPE_SCOUT_YEARLY_PRICE_ID=price_...
STRIPE_SCOUT_MONTHLY_PRICE_ID=price_...
FRONTEND_URL=http://localhost:3000
```

---

## 🎯 API Endpoints Quick Reference

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/payment/plans` | Get subscription plans | No |
| POST | `/api/payment/create-checkout-session` | Create Stripe Checkout | Yes |
| POST | `/api/payment/create-subscription-intent` | Custom payment form | Yes |
| GET | `/api/payment/subscription-status` | Get user subscription | Yes |
| POST | `/api/payment/cancel-subscription` | Cancel subscription | Yes |
| POST | `/api/payment/reactivate-subscription` | Reactivate subscription | Yes |
| GET | `/api/payment/verify-session` | Verify checkout | No |
| GET | `/api/payment/payment-history` | Get invoices | Yes |
| POST | `/api/payment/update-payment-method` | Billing portal | Yes |
| POST | `/api/webhook/stripe` | Stripe webhooks | No |

---

## 💳 Test Cards

```
✅ Success:         4242 4242 4242 4242
❌ Declined:        4000 0000 0000 9995
🔐 3D Secure:       4000 0025 0000 3155
💰 Insufficient:    4000 0000 0000 9995

Exp: Any future date (12/34)
CVC: Any 3 digits (123)
ZIP: Any 5 digits (12345)
```

---

## 📝 Frontend Integration (Minimal)

```javascript
// 1. Create checkout session
const { sessionUrl } = await fetch('/api/payment/create-checkout-session', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ plan: 'coach_yearly' })
}).then(r => r.json());

// 2. Redirect to Stripe
window.location.href = sessionUrl;

// 3. Verify on success page
const params = new URLSearchParams(window.location.search);
const { success } = await fetch(
  `/api/payment/verify-session?sessionId=${params.get('session_id')}`
).then(r => r.json());

if (success) window.location.href = '/dashboard';
```

---

## 🔧 Server.js Critical Setup

```javascript
import webhookRoutes from "./routes/webhook.routes.js";
import paymentRoutes from "./routes/payment.routes.js";

// ⚠️ CRITICAL: Webhook BEFORE express.json()
app.use("/api/webhook", webhookRoutes);

// THEN other middleware
app.use(express.json());
app.use("/api/payment", paymentRoutes);
```

---

## 🛡️ Protect Routes

```javascript
import { requireActiveSubscription } from "./middleware/subscription.middleware.js";

router.get("/premium-content", 
  authenticate, 
  requireActiveSubscription,  // ← Add this
  getContent
);
```

---

## 📊 Subscription Plans

| Plan | Code | Price | Interval |
|------|------|-------|----------|
| 4 YEAR COACH | `coach_yearly` | $9.99 | year |
| MONTHLY COACH | `coach_monthly` | $1.99 | month |
| MLD SCOUT | `scout_yearly` | $9.99 | year |
| MONTHLY SCOUT | `scout_monthly` | $1.99 | month |

---

## 🔍 Debugging Checklist

```
□ Is Stripe CLI running?
□ Is webhook secret correct in .env?
□ Are Price IDs correct?
□ Is webhook route BEFORE express.json()?
□ Check Stripe Dashboard → Webhooks → Logs
□ Check server console logs
□ Check database for Subscription records
```

---

## 📍 Stripe Dashboard URLs

```
Products:  https://dashboard.stripe.com/test/products
Webhooks:  https://dashboard.stripe.com/test/webhooks
API Keys:  https://dashboard.stripe.com/test/apikeys
Logs:      https://dashboard.stripe.com/test/logs
```

---

## 🎨 Subscription Status Values

```
active           → Subscription is active ✅
trialing         → In trial period 🆓
past_due         → Payment failed, retrying ⚠️
canceled         → Subscription canceled ❌
incomplete       → Payment incomplete ⏳
unpaid           → Payment failed completely 🚫
```

---

## 🚨 Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `Webhook signature failed` | Check STRIPE_WEBHOOK_SECRET |
| `Price not found` | Check Price IDs in .env |
| `No token provided` | Include Authorization header |
| `CORS error` | Add frontend URL to CORS config |
| `Subscription not created` | Check webhook endpoint accessible |

---

## 🎯 Registration Flow Summary

```
1. POST /api/auth/register (role: coach/scout)
2. Frontend → /subscription-plans
3. POST /api/payment/create-checkout-session
4. Redirect to sessionUrl
5. User pays on Stripe
6. Redirect to /payment/success
7. GET /api/payment/verify-session
8. Webhook fires → saves subscription
9. Dashboard access granted
```

---

## 🧪 Testing Checklist

```
□ Register coach account
□ Select yearly plan
□ Enter test card 4242...
□ Complete payment
□ Check /payment/success page
□ Verify subscription in database
□ Check webhook logs
□ Try accessing protected route
□ Cancel subscription
□ Check status updated
```

---

## 📞 Support Links

- **Stripe Docs**: https://stripe.com/docs
- **Testing Guide**: https://stripe.com/docs/testing
- **Webhooks**: https://stripe.com/docs/webhooks
- **API Reference**: https://stripe.com/docs/api

---

## 🎉 Final Checklist

```
□ Stripe package installed
□ Files copied to project
□ .env configured
□ Products created in Stripe
□ Webhook configured
□ server.js updated
□ Stripe CLI running
□ Test payment successful
□ Webhook received
□ Subscription in database
□ Protected routes working
```

---

Print this page and keep it handy! 📄