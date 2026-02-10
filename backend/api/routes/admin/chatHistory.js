import express from 'express';
import { sanitizeSearchParam } from '../../utils/sanitize.js';

const router = express.Router();

/**
 * GET /api/admin/chat-history
 * Get all chat conversations with metadata
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit: rawChatLimit = 20, search = '', dateFrom, dateTo, escalatedOnly, employeeId } = req.query;
    const limit = Math.min(parseInt(rawChatLimit) || 20, 200);
    const offset = (page - 1) * limit;

    // First, get all unique conversation_ids with filters
    // Note: attended_by, admin_notes, attended_at may not exist in older schemas
    let conversationQuery = req.supabase
      .from('chat_history')
      .select('conversation_id, employee_id, created_at, was_escalated', { count: 'exact' });

    // Apply filters
    if (dateFrom) {
      conversationQuery = conversationQuery.gte('created_at', dateFrom);
    }
    if (dateTo) {
      conversationQuery = conversationQuery.lte('created_at', dateTo);
    }
    if (escalatedOnly === 'true') {
      conversationQuery = conversationQuery.eq('was_escalated', true);
    }
    if (employeeId) {
      conversationQuery = conversationQuery.eq('employee_id', employeeId);
    }
    const safeChatSearch = sanitizeSearchParam(search);
    if (safeChatSearch) {
      conversationQuery = conversationQuery.ilike('content', `%${safeChatSearch}%`);
    }

    const { data: allMessages, error: msgError } = await conversationQuery;
    if (msgError) throw msgError;

    // Group by conversation_id and calculate metadata
    const conversationMap = new Map();
    allMessages.forEach(msg => {
      const convId = msg.conversation_id;
      if (!conversationMap.has(convId)) {
        conversationMap.set(convId, {
          conversation_id: convId,
          employee_id: msg.employee_id,
          message_count: 0,
          has_escalation: false,
          first_message_at: msg.created_at,
          last_message_at: msg.created_at,
          attended_by: null,
          admin_notes: null,
          attended_at: null
        });
      }
      const conv = conversationMap.get(convId);
      conv.message_count++;
      if (msg.was_escalated) conv.has_escalation = true;
      if (new Date(msg.created_at) < new Date(conv.first_message_at)) {
        conv.first_message_at = msg.created_at;
      }
      if (new Date(msg.created_at) > new Date(conv.last_message_at)) {
        conv.last_message_at = msg.created_at;
      }
    });

    // Convert to array and sort by last message
    const conversations = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

    // Paginate
    const total = conversations.length;
    const paginatedConversations = conversations.slice(offset, offset + parseInt(limit));

    // Try to fetch attendance data if columns exist
    const conversationIds = paginatedConversations.map(c => c.conversation_id);
    try {
      const { data: attendanceData } = await req.supabase
        .from('chat_history')
        .select('conversation_id, attended_by, admin_notes, attended_at')
        .in('conversation_id', conversationIds)
        .not('attended_by', 'is', null);

      // Update conversations with attendance data
      if (attendanceData && attendanceData.length > 0) {
        const attendanceMap = new Map();
        attendanceData.forEach(att => {
          if (!attendanceMap.has(att.conversation_id)) {
            attendanceMap.set(att.conversation_id, att);
          }
        });

        paginatedConversations.forEach(conv => {
          const attendance = attendanceMap.get(conv.conversation_id);
          if (attendance) {
            conv.attended_by = attendance.attended_by;
            conv.admin_notes = attendance.admin_notes;
            conv.attended_at = attendance.attended_at;
          }
        });
      }
    } catch (attendanceError) {
      // Columns don't exist yet - that's okay, continue without attendance data
      console.warn('Attendance columns not available:', attendanceError.message);
    }

    // Get employee details for paginated conversations
    const employeeIds = [...new Set(paginatedConversations.map(c => c.employee_id))];
    const { data: employees } = await req.supabase
      .from('employees')
      .select('id, name, email')
      .in('id', employeeIds);

    const employeeMap = new Map(employees?.map(e => [e.id, e]) || []);

    // Get last message preview for each conversation
    const { data: lastMessages } = await req.supabase
      .from('chat_history')
      .select('conversation_id, content, role, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    const lastMessageMap = new Map();
    lastMessages?.forEach(msg => {
      if (!lastMessageMap.has(msg.conversation_id)) {
        lastMessageMap.set(msg.conversation_id, msg);
      }
    });

    // Combine all data
    const enrichedConversations = paginatedConversations.map(conv => ({
      ...conv,
      employee: employeeMap.get(conv.employee_id) || null,
      last_message: lastMessageMap.get(conv.conversation_id) || null
    }));

    res.json({
      success: true,
      data: {
        conversations: enrichedConversations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat history'
    });
  }
});

/**
 * GET /api/admin/chat-history/:conversationId/messages
 * Get all messages for a specific conversation
 */
router.get('/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Get all messages for this conversation
    const { data: messages, error: msgError } = await req.supabase
      .from('chat_history')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgError) throw msgError;

    // Get employee info if available
    let employee = null;
    if (messages.length > 0 && messages[0].employee_id) {
      const { data: empData } = await req.supabase
        .from('employees')
        .select('*')
        .eq('id', messages[0].employee_id)
        .single();
      employee = empData;
    }

    res.json({
      success: true,
      data: {
        conversation_id: conversationId,
        employee,
        messages
      }
    });
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation messages'
    });
  }
});

/**
 * PUT /api/admin/chat-history/:conversationId/attendance
 * Update admin attendance for a conversation
 */
router.put('/:conversationId/attendance', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { attendedBy, adminNotes } = req.body;


    // Validate input
    if (!attendedBy || attendedBy.trim() === '') {
      console.warn('⚠️ [Attendance] Validation failed: attendedBy is required');
      return res.status(400).json({
        success: false,
        error: 'Admin name (attendedBy) is required'
      });
    }

    const updateData = {
      attended_by: attendedBy.trim(),
      admin_notes: adminNotes?.trim() || null,
      attended_at: new Date().toISOString()
    };


    // Update all messages in the conversation with admin attendance info
    const { data, error } = await req.supabase
      .from('chat_history')
      .update(updateData)
      .eq('conversation_id', conversationId)
      .select();

    if (error) {
      console.error('❌ [Attendance] Database error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.warn('⚠️ [Attendance] No conversation found with ID:', conversationId);
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }


    res.json({
      success: true,
      message: 'Admin attendance updated successfully',
      data: {
        conversationId,
        attendedBy: attendedBy.trim(),
        adminNotes: adminNotes?.trim() || null,
        attendedAt: new Date().toISOString(),
        messagesUpdated: data.length
      }
    });
  } catch (error) {
    console.error('Error updating admin attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update admin attendance'
    });
  }
});

export default router;
