import pdfplumber
import os

pdf_dir = r'E:\2026Mineru比赛\exmaples\test'
out_dir = r'E:\2026Mineru比赛\exmaples\output'

pdfs = [
    ('Distributed_Secondary_Control_for_Current_Sharing_and_Voltage_Restoration_in_DC_Microgrid.pdf', 'paper1.txt'),
    ('Distributed_Secondary_Control_for_Power_Allocation_and_Voltage_Restoration_in_Islanded_DC_Microgrids.pdf', 'paper2.txt'),
    ('Distributed_Secondary_Voltage_and_Frequency_Restoration_Control_of_Droop-Controlled_Inverter-Based_Microgrids.pdf', 'paper3.txt'),
    ('Dual-Consensus-Based_Distributed_Frequency_Control_for_Multiple_Energy_Storage_Systems.pdf', 'paper4.txt'),
    ('Two-Stage Active Distribution Network Voltage Control via LLM-RL.pdf', 'paper5.txt'),
]

for pdf_name, out_name in pdfs:
    path = os.path.join(pdf_dir, pdf_name)
    out_path = os.path.join(out_dir, out_name)
    print(f'Processing: {pdf_name[:60]}...')
    try:
        text_parts = []
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(f'--- Page {i+1} ---\n{page_text}')
        full_text = '\n\n'.join(text_parts)
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(full_text)
        print(f'  -> Saved {len(full_text)} chars to {out_name}')
    except Exception as e:
        print(f'  ERROR: {e}')

print('Done!')
