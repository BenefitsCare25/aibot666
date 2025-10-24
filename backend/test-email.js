import { sendLogRequestEmail, sendAcknowledgmentEmail } from './api/services/email.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('Testing Email Service...\n');

// Test data
const testData = {
  employee: {
    name: 'John Doe',
    employee_id: 'EMP001',
    policy_type: 'Health',
    coverage_limit: 50000,
    email: 'john.doe@example.com'
  },
  conversationHistory: [
    { role: 'user', content: 'What is my coverage?', created_at: new Date().toISOString() },
    { role: 'assistant', content: 'Your coverage is $50,000', created_at: new Date().toISOString() },
    { role: 'user', content: 'Can I request LOG for review?', created_at: new Date().toISOString() }
  ],
  conversationId: 'test-conversation-' + Date.now(),
  requestType: 'button',
  requestMessage: 'User requested LOG for review',
  attachments: []
};

console.log('📧 Test 1: Sending LOG Request Email to Support Team');
console.log('═'.repeat(60));

sendLogRequestEmail(testData)
  .then((result) => {
    console.log('✓ LOG request email sent successfully!');
    console.log('  Email sent at:', result.emailSentAt);
    console.log('  From:', process.env.LOG_REQUEST_EMAIL_FROM);
    console.log('  To:', process.env.LOG_REQUEST_EMAIL_TO);
    console.log();

    // Test acknowledgment email
    console.log('📧 Test 2: Sending Acknowledgment Email to User');
    console.log('═'.repeat(60));

    return sendAcknowledgmentEmail({
      userEmail: 'test-user@example.com', // Change this to your email for testing
      userName: testData.employee.name,
      conversationId: testData.conversationId,
      attachmentCount: 0
    });
  })
  .then((result) => {
    if (result.success) {
      console.log('✓ Acknowledgment email sent successfully!');
      console.log('  Email sent at:', result.emailSentAt);
      console.log('  To:', 'test-user@example.com');
    } else {
      console.log('⚠ Acknowledgment email skipped:', result.reason || result.error);
    }
    console.log();
    console.log('✓ All tests completed successfully!');
    console.log('═'.repeat(60));
    console.log('Check your email inbox for the test emails.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Test failed:', error.message);
    console.error();
    console.error('Troubleshooting (Delegated Permissions):');
    console.error('1. Verify Azure service account credentials in .env:');
    console.error('   - AZURE_SERVICE_ACCOUNT_USERNAME');
    console.error('   - AZURE_SERVICE_ACCOUNT_PASSWORD');
    console.error('2. Ensure service account exists and is active in Microsoft 365');
    console.error('3. Verify MFA is disabled for the service account');
    console.error('4. Check Azure AD app has delegated Mail.Send permission');
    console.error('5. Ensure "Allow public client flows" is enabled in app settings');
    console.error('6. Verify admin consent has been granted for delegated permissions');
    console.error('7. Check that service account has Exchange Online license');
    console.error('\nSee AZURE-AD-SETUP-GUIDE.md for detailed setup instructions');
    process.exit(1);
  });
