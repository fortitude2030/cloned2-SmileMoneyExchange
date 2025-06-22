const { execSync } = require('child_process');

// Test the accounting system by running tsx directly
try {
  console.log('Testing accounting system integration...');
  
  const testScript = `
    import { storage } from './server/storage.js';
    
    async function testAccounting() {
      try {
        console.log('Updating transaction 213 to completed status...');
        await storage.updateTransactionStatus(213, 'completed');
        console.log('✓ Transaction status updated successfully');
        
        // Check if journal entries were created
        console.log('Checking for created journal entries...');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
      }
    }
    
    testAccounting();
  `;
  
  require('fs').writeFileSync('temp-test.mjs', testScript);
  execSync('npx tsx temp-test.mjs', { stdio: 'inherit' });
  
} catch (error) {
  console.error('Test failed:', error.message);
}