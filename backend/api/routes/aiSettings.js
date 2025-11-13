import express from 'express';
import supabase from '../../config/supabase.js';
import { generateRAGResponse } from '../services/openai.js';
import { searchKnowledgeBase } from '../services/vectorDB.js';

const router = express.Router();

// Default AI settings (fallback when use_global_defaults is true)
const DEFAULT_AI_SETTINGS = {
  model: process.env.OPENAI_MODEL || 'gpt-4o',
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0,
  max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
  embedding_model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  similarity_threshold: parseFloat(process.env.VECTOR_SIMILARITY_THRESHOLD) || 0.7,
  top_k_results: parseInt(process.env.TOP_K_RESULTS) || 5,
  escalation_threshold: 0.5,
  system_prompt: null, // null means use default from openai.js
  use_global_defaults: true
};

// Available AI models with metadata
const AVAILABLE_MODELS = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Latest and most capable OpenAI model with best cost/performance ratio',
    cost_per_1m_input: 2.50,
    cost_per_1m_output: 10.00,
    speed: 'fast',
    quality: 'excellent',
    recommended: true
  },
  {
    id: 'gpt-4o-2024-11-20',
    name: 'GPT-4o (November 2024)',
    provider: 'openai',
    description: 'Specific version of GPT-4o with November 2024 improvements',
    cost_per_1m_input: 2.50,
    cost_per_1m_output: 10.00,
    speed: 'fast',
    quality: 'excellent',
    recommended: false
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Faster and more affordable version, 85-90% of GPT-4o quality',
    cost_per_1m_input: 0.15,
    cost_per_1m_output: 0.60,
    speed: 'very-fast',
    quality: 'good',
    recommended: false
  }
];

/**
 * GET /api/ai-settings/models
 * Get list of available AI models with pricing info
 */
router.get('/models', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        models: AVAILABLE_MODELS,
        default: DEFAULT_AI_SETTINGS.model
      }
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available models'
    });
  }
});

/**
 * GET /api/ai-settings/companies/:companyId
 * Get AI settings for a specific company
 */
router.get('/companies/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

    const { data: company, error } = await supabase
      .from('companies')
      .select('id, name, ai_settings')
      .eq('id', companyId)
      .single();

    if (error || !company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Merge company settings with defaults
    const effectiveSettings = {
      ...DEFAULT_AI_SETTINGS,
      ...(company.ai_settings || {})
    };

    res.json({
      success: true,
      data: {
        company_id: company.id,
        company_name: company.name,
        settings: effectiveSettings,
        defaults: DEFAULT_AI_SETTINGS
      }
    });
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AI settings'
    });
  }
});

/**
 * PUT /api/ai-settings/companies/:companyId
 * Update AI settings for a specific company
 */
router.put('/companies/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid settings object'
      });
    }

    // Validate settings before saving
    const validationErrors = validateAISettings(settings);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid AI settings',
        details: validationErrors
      });
    }

    // Update company AI settings
    const { data, error } = await supabase
      .from('companies')
      .update({
        ai_settings: settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', companyId)
      .select('id, name, ai_settings')
      .single();

    if (error) {
      console.error('Error updating AI settings:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update AI settings',
        details: error.message
      });
    }

    res.json({
      success: true,
      data: {
        company_id: data.id,
        company_name: data.name,
        settings: data.ai_settings
      },
      message: 'AI settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update AI settings'
    });
  }
});

/**
 * POST /api/ai-settings/test
 * Test AI configuration with a sample query
 */
