import pandas as pd
import json

# Read the Excel file
file_path = r'C:\Users\huien\Desktop\Helpdesk FAQ for Chatbot.xlsx'

# Read CBRE sheet
df = pd.read_excel(file_path, sheet_name='CBRE')

print("CBRE Sheet Analysis")
print("=" * 80)
print(f"\nTotal rows: {len(df)}")
print(f"Columns: {df.columns.tolist()}")

# Show all rows
pd.set_option('display.max_rows', None)
pd.set_option('display.max_columns', None)
pd.set_option('display.width', None)
pd.set_option('display.max_colwidth', 100)

print("\n" + "=" * 80)
print("All Questions and Answers:")
print("=" * 80)

for idx, row in df.iterrows():
    print(f"\n[{row['No']}] Category: {row['Benefit Coverage']}")
    print(f"Answer: {row['Answer'][:200]}..." if len(str(row['Answer'])) > 200 else f"Answer: {row['Answer']}")
    print("-" * 80)

# Check for categories
print("\n" + "=" * 80)
print("Unique categories/question types:")
print("=" * 80)
categories = df['Benefit Coverage'].unique()
for cat in categories:
    count = len(df[df['Benefit Coverage'] == cat])
    print(f"- {cat}: {count} questions")
