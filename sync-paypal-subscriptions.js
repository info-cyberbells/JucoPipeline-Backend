import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fetch from 'node-fetch';
import connectDB from "./src/config/db.js";
dotenv.config();

// PayPal API helper
const getAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const baseURL = 'https://api-m.sandbox.paypal.com';

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

const getPayPalSubscription = async (accessToken, subscriptionId) => {
  const baseURL = 'https://api-m.sandbox.paypal.com';

  const response = await fetch(`${baseURL}/v1/billing/subscriptions/${subscriptionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`PayPal API error: ${response.status}`);
  }

  return await response.json();
};

// Subscription Schema (simplified)
const subscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paypalSubscriptionId: String,
  plan: String,
  status: String,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: Boolean,
  canceledAt: Date,
  paymentProvider: String
}, { timestamps: true });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

// Main sync function
const syncSubscriptions = async () => {
  console.log('🔄 Starting PayPal Subscription Sync...\n');

  try {
    // Connect to MongoDB
    // await mongoose.connect(process.env.MONGODB_URI);
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Get PayPal access token
    const accessToken = await getAccessToken();
    console.log('✅ Connected to PayPal\n');

    // Find all PayPal subscriptions
    const subscriptions = await Subscription.find({
      paymentProvider: 'paypal',
      paypalSubscriptionId: { $exists: true, $ne: null }
    });

    console.log(`📋 Found ${subscriptions.length} PayPal subscriptions\n`);

    let syncedCount = 0;
    let errorCount = 0;

    for (const sub of subscriptions) {
      try {
        console.log(`Processing: ${sub.paypalSubscriptionId}`);
        console.log(`  Current DB status: ${sub.status}`);

        // Get status from PayPal
        const paypalSub = await getPayPalSubscription(accessToken, sub.paypalSubscriptionId);
        const paypalStatus = paypalSub.status.toLowerCase();

        console.log(`  PayPal status: ${paypalStatus}`);

        // Check if out of sync
        if (sub.status !== paypalStatus) {
          console.log(`  ⚠️  OUT OF SYNC - Updating...`);

          // Update subscription
          sub.status = paypalStatus;

          // Update period dates if available
          if (paypalSub.billing_info?.next_billing_time) {
            sub.currentPeriodEnd = new Date(paypalSub.billing_info.next_billing_time);
          }

          // Set cancellation info if cancelled
          if (paypalStatus === 'cancelled' && !sub.canceledAt) {
            sub.canceledAt = new Date();
            sub.cancelAtPeriodEnd = true;
          }

          await sub.save();

          // Update user
          const User = mongoose.model('User');
          await User.findByIdAndUpdate(sub.user, {
            subscriptionStatus: paypalStatus,
            subscriptionEndDate: sub.currentPeriodEnd
          });

          console.log(`  ✅ SYNCED: ${sub.status} → ${paypalStatus}`);
          syncedCount++;
        } else {
          console.log(`  ✅ Already in sync`);
        }

        console.log('');

      } catch (error) {
        console.error(`  ❌ ERROR: ${error.message}\n`);
        errorCount++;
      }
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 Sync Summary:');
    console.log(`   Total subscriptions: ${subscriptions.length}`);
    console.log(`   Synced: ${syncedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Already in sync: ${subscriptions.length - syncedCount - errorCount}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (syncedCount > 0) {
      console.log('✅ Database is now in sync with PayPal!');
    } else {
      console.log('✅ All subscriptions were already in sync!');
    }

  } catch (error) {
    console.error('\n❌ Sync Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
};

// Run the sync
syncSubscriptions();