import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// ============================================
// GET PAYPAL ACCESS TOKEN
// ============================================
const getAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not found in .env file');
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
};

// ============================================
// CREATE PRODUCT
// ============================================
const createProduct = async (accessToken, name, description) => {
  const baseURL = process.env.NODE_ENV === 'production' 
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  const product = {
    name: name,
    description: description,
    type: 'SERVICE',
    category: 'SOFTWARE',
    image_url: 'https://example.com/logo.png', // Optional: add your logo URL
    home_url: 'https://example.com' // Optional: add your website
  };

  const response = await fetch(`${baseURL}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(product)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create product: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.id;
};

// ============================================
// CREATE SUBSCRIPTION PLAN
// ============================================
const createPlan = async (accessToken, productId, planName, description, price, interval) => {
  const baseURL = process.env.NODE_ENV === 'production' 
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  const intervalUnit = interval === 'YEAR' ? 'YEAR' : 'MONTH';

  const plan = {
    product_id: productId,
    name: planName,
    description: description,
    status: 'ACTIVE',
    billing_cycles: [
      {
        frequency: {
          interval_unit: intervalUnit,
          interval_count: 1
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0, // 0 = infinite
        pricing_scheme: {
          fixed_price: {
            value: price,
            currency_code: 'USD'
          }
        }
      }
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: {
        value: '0',
        currency_code: 'USD'
      },
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3
    }
  };

  const response = await fetch(`${baseURL}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(plan)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create plan: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.id;
};

// ============================================
// MAIN FUNCTION
// ============================================
const main = async () => {
  console.log('🚀 Creating PayPal Subscription Plans...\n');

  try {
    // Get access token
    console.log('1️⃣  Getting PayPal access token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained\n');

    // Create products
    console.log('2️⃣  Creating products...');
    
    const coachProductId = await createProduct(
      accessToken,
      'JucoPipeline Coach Subscription',
      'Access to JucoPipeline platform for Coaches'
    );
    console.log(`✅ Coach product created: ${coachProductId}`);

    const scoutProductId = await createProduct(
      accessToken,
      'JucoPipeline Scout Subscription',
      'Access to JucoPipeline platform for Scouts'
    );
    console.log(`✅ Scout product created: ${scoutProductId}\n`);

    // Create plans
    console.log('3️⃣  Creating subscription plans...\n');

    const coachYearlyPlanId = await createPlan(
      accessToken,
      coachProductId,
      '4 YEAR COACH',
      'Annual subscription for Coach access',
      '9.99',
      'YEAR'
    );
    console.log(`✅ Coach Yearly Plan: ${coachYearlyPlanId}`);

    const coachMonthlyPlanId = await createPlan(
      accessToken,
      coachProductId,
      'MONTHLY COACH',
      'Monthly subscription for Coach access',
      '1.99',
      'MONTH'
    );
    console.log(`✅ Coach Monthly Plan: ${coachMonthlyPlanId}`);

    const scoutYearlyPlanId = await createPlan(
      accessToken,
      scoutProductId,
      'MLD SCOUT',
      'Annual subscription for Scout access',
      '9.99',
      'YEAR'
    );
    console.log(`✅ Scout Yearly Plan: ${scoutYearlyPlanId}`);

    const scoutMonthlyPlanId = await createPlan(
      accessToken,
      scoutProductId,
      'MONTHLY SCOUT',
      'Monthly subscription for Scout access',
      '1.99',
      'MONTH'
    );
    console.log(`✅ Scout Monthly Plan: ${scoutMonthlyPlanId}\n`);

    // Print summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 SUCCESS! All plans created successfully!\n');
    console.log('📋 Add these to your .env file:\n');
    console.log('# PayPal Plan IDs');
    console.log(`PAYPAL_COACH_YEARLY_PLAN_ID=${coachYearlyPlanId}`);
    console.log(`PAYPAL_COACH_MONTHLY_PLAN_ID=${coachMonthlyPlanId}`);
    console.log(`PAYPAL_SCOUT_YEARLY_PLAN_ID=${scoutYearlyPlanId}`);
    console.log(`PAYPAL_SCOUT_MONTHLY_PLAN_ID=${scoutMonthlyPlanId}`);
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('\n✅ Next steps:');
    console.log('1. Copy the Plan IDs above to your .env file');
    console.log('2. Restart your server: npm start');
    console.log('3. Test creating a subscription\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nPlease check:');
    console.error('1. PAYPAL_CLIENT_ID is correct in .env');
    console.error('2. PAYPAL_CLIENT_SECRET is correct in .env');
    console.error('3. You are using Sandbox credentials (not Live)');
    console.error('4. Your PayPal app has the correct permissions\n');
  }
};

// Run the script
main();