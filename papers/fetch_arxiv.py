"""
arXiv 能源动力论文精准爬取脚本 v3
使用arXiv分类+关键词组合，精确筛选能源动力领域论文
"""

import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import json
import os
import time
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PAPERS_DIR = os.path.join(BASE_DIR, "pdf")
OUTPUT_FILE = os.path.join(BASE_DIR, "papers.json")

# 精准搜索查询 - 使用分类+关键词组合
# 重点关注: 电力系统、可再生能源、储能、能源优化、热能、核能、电动汽车
SEARCH_QUERIES = [
    # 电力系统与智能电网 (eess.SY = Systems and Control, eess.SP = Signal Processing)
    "cat:eess.SY AND (all:power grid OR all:smart grid OR all:microgrid OR all:power system OR all:energy management)",
    "cat:eess.SY AND (all:renewable energy OR all:wind power OR all:solar power OR all:photovoltaic)",
    "cat:eess.SY AND (all:battery OR all:energy storage OR all:electric vehicle OR all:fuel cell)",

    # 计算工程 (cs.CE = Computational Engineering)
    "cat:cs.CE AND (all:energy OR all:power OR all:thermal OR all:combustion OR all:turbine)",

    # 优化与控制 (math.OC = Optimization and Control)
    "cat:math.OC AND (all:energy OR all:power OR all:grid OR all:microgrid)",

    # 机器人与能源系统 (cs.RO, cs.MA = Multiagent Systems)
    "cat:cs.MA AND (all:energy OR all:power OR all:microgrid OR all:smart grid)",

    # 材料科学 - 能源材料 (cond-mat.mtrl-sci)
    "cat:cond-mat.mtrl-sci AND (all:solar cell OR all:photovoltaic OR all:battery OR all:fuel cell OR all:thermoelectric)",

    # 应用物理 (physics.app-ph)
    "cat:physics.app-ph AND (all:energy OR all:solar OR all:thermal OR all:photovoltaic OR all:fuel cell OR all:battery)",

    # 电气工程 (eess.SP, eess.PE = Power Engineering 如果存在)
    "cat:eess.SP AND (all:energy OR all:power system OR all:renewable OR all:grid)",

    # 通用 - 更精准的关键词
    "all:solar photovoltaic AND (cat:eess OR cat:physics.app-ph OR cat:cond-mat.mtrl-sci OR cat:cs.CE)",
    "all:wind turbine AND (cat:eess OR cat:cs OR cat:physics)",
    "all:battery management AND (cat:eess OR cat:cs OR cat:cond-mat)",
    "all:energy storage system AND (cat:eess OR cat:cs OR cat:cond-mat)",
    "all:microgrid energy AND (cat:eess OR cat:cs)",
    "all:power flow AND (cat:eess OR cat:math.OC)",
    "all:thermal management AND (cat:eess OR cat:physics.app-ph OR cat:cs.CE)",
    "all:nuclear reactor AND (cat:physics OR cat:eess)",
    "all:hydrogen production AND (cat:chemistry OR cat:physics OR cat:eess)",
    "all:electric vehicle charging AND (cat:eess OR cat:cs)",
    "all:building energy AND (cat:cs OR cat:eess)",
    "all:power electronics AND (cat:eess OR cat:physics.app-ph)",
]


def search_arxiv(query, max_results=50):
    base_url = "https://export.arxiv.org/api/query"
    params = {
        "search_query": query,
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    }
    url = base_url + "?" + urllib.parse.urlencode(params)
    print(f"  搜索: {query[:90]}...")

    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8")
    except Exception as e:
        print(f"  失败: {e}")
        return None


