
"""
reddit_scraper.py — InferReach lead finder
No API key needed. Uses Reddit's public JSON endpoints.

Usage:
    python reddit_scraper.py
    python reddit_scraper.py --limit 50
    python reddit_scraper.py --sort hot
    python reddit_scraper.py --subreddits SaaS startups entrepreneur
"""

import requests, csv, time, logging, argparse
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

DEFAULT_SUBREDDITS = [
    "SaaS", "startups", "entrepreneur", "dataengineering",
    "BusinessIntelligence", "analytics", "smallbusiness", "growmybusiness",
]

KEYWORDS = [
    "data pipeline", "etl", "data warehouse", "bigquery", "snowflake",
    "data engineering", "data infrastructure", "data stack", "airbyte",
    "fivetran", "dbt", "airflow", "prefect", "dagster", "databricks",
    "manual reporting", "pulling reports", "spreadsheet mess",
    "messy data", "data quality", "stale dashboard", "broken dashboard",
    "no dashboard", "data is a mess", "data cleanup",
    "analytics setup", "tracking setup", "metrics don't match",
    "numbers don't add up", "conflicting data", "no visibility",
    "flying blind", "no single source of truth", "data silos",
    "google analytics", "mixpanel", "segment", "amplitude",
    "hire data engineer", "data analyst", "need data help",
    "looking for data", "data consultant", "fractional data",
    "reporting tool", "business intelligence", "bi tool",
    "looker", "metabase", "tableau", "power bi", "superset",
]

HIGH_VALUE = [
    "data pipeline", "data engineering", "etl", "data warehouse",
    "manual reporting", "data is a mess", "no dashboard",
    "hire data engineer", "data infrastructure", "data stack",
    "pulling reports", "data silos", "no single source of truth",
]

def score_post(title, body):
    text = f"{title} {body}".lower()
    score = 0
    matched = []
    for kw in KEYWORDS:
        if kw in text:
            points = 3 if kw in HIGH_VALUE else 1
            score += points
            matched.append(kw)
    return min(score, 10), list(set(matched))

def get_suggested_reply(keywords):
    kws = [k.lower() for k in keywords]
    if any(k in ["data pipeline", "etl", "data engineering", "airbyte", "dbt"] for k in kws):
        return "Seen this exact problem a lot. The fix is usually a proper ingestion layer + dbt on top. What does your current setup look like?"
    elif any(k in ["manual reporting", "pulling reports", "spreadsheet mess"] for k in kws):
        return "Manual reporting is one of those things that feels manageable until it isn't. Have you considered automating the pipeline? Happy to share a free approach."
    elif any(k in ["no dashboard", "broken dashboard", "stale dashboard"] for k in kws):
        return "Dashboard trust issues are almost always a data quality problem upstream. What are you using as your data source right now?"
    elif any(k in ["hire data engineer", "data consultant", "fractional data"] for k in kws):
        return "Before hiring full-time, worth considering whether you need someone ongoing or just to set up the foundation right. Happy to share what that looks like."
    elif any(k in ["data warehouse", "bigquery", "snowflake", "databricks"] for k in kws):
        return "Good choice of tools. What's the transformation layer looking like? That's usually where things get messy at this stage."
    else:
        return "Interesting situation. What does your current data setup look like? Happy to share what has worked for similar setups."

