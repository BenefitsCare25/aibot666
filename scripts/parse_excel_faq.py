import pandas as pd
import json
import sys

def parse_faq_excel(excel_path):
    """Parse FAQ data from Excel file"""
    # Read Excel file
    df = pd.read_excel(excel_path, header=None)

    faq_data = {}
    current_section = None

    for idx, row in df.iterrows():
        # Check if this is a section header (has "Answer" in column 2)
        if pd.notna(row[2]) and row[2] == "Answer":
            # The section name is in column 1
            if pd.notna(row[1]):
                section_name = row[1].strip()
                # Map section names
                if section_name.lower() == "coverage":
                    current_section = "Benefit Coverage"
                elif section_name.lower() == "letter of guarantee":
                    current_section = "Letter of Guarantee (LOG)"
                elif section_name.lower() == "system":
                    current_section = "Portal Matters"
                elif section_name.lower() in ["claims", "status"]:
                    current_section = "Claims Status"
                else:
                    current_section = section_name

                faq_data[current_section] = []
                print(f"Found section: {current_section}")

        # Check if this is a Q&A row (has a number in column 0)
        elif pd.notna(row[0]) and str(row[0]).strip().isdigit():
            number = int(row[0])
            question = str(row[1]).strip() if pd.notna(row[1]) else ""
            answer = str(row[2]).strip() if pd.notna(row[2]) else ""

            if current_section and question:
                faq_data[current_section].append({
                    "number": number,
                    "question": question,
                    "answer": answer
                })
                print(f"  Q{number}: {question[:60]}...")

    return faq_data

def main():
    excel_path = "C:/Users/huien/Downloads/Helpdesk FAQ for Chatbot.xlsx"
    output_path = "C:/Users/huien/aibot/faq_sections.json"

    print("Parsing FAQ from Excel file...")
    print("=" * 60)

    try:
        # Parse Excel
        faq_data = parse_faq_excel(excel_path)

        # Summary
        print("\nSummary:")
        total_questions = 0
        for section, questions in faq_data.items():
            count = len(questions)
            total_questions += count
            print(f"  {section}: {count} questions")

        print(f"\n  Total: {total_questions} questions")

        # Save to JSON
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(faq_data, f, indent=2, ensure_ascii=False)

        print(f"\nSuccessfully saved to: {output_path}")

        # Display sample
        print("\nSample data:")
        for section, questions in list(faq_data.items())[:1]:
            print(f"\n{section}:")
            for q in questions[:2]:
                print(f"  Q{q['number']}: {q['question']}")
                print(f"  A: {q['answer'][:100]}...")

    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
