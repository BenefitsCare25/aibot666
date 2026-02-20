import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://app-aibot-api.azurewebsites.net';

const normalizeAndSplit = (domain) => {
  const clean = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const idx = clean.indexOf('/');
  return idx === -1
    ? { host: clean, path: null }
    : { host: clean.substring(0, idx), path: clean.substring(idx) };
};

// Group companies by their primary host (one card per site, covers all environments)
function buildSiteGroups(companies) {
  const groupMap = {}; // primaryHost → { entries, stagingHosts }

  companies.forEach(company => {
    const { host: primaryHost, path } = normalizeAndSplit(company.domain);
    if (!primaryHost) return;

    if (!groupMap[primaryHost]) groupMap[primaryHost] = { entries: [], stagingHosts: new Set() };

    groupMap[primaryHost].entries.push({ path, companyId: company.id, companyName: company.name });

    // Collect all additional/staging hosts for this group
    (company.additional_domains || []).forEach(d => {
      const { host: addHost } = normalizeAndSplit(d);
      if (addHost && addHost !== primaryHost) groupMap[primaryHost].stagingHosts.add(addHost);
    });
  });

  return Object.entries(groupMap).map(([primaryHost, data]) => ({
    primaryHost,
    stagingHosts: [...data.stagingHosts],
    entries: data.entries,
    isSPA: data.entries.some(e => e.path !== null),
  }));
}

// Build per-company static entries (primary domain + each additional domain)
function buildStaticEntries(companies) {
  return companies.flatMap(company => {
    const allDomains = [
      { domain: company.domain, label: 'Production' },
      ...(company.additional_domains || []).map((d, i) => ({
        domain: d,
        label: (company.additional_domains.length > 1) ? `Staging ${i + 1}` : 'Staging',
      }))
    ];
    return allDomains.map(({ domain, label }) => {
      const { host, path } = normalizeAndSplit(domain);
      return { companyId: company.id, companyName: company.name, host, path, domain: `${host}${path || ''}`, label };
    });
  });
}

function generateStaticIframe(entry) {
  const encoded = encodeURIComponent(entry.domain);
  return `<!-- ${entry.companyName} AI Chatbot Widget -->
<iframe
  id="chat-widget-iframe"
  src="${API_URL}/chat?company=${entry.companyId}&domain=${encoded}&color=%233b82f6"
  style="position: fixed; bottom: 16px; right: 16px; width: 200px; height: 80px; border: none; background: transparent; z-index: 9999; transition: all 0.3s ease;"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  allow="clipboard-write"
  allowtransparency="true"
  title="${entry.companyName} Chat Widget">
</iframe>
<script src="${API_URL}/embed-helper.js"><\/script>`;
}

// No hardcoded host — uses window.location.hostname at runtime so the same
// snippet works on both production and staging environments automatically.
function generateDynamicSnippet(entries) {
  const mapLines = entries
    .filter(e => e.path)
    .map(e => `      "${e.path}": { id: "${e.companyId}", color: "%233b82f6" }`)
    .join(',\n');
  return `<script>
  (function() {
    var companyMap = {
${mapLines}
    };
    var path = window.location.pathname.replace(/\\/$/, "");
    var company = companyMap[path];
    if (!company) return;
    var domain = encodeURIComponent(window.location.hostname + path);
    var src = "${API_URL}/chat"
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
<script src="${API_URL}/embed-helper.js"><\/script>`;
}

function CodeBlock({ code, copyKey, copiedKey, onCopy }) {
  return (
    <div className="relative">
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-xs font-mono whitespace-pre">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => onCopy(code, copyKey)}
        className={`absolute top-3 right-3 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          copiedKey === copyKey ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
        }`}
      >
        {copiedKey === copyKey ? '✓ Copied!' : 'Copy'}
      </button>
    </div>
  );
}

