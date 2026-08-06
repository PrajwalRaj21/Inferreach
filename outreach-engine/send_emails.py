"""
sender.py — InferReach cold email sender
Reads customized CSV export, uses Groq API to generate human-grade personalization lines,
and sends via Resend.
"""

import os, csv, time, logging, argparse, requests
from pathlib import Path
from dotenv import load_dotenv
from groq import Groq

load_dotenv(dotenv_path=Path(__file__).parent / '.env')
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

# API Configurations
RESEND_API_KEY = os.getenv('RESEND_API_KEY')
GROQ_API_KEY   = os.getenv('GROQ_API_KEY')
FROM_EMAIL     = os.getenv('FROM_EMAIL', 'Prajwol from InferReach <prajwol@inferreach.com>')
TEST_EMAIL     = os.getenv('TEST_EMAIL', 'prajwol@inferreach.com')
CONTACTS_FILE  = os.getenv('CONTACTS_FILE', 'contacts.csv')
DELAY_SECONDS  = 2

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY missing from .env file.")
if not RESEND_API_KEY:
    raise ValueError("RESEND_API_KEY missing from .env file.")
groq_client = Groq(api_key=GROQ_API_KEY)


def clean_company_name(company):
    if not company:
        return "your team"
    for suffix in [' Inc.', ' Inc', ' LLC', ' Ltd.', ' Ltd', ', Inc.', ', LLC']:
        if company.endswith(suffix):
            company = company.replace(suffix, '')
    return company.strip()


def generate_deep_personalization(first_name, job_title, company, industry, sub_industry):
    """
    Forces Groq to write a bespoke, contextual opening line based on their operational reality.
    """
    company_clean = clean_company_name(company)
    
    prompt = f"""
    You are a technical data engineer writing a raw, 1-to-1 cold email opening line to a peer or executive. 
    It must sound 100% written by a human who looked at their LinkedIn profile for 2 minutes. No fluff.

    Prospect details:
    - Name: {first_name}
    - Title: {job_title}
    - Company: {company_clean}
    - Industry/Niche: {industry} ({sub_industry})

    Task: Write an opening 1-2 sentence hook. 
    - Identify a very specific data engineering pain point inherent to their EXACT role and industry.
    - Marketing/Growth (CMO): Focus on multi-channel attribution, ad-spend data syncing late, or untrustworthy conversion analytics.
    - Finance/Operations (CFO): Focus on messy billing schemas, reconciling fragmented data silos, or pipeline latency during end-of-month reporting.
    - Engineering/Tech (CTO/VPE): Focus on developers wasting time maintaining pipelines/ETL instead of core product, or scaling database costs.
    
    Rules:
    - Start immediately with a natural observation. Do NOT say "Congrats on...", "I came across your profile...", or "As a [Title] at [Company]..."
    - Never use words like "stale", "broken", "streamline", "leverage", "robust", "revolutionize", "cutting-edge".
    - Keep the tone casual, sharp, and direct. Lowercase styling for casual phrases is okay.
    - Return ONLY the opening sentences. No quotation marks, no preamble.

    Examples:
    1. For a CMO in SaaS: "Saw what you guys are building at {company_clean}. Usually, pulling clean attribution data from your ad channels into a single dashboard turns into a massive headache as you scale paid spend."
    2. For a CFO: "Managing financial modeling at a fast-growing {sub_industry} company is brutal when the billing data and database metrics don't perfectly reconcile."
    3. For a CTO: "Assuming your engineering team is spending more time writing custom ETL scripts and managing pipeline downtime than shipping features right now."
    """

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=90
        )
        return completion.choices[0].message.content.strip().strip('"').strip("'")
    except Exception as e:
        log.error(f"Groq failed: {e}")
        return f"Came across your role at {company_clean}—imagining keeping your data workflows clean as you scale is a moving target right now."


