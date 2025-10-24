# Delegated Permissions Setup - Quick Summary

## ✅ Changes Deployed

The email service has been updated to use **delegated permissions** with a service account instead of application permissions.

---

## 🎯 What You Need To Do Now

### 1. Create Service Account (5 minutes)

Go to [Microsoft 365 Admin Center](https://admin.microsoft.com):

1. **Users** → **Active users** → **Add a user**
2. Create:
   - Username: `notifications@yourcompany.com`
   - Display name: "Chatbot Notifications"
   - Password: Set strong password, **disable expiration**
3. **Assign license**: Exchange Online Plan 1 (or any M365 license with email)
4. **Disable MFA**: User → Security → MFA status → Disable
5. **Save credentials** securely

---

### 2. Configure Azure AD App (5 minutes)

Go to [Azure Portal](https://portal.azure.com):

#### Enable Public Client Flows
1. App registrations → Your app (`d5042b07...`)
2. **Authentication** → Advanced settings
3. **Allow public client flows** = **Yes** ✅
4. Save

#### Verify Delegated Permissions
1. **API permissions** → Check you have:
   - ✅ Mail.Send (Delegated)
   - ✅ User.Read (Delegated)
2. If "Admin consent required" shows, click **"Grant admin consent"**

---

### 3. Update Render Environment Variables (2 minutes)

[Render Dashboard](https://dashboard.render.com) → Your service → Environment:

Add these **new variables**:
```bash
AZURE_SERVICE_ACCOUNT_USERNAME=notifications@yourcompany.com
AZURE_SERVICE_ACCOUNT_PASSWORD=<the-password-you-set>
```

Verify existing:
```bash
AZURE_CLIENT_ID=d5042b07-f7dc-4706-bf6f-847a7bd1538d
AZURE_TENANT_ID=496f1a0a-6a4a-4436-b4b3-fdb75d235254
LOG_REQUEST_EMAIL_FROM=notifications@yourcompany.com
LOG_REQUEST_EMAIL_TO=support-team@yourcompany.com
```

**Save** → Render will auto-deploy

---

### 4. Test (5 minutes)

After Render redeploys:

1. Open your chatbot
2. Click paperclip 📎 → attach a test file
3. Click "Request LOG"
4. Enter your email
5. Click "Request LOG" again
6. Check both email inboxes:
   - ✅ Support team receives LOG request
   - ✅ You receive acknowledgment email

---

## ⚠️ Common Issues

### "Invalid username or password"
- Double-check service account credentials in Render env vars
- Ensure account is active in Microsoft 365

### "Multi-factor authentication required"
- MFA must be disabled for service account
- Microsoft 365 Admin → User → Security → Disable MFA

### "Public client flows not allowed"
- Enable in Azure Portal → App → Authentication → Allow public client flows = Yes

### "Access is denied"
- Verify admin consent granted for delegated permissions
- Check service account has Exchange Online license

---

## 📚 Detailed Documentation

See **AZURE-AD-SETUP-GUIDE.md** for comprehensive step-by-step instructions and troubleshooting.

---

## 🔐 Security Notes

- **Service account security**: Use strong password, disable expiration
- **MFA**: Must be disabled for automation (compensate with strong password)
- **License**: Service account needs Exchange Online license
- **Monitoring**: Check Azure AD sign-in logs regularly
- **Rotation**: Consider password rotation policy (every 6-12 months)

---

## ✅ Checklist

- [ ] Service account created in Microsoft 365
- [ ] Service account has Exchange Online license
- [ ] MFA disabled for service account
- [ ] "Allow public client flows" enabled in Azure AD app
- [ ] Delegated permissions verified (Mail.Send, User.Read)
- [ ] Admin consent granted (if required)
- [ ] Render environment variables updated
- [ ] Render service redeployed
- [ ] Email functionality tested end-to-end

---

**Need help?** Check the detailed troubleshooting in `AZURE-AD-SETUP-GUIDE.md`

**Last Updated**: October 24, 2025