def parse_arxiv_xml(xml_text):
    ns = {
        "atom": "http://www.w3.org/2005/Atom",
        "arxiv": "http://arxiv.org/schemas/atom",
    }
    root = ET.fromstring(xml_text)
    papers = []

    for entry in root.findall("atom:entry", ns):
        title_elem = entry.find("atom:title", ns)
        if title_elem is None:
            continue

        title = re.sub(r"\s+", " ", title_elem.text.strip().replace("\n", " "))

        id_elem = entry.find("atom:id", ns)
        arxiv_id = id_elem.text.strip().replace("http://arxiv.org/abs/", "") if id_elem is not None else ""

        summary_elem = entry.find("atom:summary", ns)
        summary = re.sub(r"\s+", " ", summary_elem.text.strip()) if summary_elem is not None else ""

        published_elem = entry.find("atom:published", ns)
        published = published_elem.text.strip() if published_elem is not None else ""

        updated_elem = entry.find("atom:updated", ns)
        updated = updated_elem.text.strip() if updated_elem is not None else ""

        authors = []
        for author in entry.findall("atom:author", ns):
            name = author.find("atom:name", ns)
            if name is not None:
                authors.append(name.text.strip())

        categories = []
        for cat in entry.findall("atom:category", ns):
            categories.append(cat.get("term", ""))

        primary_category = ""
        pc = entry.find("arxiv:primary_category", ns)
        if pc is not None:
            primary_category = pc.get("term", "")

        pdf_url = ""
        abs_url = ""
        for link in entry.findall("atom:link", ns):
            if link.get("title") == "pdf":
                pdf_url = link.get("href", "")
            if link.get("type") == "text/html":
                abs_url = link.get("href", "")

        comment_elem = entry.find("arxiv:comment", ns)
        comment = comment_elem.text.strip() if comment_elem is not None else ""

        doi_elem = entry.find("arxiv:doi", ns)
        doi = doi_elem.text.strip() if doi_elem is not None else ""

        papers.append({
            "arxiv_id": arxiv_id,
            "title": title,
            "authors": authors,
            "abstract": summary,
            "published": published,
            "updated": updated,
            "categories": categories,
            "primary_category": primary_category,
            "pdf_url": pdf_url,
            "abs_url": abs_url,
            "comment": comment,
            "doi": doi,
            "local_pdf_path": "",
            "download_status": "pending",
        })

    return papers


def is_energy_related(paper):
    """进一步筛选，确保论文确实与能源动力相关"""
    text = (paper["title"] + " " + paper["abstract"]).lower()

    energy_keywords = [
        "energy", "power", "solar", "photovoltaic", "pv ", "wind turbine",
        "wind energy", "wind power", "battery", "fuel cell", "grid",
        "microgrid", "renewable", "storage", "thermal", "heat",
        "combustion", "engine", "turbine", "nuclear", "reactor",
        "hydrogen", "electric vehicle", "ev ", "hydropower", "hydroelectric",
        "smart grid", "power system", "power flow", "load flow",
        "distributed energy", "der ", "energy management", "demand response",
        "charging", "discharging", "state of charge", "soc ", "soh ",
        "thermoelectric", "geothermal", "tidal", "wave energy",
        "concentrating solar", "csp ", "thermal storage", "heat pump",
        "chp ", "combined heat", "gas turbine", "steam turbine",
        "power plant", "electricity", "voltage", "current",
        "transformer", "inverter", "converter", "power electronics",
        "mppt", "maximum power point", "irradiance",
        "superconducting", "fusion", "fission", "neutron",
        "cooling", "heating", "hvac", "insulation",
        "emission", "carbon", "decarboniz", "net zero",
        "efficiency", "optimization", "dispatch",
    ]

    # 至少匹配2个关键词
    match_count = sum(1 for kw in energy_keywords if kw in text)
    return match_count >= 2


def deduplicate(papers):
    seen = {}
    for p in papers:
        base_id = re.sub(r"v\d+$", "", p["arxiv_id"])
        if base_id not in seen:
            seen[base_id] = p
        elif p["updated"] > seen[base_id]["updated"]:
            seen[base_id] = p
    return list(seen.values())


