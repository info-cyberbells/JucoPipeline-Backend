# JucoPipeline Payment API Documentation

## Overview
This API handles Stripe subscription payments for Coach and Scout roles in the JucoPipeline platform.

## Base URL
```
http://localhost:5000/api
```

---

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## API Endpoints

### 1. Get Subscription Plans
**GET** `/payment/plans`

Get available subscription plans. Can filter by role.

**Query Parameters:**
- `role` (optional): "coach" or "scout"

**Response:**
```json
{
  "success": true,
  "message": "Subscription plans retrieved successfully",
  "plans": {
    "monthly": {
      "name": "4 YEAR COACH",
      "priceId": "price_xxxxx",
      "price": 9.99,
      "interval": "year",
      "features": [...]
    },
    "yearly": {...}
  }
}
```

---

### 2. Create Checkout Session (Recommended)
**POST** `/payment/create-checkout-session`

Creates a Stripe Checkout session for subscription payment. This is the **recommended approach** as it uses Stripe's hosted payment page.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "plan": "coach_yearly"
}
```

**Available Plans:**
- `coach_yearly` - 4 YEAR COACH ($9.99/year)
- `coach_monthly` - MONTHLY COACH ($1.99/month)
- `scout_yearly` - MLD SCOUT ($9.99/year)
- `scout_monthly` - MONTHLY SCOUT ($1.99/month)

**Response:**
```json
{
  "success": true,
  "message": "Checkout session created successfully",
  "sessionId": "cs_test_xxxxx",
  "sessionUrl": "https://checkout.stripe.com/c/pay/cs_test_xxxxx",
  "plan": {
    "name": "4 YEAR COACH",
    "price": 9.99,
    "interval": "year",
    "features": [...]
  }
}
```

**Frontend Integration:**
```javascript
// Step 1: Create checkout session
const response = await fetch('http://localhost:5000/api/payment/create-checkout-session', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ plan: 'coach_yearly' })
});

const { sessionUrl } = await response.json();

// Step 2: Redirect user to Stripe Checkout
window.location.href = sessionUrl;

// Step 3: After payment, Stripe redirects to:
// Success: http://localhost:3000/payment/success?session_id=cs_test_xxxxx
// Cancel: http://localhost:3000/payment/cancel
```

---

### 3. Create Subscription Intent (Custom Payment Form)
**POST** `/payment/create-subscription-intent`

Creates a subscription with payment intent for custom payment form using Stripe Elements.

**Request Body:**
```json
{
  "plan": "coach_yearly"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription intent created successfully",
  "subscriptionId": "sub_xxxxx",
  "clientSecret": "pi_xxxxx_secret_xxxxx",
  "publishableKey": "pk_test_xxxxx",
  "plan": {...}
}
```

**Frontend Integration with Stripe Elements:**
```javascript
// Step 1: Load Stripe
const stripe = Stripe('pk_test_xxxxx');

// Step 2: Create subscription intent
const response = await fetch('/api/payment/create-subscription-intent', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ plan: 'coach_yearly' })
});

const { clientSecret, subscriptionId } = await response.json();

// Step 3: Show Stripe card element
const elements = stripe.elements();
const cardElement = elements.create('card');
cardElement.mount('#card-element');

// Step 4: Confirm payment
const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: {
      name: 'Customer Name',
      email: 'customer@example.com'
    }
  }
});

if (error) {
  console.error('Payment failed:', error);
} else {
  console.log('Payment successful!', paymentIntent);
}
```

---

### 4. Confirm Subscription Payment
**POST** `/payment/confirm-payment`

Confirm payment for a subscription.

**Request Body:**
```json
{
  "paymentMethodId": "pm_xxxxx",
  "subscriptionId": "sub_xxxxx"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment confirmed successfully",
  "subscription": {
    "id": "sub_xxxxx",
    "status": "active",
    "currentPeriodEnd": "2025-12-09T00:00:00.000Z"
  }
}
```

---

### 5. Get Subscription Status
**GET** `/payment/subscription-status`

Get current user's subscription details.

**Response:**
```json
{
  "success": true,
  "message": "Subscription status retrieved successfully",
  "subscription": {
    "_id": "675e3xxx",
    "plan": "coach_yearly",
    "planName": "4 YEAR COACH",
    "price": 9.99,
    "interval": "year",
    "status": "active",
    "currentPeriodStart": "2024-12-09T00:00:00.000Z",
    "currentPeriodEnd": "2025-12-09T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "canceledAt": null,
    "features": [...]
  },
  "hasActiveSubscription": true
}
```

---

### 6. Cancel Subscription
**POST** `/payment/cancel-subscription`

Cancel subscription at the end of billing period.

**Response:**
```json
{
  "success": true,
  "message": "Subscription will be canceled at the end of the billing period",
  "subscription": {
    "status": "active",
    "currentPeriodEnd": "2025-12-09T00:00:00.000Z",
    "cancelAtPeriodEnd": true
  }
}
```

---

### 7. Reactivate Subscription
**POST** `/payment/reactivate-subscription`

Reactivate a canceled subscription before it ends.

**Response:**
```json
{
  "success": true,
  "message": "Subscription reactivated successfully",
  "subscription": {
    "status": "active",
    "currentPeriodEnd": "2025-12-09T00:00:00.000Z",
    "cancelAtPeriodEnd": false
  }
}
```

---

### 8. Verify Session
**GET** `/payment/verify-session?sessionId=cs_test_xxxxx`

Verify checkout session after successful payment.

**Query Parameters:**
- `sessionId`: Stripe checkout session ID

**Response:**
```json
{
  "success": true,
  "message": "Session verified successfully",
  "session": {
    "id": "cs_test_xxxxx",
    "status": "complete",
    "paymentStatus": "paid",
    "customerEmail": "user@example.com",
    "subscription": {
      "plan": "coach_yearly",
      "planName": "4 YEAR COACH",
      "status": "active",
      "currentPeriodEnd": "2025-12-09T00:00:00.000Z"
    }
  }
}
```

---

### 9. Get Payment History
**GET** `/payment/payment-history?limit=10`

Get user's payment history.

**Query Parameters:**
- `limit` (optional): Number of records (default: 10)

**Response:**
```json
{
  "success": true,
  "message": "Payment history retrieved successfully",
  "payments": [
    {
      "id": "in_xxxxx",
      "amount": 9.99,
      "currency": "USD",
      "status": "paid",
      "date": "2024-12-09T00:00:00.000Z",
      "invoiceUrl": "https://invoice.stripe.com/...",
      "description": "Subscription payment"
    }
  ]
}
```

---

### 10. Update Payment Method
**POST** `/payment/update-payment-method`

Get Stripe billing portal URL to update payment method.

**Response:**
```json
{
  "success": true,
  "message": "Payment portal session created",
  "url": "https://billing.stripe.com/session/xxxxx"
}
```

---

## Webhook Endpoint

### Stripe Webhooks
**POST** `/webhook/stripe`

Handles Stripe webhook events. Configure this URL in your Stripe Dashboard.

**Webhook URL:**
```
https://yourdomain.com/api/webhook/stripe
```

**Events Handled:**
- `checkout.session.completed` - Payment completed
- `customer.subscription.created` - Subscription created
- `customer.subscription.updated` - Subscription updated
- `customer.subscription.deleted` - Subscription canceled
- `invoice.payment_succeeded` - Payment successful
- `invoice.payment_failed` - Payment failed

---

## Complete Frontend Flow Examples

### Option 1: Stripe Checkout (Recommended - Easiest)

```javascript
// registration-flow.js

