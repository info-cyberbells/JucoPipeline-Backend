// ============================================
// CREATE PAYPAL WEBHOOK
// ============================================
// Since PayPal removed webhook UI, create via API

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const getAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not found in .env');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const baseURL = process.env.NODE_ENV === 'production' 
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  const response = await fetch(`${baseURL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  return data.access_token;
};

const createWebhook = async (webhookUrl) => {
  console.log('🔗 Creating PayPal Webhook...\n');

  try {
    const accessToken = await getAccessToken();
    const baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    const webhookData = {
      url: webhookUrl,
      event_types: [
        { name: 'BILLING.SUBSCRIPTION.ACTIVATED' },
        { name: 'BILLING.SUBSCRIPTION.UPDATED' },
        { name: 'BILLING.SUBSCRIPTION.CANCELLED' },
        { name: 'BILLING.SUBSCRIPTION.SUSPENDED' },
        { name: 'BILLING.SUBSCRIPTION.EXPIRED' },
        { name: 'PAYMENT.SALE.COMPLETED' },
        { name: 'PAYMENT.SALE.REFUNDED' }
      ]
    };

    console.log(`Creating webhook for URL: ${webhookUrl}\n`);

    const response = await fetch(`${baseURL}/v1/notifications/webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookData)
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Check if webhook already exists
      if (error.name === 'WEBHOOK_URL_ALREADY_EXISTS') {
        console.log('⚠️  Webhook already exists for this URL\n');
        console.log('Fetching existing webhooks...\n');
        
        // Get all webhooks
        const listResponse = await fetch(`${baseURL}/v1/notifications/webhooks`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        const webhooks = await listResponse.json();
        const existingWebhook = webhooks.webhooks.find(w => w.url === webhookUrl);

        if (existingWebhook) {
          console.log('✅ Found existing webhook!');
          console.log(`   Webhook ID: ${existingWebhook.id}`);
          console.log(`   URL: ${existingWebhook.url}`);
          console.log(`   Status: ${existingWebhook.status || 'ENABLED'}\n`);
          
          console.log('═══════════════════════════════════════════════════════════');
          console.log('📋 Add this to your .env file:\n');
          console.log(`PAYPAL_WEBHOOK_ID=${existingWebhook.id}`);
          console.log('═══════════════════════════════════════════════════════════');
          
          return existingWebhook.id;
        }
      }
      
      throw new Error(`PayPal API Error: ${JSON.stringify(error)}`);
    }

    const webhook = await response.json();

    console.log('✅ Webhook created successfully!\n');
    console.log(`   Webhook ID: ${webhook.id}`);
    console.log(`   URL: ${webhook.url}`);
    console.log(`   Events: ${webhook.event_types.length} subscribed\n`);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 Add this to your .env file:\n');
    console.log(`PAYPAL_WEBHOOK_ID=${webhook.id}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('✅ Next steps:');
    console.log('1. Copy the Webhook ID above to your .env file');
    console.log('2. Restart your server: npm start');
    console.log('3. Test by creating a subscription\n');

    return webhook.id;

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nPlease check:');
    console.error('1. PAYPAL_CLIENT_ID is correct in .env');
    console.error('2. PAYPAL_CLIENT_SECRET is correct in .env');
    console.error('3. The webhook URL is publicly accessible');
    console.error('4. You are using Sandbox credentials for testing\n');
  }
};

const listWebhooks = async () => {
  console.log('📋 Listing all webhooks...\n');

  try {
    const accessToken = await getAccessToken();
    const baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    const response = await fetch(`${baseURL}/v1/notifications/webhooks`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.webhooks && data.webhooks.length > 0) {
      console.log(`Found ${data.webhooks.length} webhook(s):\n`);
      
      data.webhooks.forEach((webhook, index) => {
        console.log(`${index + 1}. Webhook ID: ${webhook.id}`);
        console.log(`   URL: ${webhook.url}`);
        console.log(`   Events: ${webhook.event_types?.length || 0}`);
        console.log(`   Status: ${webhook.status || 'ENABLED'}\n`);
      });

      console.log('═══════════════════════════════════════════════════════════');
      console.log('💡 To use one of these, add to your .env:\n');
      console.log(`PAYPAL_WEBHOOK_ID=${data.webhooks[0].id}`);
      console.log('═══════════════════════════════════════════════════════════');
    } else {
      console.log('No webhooks found. Create one first.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

const deleteWebhook = async (webhookId) => {
  console.log(`🗑️  Deleting webhook: ${webhookId}...\n`);

  try {
    const accessToken = await getAccessToken();
    const baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    const response = await fetch(`${baseURL}/v1/notifications/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (response.ok || response.status === 204) {
      console.log('✅ Webhook deleted successfully\n');
    } else {
      const error = await response.json();
      console.error('❌ Failed to delete webhook:', error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

// Main execution
const main = async () => {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'list') {
    await listWebhooks();
  } else if (command === 'delete' && args[1]) {
    await deleteWebhook(args[1]);
  } else if (command === 'create' && args[1]) {
    await createWebhook(args[1]);
  } else {
    console.log('🔧 PayPal Webhook Manager\n');
    console.log('Usage:');
    console.log('  node create-webhook.js create <URL>   - Create webhook');
    console.log('  node create-webhook.js list           - List all webhooks');
    console.log('  node create-webhook.js delete <ID>    - Delete webhook\n');
    console.log('Examples:');
    console.log('  node create-webhook.js create https://991872ef5140.ngrok-free.app/api/webhook/paypal');
    console.log('  node create-webhook.js list');
    console.log('  node create-webhook.js delete WH-xxxxxxxxxxxxx\n');
  }
};

main();