import express from 'express';
import supabase from '../../../config/supabase.js';
import { getAllCompanies, getCompanyById, normalizeDomain } from '../../services/companySchema.js';
import {
  createCompanySchema,
  rollbackCompanyCreation,
  softDeleteCompany
} from '../../services/schemaAutomation.js';
import { invalidateCompanyCache } from '../../middleware/companyContext.js';

const router = express.Router();

/**
 * GET /api/admin/companies
 * Get all companies
 */
router.get('/', async (req, res) => {
  try {
    const companies = await getAllCompanies();

    res.json({
      success: true,
      data: companies
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch companies'
    });
  }
});

/**
 * GET /api/admin/companies/:id
 * Get company by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyById(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company'
    });
  }
});

/**
 * POST /api/admin/companies
 * Create new company with automatic schema creation
 */
router.post('/', async (req, res) => {
  try {
    const { name, domain, additional_domains, schema_name, settings } = req.body;

    if (!name || !domain || !schema_name) {
      return res.status(400).json({
        success: false,
        error: 'Name, domain, and schema_name are required'
      });
    }

    // Step 1: Insert company into registry
    const { data: company, error } = await supabase
      .from('companies')
      .insert({
        name,
        domain,
        additional_domains: additional_domains || [],
        schema_name,
        settings: settings || {},
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    // Step 2: Automatically create database schema
    try {
      const schemaResult = await createCompanySchema({
        schemaName: schema_name,
        companyId: company.id,
        adminUser: req.user?.email || 'admin' // Add admin user tracking if available
      });


      res.json({
        success: true,
        data: company,
        schema: {
          created: true,
          name: schemaResult.schemaName,
          duration: schemaResult.duration,
          logId: schemaResult.logId
        }
      });
    } catch (schemaError) {
      // Schema creation failed - rollback company creation
      console.error('[Admin] Schema creation failed, rolling back company:', schemaError);

      try {
        await rollbackCompanyCreation(company.id);
      } catch (rollbackError) {
        console.error('[Admin] Rollback failed:', rollbackError);
        // Return error but note that manual cleanup may be needed
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to create database schema',
        details: schemaError.message,
        company_rolled_back: true,
        note: 'Company registry entry has been removed due to schema creation failure'
      });
    }
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to create company',
      details: error.message
    });
  }
});

/**
 * PUT /api/admin/companies/:id
 * Update company
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, additional_domains, settings, status } = req.body;

    // Get old company data first (to invalidate old domain cache)
    const { data: oldCompany } = await supabase
      .from('companies')
      .select('domain, additional_domains')
      .eq('id', id)
      .single();

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (domain !== undefined) updates.domain = domain;
    if (additional_domains !== undefined) updates.additional_domains = additional_domains;
    if (settings !== undefined) updates.settings = settings;
    if (status !== undefined) updates.status = status;

    const { data: company, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache for old domain(s)
    if (oldCompany) {
      await invalidateCompanyCache(oldCompany.domain);
      if (oldCompany.additional_domains) {
        for (const additionalDomain of oldCompany.additional_domains) {
          await invalidateCompanyCache(additionalDomain);
        }
      }
    }

    // Invalidate cache for new domain(s)
    await invalidateCompanyCache(company.domain);
    if (company.additional_domains) {
      for (const additionalDomain of company.additional_domains) {
        await invalidateCompanyCache(additionalDomain);
      }
    }

    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update company',
      details: error.message
    });
  }
});

/**
 * DELETE /api/admin/companies/:id
 * Soft delete company (mark as inactive, preserve schema and data)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query; // Check if permanent deletion is requested

    // Get company data first (to invalidate cache)
    const { data: companyToDelete } = await supabase
      .from('companies')
      .select('domain, additional_domains')
      .eq('id', id)
      .single();

    if (permanent === 'true') {
      // Hard delete: permanently delete schema and company record
      const { hardDeleteCompany } = await import('../../services/schemaAutomation.js');
      const result = await hardDeleteCompany(id, req.user?.email || 'admin');

      // Invalidate cache for deleted company's domains
      if (companyToDelete) {
        await invalidateCompanyCache(companyToDelete.domain);
        if (companyToDelete.additional_domains) {
          for (const additionalDomain of companyToDelete.additional_domains) {
            await invalidateCompanyCache(additionalDomain);
          }
        }
      }

      res.json({
        success: true,
        message: 'Company permanently deleted',
        data: result,
        note: `Schema "${result.schemaName}" and all data have been permanently deleted. This action cannot be undone.`
      });
    } else {
      // Soft delete: preserve schema and data
      const { softDeleteCompany } = await import('../../services/schemaAutomation.js');
      const company = await softDeleteCompany(id, req.user?.email || 'admin');

      // Invalidate cache for soft deleted company's domains
      if (companyToDelete) {
        await invalidateCompanyCache(companyToDelete.domain);
        if (companyToDelete.additional_domains) {
          for (const additionalDomain of companyToDelete.additional_domains) {
            await invalidateCompanyCache(additionalDomain);
          }
        }
      }

      res.json({
        success: true,
        message: 'Company deactivated successfully',
        data: company,
        note: 'Company marked as inactive. Database schema and all data preserved.'
      });
    }
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to delete company',
      details: error.message
    });
  }
});

/**
 * PATCH /api/admin/companies/:id/status
 * Update company status (active/inactive/suspended)
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status value
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        details: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Update company status
    const { updateCompany } = await import('../../services/companySchema.js');
    const company = await updateCompany(id, { status });

    res.json({
      success: true,
      message: `Company status updated to ${status}`,
      data: company
    });
  } catch (error) {
    console.error('Error updating company status:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update company status',
      details: error.message
    });
  }
});

/**
 * PATCH /api/admin/companies/:id/email-config
 * Update company email configuration for LOG requests
 */
