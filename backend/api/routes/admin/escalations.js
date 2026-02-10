import express from 'express';
import { addKnowledgeEntry } from '../../services/vectorDB.js';

const router = express.Router();

/**
 * GET /api/admin/escalations
 * Get escalations (with filters)
 */
router.get('/', async (req, res) => {
  try {
    const { status = '', page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = req.supabase
      .from('escalations')
      .select(`
        *,
        employees (name, email)
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: {
        escalations: data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching escalations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch escalations'
    });
  }
});

/**
 * PATCH /api/admin/escalations/:id
 * Update escalation status and resolution
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution, resolved_by, add_to_kb = false } = req.body;

    // Build update object
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (status !== undefined) {
      updates.status = status;

      // Auto-set resolved_at when marking as resolved
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
        if (resolved_by) {
          updates.resolved_by = resolved_by;
        }
      }
    }

    if (resolution !== undefined) {
      updates.resolution = resolution;
    }

    // Update the escalation
    const { data: escalation, error: updateError } = await req.supabase
      .from('escalations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // If marking as resolved and add_to_kb is true, add to knowledge base
    if (status === 'resolved' && add_to_kb && resolution) {
      try {
        const kbEntry = await addKnowledgeEntry({
          title: `Escalation: ${escalation.query.substring(0, 100)}`,
          content: resolution,
          category: 'Escalations',
          subcategory: 'Resolved Queries',
          metadata: {
            escalation_id: escalation.id,
            original_query: escalation.query,
            resolved_by: resolved_by || 'admin'
          },
          source: 'escalation_resolution'
        }, req.supabase); // Pass schema-specific client

        // Mark escalation as added to KB
        await req.supabase
          .from('escalations')
          .update({ was_added_to_kb: true })
          .eq('id', id);

        escalation.was_added_to_kb = true;
      } catch (kbError) {
        console.error('Error adding to knowledge base:', kbError);
        // Don't fail the update if KB addition fails
      }
    }

    res.json({
      success: true,
      data: escalation
    });
  } catch (error) {
    console.error('Error updating escalation:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update escalation',
      details: error.message
    });
  }
});

export default router;