def scrape_subreddit(subreddit, limit=50, sort="new"):
    url = f"https://www.reddit.com/r/{subreddit}/{sort}.json?limit={limit}"
    results = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 429:
            log.warning(f"r/{subreddit}: rate limited, waiting 30s...")
            time.sleep(30)
            resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            log.error(f"r/{subreddit}: HTTP {resp.status_code}")
            return results
        data = resp.json()
        posts = data.get("data", {}).get("children", [])
        for post in posts:
            p = post.get("data", {})
            title = p.get("title", "")
            body = p.get("selftext", "")
            author = p.get("author", "[deleted]")
            permalink = p.get("permalink", "")
            upvotes = p.get("score", 0)
            comments = p.get("num_comments", 0)
            created = datetime.utcfromtimestamp(p.get("created_utc", 0)).strftime("%Y-%m-%d")
            post_url = f"https://reddit.com{permalink}"
            score, matched = score_post(title, body)
            if score == 0:
                continue
            results.append({
                "score": score,
                "subreddit": subreddit,
                "title": title[:120],
                "username": author,
                "reddit_url": post_url,
                "profile_url": f"https://reddit.com/u/{author}",
                "upvotes": upvotes,
                "comments": comments,
                "date": created,
                "matched_keywords": ", ".join(matched[:6]),
                "post_preview": body[:200].replace("\n", " ") if body else "",
                "suggested_reply": get_suggested_reply(matched),
                "outreach_done": "no",
                "reply_received": "no",
                "notes": "",
            })
        log.info(f"r/{subreddit}: {len(results)} relevant posts found out of {len(posts)}")
    except Exception as e:
        log.error(f"r/{subreddit}: {e}")
    return results

def save_csv(results, output_file):
    if not results:
        log.warning("No leads found.")
        return 0
    results.sort(key=lambda x: x["score"], reverse=True)
    fields = [
        "score", "subreddit", "title", "username",
        "reddit_url", "profile_url", "upvotes", "comments", "date",
        "matched_keywords", "post_preview", "suggested_reply",
        "outreach_done", "reply_received", "notes",
    ]
    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(results)
    return len(results)

def print_summary(results):
    if not results:
        print("\nNo leads found. Try --sort hot or --limit 100\n")
        return
    hot  = [r for r in results if r["score"] >= 6]
    warm = [r for r in results if 3 <= r["score"] < 6]
    cold = [r for r in results if r["score"] < 3]
    print("\n" + "="*60)
    print("INFERREACH REDDIT LEAD REPORT")
    print("="*60)
    print(f"Total leads:     {len(results)}")
    print(f"Hot (score 6+):  {len(hot)}  <- engage these first")
    print(f"Warm (3-5):      {len(warm)}")
    print(f"Cold (1-2):      {len(cold)}")
    print("="*60)
    if hot:
        print("\nTOP HOT LEADS:\n")
        for r in hot[:8]:
            print(f"  [{r['score']}/10] r/{r['subreddit']} | u/{r['username']}")
            print(f"  {r['title'][:75]}")
            print(f"  {r['reddit_url']}")
            print(f"  Reply: {r['suggested_reply'][:80]}...")
            print()

def main():
    parser = argparse.ArgumentParser(description="InferReach Reddit Lead Scraper - no API key needed")
    parser.add_argument("--limit",      type=int, default=50,             help="Posts per subreddit (default 50)")
    parser.add_argument("--sort",       choices=["new","hot","top"],       default="new")
    parser.add_argument("--subreddits", nargs="+",                         default=DEFAULT_SUBREDDITS)
    parser.add_argument("--output",     default="reddit_leads.csv")
    args = parser.parse_args()

    log.info(f"Scraping {len(args.subreddits)} subreddits | {args.limit} posts each | sort={args.sort}")
    all_results = []
    for i, sub in enumerate(args.subreddits):
        results = scrape_subreddit(sub, limit=args.limit, sort=args.sort)
        all_results.extend(results)
        if i < len(args.subreddits) - 1:
            time.sleep(2)

    total = save_csv(all_results, args.output)
    print_summary(all_results)

    if total > 0:
        print(f"\nSaved {total} leads to: {args.output}")
        print("\nNext steps:")
        print("  1. Open reddit_leads.csv")
        print("  2. Sort by score column highest first")
        print("  3. Open the reddit_url for each hot lead")
        print("  4. Post the suggested_reply as a comment")
        print("  5. DM the user if they engage with your comment")

if __name__ == "__main__":
    main()
