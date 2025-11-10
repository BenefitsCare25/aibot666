-- ============================================
-- SOLUTION: Cross-Schema Access Without Manual Exposure
-- ============================================
-- This allows querying any company schema through the public schema
-- without manually adding each schema to "Exposed schemas" in Dashboard

-- Create a function to dynamically query any schema's quick_questions table
CREATE OR REPLACE FUNCTION public.get_quick_questions_by_schema(schema_name TEXT)
RETURNS TABLE (
    id UUID,
    category_id TEXT,
    category_title TEXT,
    category_icon TEXT,
    question TEXT,
    answer TEXT,
    display_order INTEGER,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Validate schema name to prevent SQL injection
    IF schema_name !~ '^[a-z_][a-z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid schema name';
    END IF;

    -- Dynamically query the quick_questions table from the specified schema
    RETURN QUERY EXECUTE format(
        'SELECT id, category_id, category_title, category_icon, question, answer,
                display_order, is_active, created_at, updated_at
         FROM %I.quick_questions
         WHERE is_active = true
         ORDER BY category_id, display_order',
        schema_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to all roles
GRANT EXECUTE ON FUNCTION public.get_quick_questions_by_schema(TEXT) TO postgres, anon, authenticated, service_role;

-- Create similar function for all quick questions (including inactive)
CREATE OR REPLACE FUNCTION public.get_all_quick_questions_by_schema(schema_name TEXT)
RETURNS TABLE (
    id UUID,
    category_id TEXT,
    category_title TEXT,
    category_icon TEXT,
    question TEXT,
    answer TEXT,
    display_order INTEGER,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    IF schema_name !~ '^[a-z_][a-z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid schema name';
    END IF;

    RETURN QUERY EXECUTE format(
        'SELECT id, category_id, category_title, category_icon, question, answer,
                display_order, is_active, created_at, updated_at
         FROM %I.quick_questions
         ORDER BY category_id, display_order',
        schema_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_all_quick_questions_by_schema(TEXT) TO postgres, anon, authenticated, service_role;

-- Create function to insert quick questions
CREATE OR REPLACE FUNCTION public.insert_quick_question(
    schema_name TEXT,
    p_category_id TEXT,
    p_category_title TEXT,
    p_category_icon TEXT,
    p_question TEXT,
    p_answer TEXT,
    p_display_order INTEGER DEFAULT 0,
    p_is_active BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    IF schema_name !~ '^[a-z_][a-z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid schema name';
    END IF;

    EXECUTE format(
        'INSERT INTO %I.quick_questions
         (category_id, category_title, category_icon, question, answer, display_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id',
        schema_name
    ) USING p_category_id, p_category_title, p_category_icon, p_question, p_answer, p_display_order, p_is_active
    INTO new_id;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.insert_quick_question(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN) TO postgres, anon, authenticated, service_role;

-- Create function to delete all quick questions (for replace functionality)
CREATE OR REPLACE FUNCTION public.delete_all_quick_questions(schema_name TEXT)
RETURNS VOID AS $$
BEGIN
    IF schema_name !~ '^[a-z_][a-z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid schema name';
    END IF;

    EXECUTE format('DELETE FROM %I.quick_questions', schema_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_all_quick_questions(TEXT) TO postgres, anon, authenticated, service_role;

-- Test the functions
-- SELECT * FROM public.get_quick_questions_by_schema('cbre');
-- SELECT * FROM public.get_all_quick_questions_by_schema('cbre');
