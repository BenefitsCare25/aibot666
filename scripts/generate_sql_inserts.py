import json

def escape_sql_string(text):
    """Escape string for SQL"""
    if not text:
        return ''
    # Replace single quotes with double single quotes for SQL
    text = text.replace("'", "''")
    return text

def generate_sql_inserts():
    """Generate SQL INSERT statements for FAQ knowledge base"""

    # Read FAQ data
    with open('C:/Users/huien/aibot/faq_sections.json', 'r', encoding='utf-8') as f:
        faq_data = json.load(f)

    # Map section names to categories and subcategories
    category_mapping = {
        'Benefit Coverage': {'category': 'benefits', 'subcategory': 'coverage'},
        'Letter of Guarantee (LOG)': {'category': 'log', 'subcategory': 'requests'},
        'Portal Matters': {'category': 'portal', 'subcategory': 'access'},
        'Claims Status': {'category': 'claims', 'subcategory': 'status'}
    }

    sql_statements = []

    # Generate header comment
    sql_statements.append("-- FAQ Knowledge Base Insert Statements")
    sql_statements.append("-- Generated from Helpdesk FAQ for Chatbot.xlsx")
    sql_statements.append("-- Total Questions: " + str(sum(len(q) for q in faq_data.values())))
    sql_statements.append("")
    sql_statements.append("-- Clear existing FAQ data (optional - remove if you want to keep existing data)")
    sql_statements.append("-- DELETE FROM knowledge_base WHERE source = 'Helpdesk FAQ Excel';")
    sql_statements.append("")

    # Generate INSERT statements for each FAQ
    for section_name, questions in faq_data.items():
        sql_statements.append(f"-- {section_name} ({len(questions)} questions)")
        sql_statements.append("")

        mapping = category_mapping.get(section_name, {'category': 'general', 'subcategory': 'faq'})

        for q in questions:
            question = escape_sql_string(q['question'])
            answer = escape_sql_string(q['answer'])

            # Skip if answer is empty
            if not answer or answer.strip() == '':
                sql_statements.append(f"-- Skipping Q{q['number']}: No answer provided")
                continue

            # Create metadata JSON
            metadata = {
                'section': section_name,
                'question_number': q['number'],
                'has_detailed_answer': len(answer) > 100
            }
            metadata_json = json.dumps(metadata).replace("'", "''")

            sql = f"""INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  '{question}',
  '{answer}',
  '{mapping['category']}',
  '{mapping['subcategory']}',
  '{metadata_json}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);"""
            sql_statements.append(sql)
            sql_statements.append("")

    # Join all statements
    full_sql = '\n'.join(sql_statements)

    # Write to file
    output_path = 'C:/Users/huien/aibot/insert_faq_knowledge.sql'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(full_sql)

    print(f"SQL script generated: {output_path}")
    print(f"\nTotal statements: {len([s for s in sql_statements if s.startswith('INSERT')])}")

    # Also create a version without the DELETE statement for safety
    safe_sql = '\n'.join([s for s in sql_statements if 'DELETE FROM' not in s])
    safe_output_path = 'C:/Users/huien/aibot/insert_faq_knowledge_safe.sql'
    with open(safe_output_path, 'w', encoding='utf-8') as f:
        f.write(safe_sql)

    print(f"Safe SQL script (no deletes): {safe_output_path}")

    # Summary
    print("\nSummary:")
    for section_name, questions in faq_data.items():
        valid_count = len([q for q in questions if q['answer'] and q['answer'].strip()])
        print(f"  {section_name}: {valid_count} questions with answers")

if __name__ == "__main__":
    generate_sql_inserts()
