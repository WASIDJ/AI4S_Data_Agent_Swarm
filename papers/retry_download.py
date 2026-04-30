"""
续传下载脚本 - 重新下载之前失败的PDF
增加延迟和重试机制来处理限流
"""

import json
import os
import time
import urllib.request
import urllib.error

PAPERS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pdf")
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "papers.json")

def download_pdf_with_retry(paper, output_dir, max_retries=3, base_delay=5):
    """带重试的PDF下载"""
    arxiv_id = paper["arxiv_id"]
    filename = arxiv_id.replace("/", "_") + ".pdf"
    filepath = os.path.join(output_dir, filename)

    if os.path.exists(filepath) and os.path.getsize(filepath) > 10000:
        paper["local_pdf_path"] = filepath
        paper["download_status"] = "success"
        return True

    pdf_url = paper.get("pdf_url", "")
    if not pdf_url:
        paper["download_status"] = "no_pdf_url"
        return False

    for attempt in range(max_retries):
        try:
            delay = base_delay * (attempt + 1)
            if attempt > 0:
                print(f"    重试 {attempt}/{max_retries}, 等待 {delay}s...")
                time.sleep(delay)

            req = urllib.request.Request(pdf_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = resp.read()
                if len(data) > 10000:  # PDF文件至少应该有10KB
                    with open(filepath, "wb") as f:
                        f.write(data)
                    paper["local_pdf_path"] = filepath
                    paper["download_status"] = "success"
                    print(f"  下载成功: {filename} ({len(data)//1024}KB)")
                    return True
                else:
                    print(f"  文件过小 ({len(data)}B), 可能不是有效PDF")
        except Exception as e:
            print(f"  失败 ({attempt+1}/{max_retries}): {e}")

    paper["download_status"] = "failed_after_retries"
    return False


def main():
    print("加载 papers.json...")
    with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
        papers = json.load(f)

    # 找出需要下载的论文
    pending = []
    for p in papers:
        status = p.get("download_status", "")
        local_path = p.get("local_pdf_path", "")
        # 检查文件是否真正存在
        if status == "success" and local_path and os.path.exists(local_path):
            continue
        if status == "no_pdf_url":
            continue
        pending.append(p)

    print(f"总计 {len(papers)} 篇, 需要下载 {len(pending)} 篇")

    if not pending:
        print("所有论文已下载完成!")
        # 统计
        success = sum(1 for p in papers if p.get("download_status") == "success")
        failed = sum(1 for p in papers if p.get("download_status") not in ("success", "no_pdf_url"))
        print(f"成功: {success}, 失败: {failed}")
        return

    success_count = 0
    fail_count = 0

    for i, paper in enumerate(pending):
        title = paper.get("title", "Unknown")[:60]
        print(f"\n[{i+1}/{len(pending)}] {title}...")
        if download_pdf_with_retry(paper, PAPERS_DIR, max_retries=3, base_delay=5):
            success_count += 1
        else:
            fail_count += 1
        # 间隔3秒避免限流
        time.sleep(3)

    # 保存更新后的papers.json
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(papers, f, ensure_ascii=False, indent=2)

    print(f"\n下载完成: 成功 {success_count}, 失败 {fail_count}")
    print(f"总计: 成功 {sum(1 for p in papers if p.get('download_status') == 'success')}, "
          f"失败 {sum(1 for p in papers if 'fail' in p.get('download_status', ''))}")


if __name__ == "__main__":
    main()
