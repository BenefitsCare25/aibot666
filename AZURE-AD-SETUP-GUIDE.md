# Azure AD Setup Guide for LOG Request Email Feature (Delegated Permissions)

This guide will help you configure Azure AD with **delegated permissions** to enable email sending via Microsoft Graph API using a service account.

## Current Error

```
GraphError: Access is denied. Check credentials and try again.
statusCode: 403
code: ErrorAccessDenied
```

This means your Azure AD app needs proper delegated permissions configuration with a service account.

---

## 🎯 Authentication Approach: Delegated Permissions with Service Account

Since you're using **Delegated permissions**, we use a **service account** (dedicated user account) to send emails on behalf of the organization.

**How it works:**
1. Create a dedicated service account (e.g., `notifications@yourcompany.com`)
2. Configure Azure AD app with delegated `Mail.Send` permission
3. Application authenticates as the service account using username/password
4. Emails are sent from the service account's mailbox

---

## Step-by-Step Azure AD Configuration

### Step 1: Create Service Account

1. Go to [Microsoft 365 Admin Center](https://admin.microsoft.com)
2. Navigate to **Users** → **Active users**
3. Click **Add a user**
4. Create account:
   - **Username**: `notifications@yourcompany.com` (or similar)
   - **Display name**: "Chatbot Notifications"
   - **Password**: Set a strong password and **disable password expiration**
5. Assign a license (at minimum, Exchange Online Plan 1 or Microsoft 365 Business Basic)
6. **Important**: Disable MFA (Multi-Factor Authentication) for this service account
   - Go to user → Security → MFA status → Disable
7. Save the username and password securely

### Step 2: Navigate to Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Sign in with your admin account
3. Search for "App registrations" in the top search bar
4. Click on **App registrations**

### Step 3: Find Your Application

1. Look for your app with Client ID: `d5042b07-f7dc-4706-bf6f-847a7bd1538d`
2. Click on the app name to open it

### Step 4: Configure Authentication Settings

**Note**: With the ROPC (Resource Owner Password Credentials) flow using client_secret, public client flows are NOT required.

1. In the left sidebar, click **Authentication**
2. No changes needed - the app uses confidential client authentication with client_secret
3. Verify that you have a valid client secret in **Certificates & secrets**

### Step 5: Add API Permissions (Delegated)

1. In the left sidebar, click **API permissions**
2. You should already have delegated permissions. Verify:
   - **Mail.Send** (Delegated)
   - **User.Read** (Delegated)
3. If not present, add them:
   - Click **+ Add a permission**
   - Select **Microsoft Graph**
   - Select **Delegated permissions** (NOT Application)
   - Search for `Mail.Send` and `User.Read`
   - Check both boxes
   - Click **Add permissions**

### Step 6: Grant Admin Consent (If Required)

1. Still on the **API permissions** page
2. If you see "Admin consent required" = Yes:
   - Click **"Grant admin consent for [Your Organization]"**
   - Click **Yes** when prompted
3. Wait for the status to show **"Granted for [Your Organization]"** with green checkmark ✅

### Step 7: Verify Permissions

After configuration, you should see:

| Permission | Type | Admin Consent Required | Status |
|------------|------|------------------------|--------|
| Mail.Send | Delegated | Yes | ✅ Granted for [Org] |
| User.Read | Delegated | No | ✅ Granted for [Org] |

---

## Alternative: Use Shared Mailbox

If your organization restricts `Mail.Send` permission, you can use a shared mailbox approach:

### Option A: Application Access Policy

1. Create a shared mailbox (e.g., `notifications@yourcompany.com`)
2. Use PowerShell to grant app access to specific mailbox:

```powershell
# Connect to Exchange Online
Connect-ExchangeOnline

# Create application access policy
New-ApplicationAccessPolicy -AppId d5042b07-f7dc-4706-bf6f-847a7bd1538d -PolicyScopeGroupId notifications@yourcompany.com -AccessRight RestrictAccess -Description "Restrict app to notifications mailbox only"
```

### Option B: Use Mail.Send.Shared Permission

1. Instead of `Mail.Send`, add `Mail.Send.Shared` permission
2. Grant admin consent
3. Update your `.env` to use the shared mailbox email in `LOG_REQUEST_EMAIL_FROM`

---

## Environment Variables Configuration

After Azure AD is configured, update your Render environment variables:

### Required Variables (Delegated Permissions)

```bash
# Azure AD Configuration
AZURE_CLIENT_ID=d5042b07-f7dc-4706-bf6f-847a7bd1538d
AZURE_CLIENT_SECRET=<your-client-secret>
AZURE_TENANT_ID=496f1a0a-6a4a-4436-b4b3-fdb75d235254

# Service Account Credentials (for Delegated Permissions)
AZURE_SERVICE_ACCOUNT_USERNAME=notifications@yourcompany.com
AZURE_SERVICE_ACCOUNT_PASSWORD=<service-account-password>

# Email Configuration
LOG_REQUEST_EMAIL_FROM=notifications@yourcompany.com
LOG_REQUEST_EMAIL_TO=support-team@yourcompany.com
LOG_REQUEST_KEYWORDS=request log,send logs,need log
```

**Important Notes:**
- `AZURE_SERVICE_ACCOUNT_USERNAME` = The service account email you created in Step 1
- `AZURE_SERVICE_ACCOUNT_PASSWORD` = The password for that service account
- `LOG_REQUEST_EMAIL_FROM` should match the service account email
- Ensure MFA is disabled for the service account

### How to Set on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your web service
3. Go to **Environment** tab
4. Add each variable above
5. Click **Save Changes**
6. Render will automatically redeploy your service

---

## Testing the Configuration

After setting up Azure AD and environment variables:

### Test 1: Check Environment Variables

```bash
# SSH into your Render instance or check logs
echo $AZURE_CLIENT_ID
echo $AZURE_TENANT_ID
# Do NOT echo AZURE_CLIENT_SECRET for security
```

### Test 2: Test Email Locally (if you have backend running locally)

```bash
cd backend
node test-email.js
```

Expected output:
```
Testing Email Service...
📧 Test 1: Sending LOG Request Email to Support Team
✓ LOG request email sent successfully!
📧 Test 2: Sending Acknowledgment Email to User
✓ Acknowledgment email sent successfully!
✓ All tests completed successfully!
```

### Test 3: Test from Widget

1. Open your chatbot
2. Click the paperclip icon 📎
3. Attach a test file
4. Click "Request LOG" button
5. Enter your email
6. Click "Request LOG" again
7. Check both:
   - Support team email inbox (should receive LOG request)
   - Your email inbox (should receive acknowledgment)

---

## Troubleshooting

### Issue: "Access is denied" (403)

**Solution**:
- Verify admin consent granted for delegated permissions (Step 6)
- Ensure "Allow public client flows" is enabled (Step 4)
- Verify service account has correct permissions

### Issue: "Invalid username or password" (AADSTS50126)

**Solution**:
- Double-check `AZURE_SERVICE_ACCOUNT_USERNAME` and `AZURE_SERVICE_ACCOUNT_PASSWORD`
- Ensure the service account is active in Microsoft 365
- Verify MFA is disabled for the service account

### Issue: "Multi-factor authentication required" (AADSTS50076)

**Solution**: MFA must be disabled for the service account. Go to Microsoft 365 Admin Center → Users → Select service account → Security → Disable MFA.

### Issue: "Public client flows not allowed" or "client_secret required" (AADSTS7000218)

**Solution**: This error is now handled by using confidential client flow with client_secret. Ensure:
- `AZURE_CLIENT_SECRET` is set correctly in Render environment variables
- Client secret is valid and not expired in Azure Portal

### Issue: "Invalid client secret" (401)

**Solution**: The `AZURE_CLIENT_SECRET` is wrong or expired. Generate a new client secret:
1. Azure Portal → App registrations → Your app
2. Certificates & secrets → + New client secret
3. Copy the secret value immediately (you won't see it again)
4. Update Render environment variable

### Issue: "Tenant does not exist" (400)

**Solution**: The `AZURE_TENANT_ID` is incorrect. Verify it in Azure Portal.

### Issue: Emails not sending but no errors

**Solution**:
- Check that `LOG_REQUEST_EMAIL_FROM` matches the service account email
- Verify the service account has an active Exchange Online license
- Check the service account mailbox is accessible

### Issue: File upload works but email fails

**Solution**: File upload uses local filesystem, email needs Azure AD. Focus on Azure AD configuration and service account setup.

---

## Security Best Practices

1. **Never commit secrets**: Keep `.env` in `.gitignore`
2. **Rotate secrets regularly**: Change client secret every 6-12 months
3. **Use least privilege**: Only grant `Mail.Send` permission, nothing more
4. **Monitor usage**: Check Azure AD sign-in logs regularly
5. **Use managed identity**: On Azure App Service, use managed identity instead of client secret

---

## Next Steps

After Azure AD is configured:

1. ✅ Grant admin consent for Mail.Send permission
2. ✅ Set environment variables on Render
3. ✅ Redeploy your Render service
4. ✅ Test email functionality
5. ✅ Monitor logs for any errors

---

## Need Help?

If you're still having issues:

1. **Check Render Logs**: Dashboard → Your Service → Logs
2. **Check Azure AD Logs**: Azure Portal → Azure Active Directory → Sign-in logs
3. **Verify Permissions**: Azure Portal → App registrations → Your app → API permissions
4. **Test Locally First**: Run `node test-email.js` on your local machine with correct credentials

---

**Last Updated**: October 24, 2025
**Status**: Ready for configuration
