import { useState, useEffect } from 'react';
import { companyApi } from '../api/companies';
import { aiSettingsApi } from '../api/aiSettings';

const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant for an employee insurance benefits portal. Your role is to help employees understand their insurance coverage, benefits, and claims procedures.

IMPORTANT INSTRUCTIONS:
1. Answer based on the provided context from knowledge base and employee information
2. CONTEXT USAGE PRIORITY: If context is provided from the knowledge base, USE IT to answer:
   - Context has been matched with similarity >{{SIMILARITY_THRESHOLD}} - it is relevant and passed quality threshold
   - When {{CONTEXT_COUNT}} contexts are provided, you MUST use them to answer directly
   - DO NOT ask for clarification when context is provided - the context IS the answer
   - Provide the answer from the context word-for-word when appropriate
3. ONLY escalate if NO context is provided AND you cannot answer from employee information
4. When escalating, say: "For such query, let us check back with the team. You may leave your contact or email address for our team to follow up with you. Thank you."
5. Be specific about policy limits, coverage amounts, and procedures
6. Use clear, professional, and empathetic language

CRITICAL DATA PRIVACY RULES:
- NEVER provide information about OTHER employees
- You can ONLY discuss the logged-in employee's own information
- NEVER search the web or external sources for employee data
- NEVER hallucinate or guess information not explicitly provided in the context

FORMATTING GUIDELINES:
- Use clean, readable formatting with markdown
- Use bullet points (using -) for lists instead of asterisks
- Keep paragraphs short and concise

{{EMPLOYEE_INFO}}

CONTEXT FROM KNOWLEDGE BASE:
{{CONTEXT}}