export default function EmbedCodeModal({ companies = [], onClose }) {
  const [activeTab, setActiveTab] = useState('dynamic');
  const [copiedKey, setCopiedKey] = useState(null);

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch { /* ignore */ }
  };

  const siteGroups = buildSiteGroups(companies);
  const staticEntries = buildStaticEntries(companies);

  const tabs = [
    {
      id: 'dynamic',
      label: 'Dynamic',
      description: 'For SPAs or multi-company hosts — one snippet auto-selects the company from the URL path',
    },
    {
      id: 'static',
      label: 'Static',
      description: 'For standalone pages — one dedicated iframe per company per domain',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Embed Codes</h2>
            <p className="text-gray-600 mt-1">
              {companies.length} {companies.length === 1 ? 'company' : 'companies'} · {siteGroups.length} {siteGroups.length === 1 ? 'site' : 'sites'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border border-gray-200 rounded-lg overflow-hidden mb-5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="font-semibold">{tab.label}</div>
              <div className={`text-xs mt-0.5 ${activeTab === tab.id ? 'text-gray-300' : 'text-gray-400'}`}>
                {tab.description}
              </div>
            </button>
          ))}
        </div>

        {companies.length === 0 && (
          <div className="text-center text-gray-500 py-8">No companies found.</div>
        )}

        {/* ── Dynamic Tab ── */}
        {activeTab === 'dynamic' && (
          <div className="space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              The snippet uses <code className="bg-blue-100 px-1 rounded">window.location.hostname</code> at
              runtime — so <strong>one snippet works on both production and staging</strong> without any changes.
              Place it once on each environment and it automatically sends the correct domain to the backend.
            </div>

            {siteGroups.filter(g => g.isSPA).map((group, idx) => (
              <div key={group.primaryHost} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Card header */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {group.entries.length} {group.entries.length === 1 ? 'company' : 'companies'}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      Dynamic snippet
                    </span>
                  </div>
                  {/* Environments this snippet covers */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                      <span className="text-gray-600">Production:</span>
                      <code className="text-gray-800">{group.primaryHost}</code>
                    </span>
                    {group.stagingHosts.map(h => (
                      <span key={h} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"></span>
                        <span className="text-gray-600">Staging:</span>
                        <code className="text-gray-800">{h}</code>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Path → company breakdown */}
                <div className="px-4 pt-3 flex flex-wrap gap-2">
                  {group.entries.map(e => (
                    <span key={e.companyId} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      <code className="text-gray-500">{e.path}</code>
                      <span className="text-gray-300">→</span>
                      <span className="font-medium">{e.companyName}</span>
                    </span>
                  ))}
                </div>

                <div className="p-4">
                  <CodeBlock
                    code={generateDynamicSnippet(group.entries)}
                    copyKey={`dyn-${idx}`}
                    copiedKey={copiedKey}
                    onCopy={copyToClipboard}
                  />
                </div>
              </div>
            ))}

            {siteGroups.filter(g => g.isSPA).length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">
                No path-based (SPA) companies found. Dynamic snippets require companies with a path in their domain
                (e.g. <code className="bg-white px-1">benefits.inspro.com.sg/cbre</code>).
              </div>
            )}
          </div>
        )}

        {/* ── Static Tab ── */}
        {activeTab === 'static' && (
          <div className="space-y-5">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Each snippet is hardcoded for one company on one domain. Paste it on the specific
              page where that company's widget should appear.
            </div>

            {companies.map((company) => {
              const entries = staticEntries.filter(e => e.companyId === company.id);
              return (
                <div key={company.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{company.name}</span>
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                      {entries.length} {entries.length === 1 ? 'domain' : 'domains'}
                    </span>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {entries.map((entry, idx) => (
                      <div key={idx} className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            entry.label === 'Production'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {entry.label}
                          </span>
                          <code className="text-xs text-gray-500">{entry.domain}</code>
                        </div>
                        <CodeBlock
                          code={generateStaticIframe(entry)}
                          copyKey={`static-${company.id}-${idx}`}
                          copiedKey={copiedKey}
                          onCopy={copyToClipboard}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-5 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2 text-sm">
            {activeTab === 'dynamic' ? 'Dynamic — When to use' : 'Static — When to use'}
          </h4>
          {activeTab === 'dynamic' ? (
            <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
              <li>For SPAs where multiple companies share the same host, distinguished by URL path</li>
              <li>Uses <code className="bg-white px-1">window.location.hostname</code> at runtime — no hardcoded URLs, works on all registered environments automatically</li>
              <li>One snippet placed on the site handles both production and staging</li>
              <li>When a new company is added, regenerate this snippet and re-deploy to the vendor</li>
            </ul>
          ) : (
            <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
              <li>Static websites or standalone pages with one company per page</li>
              <li>Each snippet is tied to a specific company and domain</li>
              <li>Paste the Production snippet on the live site, Staging snippet on the test site</li>
              <li>Customize <code className="bg-white px-1">color=%233b82f6</code> to change the widget accent color</li>
            </ul>
          )}
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
