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
    console.error('Troubleshooting:');
    console.error('1. Verify Azure credentials in .env file');
    console.error('2. Check email addresses in .env (FROM and TO)');
    console.error('3. Ensure Azure AD app has Mail.Send permission');
    console.error('4. Verify admin consent has been granted');
    process.exit(1);
  });
