import ReactMarkdown from 'react-markdown';

export default function MessageContent({ message, isUser, isError }) {
  if (isUser) {
    return (
      <p className="ic-m-0 ic-whitespace-pre-wrap ic-font-normal ic-leading-relaxed">
        {message.content}
      </p>
    );
  }

  return (
    <ReactMarkdown
      components={{
        a: SafeLink,
        p: props => (
          <p
            className="ic-mb-2 ic-leading-relaxed ic-last:mb-0"
            style={{ color: isError ? 'var(--color-error-text)' : 'var(--color-text-primary)' }}
            {...withoutNode(props)}
          />
        ),
        ul: props => <ul className="ic-mb-2 ic-list-inside ic-list-disc ic-space-y-1 ic-pl-1" {...withoutNode(props)} />,
        ol: props => <ol className="ic-mb-2 ic-list-inside ic-list-decimal ic-space-y-1 ic-pl-1" {...withoutNode(props)} />,
        li: props => <li className="ic-ml-2 ic-leading-relaxed" {...withoutNode(props)} />,
        strong: props => <strong className="ic-font-semibold" {...withoutNode(props)} />,
        em: props => <em className="ic-italic" {...withoutNode(props)} />,
        code: CodeBlock,
        h1: props => <h1 className="ic-mb-2 ic-mt-1 ic-text-base ic-font-bold" {...withoutNode(props)} />,
        h2: props => <h2 className="ic-mb-2 ic-mt-1 ic-text-sm ic-font-bold" {...withoutNode(props)} />,
        h3: props => <h3 className="ic-mb-1 ic-text-sm ic-font-semibold" {...withoutNode(props)} />
      }}
    >
      {message.content}
    </ReactMarkdown>
  );
}

function SafeLink({ href, ...props }) {
  const safeProps = withoutNode(props);
  if (href && !/^(https?:|mailto:)/i.test(href)) return <span {...safeProps} />;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="ic-underline"
      style={{ color: 'var(--color-primary-500)' }}
      {...safeProps}
    />
  );
}

function CodeBlock({ inline, ...props }) {
  const sharedStyle = {
    backgroundColor: 'var(--color-bg-tertiary)',
    borderColor: 'var(--color-border)'
  };
  return inline ? (
    <code
      className="ic-rounded ic-border ic-px-1.5 ic-py-0.5 ic-font-mono ic-text-xs"
      style={{ ...sharedStyle, color: 'var(--color-primary-600)' }}
      {...withoutNode(props)}
    />
  ) : (
    <code
      className="ic-my-2 ic-block ic-overflow-x-auto ic-rounded-lg ic-border ic-px-3 ic-py-2 ic-font-mono ic-text-xs"
      style={sharedStyle}
      {...withoutNode(props)}
    />
  );
}

function withoutNode({ node, ...props }) {
  return props;
}
