import { formatDistanceToNow } from 'date-fns';

export default function ConversationCard({ conversation, isSelected, onClick }) {
  const { employee, last_message, message_count, has_escalation, last_message_at, attended_by } = conversation;

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Truncate message preview
  const getPreview = () => {
    if (!last_message?.content) return 'No messages';
    const text = last_message.content;
    return text.length > 60 ? text.substring(0, 60) + '...' : text;
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-gray-200 cursor-pointer transition-colors hover:bg-gray-50 ${
        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold shadow">
            {getInitials(employee?.name)}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {employee?.name || 'Unknown Employee'}
              </h3>
              <p className="text-xs text-gray-500 truncate">{employee?.email}</p>
            </div>
            <div className="flex-shrink-0 text-xs text-gray-500">
              {last_message_at && formatDistanceToNow(new Date(last_message_at), { addSuffix: true })}
            </div>
          </div>

          {/* Last message preview */}
          <p className="text-sm text-gray-600 truncate mb-2">
            {last_message?.role === 'user' ? '👤 ' : '🤖 '}
            {getPreview()}
          </p>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
              {message_count} {message_count === 1 ? 'message' : 'messages'}
            </span>
            {has_escalation && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                ⚠️ Escalated
              </span>
            )}
            {attended_by && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                ✓ {attended_by}
              </span>
            )}
            {employee?.policy_type && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                {employee.policy_type}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