router.patch('/:id/email-config', async (req, res) => {
  try {
    const { id } = req.params;
    const { log_request_email_to, log_request_email_cc, log_request_keywords } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validate TO email format if provided
    if (log_request_email_to !== undefined && log_request_email_to !== null && log_request_email_to.trim() !== '') {
      const emails = log_request_email_to.split(',').map(e => e.trim());

      for (const email of emails) {
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            error: `Invalid TO email format: ${email}`
          });
        }
      }
    }

    // Validate CC email format if provided
    if (log_request_email_cc !== undefined && log_request_email_cc !== null && log_request_email_cc.trim() !== '') {
      const emails = log_request_email_cc.split(',').map(e => e.trim());

      for (const email of emails) {
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            error: `Invalid CC email format: ${email}`
          });
        }
      }
    }

    const updates = {};
    if (log_request_email_to !== undefined) {
      updates.log_request_email_to = log_request_email_to;
    }
    if (log_request_email_cc !== undefined) {
      updates.log_request_email_cc = log_request_email_cc;
    }
    if (log_request_keywords !== undefined) {
      updates.log_request_keywords = log_request_keywords;
    }

    const { data: company, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache for this company
    await invalidateCompanyCache(company.domain);
    if (company.additional_domains) {
      for (const additionalDomain of company.additional_domains) {
        await invalidateCompanyCache(additionalDomain);
      }
    }

    res.json({
      success: true,
      data: company
    });

  } catch (error) {
    console.error('Error updating email configuration:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update email configuration',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/companies/:id/embed-code
 * Get embed code for a company (with SRI integrity hashes)
 */
router.get('/:id/embed-code', async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompanyById(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Get API URL from environment or construct from request
    const apiUrl = process.env.API_URL || process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;

    // Normalize and encode domain for URL (handles paths like benefits-staging.inspro.com.sg/cbre)
    // Normalization strips https://, www., etc. so embed code is clean
    // Domain must be explicitly passed because cross-origin referrer policy strips the path
    const normalizedDomain = normalizeDomain(company.domain);
    const encodedDomain = encodeURIComponent(normalizedDomain);

    // Iframe embed code (sandboxed for maximum security)
    // Uses hosted embed-helper.js for automatic updates and mobile fullscreen support
    const embedCodeIframe = `<!-- ${company.name} AI Chatbot Widget -->
<iframe
  id="chat-widget-iframe"
  src="${apiUrl}/chat?company=${company.id}&domain=${encodedDomain}&color=%233b82f6"
  style="position: fixed; bottom: 16px; right: 16px; width: 200px; height: 80px; border: none; background: transparent; z-index: 9999;"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  allow="clipboard-write"
  allowtransparency="true"
  title="${company.name} Chat Widget">
</iframe>

<!-- Embed Helper Script (handles mobile fullscreen automatically) -->
<script src="${apiUrl}/embed-helper.js"></script>`;

    const instructions = `Implementation Instructions:

1. Copy the embed code above
2. Paste it just before the closing </body> tag in your HTML
3. The widget will automatically appear in the bottom-right corner
4. Users can start chatting immediately

Features:
• Mobile full-screen support (automatic)
• Desktop corner positioning (bottom-right)
• Automatic updates - no code changes needed on your site

Customization:
• Change color by modifying the "color" parameter in the iframe src URL
• Example: color=%23ff0000 for red (use %23 for #)

Need help? Contact your system administrator.`;

    res.json({
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.name,
          domain: company.domain,
          additional_domains: company.additional_domains
        },
        embedCode: {
          iframe: embedCodeIframe
        },
        instructions,
        apiUrl
      }
    });
  } catch (error) {
    console.error('Error generating embed code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate embed code'
    });
  }
});

export default router;
