"""Extract PDFs using MinerU API and save as markdown."""
import os
import sys

from magic_pdf.data.data_reader_writer import FileBasedDataWriter, FileBasedDataReader
from magic_pdf.data.dataset import PymuDocDataset
from magic_pdf.config.enums import SupportedPdfParseMethod
from magic_pdf.config.make_content_config import DropMode, MakeMode
from magic_pdf.model.doc_analyze_by_custom_model import doc_analyze

pdf_dir = r'E:\2026Mineru比赛\exmaples\test'
output_base = r'E:\2026Mineru比赛\exmaples\output'

pdfs = [
    ('Distributed_Secondary_Control_for_Current_Sharing_and_Voltage_Restoration_in_DC_Microgrid.pdf', 'paper1'),
    ('Distributed_Secondary_Control_for_Power_Allocation_and_Voltage_Restoration_in_Islanded_DC_Microgrids.pdf', 'paper2'),
    ('Distributed_Secondary_Voltage_and_Frequency_Restoration_Control_of_Droop-Controlled_Inverter-Based_Microgrids.pdf', 'paper3'),
    ('Dual-Consensus-Based_Distributed_Frequency_Control_for_Multiple_Energy_Storage_Systems.pdf', 'paper4'),
    ('Two-Stage Active Distribution Network Voltage Control via LLM-RL.pdf', 'paper5'),
]

reader = FileBasedDataReader('')

for pdf_name, paper_id in pdfs:
    pdf_path = os.path.join(pdf_dir, pdf_name)
    paper_output_dir = os.path.join(output_base, f'mineru_{paper_id}')
    local_image_dir = os.path.join(paper_output_dir, 'images')
    local_md_dir = paper_output_dir
    os.makedirs(local_image_dir, exist_ok=True)

    print(f'Processing {paper_id}: {pdf_name[:60]}...')

    try:
        pdf_bytes = reader.read(pdf_path)
        ds = PymuDocDataset(pdf_bytes, lang='en')

        classify = ds.classify()
        print(f'  Classify: {classify}')

        image_writer = FileBasedDataWriter(local_image_dir)
        md_writer = FileBasedDataWriter(local_md_dir)
        image_dir = str(os.path.basename(local_image_dir))

        if classify == SupportedPdfParseMethod.TXT:
            infer_result = ds.apply(doc_analyze, ocr=False, lang=ds._lang)
            pipe_result = infer_result.pipe_txt_mode(image_writer, lang=ds._lang)
        else:
            infer_result = ds.apply(doc_analyze, ocr=True, lang=ds._lang)
            pipe_result = infer_result.pipe_ocr_mode(image_writer, lang=ds._lang)

        md_content = pipe_result.get_markdown(image_dir, drop_mode=DropMode.NONE, md_make_mode=MakeMode.MM_MD)

        md_path = os.path.join(local_md_dir, 'output.md')
        if isinstance(md_content, list):
            with open(md_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(md_content))
        else:
            with open(md_path, 'w', encoding='utf-8') as f:
                f.write(md_content)

        print(f'  -> Saved markdown ({len(md_content)} chars) to {md_path}')

        # Also dump content list for structured data
        try:
            content_list = pipe_result.get_content_list(image_dir, drop_mode=DropMode.NONE)
            cl_path = os.path.join(local_md_dir, 'content_list.json')
            import json
            with open(cl_path, 'w', encoding='utf-8') as f:
                json.dump(content_list, f, ensure_ascii=False, indent=2)
            print(f'  -> Saved content_list.json')
        except Exception as e:
            print(f'  -> content_list failed: {e}')

    except Exception as e:
        print(f'  ERROR: {e}')
        import traceback
        traceback.print_exc()

print('\nAll done!')