def get_body(first_name, company, opening_hook):
    company_clean = clean_company_name(company)
    return f"""Hi {first_name},

{opening_hook}

I run InferReach. We act as an outsourced, on-demand data engineering team—building and managing your entire data infrastructure end-to-end so your team never has to fight it or maintain it.

Happy to do a completely free, 30-minute audit of {company_clean}’s current data setup if you're open to it. No pitching, just practical recommendations on where your pipelines are leaking.

Worth a brief chat this week?

Prajwol
inferreach.com
"""


def get_html(first_name, company, opening_hook):
    first_name = first_name.strip().capitalize()
    company_clean = clean_company_name(company)
    
    return f"""<div style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.6;max-width:550px">
<p>Hi {first_name},</p>
<p>{opening_hook}</p>
<p>I run <a href="https://inferreach.com" style="color:#10b981; text-decoration:none; font-weight:bold;">InferReach</a>. We act as an outsourced, on-demand data engineering team—building and managing your entire data infrastructure end-to-end so your team never has to fight it or maintain it.</p>
<p>Happy to do a completely free, 30-minute audit of {company_clean}’s current data setup if you're open to it. No pitching, just practical recommendations on where your pipelines are leaking.</p>
<p>Worth a brief chat this week?</p>
<p>Prajwol<br><a href="https://inferreach.com" style="color:#10b981">inferreach.com</a></p>
</div>"""


def send(to_email, first_name, company, job_title, industry, sub_industry):
    company_clean = clean_company_name(company)
    subject = f"question for {first_name} ({company_clean} data)"
    
    # Generate the deeply personalized opening
    log.info(f"Generating bespoke research line for {first_name} ({company_clean})...")
    opening_hook = generate_deep_personalization(first_name, job_title, company, industry, sub_industry)
    
    try:
        r = requests.post('https://api.resend.com/emails',
            headers={'Authorization': f'Bearer {RESEND_API_KEY}', 'Content-Type': 'application/json'},
            json={'from': FROM_EMAIL, 'to': [to_email],
                  'subject': subject,
                  'text': get_body(first_name, company, opening_hook), 
                  'html': get_html(first_name, company, opening_hook)},
            timeout=10)
        r.raise_for_status()
        log.info(f'Sent to {to_email} — id: {r.json().get("id")}')
        return True
    except Exception as e:
        log.error(f'Failed {to_email}: {e}')
        return False


def load_contacts(filepath):
    contacts = []
    try:
        with open(filepath, newline='', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                email = (row.get('Work email') or row.get('Work email 2') or row.get('Private email') or '').strip()
                full_name = row.get('Contact name', '').strip()
                
                if not full_name or not email or '@' not in email:
                    continue

                fname = full_name.split()[0].capitalize()
                contacts.append({
                    'email': email, 
                    'first_name': fname,
                    'company': row.get('Company name', '').strip(),
                    'job_title': row.get('Job title', '').strip(),
                    'industry': row.get('Industry', '').strip(),
                    'sub_industry': row.get('Sub industry', '').strip()
                })
    except FileNotFoundError:
        log.error(f'{filepath} not found.')
    return contacts


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--test', action='store_true')
    args = parser.parse_args()

    if args.test:
        log.info(f'TEST MODE — sending to {TEST_EMAIL}')
        send(TEST_EMAIL, 'Rodrigo', 'Qntrl', 'Chief Marketing Officer', 'Technology, Information & Media', 'Software Development')
        return

    contacts = load_contacts(CONTACTS_FILE)
    if not contacts:
        log.error('No valid contacts found.')
        return

    log.info(f'{len(contacts)} contacts loaded. Initiating personalized campaign...')
    sent = failed = 0
    for i, c in enumerate(contacts, 1):
        if send(c['email'], c['first_name'], c['company'], c['job_title'], c['industry'], c['sub_industry']): 
            sent += 1
        else: 
            failed += 1
        if i < len(contacts): 
            time.sleep(DELAY_SECONDS)

    log.info(f'Complete. Sent: {sent} | Failed: {failed}')

if __name__ == '__main__':
    main()