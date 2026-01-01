import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const OUTSETA_DOMAIN = process.env.OUTSETA_DOMAIN;
const OUTSETA_API_KEY = process.env.OUTSETA_API_KEY?.trim();
const OUTSETA_SECRET_KEY = process.env.OUTSETA_SECRET_KEY?.trim();

// ============================================
// CORRECT: Outseta uses API Key + Secret as headers
// NOT Basic Auth!
// ============================================
const outsetaAPI = axios.create({
  baseURL: `https://${OUTSETA_DOMAIN}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
    'Outseta-Api-Key': OUTSETA_API_KEY,        // API Key as header
    'Outseta-Api-Secret': OUTSETA_SECRET_KEY    // Secret as header
  }
});

// ============================================
// OUTSETA API WRAPPER
// ============================================
class OutsetaAPI {
  
  // ===== PLANS =====
  async getPlans() {
    try {
      const response = await outsetaAPI.get('/billing/plans');
      return response.data.items;
    } catch (error) {
      console.error('Outseta API Error (getPlans):', error.response?.data || error.message);
      throw error;
    }
  }

  async getPlan(planUid) {
    try {
      const response = await outsetaAPI.get(`/billing/plans/${planUid}`);
      return response.data;
    } catch (error) {
      console.error('Outseta API Error (getPlan):', error.response?.data || error.message);
      throw error;
    }
  }

  // ===== PEOPLE (Users) =====
  async createOrUpdatePerson(userData) {
    try {
      // First check if person exists
      const existing = await this.findPersonByEmail(userData.email);
      
      if (existing) {
        // Update existing person
        const response = await outsetaAPI.put(`/crm/people/${existing.Uid}`, {
          FirstName: userData.firstName,
          LastName: userData.lastName,
          MailingAddress: {
            State: userData.state || ''
          }
        });
        return response.data;
      }
      
      // Create new person with account
      const response = await outsetaAPI.post('/crm/people', {
        Email: userData.email,
        FirstName: userData.firstName,
        LastName: userData.lastName,
        MailingAddress: {
          State: userData.state || ''
        },
        Account: {
          Name: `${userData.firstName} ${userData.lastName}`,
          AccountStage: 1 // Subscribing
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Outseta API Error (createOrUpdatePerson):', error.response?.data || error.message);
      throw error;
    }
  }

  async findPersonByEmail(email) {
    try {
      const response = await outsetaAPI.get(`/crm/people?Email=${encodeURIComponent(email)}`);
      return response.data.items && response.data.items.length > 0 ? response.data.items[0] : null;
    } catch (error) {
      return null;
    }
  }

  async getPerson(personUid) {
    try {
      const response = await outsetaAPI.get(`/crm/people/${personUid}`);
      return response.data;
    } catch (error) {
      console.error('Outseta API Error (getPerson):', error.response?.data || error.message);
      throw error;
    }
  }

  // ===== ACCOUNTS =====
  async getAccount(accountUid) {
    try {
      const response = await outsetaAPI.get(`/crm/accounts/${accountUid}`);
      return response.data;
    } catch (error) {
      console.error('Outseta API Error (getAccount):', error.response?.data || error.message);
      throw error;
    }
  }

  // ===== SUBSCRIPTIONS =====
  async createSubscription(accountUid, planUid) {
    try {
      const response = await outsetaAPI.post('/billing/subscriptions', {
        Account: {
          Uid: accountUid
        },
        Plan: {
          Uid: planUid
        },
        StartDate: new Date().toISOString()
      });
      return response.data;
    } catch (error) {
      console.error('Outseta API Error (createSubscription):', error.response?.data || error.message);
      throw error;
    }
  }

  async getSubscription(subscriptionUid) {
    try {
      const response = await outsetaAPI.get(`/billing/subscriptions/${subscriptionUid}`);
      return response.data;
    } catch (error) {
      console.error('Outseta API Error (getSubscription):', error.response?.data || error.message);
      throw error;
    }
  }

  async getAccountSubscriptions(accountUid) {
    try {
      const response = await outsetaAPI.get(`/billing/subscriptions?Account.Uid=${accountUid}`);
      return response.data.items || [];
    } catch (error) {
      console.error('Outseta API Error (getAccountSubscriptions):', error.response?.data || error.message);
      return [];
    }
  }

  async updateSubscription(subscriptionUid, updateData) {
    try {
      const response = await outsetaAPI.put(`/billing/subscriptions/${subscriptionUid}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Outseta API Error (updateSubscription):', error.response?.data || error.message);
      throw error;
    }
  }

  async cancelSubscription(subscriptionUid, cancellationDate = null) {
    try {
      const updateData = {
        CancellationDate: cancellationDate || new Date().toISOString()
      };
      const response = await outsetaAPI.put(`/billing/subscriptions/${subscriptionUid}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Outseta API Error (cancelSubscription):', error.response?.data || error.message);
      throw error;
    }
  }

  // ===== INVOICES =====
  async getInvoices(accountUid, limit = 10) {
    try {
      const response = await outsetaAPI.get(`/billing/invoices?Account.Uid=${accountUid}&limit=${limit}`);
      return response.data.items || [];
    } catch (error) {
      console.error('Outseta API Error (getInvoices):', error.response?.data || error.message);
      return [];
    }
  }

  // ===== STRIPE CHECKOUT (via Outseta) =====
  async createStripeCheckoutSession(accountUid, planUid, successUrl, cancelUrl) {
    try {
      // Note: This endpoint might be different in Outseta
      // Check Postman collection for exact endpoint
      const response = await outsetaAPI.post('/billing/stripe/checkout-sessions', {
        Account: {
          Uid: accountUid
        },
        Plan: {
          Uid: planUid
        },
        SuccessUrl: successUrl,
        CancelUrl: cancelUrl
      });
      return response.data;
    } catch (error) {
      console.error('Outseta API Error (createStripeCheckoutSession):', error.response?.data || error.message);
      throw error;
    }
  }

  // ===== STRIPE BILLING PORTAL =====
  async getStripePortalUrl(accountUid, returnUrl) {
    try {
      const response = await outsetaAPI.post('/billing/stripe/portal-sessions', {
        Account: {
          Uid: accountUid
        },
        ReturnUrl: returnUrl
      });
      return response.data.url;
    } catch (error) {
      console.error('Outseta API Error (getStripePortalUrl):', error.response?.data || error.message);
      throw error;
    }
  }
}

// Export single instance
const outseta = new OutsetaAPI();
export default outseta;