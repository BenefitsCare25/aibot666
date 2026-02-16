import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText } from 'lucide-react';

export default function PrivacyPolicyModal({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="ic-fixed ic-inset-0 ic-flex ic-items-center ic-justify-center ic-p-4"
          style={{ backgroundColor: 'var(--color-overlay)', zIndex: 100 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="ic-w-full ic-rounded-2xl ic-overflow-hidden ic-flex ic-flex-col"
            style={{
              maxWidth: 380,
              maxHeight: '85vh',
              backgroundColor: 'var(--color-bg-primary)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="ic-p-4 ic-text-white ic-flex ic-items-center ic-justify-between ic-flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)' }}
            >
              <div className="ic-flex ic-items-center ic-gap-2">
                <FileText className="ic-w-5 ic-h-5" strokeWidth={2} />
                <h3 className="ic-text-base ic-font-semibold">Terms of Use</h3>
              </div>
              <button
                onClick={onClose}
                className="ic-text-white hover:ic-bg-white/20 ic-rounded-full ic-p-1.5 ic-transition-colors ic-min-w-[36px] ic-min-h-[36px] ic-flex ic-items-center ic-justify-center"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                aria-label="Close terms of use"
              >
                <X className="ic-w-5 ic-h-5" strokeWidth={2} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="ic-overflow-y-auto ic-flex-1" style={{ padding: '16px 20px' }}>
              <Section num="1" title="Authorised Use">
                <Para>
                  This AI assistant is provided by Inspro Insurance Brokers Pte Ltd
                  for general informational purposes related to insurance and employee
                  benefits enquiries. Use of this assistant is subject to these Terms
                  of Use.
                </Para>
              </Section>

              <Section num="2" title="Accuracy of Information">
                <Para>
                  While we strive to provide helpful and accurate information, we do
                  not guarantee the accuracy, completeness, or timeliness of any
                  information provided by this assistant. Information may be outdated
                  or contain errors.
                </Para>
              </Section>

              <Section num="3" title="No Professional Advice">
                <Para>
                  The information provided by this assistant does not constitute
                  professional insurance, financial, or legal advice. You should
                  consult a qualified professional before making decisions based on
                  information obtained through this assistant.
                </Para>
              </Section>

              <Section num="4" title="No Warranty">
                <Para>
                  This assistant is provided on an &ldquo;as is&rdquo; and
                  &ldquo;as available&rdquo; basis without warranties of any kind,
                  whether express or implied, including but not limited to implied
                  warranties of merchantability, fitness for a particular purpose,
                  or non-infringement.
                </Para>
              </Section>

              <Section num="5" title="Limitation of Liability">
                <Para>
                  Your use of this assistant is at your own risk. Inspro Insurance
                  Brokers Pte Ltd shall not be liable for any direct, indirect,
                  incidental, consequential, or punitive damages arising from your
                  use of, or inability to use, this assistant.
                </Para>
              </Section>

              <Section num="6" title="No Endorsement">
                <Para>
                  Any reference to third-party products, services, or organisations
                  does not constitute or imply an endorsement, recommendation, or
                  affiliation by Inspro Insurance Brokers Pte Ltd.
                </Para>
              </Section>

              <Section num="7" title="User Responsibility">
                <Para>
                  You are solely responsible for any decisions or actions taken based
                  on the information provided by this assistant. We recommend verifying
                  all information independently before relying on it.
                </Para>
              </Section>

              <Section num="8" title="Data Collection &amp; Analytics">
                <Para>
                  Conversations with this assistant are recorded for quality assurance,
                  service improvement, and analytics purposes. Aggregated and
                  anonymised data may be used for reporting. All personal data is
                  handled in accordance with the Personal Data Protection Act 2012
                  (PDPA) of Singapore.
                </Para>
              </Section>

              <Section num="9" title="Proprietary Rights">
                <Para>
                  This chatbot, including its design, content, and underlying
                  technology, is the intellectual property of Inspro Insurance
                  Brokers Pte Ltd. Unauthorised reproduction, distribution, or use
                  is prohibited.
                </Para>
              </Section>

              <Section num="10" title="Availability">
                <Para>
                  We do not guarantee that this assistant will be available at all
                  times or operate without interruption. We reserve the right to
                  modify, suspend, or discontinue the service at any time without
                  prior notice.
                </Para>
              </Section>

              <Section num="11" title="Modification of Terms">
                <Para>
                  These Terms of Use may be updated or modified at any time without
                  prior notice. Your continued use of this assistant constitutes
                  acceptance of any changes.
                </Para>
              </Section>

              <Section num="12" title="Governing Law">
                <Para>
                  These Terms of Use shall be governed by and construed in accordance
                  with the laws of Singapore. Any disputes arising from the use of
                  this assistant shall be subject to the exclusive jurisdiction of the
                  courts of Singapore.
                </Para>
              </Section>

              <Section num="13" title="Contact">
                <Para>
                  For questions regarding these Terms of Use, please contact us at{' '}
                  <span className="ic-font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    helpdesk@inspro.com.sg
                  </span>.
                </Para>
              </Section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ num, title, children }) {
  return (
    <div className="ic-mb-4">
      <h4
        className="ic-text-sm ic-font-semibold ic-mb-1"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {num}. {title}
      </h4>
      {children}
    </div>
  );
}

function Para({ children }) {
  return (
    <p
      className="ic-text-xs ic-leading-relaxed"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {children}
    </p>
  );
}