def download_pdf(paper, output_dir, max_retries=3):
    arxiv_id = paper["arxiv_id"]
    filename = arxiv_id.replace("/", "_") + ".pdf"
    filepath = os.path.join(output_dir, filename)

    if os.path.exists(filepath) and os.path.getsize(filepath) > 10000:
        paper["local_pdf_path"] = os.path.abspath(filepath)
        paper["download_status"] = "success"
        return True

    pdf_url = paper.get("pdf_url", "")
    if not pdf_url:
        paper["download_status"] = "no_pdf_url"
        return False

    for attempt in range(max_retries):
        try:
            if attempt > 0:
                wait = 15 * attempt
                print(f"      等待 {wait}s 后重试...")
                time.sleep(wait)

            req = urllib.request.Request(pdf_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = resp.read()

            if len(data) > 10000:
                with open(filepath, "wb") as f:
                    f.write(data)
                paper["local_pdf_path"] = os.path.abspath(filepath)
                paper["download_status"] = "success"
                print(f"      OK ({len(data)//1024}KB)")
                return True
            else:
                print(f"      文件过小({len(data)}B)")
        except Exception as e:
            err_str = str(e)[:60]
            print(f"      失败({attempt+1}/{max_retries}): {err_str}")

    paper["download_status"] = "failed"
    return False


def main():
    print("=" * 60)
    print("arXiv 能源动力论文精准爬取 v3")
    print("=" * 60)

    os.makedirs(PAPERS_DIR, exist_ok=True)

    # 步骤1: 搜索
    all_papers = []
    for i, query in enumerate(SEARCH_QUERIES):
        print(f"\n[{i+1}/{len(SEARCH_QUERIES)}]")
        xml_text = search_arxiv(query)
        if xml_text is None:
            time.sleep(5)
            continue

        papers = parse_arxiv_xml(xml_text)
        april_papers = [p for p in papers if p["published"].startswith("2026-04")]
        energy_papers = [p for p in april_papers if is_energy_related(p)]
        print(f"  结果: {len(papers)} -> 4月: {len(april_papers)} -> 能源相关: {len(energy_papers)}")

        all_papers.extend(energy_papers)
        time.sleep(3)

    # 去重
    print(f"\n总计: {len(all_papers)} 篇")
    all_papers = deduplicate(all_papers)
    print(f"去重后: {len(all_papers)} 篇")

    # 立即保存JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_papers, f, ensure_ascii=False, indent=2)
    print(f"元数据已保存: {OUTPUT_FILE}")

    # 步骤2: 分批下载PDF
    print(f"\n开始下载PDF (分批, 每批20篇)...")
    success = 0
    fail = 0
    batch_size = 20

    for batch_start in range(0, len(all_papers), batch_size):
        batch = all_papers[batch_start:batch_start + batch_size]
        batch_num = batch_start // batch_size + 1
        print(f"\n--- 批次 {batch_num} ({len(batch)} 篇) ---")

        for i, paper in enumerate(batch):
            idx = batch_start + i + 1
            print(f"  [{idx}/{len(all_papers)}] {paper['title'][:55]}...")
            if download_pdf(paper, PAPERS_DIR, max_retries=2):
                success += 1
            else:
                fail += 1
            time.sleep(3)

        # 每批保存进度
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(all_papers, f, ensure_ascii=False, indent=2)
        print(f"  进度: 成功 {success}, 失败 {fail}")

        # 批次间等待
        if batch_start + batch_size < len(all_papers):
            print(f"  等待 60s...")
            time.sleep(60)

    # 最终统计
    print(f"\n{'=' * 60}")
    print(f"最终统计:")
    print(f"  总论文数: {len(all_papers)}")
    print(f"  已下载: {success}")
    print(f"  失败: {fail}")
    print(f"  清单: {OUTPUT_FILE}")
    print(f"  PDF目录: {PAPERS_DIR}")

    # 分类统计
    from collections import Counter
    cats = Counter(p["primary_category"] for p in all_papers)
    print(f"\n分类分布:")
    for cat, count in cats.most_common(10):
        print(f"  {cat}: {count}")


if __name__ == "__main__":
    main()
