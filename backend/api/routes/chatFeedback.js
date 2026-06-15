import express from 'express';
import { getSession } from '../utils/session.js';

const router = express.Router();
const VALID_RATINGS = new Set(['positive', 'negative']);
const MAX_REASON_LENGTH = 500;

router.post('/', async (req, res) => {
  const { sessionId, messageId, rating, reason = '' } = req.body;

  if (!sessionId || !messageId || !VALID_RATINGS.has(rating)) {
    return res.status(400).json({
      success: false,
      error: 'Session ID, assistant message ID, and a valid rating are required'
    });
  }

  const normalizedReason = String(reason).trim();
  if (normalizedReason.length > MAX_REASON_LENGTH) {
    return res.status(400).json({
      success: false,
      error: `Feedback reason must be ${MAX_REASON_LENGTH} characters or fewer`
    });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found or expired'
    });
  }

  const { data: message, error: fetchError } = await req.supabase
    .from('chat_history')
    .select('id, role, conversation_id, metadata')
    .eq('id', messageId)
    .eq('conversation_id', session.conversationId)
    .single();

  if (fetchError || !message || message.role !== 'assistant') {
    return res.status(404).json({
      success: false,
      error: 'Assistant message not found'
    });
  }

  const feedback = {
    rating,
    reason: normalizedReason || null,
    submitted_at: new Date().toISOString()
  };

  const { error: updateError } = await req.supabase
    .from('chat_history')
    .update({
      metadata: {
        ...(message.metadata || {}),
        feedback
      }
    })
    .eq('id', messageId);

  if (updateError) {
    console.error('Failed to save message feedback:', updateError);
    return res.status(500).json({
      success: false,
      error: 'Failed to save feedback'
    });
  }

  return res.json({
    success: true,
    data: { feedback }
  });
});

export default router;
