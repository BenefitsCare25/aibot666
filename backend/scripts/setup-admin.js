/**
 * Setup Script for Initial Super Admin Account
 * Run this once to create the first Super Admin user
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Generate a secure random password
 * @returns {string} - Secure password
 */
function generateSecurePassword() {
  const length = 16;
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  let password = '';

  // Ensure at least one of each required character type
  password += 'ABCDEFGHJKLMNPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 24)); // Uppercase
  password += 'abcdefghjkmnpqrstuvwxyz'.charAt(Math.floor(Math.random() * 24)); // Lowercase
  password += '23456789'.charAt(Math.floor(Math.random() * 8)); // Number
  password += '!@#$%^&*'.charAt(Math.floor(Math.random() * 8)); // Special char

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Setup initial Super Admin account
 */
async function setupSuperAdmin() {
  try {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Super Admin Setup Script');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    // Check if admin_users table exists
    const { data: tables, error: tableError } = await supabase
      .from('admin_users')
      .select('id')
      .limit(1);

    if (tableError && tableError.code === '42P01') {
      console.error('❌ Error: admin_users table does not exist');
      console.log('');
      console.log('Please run the database migration first:');
      console.log('  psql $DATABASE_URL < backend/migrations/create_admin_auth_tables.sql');
      console.log('');
      process.exit(1);
    }

    // Check if Super Admin already exists
    const { data: existingAdmin, error: checkError } = await supabase
      .from('admin_users')
      .select('username, created_at')
      .eq('role', 'super_admin')
      .limit(1)
      .single();

    if (existingAdmin) {
      console.log('⚠️  Warning: A Super Admin account already exists');
      console.log('');
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Created: ${new Date(existingAdmin.created_at).toLocaleString()}`);
      console.log('');
      console.log('If you need to reset the password, use the admin-assisted password reset feature.');
      console.log('');
      process.exit(0);
    }

    // Generate secure password
    const password = generateSecurePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    // Create Super Admin account
    const { data: newAdmin, error: createError } = await supabase
      .from('admin_users')
      .insert({
        username: 'admin',
        password_hash: passwordHash,
        role: 'super_admin',
        full_name: 'Super Administrator',
        email: 'admin@example.com',
        is_active: true
      })
      .select('id, username, role, created_at')
      .single();

    if (createError) {
      console.error('❌ Error creating Super Admin account:', createError.message);
      process.exit(1);
    }

    // Success! Display credentials
    console.log('✅ Super Admin account created successfully!');
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  SUPER ADMIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log(`  Username: ${newAdmin.username}`);
    console.log(`  Password: ${password}`);
    console.log(`  Role:     ${newAdmin.role}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('⚠️  IMPORTANT SECURITY NOTES:');
    console.log('');
    console.log('  1. Save these credentials securely (password manager recommended)');
    console.log('  2. Change this password after first login');
    console.log('  3. Do not share these credentials');
    console.log('  4. This password will not be shown again');
    console.log('');
    console.log('You can now login at: http://localhost:3001/login');
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupSuperAdmin().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
