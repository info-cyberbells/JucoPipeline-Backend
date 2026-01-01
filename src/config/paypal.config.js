import fetch from 'node-fetch';

// PayPal API Base URLs
const PAYPAL_API_BASE = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com'
};

// Get PayPal API base URL based on environment
export const getPayPalBaseURL = () => {
  return process.env.NODE_ENV === 'production' 
    ? PAYPAL_API_BASE.live 
    : PAYPAL_API_BASE.sandbox;
};

// Subscription Plans Configuration
export const PAYPAL_SUBSCRIPTION_PLANS = {
  coach_yearly: {
    name: "4 YEAR COACH",
    description: "Annual subscription for Coach access",
    price: 9.99,
    interval: "YEAR",
    planId: process.env.PAYPAL_COACH_YEARLY_PLAN_ID,
    features: [
      "Full Access to Elite Player Database",
      "Advanced Search & Filters",
      "Player Analytics & Stats",
      "Direct Player Contact",
      "Priority Support"
    ]
  },
  coach_monthly: {
    name: "MONTHLY COACH",
    description: "Monthly subscription for Coach access",
    price: 1.99,
    interval: "MONTH",
    planId: process.env.PAYPAL_COACH_MONTHLY_PLAN_ID,
    features: [
      "Full Access to Elite Player Database",
      "Advanced Search & Filters",
      "Player Analytics & Stats",
      "Direct Player Contact",
      "Email Support"
    ]
  },
  scout_yearly: {
    name: "MLD SCOUT",
    description: "Annual subscription for Scout access",
    price: 9.99,
    interval: "YEAR",
    planId: process.env.PAYPAL_SCOUT_YEARLY_PLAN_ID,
    features: [
      "Full Access to Elite Player Database",
      "Advanced Search & Filters",
      "Player Analytics & Stats",
      "Recruitment Tools",
      "Priority Support"
    ]
  },
  scout_monthly: {
    name: "MONTHLY SCOUT",
    description: "Monthly subscription for Scout access",
    price: 1.99,
    interval: "MONTH",
    planId: process.env.PAYPAL_SCOUT_MONTHLY_PLAN_ID,
    features: [
      "Full Access to Elite Player Database",
      "Advanced Search & Filters",
      "Player Analytics & Stats",
      "Recruitment Tools",
      "Email Support"
    ]
  }
};

// ============================================
// PAYPAL ACCESS TOKEN
// ============================================

let cachedToken = null;
let tokenExpiry = null;

export const getPayPalAccessToken = async () => {
  // Return cached token if still valid
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const baseURL = getPayPalBaseURL();

  const response = await fetch(`${baseURL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get PayPal access token: ${error}`);
  }

  const data = await response.json();
  
  // Cache token (expires in 1 hour, we'll refresh 5 minutes early)
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + ((data.expires_in - 300) * 1000);

  return cachedToken;
};

// ============================================
// PAYPAL API HELPER
// ============================================

export const paypalAPI = async (endpoint, options = {}) => {
  const accessToken = await getPayPalAccessToken();
  const baseURL = getPayPalBaseURL();

  const defaultHeaders = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const response = await fetch(`${baseURL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });

  // Check if response has content before parsing JSON
  // Some endpoints (like cancel) return 204 No Content
  let data = null;
  
  const contentType = response.headers.get('content-type');
  const hasContent = response.status !== 204 && response.status !== 205;
  
  if (hasContent && contentType && contentType.includes('application/json')) {
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        console.error('Failed to parse JSON response:', text);
        data = { rawResponse: text };
      }
    }
  }

  if (!response.ok) {
    console.error('PayPal API Error:', data);
    throw new Error(data?.message || `PayPal API request failed with status ${response.status}`);
  }

  // Return empty object for 204 responses, otherwise return data
  return data || { success: true };
};

// ============================================
// WEBHOOK VERIFICATION
// ============================================

export const verifyPayPalWebhook = async (headers, body) => {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    
    if (!webhookId) {
      console.error('PayPal webhook ID not configured');
      return false;
    }

    const accessToken = await getPayPalAccessToken();
    const baseURL = getPayPalBaseURL();

    const verificationData = {
      transmission_id: headers['paypal-transmission-id'],
      transmission_time: headers['paypal-transmission-time'],
      cert_url: headers['paypal-cert-url'],
      auth_algo: headers['paypal-auth-algo'],
      transmission_sig: headers['paypal-transmission-sig'],
      webhook_id: webhookId,
      webhook_event: body
    };

    const response = await fetch(`${baseURL}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(verificationData)
    });

    const result = await response.json();
    return result.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('PayPal webhook verification error:', error);
    return false;
  }
};

export default {
  PAYPAL_SUBSCRIPTION_PLANS,
  getPayPalAccessToken,
  paypalAPI,
  verifyPayPalWebhook,
  getPayPalBaseURL
};