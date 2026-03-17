import { motion } from 'framer-motion';
import { FileText, Download, ArrowLeft, ChevronRight } from 'lucide-react';

export default function LogRouteSelector({ routes, downloadableFiles, apiUrl, domain, onSelectRoute, onBack }) {
  const handleDownload = (e, downloadKey) => {
    e.stopPropagation();
    if (downloadKey && apiUrl) {
      const domainParam = domain ? `?domain=${encodeURIComponent(domain)}` : '';
      window.open(`${apiUrl}/api/chat/log-form/${downloadKey}${domainParam}`, '_blank');
    }
  };

  return (
    <div className="ic-space-y-3">
      <p
        className="ic-text-sm ic-font-semibold ic-mb-2"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Select hospital type:
      </p>

      {routes.map((route) => (
        <motion.button
          key={route.id}
          onClick={() => onSelectRoute(route)}
          className="ic-w-full ic-p-4 ic-rounded-xl ic-bg-white ic-shadow-soft hover:ic-shadow-soft-lg ic-transition-all ic-text-left ic-group"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="ic-flex ic-items-center ic-justify-between ic-mb-2">
            <div className="ic-flex ic-items-center ic-gap-2">
              <FileText className="ic-w-4 ic-h-4 ic-flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} strokeWidth={2} />
              <span className="ic-text-sm ic-font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {route.label}
              </span>
            </div>
            <ChevronRight className="ic-w-4 ic-h-4 group-hover:ic-translate-x-0.5 ic-transition-transform" style={{ color: 'var(--color-text-tertiary)' }} strokeWidth={2} />
          </div>

          {route.requiredDocuments?.length > 0 && (
            <ul className="ic-space-y-1 ic-ml-6">
              {route.requiredDocuments.map((doc, idx) => (
                <li key={idx} className="ic-flex ic-items-start ic-gap-2">
                  <span className="ic-text-xs ic-mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>•</span>
                  <div className="ic-flex-1">
                    <span className="ic-text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {doc.name}
                    </span>
                    {doc.downloadKey && downloadableFiles?.[doc.downloadKey] && (
                      <button
                        type="button"
                        onClick={(e) => handleDownload(e, doc.downloadKey)}
                        className="ic-ml-2 ic-inline-flex ic-items-center ic-gap-0.5 ic-text-xs ic-font-medium hover:ic-underline"
                        style={{ color: 'var(--color-primary-500)' }}
                      >
                        <Download className="ic-w-3 ic-h-3" strokeWidth={2} />
                        Download
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.button>
      ))}

      <button
        type="button"
        onClick={onBack}
        className="ic-w-full ic-text-sm ic-py-2 ic-text-center ic-transition-colors ic-flex ic-items-center ic-justify-center ic-gap-1"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        <ArrowLeft className="ic-w-3.5 ic-h-3.5" strokeWidth={2} />
        Back to options
      </button>
    </div>
  );
}