USER QUESTION:
{{QUERY}}`;

export default function AISettings() {
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Available models
  const [models, setModels] = useState([]);

  // AI Settings
  const [settings, setSettings] = useState({
    model: 'gpt-4o',
    temperature: 0,
    max_tokens: 1000,
    similarity_threshold: 0.7,
    top_k_results: 5,
    escalation_threshold: 0.5,
    system_prompt: null,
    use_global_defaults: true
  });

  // Test interface
  const [testQuery, setTestQuery] = useState('What is my dental coverage?');
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      loadData();
    }
  }, [selectedCompany]);

  const loadCompanies = async () => {
    try {
      const response = await companyApi.getAll();
      if (response.success) {
        setCompanies(response.data);

        // Get selected company from localStorage
        const savedDomain = localStorage.getItem('selected_company_domain');
        const company = response.data.find(c => c.domain === savedDomain) || response.data[0];

        if (company) {
          setSelectedCompany(company);
        }
      }
    } catch (err) {
      console.error('Error loading companies:', err);
      setError('Failed to load companies');
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load available models
      const modelsResponse = await aiSettingsApi.getModels();
      setModels(modelsResponse.data.models || []);

      // Load company settings
      const settingsResponse = await aiSettingsApi.getCompanySettings(selectedCompany.id);
      const loadedSettings = settingsResponse.data.settings || {};

      // If system_prompt is null, initialize it with DEFAULT_SYSTEM_PROMPT for editing
      if (loadedSettings.system_prompt === null || loadedSettings.system_prompt === undefined) {
        loadedSettings.system_prompt = DEFAULT_SYSTEM_PROMPT;
      }

      setSettings(loadedSettings);

    } catch (err) {
      console.error('Error loading AI settings:', err);
      setError(err.response?.data?.error || 'Failed to load AI settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await aiSettingsApi.updateCompanySettings(selectedCompany.id, settings);

      setSuccess('AI settings saved successfully!');
      setTimeout(() => setSuccess(''), 5000);

    } catch (err) {
      console.error('Error saving AI settings:', err);
      const errorDetails = err.response?.data?.details || [];
      setError(errorDetails.length > 0 ? errorDetails.join(', ') : 'Failed to save AI settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setError('');
      setTestResult(null);

      const response = await aiSettingsApi.testConfiguration(
        selectedCompany.id,
        testQuery,
        settings
      );

      setTestResult(response.data);

    } catch (err) {
      console.error('Error testing configuration:', err);
      setError(err.response?.data?.error || 'Failed to test configuration');
    } finally {
      setTesting(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all AI settings to global defaults?')) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await aiSettingsApi.resetSettings(selectedCompany.id);
      setSettings(response.data.settings);

      setSuccess('AI settings reset to defaults successfully!');
      setTimeout(() => setSuccess(''), 5000);

    } catch (err) {
      console.error('Error resetting AI settings:', err);
      setError(err.response?.data?.error || 'Failed to reset AI settings');
    } finally {
      setSaving(false);
    }
  };

  const calculateMonthlyCost = (model, queries = 100000) => {
    const modelData = models.find(m => m.id === model);
    if (!modelData) return null;

    const avgInputTokens = 500;
    const avgOutputTokens = 200;

    const inputCost = (queries * avgInputTokens / 1000000) * modelData.cost_per_1m_input;
    const outputCost = (queries * avgOutputTokens / 1000000) * modelData.cost_per_1m_output;

    return (inputCost + outputCost).toFixed(2);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading AI settings...</div>
      </div>
    );
  }

  if (!selectedCompany) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Please select a company to configure AI settings</div>
      </div>
    );
  }

  const selectedModel = models.find(m => m.id === settings.model);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Configuration</h1>
        <p className="text-gray-600 mt-1">
          Configure AI model, prompts, and parameters for {selectedCompany.name}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Model Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Model Selection</h2>

        <div className="space-y-3">
          {models.map((model) => (
            <label
              key={model.id}
              className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                settings.model === model.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${model.deprecated ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start">
                <input
                  type="radio"
                  name="model"
                  value={model.id}
                  checked={settings.model === model.id}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.name}</span>
                    {model.recommended && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                        Recommended
                      </span>
                    )}
                    {model.deprecated && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded">
                        Deprecated
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>Cost: ${model.cost_per_1m_input} input | ${model.cost_per_1m_output} output per 1M tokens</span>
                    <span>Speed: {model.speed}</span>
                    <span>Quality: {model.quality}</span>
                  </div>
                  {model.requires_different_api && (
                    <div className="mt-2 text-xs text-amber-600">
                      ⚠️ Requires {model.provider === 'anthropic' ? 'Anthropic' : 'different'} API key
                    </div>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* System Prompt */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">System Prompt</h2>
          <button
            onClick={() => setSettings({ ...settings, system_prompt: DEFAULT_SYSTEM_PROMPT })}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Reset to Default
          </button>
        </div>

        {/* Variable Helpers */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-blue-700 font-medium text-sm">💡 Available Variables:</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {/* Configuration Variables */}
            <div>
              <p className="font-semibold text-blue-800 mb-1">Configuration:</p>
              <button onClick={() => navigator.clipboard.writeText('{{SIMILARITY_THRESHOLD}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{SIMILARITY_THRESHOLD}}'}<span className="text-gray-500 ml-1">(e.g., 0.60)</span>
              </button>
              <button onClick={() => navigator.clipboard.writeText('{{TOP_K_RESULTS}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{TOP_K_RESULTS}}'}<span className="text-gray-500 ml-1">(e.g., 5)</span>
              </button>
              <button onClick={() => navigator.clipboard.writeText('{{CONTEXT_COUNT}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{CONTEXT_COUNT}}'}<span className="text-gray-500 ml-1">(e.g., 3)</span>
              </button>
            </div>

            {/* Query Variables */}
            <div>
              <p className="font-semibold text-blue-800 mb-1">User Query:</p>
              <button onClick={() => navigator.clipboard.writeText('{{QUERY}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{QUERY}}'}<span className="text-gray-500 ml-1">(user question)</span>
              </button>
              <button onClick={() => navigator.clipboard.writeText('{{USER_QUESTION}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{USER_QUESTION}}'}<span className="text-gray-500 ml-1">(same as QUERY)</span>
              </button>
            </div>

            {/* Context Variables */}
            <div>
              <p className="font-semibold text-blue-800 mb-1">Knowledge Base:</p>
              <button onClick={() => navigator.clipboard.writeText('{{CONTEXT}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{CONTEXT}}'}<span className="text-gray-500 ml-1">(all contexts)</span>
              </button>
              <button onClick={() => navigator.clipboard.writeText('{{CONTEXTS}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{CONTEXTS}}'}<span className="text-gray-500 ml-1">(same as CONTEXT)</span>
              </button>
              <button onClick={() => navigator.clipboard.writeText('{{KNOWLEDGE_BASE}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{KNOWLEDGE_BASE}}'}<span className="text-gray-500 ml-1">(same as CONTEXT)</span>
              </button>
            </div>

            {/* Employee Info Variables */}
            <div>
              <p className="font-semibold text-blue-800 mb-1">Employee (Full):</p>
              <button onClick={() => navigator.clipboard.writeText('{{EMPLOYEE_INFO}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{EMPLOYEE_INFO}}'}<span className="text-gray-500 ml-1">(all fields)</span>
              </button>
            </div>

            {/* Employee Specific Fields */}
            <div>
              <p className="font-semibold text-blue-800 mb-1">Employee (Specific):</p>
              <button onClick={() => navigator.clipboard.writeText('{{EMPLOYEE_NAME}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{EMPLOYEE_NAME}}'}
              </button>
              <button onClick={() => navigator.clipboard.writeText('{{EMPLOYEE_ID}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{EMPLOYEE_ID}}'}
              </button>
              <button onClick={() => navigator.clipboard.writeText('{{EMPLOYEE_EMAIL}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{EMPLOYEE_EMAIL}}'}
              </button>
              <button onClick={() => navigator.clipboard.writeText('{{EMPLOYEE_POLICY_TYPE}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{EMPLOYEE_POLICY_TYPE}}'}
              </button>
            </div>

            {/* Coverage Variables */}
            <div>
              <p className="font-semibold text-blue-800 mb-1">Coverage Limits:</p>
              <button onClick={() => navigator.clipboard.writeText('{{COVERAGE_LIMIT}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{COVERAGE_LIMIT}}'}
              </button>
              <button onClick={() => navigator.clipboard.writeText('{{ANNUAL_CLAIM_LIMIT}}')} className="block text-left hover:bg-blue-100 px-2 py-1 rounded font-mono text-blue-600">
                {'{{ANNUAL_CLAIM_LIMIT}}'}
              </button>
            </div>
          </div>
          <p className="text-xs text-blue-600 mt-2">💡 Click any variable to copy it to clipboard, then paste into your prompt</p>
        </div>

        <textarea
          value={settings.system_prompt || DEFAULT_SYSTEM_PROMPT}
          onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          rows={15}
          placeholder="Enter custom system prompt with variables like {{CONTEXT}}, {{EMPLOYEE_INFO}}, {{QUERY}}"
        />

        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>Markdown formatting supported</span>
          <span>{(settings.system_prompt || DEFAULT_SYSTEM_PROMPT).length} / 50,000 characters</span>
        </div>

        {/* Example Prompt Preview */}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-primary-600">
            📝 Example: See how variables are replaced
          </summary>
          <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs font-semibold text-gray-700 mb-2">Example Template:</p>
            <pre className="text-xs bg-white p-3 rounded border font-mono text-gray-800 mb-3 overflow-x-auto">
{`Answer based on context with similarity >{{SIMILARITY_THRESHOLD}}.

