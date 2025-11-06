import pandas as pd
import json

def parse_cbre_faq():
    """Parse CBRE FAQ data from Excel CBRE sheet"""

    # Read the CBRE sheet specifically
    df = pd.read_excel('C:/Users/huien/Desktop/Helpdesk FAQ for Chatbot.xlsx', sheet_name='CBRE', header=None)

    faq_data = {}
    current_section = None

    for idx, row in df.iterrows():
        # Check if this is a section header (has "Answer" in column 2)
        if pd.notna(row[2]) and str(row[2]).strip() == 'Answer':
            # Section name is in column 1
            if pd.notna(row[1]):
                section_name = str(row[1]).strip()

                # Map section names
                if 'Coverage' in section_name:
                    current_section = 'Benefit Coverage'
                elif 'Letter of Guarantee' in section_name:
                    current_section = 'Letter of Guarantee (LOG)'
                elif 'System' in section_name:
                    current_section = 'Portal Matters'
                elif 'Status' in section_name:
                    current_section = 'Claims Status'
                else:
                    current_section = section_name

                faq_data[current_section] = []
                print(f'Section: {current_section}')

        # Check if this is a Q&A row (has number in column 0)
        elif pd.notna(row[0]) and str(row[0]).strip().isdigit():
            number = int(row[0])
            question = str(row[1]).strip() if pd.notna(row[1]) else ''
            answer = str(row[2]).strip() if pd.notna(row[2]) else ''

            if current_section and question:
                faq_data[current_section].append({
                    'number': number,
                    'question': question,
                    'answer': answer
                })
                print(f'  Q{number}: {question[:70]}')

    # Save to JSON
    output_path = 'C:/Users/huien/aibot/faq_sections.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(faq_data, f, indent=2, ensure_ascii=False)

    print(f'\nSaved to: {output_path}')

    # Summary
    print('\nSummary:')
    total = 0
    for section, questions in faq_data.items():
        count = len(questions)
        total += count
        print(f'  {section}: {count} questions')
    print(f'  TOTAL: {total} questions')

    return faq_data

if __name__ == '__main__':
    parse_cbre_faq()
