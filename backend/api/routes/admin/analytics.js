import express from 'express';

const router = express.Router();

/**
 * GET /api/admin/analytics
 * Get usage analytics
 */
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Get chat statistics
    let chatQuery = req.supabase
      .from('chat_history')
      .select('employee_id, created_at, was_escalated, confidence_score, role');

    if (startDate) {
      chatQuery = chatQuery.gte('created_at', startDate);
    }

    if (endDate) {
      chatQuery = chatQuery.lte('created_at', endDate);
    }

    const { data: chatData, error: chatError } = await chatQuery;

    if (chatError) throw chatError;

    // Calculate metrics - only count user messages as queries
    const userMessages = chatData.filter(c => c.role === 'user');
    const totalQueries = userMessages.length;
    const escalatedQueries = userMessages.filter(c => c.was_escalated).length;
    const avgConfidence = chatData.reduce((sum, c) => sum + (c.confidence_score || 0), 0) / chatData.length;

    // Count unique employees
    const uniqueEmployees = new Set(chatData.map(c => c.employee_id).filter(id => id)).size;

    // Count total AI responses (messages where role is 'assistant')
    const totalResponses = chatData.filter(c => c.role === 'assistant').length;

    // Get escalation statistics
    const { data: escalations, error: escError } = await req.supabase
      .from('escalations')
      .select('status, created_at, resolved_at');

    if (escError) throw escError;

    const pendingEscalations = escalations.filter(e => e.status === 'pending').length;
    const resolvedEscalations = escalations.filter(e => e.status === 'resolved').length;

    // Calculate average resolution time
    const resolvedWithTime = escalations.filter(e => e.resolved_at && e.created_at);
    const avgResolutionTime = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, e) => {
          const created = new Date(e.created_at);
          const resolved = new Date(e.resolved_at);
          return sum + (resolved - created);
        }, 0) / resolvedWithTime.length
      : 0;

    res.json({
      success: true,
      data: {
        queries: {
          total: totalQueries,
          uniqueEmployees: uniqueEmployees,
          totalResponses: totalResponses,
          escalated: escalatedQueries,
          escalationRate: totalQueries > 0 ? (escalatedQueries / totalQueries * 100).toFixed(2) : 0,
          avgConfidence: avgConfidence.toFixed(2)
        },
        escalations: {
          total: escalations.length,
          pending: pendingEscalations,
          resolved: resolvedEscalations,
          avgResolutionTimeMinutes: (avgResolutionTime / 1000 / 60).toFixed(2)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

/**
 * GET /api/admin/analytics/recent-activity
 * Get recent chat activity for dashboard
 */
router.get('/recent-activity', async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    // Get recent conversations (user messages only)
    let query = req.supabase
      .from('chat_history')
      .select('id, employee_id, content, created_at, was_escalated, confidence_score, employees(name, email)')
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Format the response
    const activity = data.map(item => ({
      id: item.id,
      employeeName: item.employees?.name || 'Unknown',
      employeeEmail: item.employees?.email || '',
      question: item.content,
      status: item.was_escalated ? 'escalated' : 'resolved',
      confidence: item.confidence_score,
      timestamp: item.created_at
    }));

    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent activity'
    });
  }
});

/**
 * GET /api/admin/analytics/frequent-categories
 * Get top categories and questions for dashboard
 */
router.get('/frequent-categories', async (req, res) => {
  try {
    const { startDate, endDate, categoryLimit = 5, questionLimit = 5 } = req.query;

    // Get top categories by usage
    let categoryQuery = req.supabase
      .from('knowledge_base')
      .select('category, subcategory, usage_count, title')
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    const { data: knowledgeData, error: kbError } = await categoryQuery;
    if (kbError) throw kbError;

    // Aggregate by category
    const categoryMap = {};
    knowledgeData.forEach(item => {
      if (!item.category) return;

      if (!categoryMap[item.category]) {
        categoryMap[item.category] = {
          category: item.category,
          totalUsage: 0,
          entries: 0,
          topQuestions: []
        };
      }

      categoryMap[item.category].totalUsage += item.usage_count || 0;
      categoryMap[item.category].entries += 1;

      if (categoryMap[item.category].topQuestions.length < questionLimit) {
        categoryMap[item.category].topQuestions.push({
          title: item.title,
          usage: item.usage_count || 0,
          subcategory: item.subcategory
        });
      }
    });

    // Convert to array and sort
    const topCategories = Object.values(categoryMap)
      .sort((a, b) => b.totalUsage - a.totalUsage)
      .slice(0, parseInt(categoryLimit))
      .map(cat => ({
        ...cat,
        topQuestions: cat.topQuestions.sort((a, b) => b.usage - a.usage)
      }));

    // Get most frequent user questions that escalated
    let escalatedQuery = req.supabase
      .from('chat_history')
      .select('content, created_at')
      .eq('role', 'user')
      .eq('was_escalated', true)
      .order('created_at', { ascending: false })
      .limit(100);

    if (startDate) {
      escalatedQuery = escalatedQuery.gte('created_at', startDate);
    }
    if (endDate) {
      escalatedQuery = escalatedQuery.lte('created_at', endDate);
    }

    const { data: escalatedData, error: escError } = await escalatedQuery;
    if (escError) throw escError;

    // Count frequency of escalated questions
    const questionFreq = {};
    escalatedData.forEach(item => {
      const q = item.content.substring(0, 100); // Truncate for grouping
      questionFreq[q] = (questionFreq[q] || 0) + 1;
    });

    const unansweredQuestions = Object.entries(questionFreq)
      .map(([question, frequency]) => ({ question, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, parseInt(questionLimit));

    res.json({
      success: true,
      data: {
        topCategories,
        unansweredQuestions
      }
    });
  } catch (error) {
    console.error('Error fetching frequent categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch frequent categories'
    });
  }
});

/**
 * POST /api/admin/analytics/reset-usage
 * Reset all knowledge_base usage_count to 0
 */
router.post('/reset-usage', async (req, res) => {
  try {
    const { error } = await req.supabase
      .from('knowledge_base')
      .update({ usage_count: 0, last_used_at: null })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // match all rows

    if (error) throw error;

    res.json({ success: true, message: 'Usage counts reset successfully' });
  } catch (error) {
    console.error('Error resetting usage counts:', error);
    res.status(500).json({ success: false, error: 'Failed to reset usage counts' });
  }
});

/**
 * GET /api/admin/analytics/query-trends
 * Get daily query trends for the last 7 days
 */
router.get('/query-trends', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get all user queries in the date range
    const { data, error } = await req.supabase
      .from('chat_history')
      .select('created_at')
      .eq('role', 'user')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    // Group by date
    const dailyCounts = {};

    // Initialize all dates with 0
    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyCounts[dateKey] = 0;
    }

    // Count queries per day
    data.forEach(item => {
      const dateKey = item.created_at.split('T')[0];
      if (dailyCounts[dateKey] !== undefined) {
        dailyCounts[dateKey]++;
      }
    });

    // Convert to array format for charting
    const trends = Object.entries(dailyCounts)
      .map(([date, queries]) => ({ date, queries }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Error fetching query trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch query trends'
    });
  }
});

export default router;
