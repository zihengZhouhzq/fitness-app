#!/usr/bin/env python3
"""
健身助手 - GIF 下载器 (分包策略)
从 ExerciseDB CDN 下载所有动作演示 GIF，按身体部位分目录存放。

用法:
  python download_gifs.py              # 下载所有 GIF
  python download_gifs.py --dry-run    # 预览将要下载的文件
  python download_gifs.py --category chest  # 仅下载指定部位
  python download_gifs.py --limit 10   # 仅下载前10个

CDN 格式: https://static.exercisedb.dev/media/{media_id}.gif
"""

import json
import os
import sys
import time
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'exercises.json')
GIFS_DIR = os.path.join(BASE_DIR, 'gifs')
CDN_BASE = 'https://static.exercisedb.dev/media'

# 下载配置
MAX_WORKERS = 8        # 并发下载数
RETRY_COUNT = 3        # 失败重试次数
RETRY_DELAY = 2        # 重试间隔(秒)


def load_exercises():
    """加载数据集"""
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def sanitize_category(category):
    """将身体部位转换为目录名"""
    return category.replace(' ', '_').lower()


def get_gif_url(media_id):
    """获取 GIF 的 CDN URL"""
    return f'{CDN_BASE}/{media_id}.gif'


def download_gif(media_id, category, dry_run=False):
    """
    下载单个 GIF，返回 (media_id, status, size)
    status: 'ok', 'skip', 'fail'
    """
    category_dir = sanitize_category(category)
    gif_dir = os.path.join(GIFS_DIR, category_dir)
    gif_path = os.path.join(gif_dir, f'{media_id}.gif')

    # 跳过已下载
    if os.path.exists(gif_path) and os.path.getsize(gif_path) > 0:
        return (media_id, 'skip', os.path.getsize(gif_path))

    if dry_run:
        return (media_id, 'dry_run', 0)

    os.makedirs(gif_dir, exist_ok=True)

    url = get_gif_url(media_id)

    for attempt in range(RETRY_COUNT):
        try:
            req = Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            with urlopen(req, timeout=30) as resp:
                data = resp.read()
                with open(gif_path, 'wb') as f:
                    f.write(data)
                return (media_id, 'ok', len(data))
        except HTTPError as e:
            if e.code == 404:
                return (media_id, 'not_found', 0)
            if attempt < RETRY_COUNT - 1:
                time.sleep(RETRY_DELAY)
        except (URLError, OSError) as e:
            if attempt < RETRY_COUNT - 1:
                time.sleep(RETRY_DELAY)

    return (media_id, 'fail', 0)


def main():
    parser = argparse.ArgumentParser(description='下载健身动作 GIF 演示')
    parser.add_argument('--dry-run', action='store_true', help='预览模式，不实际下载')
    parser.add_argument('--category', type=str, help='仅下载指定部位 (如 chest, back, upper_arms)')
    parser.add_argument('--limit', type=int, default=0, help='限制下载数量')
    parser.add_argument('--workers', type=int, default=MAX_WORKERS, help='并发下载线程数')
    args = parser.parse_args()

    # 加载数据
    print(f'加载数据: {DATA_FILE}')
    exercises = load_exercises()
    print(f'共 {len(exercises)} 个动作')

    # 按部位分组
    grouped = {}
    for ex in exercises:
        media_id = ex.get('media_id')
        category = ex.get('category', 'unknown')
        if not media_id:
            continue
        if args.category and sanitize_category(category) != args.category:
            continue
        if media_id not in grouped:
            grouped[media_id] = category

    # 去重
    unique = list(grouped.items())
    if args.limit > 0:
        unique = unique[:args.limit]

    total = len(unique)
    print(f'待下载 GIF: {total} (去重后)')

    if args.dry_run:
        # 按部位统计
        cat_counts = {}
        for _, cat in unique:
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
        print('\n--- 分包统计 ---')
        for cat, count in sorted(cat_counts.items()):
            print(f'  {cat}: {count} 个')
        print(f'\n总计: {total} 个 GIF')
        print(f'CDN: {CDN_BASE}/{{media_id}}.gif')
        return

    # 下载
    print(f'\n开始下载 (并发: {args.workers})...')
    stats = {'ok': 0, 'skip': 0, 'fail': 0, 'not_found': 0}
    total_size = 0
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(download_gif, mid, cat): mid
            for mid, cat in unique
        }

        completed = 0
        for future in as_completed(futures):
            mid, status, size = future.result()
            stats[status] += 1
            total_size += size
            completed += 1

            # 进度显示
            pct = completed / total * 100
            size_mb = total_size / (1024 * 1024)
            elapsed = time.time() - start_time
            speed = completed / elapsed if elapsed > 0 else 0
            print(f'\r[{pct:5.1f}%] {completed}/{total}  '
                  f'ok={stats["ok"]} skip={stats["skip"]} fail={stats["fail"]} 404={stats["not_found"]}  '
                  f'{size_mb:.1f}MB  {speed:.1f}/s', end='', flush=True)

    print()

    # 最终统计
    elapsed = time.time() - start_time
    print(f'\n=== 下载完成 ===')
    print(f'  成功: {stats["ok"]}')
    print(f'  跳过(已存在): {stats["skip"]}')
    print(f'  失败: {stats["fail"]}')
    print(f'  404不存在: {stats["not_found"]}')
    print(f'  总大小: {total_size / (1024 * 1024):.1f} MB')
    print(f'  耗时: {elapsed:.1f} 秒')

    # 分包大小统计
    print('\n--- 分包大小 ---')
    for cat_dir in sorted(os.listdir(GIFS_DIR)):
        cat_path = os.path.join(GIFS_DIR, cat_dir)
        if os.path.isdir(cat_path):
            count = len([f for f in os.listdir(cat_path) if f.endswith('.gif')])
            size = sum(os.path.getsize(os.path.join(cat_path, f))
                      for f in os.listdir(cat_path) if f.endswith('.gif'))
            print(f'  {cat_dir}: {count} 个, {size / (1024 * 1024):.1f} MB')


if __name__ == '__main__':
    main()