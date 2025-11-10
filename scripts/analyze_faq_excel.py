import pandas as pd
import json

# Read the Excel file
file_path = r'C:\Users\huien\Desktop\Helpdesk FAQ for Chatbot.xlsx'

# Read all sheets
xls = pd.ExcelFile(file_path)
print(f"Sheet names: {xls.sheet_names}\n")

# Read each sheet
for sheet_name in xls.sheet_names:
    df = pd.read_excel(file_path, sheet_name=sheet_name)
    print(f"\n{'='*60}")
    print(f"Sheet: {sheet_name}")
    print(f"{'='*60}")
    print(f"Columns: {df.columns.tolist()}")
    print(f"Shape: {df.shape}")
    print(f"\nFirst 5 rows:")
    print(df.head())
    print(f"\nData types:")
    print(df.dtypes)