router.post('/test', async (req, res) => {
  try {
    const { companyId, testQuery, settings } = req.body;

    if (!companyId || !testQuery) {
      return res.status(400).json({
        success: false,
        error: 'companyId and testQuery are required'
      });
    }

    // Get company's supabase client
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('schema_name')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Create company-specific Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const companySupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        db: { schema: company.schema_name }
      }
    );

    // Use provided settings or fetch from database
    const testSettings = settings || DEFAULT_AI_SETTINGS;

    // Search knowledge base using test settings
    const contexts = await searchKnowledgeBase(
      testQuery,
      companySupabase,
      testSettings.top_k_results || 5,
      testSettings.similarity_threshold || 0.7,
      null,
      null // No policy type filtering for test
    );

    // Create a mock employee for testing
    const mockEmployee = {
      name: 'Test Employee',
      employee_id: 'TEST001',
      policy_type: 'Premium',
      coverage_limit: 50000,
      annual_claim_limit: 10000,
      dental_limit: 2000,
      optical_limit: 500,
      policy_start_date: '2024-01-01',
      policy_end_date: '2024-12-31'
    };

    // Generate response using test settings
    const response = await generateRAGResponse(
      testQuery,
      contexts,
      mockEmployee,
      [], // No conversation history for test
      testSettings // Pass custom settings
    );

    res.json({
      success: true,
      data: {
        query: testQuery,
        answer: response.answer,
        confidence: response.confidence,
        sources: response.sources,
        knowledgeMatch: response.knowledgeMatch,
        model_used: testSettings.model,
        tokens_used: response.tokens,
        contexts_found: contexts.length
      }
    });
  } catch (error) {
    console.error('Error testing AI configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test AI configuration',
      details: error.message
    });
  }
});

/**
 * POST /api/ai-settings/reset
 * Reset AI settings to global defaults for a company
 */
router.post('/reset/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

    const { data, error } = await supabase
      .from('companies')
      .update({
        ai_settings: DEFAULT_AI_SETTINGS,
        updated_at: new Date().toISOString()
      })
      .eq('id', companyId)
      .select('id, name, ai_settings')
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to reset AI settings',
        details: error.message
      });
    }

    res.json({
      success: true,
      data: {
        company_id: data.id,
        company_name: data.name,
        settings: data.ai_settings
      },
      message: 'AI settings reset to defaults'
    });
  } catch (error) {
    console.error('Error resetting AI settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset AI settings'
    });
  }
});

/**
 * GET /api/ai-settings/defaults
 * Get global default AI settings
 */
router.get('/defaults', async (req, res) => {
  try {
    res.json({
      success: true,
      data: DEFAULT_AI_SETTINGS
    });
  } catch (error) {
    console.error('Error fetching defaults:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch default settings'
    });
  }
});

/**
 * Validate AI settings object
 * @param {Object} settings - AI settings to validate
 * @returns {Array} - Array of validation error messages
 */
function validateAISettings(settings) {
  const errors = [];

  // Validate model
  if (settings.model) {
    const validModels = AVAILABLE_MODELS.map(m => m.id);
    if (!validModels.includes(settings.model)) {
      errors.push(`Invalid model: ${settings.model}. Must be one of: ${validModels.join(', ')}`);
    }
  }

  // Validate temperature
  if (settings.temperature !== undefined) {
    const temp = parseFloat(settings.temperature);
    if (isNaN(temp) || temp < 0 || temp > 1) {
      errors.push('Temperature must be a number between 0 and 1');
    }
  }

  // Validate max_tokens
  if (settings.max_tokens !== undefined) {
    const tokens = parseInt(settings.max_tokens);
    if (isNaN(tokens) || tokens < 1 || tokens > 16000) {
      errors.push('max_tokens must be an integer between 1 and 16000');
    }
  }

  // Validate similarity_threshold
  if (settings.similarity_threshold !== undefined) {
    const threshold = parseFloat(settings.similarity_threshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      errors.push('similarity_threshold must be a number between 0 and 1');
    }
  }

  // Validate top_k_results
  if (settings.top_k_results !== undefined) {
    const topK = parseInt(settings.top_k_results);
    if (isNaN(topK) || topK < 1 || topK > 20) {
      errors.push('top_k_results must be an integer between 1 and 20');
    }
  }

  // Validate escalation_threshold
  if (settings.escalation_threshold !== undefined) {
    const threshold = parseFloat(settings.escalation_threshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      errors.push('escalation_threshold must be a number between 0 and 1');
    }
  }

  // Validate system_prompt (if provided)
  if (settings.system_prompt !== null && settings.system_prompt !== undefined) {
    if (typeof settings.system_prompt !== 'string') {
      errors.push('system_prompt must be a string');
    } else if (settings.system_prompt.length > 50000) {
      errors.push('system_prompt must be less than 50000 characters');
    }
  }

  return errors;
}

export default router;
