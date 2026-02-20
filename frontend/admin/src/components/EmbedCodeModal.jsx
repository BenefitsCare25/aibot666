import { useState, useEffect } from 'react';
import { companyApi } from '../api/companies';

const getBaseHost = (domain) => domain.split('/')[0];
const getPath = (domain) => {
  const idx = domain.indexOf('/');
  return idx === -1 ? null : domain.substring(idx);
};
const hasSPAPath = (domain) => domain.includes('/');

function CodeBlock({ code, copyKey, copiedKey, onCopy }) {
  const isCopied = copiedKey === copyKey;
  return (
    <div className="relative">
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-xs font-mono whitespace-pre">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => onCopy(code, copyKey)}
        className={`absolute top-3 right-3 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          isCopied ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
        }`}
      >
        {isCopied ? '✓ Copied!' : 'Copy'}
      </button>
    </div>
  );
}

export default function EmbedCodeModal({ company, allCompanies = [], onClose }) {
  const [apiUrl, setApiUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('production');
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    companyApi.getEmbedCode(company.id)
      .then(r => setApiUrl(r.data.apiUrl))
      .catch(() => setError('Failed to load embed configuration'))
      .finally(() => setLoading(false));
  }, [company.id]);

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore
    }
  };

  const generateIframe = (domain, companyId, name) => {
    const encoded = encodeURIComponent(domain);
    return `<!-- ${name} AI Chatbot Widget -->
<iframe
  id="chat-widget-iframe"
  src="${apiUrl}/chat?company=${companyId}&domain=${encoded}&color=%233b82f6"
  style="position: fixed; bottom: 16px; right: 16px; width: 200px; height: 80px; border: none; background: transparent; z-index: 9999; transition: all 0.3s ease;"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  allow="clipboard-write"
  allowtransparency="true"
  title="${name} Chat Widget">
</iframe>
<script src="${apiUrl}/embed-helper.js"><\/script>`;
  };

  const generateDynamicSnippet = (baseHost, companyMap) => {
    const mapLines = Object.entries(companyMap)
      .map(([path, id]) => `      "${path}": { id: "${id}", color: "%233b82f6" }`)
      .join(',\n');
    return `<script>
  (function() {
    var companyMap = {
${mapLines}
    };
    var path = window.location.pathname.replace(/\\/$/, "");
    var company = companyMap[path];
    if (!company) return;
    var domain = encodeURIComponent("${baseHost}" + path);
    var src = "${apiUrl}/chat"
      + "?company=" + company.id + "&domain=" + domain + "&color=" + company.color;
    var iframe = document.createElement("iframe");
    iframe.id = "chat-widget-iframe";
    iframe.src = src;
    iframe.style.cssText = "position:fixed;bottom:16px;right:16px;width:200px;height:80px;border:none;background:transparent;z-index:9999;transition:all 0.3s ease;";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
    iframe.setAttribute("allow", "clipboard-write");
    iframe.setAttribute("allowtransparency", "true");
    iframe.title = "Chat Widget";
    document.body.appendChild(iframe);
  })();
<\/script>
<script src="${apiUrl}/embed-helper.js"><\/script>`;
  };

  const isSPA = hasSPAPath(company.domain);
  const prodBaseHost = getBaseHost(company.domain);
  const additionalDomains = company.additional_domains || [];

  const buildProductionCode = () => {
    if (!isSPA) return generateIframe(company.domain, company.id, company.name);
    const companyMap = {};
    allCompanies.forEach(c => {
      if (getBaseHost(c.domain) === prodBaseHost) {
        const path = getPath(c.domain);
        if (path) companyMap[path] = c.id;
      }
    });
    return generateDynamicSnippet(prodBaseHost, companyMap);
  };

  const buildStagingBlocks = () => {
    if (additionalDomains.length === 0) return null;
    const blocks = [];

    // Group SPA staging domains by base host
    const spaDomains = additionalDomains.filter(d => hasSPAPath(d));
    const stagingHosts = [...new Set(spaDomains.map(d => getBaseHost(d)))];
    stagingHosts.forEach(stagingBaseHost => {
      const companyMap = {};
      allCompanies.forEach(c => {
        const match = (c.additional_domains || []).find(
          d => getBaseHost(d) === stagingBaseHost && getPath(d)
        );
        if (match) companyMap[getPath(match)] = c.id;
      });
      if (Object.keys(companyMap).length > 0) {
        blocks.push({
          label: `Dynamic snippet — ${stagingBaseHost}`,
          subLabel: `${Object.keys(companyMap).length} companies`,
          code: generateDynamicSnippet(stagingBaseHost, companyMap),
        });
      }
    });

    // Simple iframe for non-SPA additional domains
    additionalDomains.filter(d => !hasSPAPath(d)).forEach(d => {
      blocks.push({ label: d, code: generateIframe(d, company.id, company.name) });
    });

    return blocks.length > 0 ? blocks : null;
  };

  const prodSPACount = isSPA
    ? allCompanies.filter(c => getBaseHost(c.domain) === prodBaseHost && getPath(c.domain)).length
    : 0;

  if (loading) return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full">
        <div className="flex justify-center items-center h-32 text-gray-500">Loading embed code...</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
        <button onClick={onClose} className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Close</button>
      </div>
    </div>
  );

  const prodCode = buildProductionCode();
  const stagingBlocks = buildStagingBlocks();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Widget Embed Code</h2>
            <p className="text-gray-600 mt-1">
              {company.name} — <code className="text-sm bg-gray-100 px-1 rounded">{company.domain}</code>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* SPA banner */}
        {isSPA && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>SPA / Multi-company mode:</strong> This company uses a path-based domain.
              The dynamic snippet reads <code className="bg-amber-100 px-1 rounded">window.location.pathname</code> and
              includes all companies registered on the same host.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab('production')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'production'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Production
          </button>
          <button
            onClick={() => setActiveTab('staging')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'staging'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Staging
            {additionalDomains.length > 0 && (
              <span className="ml-1.5 bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                {additionalDomains.length}
              </span>
            )}
          </button>
        </div>

        {/* Production tab */}
        {activeTab === 'production' && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700">
                {isSPA ? `Dynamic snippet — ${prodBaseHost}` : `Iframe — ${company.domain}`}
              </span>
              {isSPA && prodSPACount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {prodSPACount} {prodSPACount === 1 ? 'company' : 'companies'}
                </span>
              )}
            </div>
            <CodeBlock
              code={prodCode}
              copyKey="prod"
              copiedKey={copiedKey}
              onCopy={copyToClipboard}
            />
          </div>
        )}

        {/* Staging tab */}
        {activeTab === 'staging' && (
          stagingBlocks ? (
            <div className="space-y-4">
              {stagingBlocks.map((block, idx) => (
                <div key={idx}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-700">{block.label}</span>
                    {block.subLabel && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {block.subLabel}
                      </span>
                    )}
                  </div>
                  <CodeBlock
                    code={block.code}
                    copyKey={`staging-${idx}`}
                    copiedKey={copiedKey}
                    onCopy={copyToClipboard}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">
              No staging domains configured.
              <br />
              Add additional domains when editing this company.
            </div>
          )
        )}

        {/* Domain info + instructions */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2 text-sm">Registered Domains</h4>
            <div className="space-y-1 text-xs">
              <div>
                <span className="font-medium text-green-700">Production: </span>
                <code className="bg-white px-1 rounded">{company.domain}</code>
              </div>
              {additionalDomains.map((d, i) => (
                <div key={i}>
                  <span className="font-medium text-orange-700">Staging {additionalDomains.length > 1 ? i + 1 : ''}: </span>
                  <code className="bg-white px-1 rounded">{d}</code>
                </div>
              ))}
              {additionalDomains.length === 0 && (
                <div className="text-gray-400 italic">No staging domains</div>
              )}
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2 text-sm">Instructions</h4>
            <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
              <li>Paste code just before <code className="bg-white px-1">&lt;/body&gt;</code></li>
              <li>Updates are automatic — no code changes needed</li>
              <li>Change <code className="bg-white px-1">color=%233b82f6</code> to customize accent</li>
              {isSPA && <li>Add new companies to <code className="bg-white px-1">companyMap</code> as needed</li>}
            </ol>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
