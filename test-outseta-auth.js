import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const OUTSETA_DOMAIN = process.env.OUTSETA_DOMAIN;
const OUTSETA_API_KEY = process.env.OUTSETA_API_KEY?.trim();
const OUTSETA_SECRET_KEY = process.env.OUTSETA_SECRET_KEY?.trim();

async function testAuth() {
  console.log('🔍 Testing Outseta Authentication...');
  console.log('Domain:', OUTSETA_DOMAIN);
  console.log('API Key:', OUTSETA_API_KEY?.substring(0, 10) + '...');
  
//   try {
    // Test 1: Get Plans
    console.log('\n📋 Test 1: Getting plans...');
    const plansResponse = await axios.get(
      `https://${OUTSETA_DOMAIN}/api/v1/billing/plans`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Outseta-Api-Key': OUTSETA_API_KEY,
          'Outseta-Api-Secret': OUTSETA_SECRET_KEY
        }
      }
    );
    console.log('✅ Plans API works! Found', plansResponse.data.items?.length || 0, 'plans');
    
    // Test 2: Get People
    console.log('\n👥 Test 2: Getting people...');
    const peopleResponse = await axios.get(
      `https://${OUTSETA_DOMAIN}/api/v1/crm/people?limit=1`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Outseta-Api-Key': OUTSETA_API_KEY,
          'Outseta-Api-Secret': OUTSETA_SECRET_KEY
        }
      }
    );
    console.log('✅ People API works! Found', peopleResponse.data.items?.length || 0, 'people');
    
    // Test 3: Create Person
    console.log('\n✏️ Test 3: Creating test person...');
    const createResponse = await axios.post(
      `https://${OUTSETA_DOMAIN}/api/v1/crm/people`,
      {
        Email: `test-${Date.now()}@example.com`,
        FirstName: "Test",
        LastName: "User",
        Account: {
          Name: "Test User Account",
          AccountStage: 1
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Outseta-Api-Key': OUTSETA_API_KEY,
          'Outseta-Api-Secret': OUTSETA_SECRET_KEY
        }
      }
    );
    console.log('✅ Create Person API works! Person UID:', createResponse.data.Uid);
    
    console.log('\n🎉 All tests passed! Your Outseta API is working perfectly.');
    
//   } catch (error) {
//     console.error('\n❌ Authentication failed!');
//     console.error('Status:', error.response?.status);
//     console.error('Message:', error.response?.data?.Message || error.message);
//     console.error('Full error:', error.response?.data);
//   }
}

testAuth();