/**
 * Seed RBAC Permissions
 * Seeds only the permissions data (for when tables exist but are empty)
 */

import { postgres } from '../config/supabase.js';

async function seedPermissions() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Seeding RBAC Permissions');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!postgres) {
    console.error('❌ PostgreSQL connection not configured');
    process.exit(1);
  }

  const client = await postgres.connect();

  try {
    await client.query('BEGIN');

    // Check if permissions already exist
    const checkResult = await client.query('SELECT COUNT(*) FROM public.permissions');
    const existingCount = parseInt(checkResult.rows[0].count);

    if (existingCount > 0) {
      console.log(`⚠️  ${existingCount} permissions already exist in database`);
      console.log('Skipping seed to avoid duplicates.\n');
      await client.query('ROLLBACK');
      client.release();
      await postgres.end();
      process.exit(0);
    }

    console.log('📝 Inserting 47 permissions...\n');

    // Insert all permissions
    const permissions = [
      // Dashboard permissions
      { code: 'dashboard.view', resource: 'dashboard', action: 'view', description: 'View dashboard statistics and metrics' },
      { code: 'dashboard.export', resource: 'dashboard', action: 'export', description: 'Export dashboard data' },

      // Employee permissions
      { code: 'employees.view', resource: 'employees', action: 'view', description: 'View employee list' },
      { code: 'employees.create', resource: 'employees', action: 'create', description: 'Add new employees' },
      { code: 'employees.edit', resource: 'employees', action: 'edit', description: 'Edit employee information' },
      { code: 'employees.delete', resource: 'employees', action: 'delete', description: 'Delete employees' },
      { code: 'employees.upload', resource: 'employees', action: 'upload', description: 'Bulk upload employees via CSV/Excel' },
      { code: 'employees.export', resource: 'employees', action: 'export', description: 'Export employee data' },

      // Knowledge Base permissions
      { code: 'knowledge.view', resource: 'knowledge', action: 'view', description: 'View knowledge base articles' },
      { code: 'knowledge.create', resource: 'knowledge', action: 'create', description: 'Create new knowledge articles' },
      { code: 'knowledge.edit', resource: 'knowledge', action: 'edit', description: 'Edit existing articles' },
      { code: 'knowledge.delete', resource: 'knowledge', action: 'delete', description: 'Delete articles' },
      { code: 'knowledge.upload', resource: 'knowledge', action: 'upload', description: 'Upload documents to knowledge base' },

      // Quick Questions permissions
      { code: 'quick_questions.view', resource: 'quick_questions', action: 'view', description: 'View quick questions and answers' },
      { code: 'quick_questions.create', resource: 'quick_questions', action: 'create', description: 'Create new quick questions' },
      { code: 'quick_questions.edit', resource: 'quick_questions', action: 'edit', description: 'Edit quick questions' },
      { code: 'quick_questions.delete', resource: 'quick_questions', action: 'delete', description: 'Delete quick questions' },

      // Chat History permissions
      { code: 'chat_history.view', resource: 'chat_history', action: 'view', description: 'View chat conversation history' },
      { code: 'chat_history.export', resource: 'chat_history', action: 'export', description: 'Export chat history' },
      { code: 'chat_history.delete', resource: 'chat_history', action: 'delete', description: 'Delete chat history entries' },

      // Escalations permissions
      { code: 'escalations.view', resource: 'escalations', action: 'view', description: 'View escalated chat requests' },
      { code: 'escalations.resolve', resource: 'escalations', action: 'resolve', description: 'Mark escalations as resolved' },
      { code: 'escalations.delete', resource: 'escalations', action: 'delete', description: 'Delete escalation records' },

      // Companies permissions
      { code: 'companies.view', resource: 'companies', action: 'view', description: 'View company list' },
      { code: 'companies.create', resource: 'companies', action: 'create', description: 'Create new companies' },
      { code: 'companies.edit', resource: 'companies', action: 'edit', description: 'Edit company information' },
      { code: 'companies.delete', resource: 'companies', action: 'delete', description: 'Delete companies' },

      // AI Settings permissions (Super Admin only)
      { code: 'ai_settings.view', resource: 'ai_settings', action: 'view', description: 'View AI configuration settings' },
      { code: 'ai_settings.edit', resource: 'ai_settings', action: 'edit', description: 'Modify AI model and prompt settings' },

      // Admin Users permissions (Super Admin only)
      { code: 'admin_users.view', resource: 'admin_users', action: 'view', description: 'View admin user list' },
      { code: 'admin_users.create', resource: 'admin_users', action: 'create', description: 'Create new admin users' },
      { code: 'admin_users.edit', resource: 'admin_users', action: 'edit', description: 'Edit admin user details' },
      { code: 'admin_users.delete', resource: 'admin_users', action: 'delete', description: 'Delete admin users' },
      { code: 'admin_users.reset_password', resource: 'admin_users', action: 'reset_password', description: 'Reset admin user passwords' },

      // Roles permissions (Super Admin only)
      { code: 'roles.view', resource: 'roles', action: 'view', description: 'View roles and permissions' },
      { code: 'roles.create', resource: 'roles', action: 'create', description: 'Create custom roles' },
      { code: 'roles.edit', resource: 'roles', action: 'edit', description: 'Edit role details and permissions' },
      { code: 'roles.delete', resource: 'roles', action: 'delete', description: 'Delete custom roles' },
      { code: 'roles.assign', resource: 'roles', action: 'assign', description: 'Assign roles to users' },

      // System permissions (Super Admin only)
      { code: 'system.audit_logs', resource: 'system', action: 'audit_logs', description: 'View system audit logs' },
      { code: 'system.settings', resource: 'system', action: 'settings', description: 'Modify system-wide settings' },
      { code: 'system.backup', resource: 'system', action: 'backup', description: 'Create and restore system backups' },
      { code: 'system.maintenance', resource: 'system', action: 'maintenance', description: 'Perform system maintenance operations' },

      // Widget permissions
      { code: 'widget.configure', resource: 'widget', action: 'configure', description: 'Configure chat widget appearance and behavior' },
      { code: 'widget.embed', resource: 'widget', action: 'embed', description: 'Generate and view widget embed codes' },
      { code: 'widget.analytics', resource: 'widget', action: 'analytics', description: 'View widget usage analytics' }
    ];

    for (const perm of permissions) {
      await client.query(
        'INSERT INTO public.permissions (code, resource, action, description) VALUES ($1, $2, $3, $4)',
        [perm.code, perm.resource, perm.action, perm.description]
      );
    }

    console.log(`✓ Inserted ${permissions.length} permissions\n`);

    // Get Super Admin role ID
    const roleResult = await client.query(
      "SELECT id FROM public.roles WHERE name = 'Super Admin' AND is_system = true LIMIT 1"
    );

    if (roleResult.rows.length > 0) {
      const superAdminRoleId = roleResult.rows[0].id;
      console.log(`📝 Assigning all permissions to Super Admin role...\n`);

      // Get all permission IDs
      const permIdsResult = await client.query('SELECT id FROM public.permissions');

      // Assign all permissions to Super Admin
      for (const permRow of permIdsResult.rows) {
        await client.query(
          'INSERT INTO public.role_permissions (role_id, permission_id) VALUES ($1, $2)',
          [superAdminRoleId, permRow.id]
        );
      }

      console.log(`✓ Assigned ${permIdsResult.rows.length} permissions to Super Admin\n`);
    } else {
      console.log('⚠️  Super Admin role not found, skipping permission assignment\n');
    }

    await client.query('COMMIT');

    console.log('═══════════════════════════════════════════════════════');
    console.log('  ✅ Permissions seeded successfully!');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('You can now refresh the Roles page to see permissions.\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seeding failed:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    client.release();
    await postgres.end();
  }
}

seedPermissions();