// Step 1: User completes registration
const registerUser = async (userData) => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  
  const { token, user } = await response.json();
  localStorage.setItem('token', token);
  
  // If coach or scout, redirect to payment
  if (user.role === 'coach' || user.role === 'scout') {
    window.location.href = '/subscription-plans';
  }
};

// Step 2: User selects plan and initiates checkout
const selectPlan = async (plan) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/payment/create-checkout-session', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ plan }) // e.g., "coach_yearly"
  });
  
  const { sessionUrl } = await response.json();
  
  // Redirect to Stripe Checkout
  window.location.href = sessionUrl;
};

// Step 3: Handle success redirect
// URL: /payment/success?session_id=cs_test_xxxxx
const verifyPayment = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  
  const response = await fetch(`/api/payment/verify-session?sessionId=${sessionId}`);
  const data = await response.json();
  
  if (data.success) {
    // Payment successful!
    window.location.href = '/dashboard';
  }
};
```

### Option 2: Custom Payment Form with Stripe Elements

```javascript
// custom-payment-form.js

const stripe = Stripe('pk_test_xxxxx');
const elements = stripe.elements();
const cardElement = elements.create('card', {
  style: {
    base: {
      fontSize: '16px',
      color: '#32325d',
    }
  }
});

cardElement.mount('#card-element');

const handlePayment = async (plan) => {
  const token = localStorage.getItem('token');
  
  // Step 1: Create subscription intent
  const response = await fetch('/api/payment/create-subscription-intent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ plan })
  });
  
  const { clientSecret, subscriptionId } = await response.json();
  
  // Step 2: Confirm card payment
  const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      card: cardElement,
      billing_details: {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
      }
    }
  });
  
  if (error) {
    console.error('Payment failed:', error.message);
    alert('Payment failed: ' + error.message);
  } else if (paymentIntent.status === 'succeeded') {
    console.log('Payment successful!');
    window.location.href = '/dashboard';
  }
};
```

---

## Protected Routes Example

```javascript
// Example: Protect routes that require subscription

import { requireActiveSubscription } from "./middleware/subscription.middleware.js";

// Only users with active subscription can access
router.get("/api/players/premium-list", 
  authenticate, 
  requireActiveSubscription, 
  getPremiumPlayerList
);

// Only coaches with active subscription can contact players
router.post("/api/contact/player", 
  authenticate, 
  requireActiveSubscription, 
  contactPlayer
);
```

---

## Testing

### Test Cards (Stripe Test Mode)

**Successful Payment:**
```
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
```

**Payment Requires Authentication:**
```
Card: 4000 0025 0000 3155
```

**Declined Payment:**
```
Card: 4000 0000 0000 9995
```

---

## Error Handling

All endpoints follow this error format:

```json
{
  "success": false,
  "message": "Error message here",
  "error": "Detailed error (development only)"
}
```

**Common Error Codes:**
- `400` - Bad Request (Invalid input)
- `401` - Unauthorized (No token or invalid token)
- `403` - Forbidden (No active subscription)
- `404` - Not Found
- `500` - Server Error

---

## Subscription Status Values

- `active` - Subscription is active
- `trialing` - In trial period
- `past_due` - Payment failed, retrying
- `canceled` - Subscription canceled
- `incomplete` - Payment incomplete
- `incomplete_expired` - Payment incomplete and expired
- `unpaid` - Payment failed completely

---

## Notes

1. **Webhook Secret**: Get from Stripe Dashboard → Developers → Webhooks
2. **Price IDs**: Create products in Stripe Dashboard and copy Price IDs
3. **Test Mode**: Use test keys (pk_test_ and sk_test_) during development
4. **Production**: Switch to live keys (pk_live_ and sk_live_) for production

---

## Support

For issues or questions, contact: hello@jucopipeline.com