User asked: {{QUERY}}

Found {{CONTEXT_COUNT}} relevant knowledge base entries:
{{CONTEXT}}

Employee details: {{EMPLOYEE_NAME}} ({{EMPLOYEE_POLICY_TYPE}})`}
            </pre>

            <p className="text-xs font-semibold text-gray-700 mb-2">After Variable Replacement:</p>
            <pre className="text-xs bg-white p-3 rounded border font-mono text-gray-800 overflow-x-auto">
{`Answer based on context with similarity >0.60.

User asked: How much will be covered and what do I have to pay?

Found 1 relevant knowledge base entries:
[Context 1]
Title: How much will be covered and what do I have to pay?
Category: benefits
Similarity: 0.6105
We are unable to advise on the interim, kindly provide...

Employee details: Baharuddin, Ady Guntor Bin (Standard)`}
            </pre>
          </div>
        </details>
      </div>

      {/* Advanced Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Advanced Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temperature: {settings.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              0 = Deterministic, 1 = Creative
            </p>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Tokens
            </label>
            <input
              type="number"
              min="100"
              max="16000"
              step="100"
              value={settings.max_tokens}
              onChange={(e) => setSettings({ ...settings, max_tokens: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum response length (1-16000)
            </p>
          </div>

          {/* Similarity Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Similarity Threshold: {settings.similarity_threshold}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.similarity_threshold}
              onChange={(e) => setSettings({ ...settings, similarity_threshold: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum similarity for knowledge base matches (0.6-0.8 recommended)
            </p>
          </div>

          {/* Top K Results */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Top K Results
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={settings.top_k_results}
              onChange={(e) => setSettings({ ...settings, top_k_results: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Number of context chunks to retrieve (1-20)
            </p>
          </div>
        </div>
      </div>

      {/* Test Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Test Configuration</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sample Query
            </label>
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="What is my dental coverage?"
            />
          </div>

          <button
            onClick={handleTest}
            disabled={testing || !testQuery.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {testing ? 'Testing...' : 'Test Configuration'}
          </button>

          {testResult && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="font-medium mb-2">Response:</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{testResult.answer}</p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Confidence:</span>
                  <span className="ml-2 font-medium">{(testResult.confidence * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-gray-600">Tokens:</span>
                  <span className="ml-2 font-medium">{testResult.tokens_used}</span>
                </div>
                <div>
                  <span className="text-gray-600">Sources:</span>
                  <span className="ml-2 font-medium">{testResult.sources?.length || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Model:</span>
                  <span className="ml-2 font-medium">{testResult.model_used}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-start">
        <button
          onClick={handleReset}
          disabled={saving}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
        >
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
