import { useState, useEffect } from 'react';
import { chatHistoryApi } from '../api/chatHistory';
import toast from 'react-hot-toast';
import FilterBar from '../components/ChatHistory/FilterBar';
import ConversationList from '../components/ChatHistory/ConversationList';
import ChatView from '../components/ChatHistory/ChatView';

export default function ChatHistory() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    escalatedOnly: false
  });

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, [pagination.page, filters]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations(true); // Silent refresh
    }, 30000);

    return () => clearInterval(interval);
  }, [pagination.page, filters]);

  const loadConversations = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const response = await chatHistoryApi.getConversations({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        escalatedOnly: filters.escalatedOnly
      });

      setConversations(response.data.conversations);
      setPagination(response.data.pagination);
    } catch (error) {
      if (!silent) {
        toast.error('Failed to load conversations');
        console.error(error);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      setMessagesLoading(true);
      const response = await chatHistoryApi.getConversationMessages(conversationId);
      setMessages(response.data.messages);
    } catch (error) {
      toast.error('Failed to load messages');
      console.error(error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.conversation_id);
  };

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, page: newPage });
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPagination({ ...pagination, page: 1 }); // Reset to first page
  };

  const handleExport = async () => {
    if (!selectedConversation) return;

    try {
      setExporting(true);
      await chatHistoryApi.exportConversation(selectedConversation.conversation_id);
      toast.success('Conversation exported successfully!');
    } catch (error) {
      toast.error('Failed to export conversation');
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const handleAttendanceUpdate = async () => {
    // Refresh conversations list to update attendance badges
    await loadConversations(true);

    // Reload the selected conversation to get updated attendance data
    if (selectedConversation) {
      const updatedConversation = conversations.find(
        c => c.conversation_id === selectedConversation.conversation_id
      );
      if (updatedConversation) {
        setSelectedConversation({ ...selectedConversation, ...updatedConversation });
      }
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Chat History</h1>
        <p className="text-gray-600 mt-1">View and search employee conversation history</p>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Conversation list */}
        <div className="w-1/3 border-r border-gray-200 bg-white flex flex-col">
          <FilterBar filters={filters} onFilterChange={handleFilterChange} />

          <ConversationList
            conversations={conversations}
            loading={loading}
            selectedConversationId={selectedConversation?.conversation_id}
            onSelectConversation={handleSelectConversation}
            pagination={pagination}
            onPageChange={handlePageChange}
          />
        </div>

        {/* Right panel: Chat view */}
        <div className="flex-1 flex flex-col">
          <ChatView
            conversation={selectedConversation}
            messages={messages}
            loading={messagesLoading}
            onExport={handleExport}
            exporting={exporting}
            onAttendanceUpdate={handleAttendanceUpdate}
          />
        </div>
      </div>
    </div>
  );
}
