import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://app-aibot-api.azurewebsites.net';

const normalizeAndSplit = (domain) => {
  const clean = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const idx = clean.indexOf('/');
  return idx === -1
    ? { host: clean, path: null }
    : { host: clean.substring(0, idx), path: clean.substring(idx) };
};

function buildHostGroups(companies) {
  const hostMap = {}; // host → { entries: [...], allAdditional: bool }

  companies.forEach(company => {
    const domains = [
      { domain: company.domain, isPrimary: true },
      ...(company.additional_domains || []).map(d => ({ domain: d, isPrimary: false }))
    ];

    domains.forEach(({ domain, isPrimary }) => {
      const { host, path } = normalizeAndSplit(domain);
      if (!host) return;
      if (!hostMap[host]) hostMap[host] = { entries: [], allAdditional: true };
      if (isPrimary) hostMap[host].allAdditional = false;
      // One entry per company per host
      if (!hostMap[host].entries.find(e => e.companyId === company.id)) {
        hostMap[host].entries.push({ path, companyId: company.id, companyName: company.name, isPrimary });
      }
    });
  });

  return Object.entries(hostMap)
    .map(([host, data]) => ({
      host,
      isStaging: data.allAdditional, // staging if no company has it as primary
      entries: data.entries,
      isSPA: data.entries.some(e => e.path !== null),
    }))
    .sort((a, b) => Number(a.isStaging) - Number(b.isStaging)); // production hosts first
}

function generateIframe(host, entry) {
  const domain = entry.path ? `${host}${entry.path}` : host;
  const encoded = encodeURIComponent(domain);
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

function generateDynamicSnippet(host, entries) {
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
    var domain = encodeURIComponent("${host}" + path);
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
  const [copiedKey, setCopiedKey] = useState(null);

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch { /* ignore */ }
  };

  const hostGroups = buildHostGroups(companies);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Embed Codes</h2>
            <p className="text-gray-600 mt-1">
              {companies.length} {companies.length === 1 ? 'company' : 'companies'} · {hostGroups.length} {hostGroups.length === 1 ? 'host' : 'hosts'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            Each snippet below covers all companies registered on that host.
            Dynamic snippets read <code className="bg-blue-100 px-1 rounded">window.location.pathname</code> to select the correct company automatically.
          </p>
        </div>

        {companies.length === 0 && (
          <div className="text-center text-gray-500 py-8">No companies found.</div>
        )}

        {/* One card per host */}
        <div className="space-y-5">
          {hostGroups.map((group, idx) => {
            const code = group.isSPA
              ? generateDynamicSnippet(group.host, group.entries)
              : generateIframe(group.host, group.entries[0]);

            return (
              <div key={group.host} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Card header */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex flex-wrap items-center gap-2">
                  <code className="text-sm font-semibold text-gray-900">{group.host}</code>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    group.isStaging
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {group.isStaging ? 'Staging' : 'Production'}
                  </span>
                  {group.isSPA ? (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      Dynamic · {group.entries.length} {group.entries.length === 1 ? 'company' : 'companies'}
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                      Iframe · {group.entries[0].companyName}
                    </span>
                  )}
                </div>

                {/* Company path breakdown (SPA only) */}
                {group.isSPA && (
                  <div className="px-4 pt-3 flex flex-wrap gap-2">
                    {group.entries.map(e => (
                      <span
                        key={e.companyId}
                        className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                      >
                        <code className="text-gray-500">{e.path}</code>
                        <span className="text-gray-300">→</span>
                        <span className="font-medium">{e.companyName}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Code block */}
                <div className="p-4">
                  <CodeBlock
                    code={code}
                    copyKey={`host-${idx}`}
                    copiedKey={copiedKey}
                    onCopy={copyToClipboard}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Instructions */}
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2 text-sm">Instructions</h4>
          <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
            <li>Paste the correct environment snippet just before <code className="bg-white px-1">&lt;/body&gt;</code></li>
            <li>Dynamic snippets auto-select the right company from the URL path — no changes needed when adding companies</li>
            <li>Simple iframe snippets are for standalone single-company sites</li>
            <li>Customize accent color by changing <code className="bg-white px-1">color=%233b82f6</code></li>
          </ol>
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
