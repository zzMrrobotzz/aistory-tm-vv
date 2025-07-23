const mongoose = require('./apps/backend/node_modules/mongoose');

const axios = require('./apps/backend/node_modules/axios').default;

async function checkPackages() {
  console.log('📦 Checking package names in database...\n');
  
  try {
    const response = await axios.get('https://aistory-backend.onrender.com/api/packages');
    const packages = response.data.packages;
    
    console.log('Current packages:');
    packages.forEach(p => {
      console.log(`- Name: '${p.name}' (length: ${p.name.length})`);
      console.log(`  PlanId: ${p.planId}`);
      console.log(`  Price: ${p.price}`);
      console.log('---');
    });
  } catch (error) {
    console.error('Error fetching packages:', error.message);
  }
}

checkPackages();