#!/usr/bin/env python3
"""Build the Genesys run-of-show (runofshow/genesys-run-of-show.html).

Same layout as the Värde run-of-show. Every Show link points at a live record or page
in the demo account. Internal IDs come from runofshow/ids.json, a copy of the
gi_config.json the GI Demo Setup loader writes to the File Cabinet (plus "account").
Until ids.json exists, links render as placeholders. Re-run after reloading data.
"""
import pathlib, json, base64, html, os, re

HERE = pathlib.Path(__file__).parent
try:
    IDS = json.load(open(HERE / "ids.json", encoding="utf-8"))
except FileNotFoundError:
    IDS = {}
ACCT = IDS.get("account", "ACCOUNT")
B = f"https://{ACCT.lower().replace('_', '-')}.app.netsuite.com"
JOB = IDS.get("jobs", {})
VEN = IDS.get("vendors", {})
LJE = IDS.get("labourJe", {})


def L(text, path):
    if path is None or "None" in path:
        return f'<b>{html.escape(text)}</b> <span class="ref">(link after load)</span>'
    return f'<a href="{B}{path}" target="_blank" rel="noopener">{html.escape(text)}</a>'


def project(i): return f"/app/accounting/project/project.nl?id={i}" if i else None
def je(i): return f"/app/accounting/transactions/journal.nl?id={i}" if i else None
def new_bill(vendor): return f"/app/accounting/transactions/vendbill.nl?entity={vendor}" if vendor else None
def new_inv(job): return f"/app/accounting/transactions/custinvc.nl?entity={job}" if job else None
def sl(script, deploy, q=""): return f"/app/site/hosting/scriptlet.nl?script={script}&deploy={deploy}{q}"


WIP = sl("customscript_gi_wip_sl", "customdeploy_gi_wip_sl")
SETUP = sl("customscript_gi_setup_sl", "customdeploy_gi_setup_sl")
PROJECTS = "/app/accounting/project/projects.nl"
J = lambda n: JOB.get(n)

FIT = {
    "N": ("Native", "#1b7f3b", "Standard NetSuite, configured only."),
    "B": ("Built", "#a35200", "Built for this demo on the platform: four fields on the standard project record and one SuiteScript report, all in the SDF project. Delivered by the implementation; Oracle's WIP SuiteApp can replace it when it is generally available."),
    "D": ("Described", "#7a2e8f", "Not run live: describe and show the screen."),
}


def fit(code):
    name, color, _ = FIT[code]
    return f'<span class="fit" style="background:{color}">{name}</span>'


# ---------------------------------------------------------------- content
# Each segment: (title, minutes, objective, steps, capabilities, notes)
# Each step: (n, title, refs, fit, show_html, say_text)
SEG = []

SEG.append(("Jobs on the project record", 5,
 "A Genesys job is a standard NetSuite project under the general contractor, carrying the contract value and the PM's estimate that drive WIP.",
 [
  (1, "The job list", "Jobs", "N",
   f"{L('Jobs list', PROJECTS)}: the twelve jobs 01-00044 to 01-00177 under four general contractors, with Contract Value, Estimated Total Cost and Job State as columns.",
   "Each construction job is a project under the general contractor it works for, numbered the way you number jobs today, with its contract value and estimate right on the list. When a job is won in HubSpot, the award comes across with contract value, projected costs and resources, and accounting sets the project up from a template."),
  (2, "Contract value and estimate on the project", "WIP inputs", "B",
   f"Open {L('01-00177 Orlando Airport Terminal C', project(J('01-00177')))}: customer (Summit Ridge GC), status In Progress, start date. Click the <b>Custom</b> subtab: <b>Contract Value</b> $4,200,000, <b>Estimated Total Cost</b> $3,530,000, Job State FL, <b>Include on WIP Schedule</b>.",
   "Two numbers drive the WIP: the contract value, including approved change orders, and the project manager's current estimate of total cost at completion. They sit on the project record and the PM updates the estimate. Everything else — cost to date, billings to date — comes from transactions, so nobody re-keys it into a spreadsheet."),
 ],
 "Project records; project templates; customer-job hierarchy; project status.",
 "If Dillon has already shown the project record and Project Center, skip 1.1 and start at 1.2."))

SEG.append(("Cost and billing land on the job", 8,
 "Ordinary transactions put cost and billing on the job: vendor bills, the labour allocation and pay applications.",
 [
  (1, "Materials bill coded to the job", "Job cost", "N",
   f"{L('New bill from Westline Electrical Supply', new_bill(VEN.get('materials')))} (vendor already filled). Reference No. <code>WES-TC-4471</code>; <b>Location</b> (Classification) = <code>Genesys HQ (DEMO)</code>. Expenses line: Account <code>5950 GI Job Cost - Materials</code>, Amount <code>180,000</code>, Memo <code>Terminal C cable tray and Cat6A</code>, line <b>Location</b> = <code>Genesys HQ (DEMO)</code>, <b>Customer</b> = pick <code>01-00177 … Orlando Airport Terminal C</code> from the list (it's a dropdown, not type-ahead). Click Add, then Save.",
   "A $180,000 materials invoice from Westline arrives. AP codes the line to the job — that one field is all it takes for the cost to land on job 01-00177. Purchase orders work the same way when you buy against a job."),
  (2, "Field labour from ClockShark and ADP", "Labour cost", "N",
   f"Open the {L('labour allocation journal', je(LJE.get('ytd')))}: one debit line per job to <b>GI Job Cost - Field Labor</b>, credit payroll clearing.",
   "ClockShark stays for time. Hours by job times the cost rate from ADP payroll become one labour allocation per pay period, with a line per job. In implementation this is an import or a small integration rather than typing."),
  (3, "Pay application on the job", "Billing", "N",
   f"{L('New invoice for 01-00152 Miami Medical', new_inv(J('01-00152')))} (job already filled). Memo <code>Pay application 10 (Textura)</code>; <b>Location</b> = <code>Genesys HQ (DEMO)</code>. Items line: Item <code>GI Progress Billing (AIA)</code> from the list, Rate <code>350,000</code>, Tab, Add. Save.",
   "The pay application has been approved in Textura. The amount billed to the general contractor is recorded on the job as an invoice, so billings to date are always in NetSuite."),
  (4, "AIA and Textura", "Textura", "D",
   "—",
   "Textura stays the GC-facing system for pay apps. Bringing the approved pay app into NetSuite automatically — a file drop from Textura, or a connector — is part of implementation design and depends on what each GC's Textura instance allows."),
 ],
 "Vendor bills and POs coded to projects; journal import; invoicing on projects; progress billing.",
 "This TestDrive's bill form needs a Location on the header AND on every expense line (it pops up 'Location is required on every bill line' otherwise); invoices need the header Location. Use Genesys HQ (DEMO) everywhere. Keep the bill and invoice amounts exactly as written: the WIP figures in segment 3 assume them. Don't commit to the Textura design or to designated-vendor enforcement (Wesco-only jobs); both are open items for the statement of work."))

SEG.append(("The WIP schedule", 14,
 "Genesys' WIP schedule, column for column with their Excel template, produced live from the projects and the GL.",
 [
  (1, "Their template, in NetSuite", "WIP template", "B",
   f"Open {L('Genesys Impact - WIP Schedule', WIP)}. Walk the column groups: Contract Totals, From Inception, Current Year, Prior Years; then the tiles.",
   "This is the schedule you build in Excel today, with the same columns in the same order. Percent complete is cost-to-cost: cost to date over the PM's estimate. Earned revenue is that percentage times the contract. Compare earned with billed and you get the over and under billing. The current-year and prior-year columns split the same numbers by year. Across the twelve jobs: $19.7 million of contract, $13.3 million earned, $12.6 million billed, about $1 million under-billed and $310 thousand over-billed — before what we just entered."),
  (2, "What we just entered", "Live update", "B",
   "Click <b>Refresh</b>. 01-00177 goes from 18.0% to <b>23.1%</b> complete and its under-billing from $335.5K to <b>$549.7K</b>. On 01-00152 under-billing drops from $356.3K to <b>$6.3K</b>. Tiles: earned $13,537,500, billed $12,995,000, under-billed $852,500.",
   "The bill we just entered moved Orlando from 18 to 23 percent complete, and because we haven't billed for that work yet, under-billing went up by about $214 thousand. The pay app on Miami Medical caught billing up to the work — under-billing there is down to $6 thousand. No spreadsheet, no month-end refresh."),
  (3, "Drill to the source", "Audit trail", "B",
   "Click the JTD Contract Costs figure on 01-00177, then open the Westline bill from the list. Back, then click JTD Billings.",
   "Every number on the schedule goes back to the bills, labour journals and pay apps behind it, so the auditors' question 'where does this come from' is answered with one click."),
  (4, "Loss job", "Loss provision", "B",
   f"The red row: {L('01-00155 Charlotte HQ', project(J('01-00155')))} — estimated cost $1.52M on a $1.45M contract; the note under the table.",
   "Charlotte has been re-estimated above its contract value, so the schedule flags it as a loss job: a projected loss of $70 thousand. Under US GAAP the whole expected loss is recognised now, not as the work is done, and the schedule makes sure nobody misses it."),
  (5, "The PM revises an estimate", "Re-forecast", "N",
   f"Open {L('01-00170 Capitol Hill Annex', project(J('01-00170')))}, Edit, change <b>Estimated Total Cost</b> from <code>905,000</code> to <code>1,010,000</code>, Save. Back on the schedule, Refresh.",
   "The PM tells us the Capitol Hill job will cost more than planned. They change one number on the project. Percent complete drops from 75 to 67 percent, earned revenue comes down, and job-to-date gross profit falls from $161 thousand to $74 thousand. The forecast change flows straight through to revenue and margin."),
  (6, "Year-end view", "As of date", "B",
   "Set <b>As of</b> to 12/31 last year, Refresh (eight jobs; earned about $6.9M against $6.88M billed). Then set it back to today and Refresh.",
   "Any date works, so the year-end WIP your auditors and your bank see is the same report. At last year-end eight jobs were under way, with about $6.9 million earned against $6.9 million billed; the jobs that started this year drop off."),
  (7, "Export to Excel", "Excel", "B",
   "Click <b>Export to Excel (CSV)</b> and open the file.",
   "If the bank or the PE firm wants the WIP as a spreadsheet, it's one click, with the same columns as today's file."),
  (8, "Book the over and under billing", "WIP journal", "B",
   "Click <b>Post WIP Adjustment JE</b>. On the journal: debit <b>Costs & Est. Earnings in Excess of Billings</b> and credit revenue per under-billed job; debit revenue and credit <b>Billings in Excess</b> per over-billed job; Reversal Date = the 1st of next month. Open the <b>GL Impact</b> subtab if asked.",
   "Month end: one click books the contract asset and contract liability from the schedule, job by job, and reverses on the first of next month, so the balance sheet and the income statement agree with the WIP without a manual journal."),
  (9, "Project profitability", "Profitability", "D",
   "—",
   "Because cost and revenue post to the job, NetSuite's project profitability and Project Center work on the same data once Project Management is switched on (it is off in this generic account). The WIP schedule is the accountant's view; profitability is the PM's view of the same job."),
 ],
 "Cost-to-cost percent complete; over/under billing; contract asset and liability; reversing journals; project profitability; saved searches and Excel export.",
 "If the CFO consultant asks about prior years: the schedule calculates prior-year revenue from cost at last year-end and today's estimate. Excel carries last year's figures forward; in implementation we would snapshot the year-end WIP. The Status column shows today's status even on the year-end view (01-00079 shows Closed at last year-end). The JE button posts once per date; Reset removes it and its reversal."))

SEG.append(("Wrap-up and hand back", 3,
 "What was standard, what was built, and what comes next.",
 [
  (1, "Standard vs built", "Fit", "D", "This page's fit tags.",
   "Everything you saw sits on the standard project record and standard transactions. The WIP schedule itself is four fields and one report, built on the platform and upgrade-safe; when Oracle's WIP SuiteApp is generally available it can take over."),
  (2, "Next step", "Follow-up", "D", "—",
   "If this is the direction, the next session runs the same schedule on your own jobs, from your current WIP file, so you can tie it to the numbers you know. Then hand back to Dillon."),
 ],
 "", "No pricing in this segment: our estimate goes to Connor separately."))


CONTEXT_HTML = """
<h2 id="context">Context for this session</h2>
<table><tbody>
<tr><th>Meeting</th><td>Fri 20 Nov, 10:00-11:00 ET, "Genesys + NetSuite | Alignment Workshop (Demo)", Connor O'Grady's Zoom. Dillon Barclay (Oracle SC) runs the demo and the out-of-the-box overview incl. NetSuite Next; we take WIP and projects (~30 min) when he reaches projects. Bob Alario (Oracle) also on.</td></tr>
<tr><th>Who decides</th><td><b>Jad Boustany</b>, CEO: decides, very price-sensitive, wants it simple. A <b>CFO consultant from their PE firm</b> (name unknown) may attend; missed the first demo, so expect accounting questions on WIP maths.</td></tr>
<tr><th>The company</th><td>Systems integrator in construction tech (cabling, CCTV, access control, AV rooms), ~$20-30M revenue, one entity, $33M backlog, $50M target. Replacing Deltek Vantage Point. Revenue: ~70% system integration (AIA progress billing as a subcontractor to GCs, through Textura), ~15% federal T&amp;M (winding down, no DCAA), ~15% MSP recurring.</td></tr>
<tr><th>Why WIP matters</th><td>Their WIP schedule is the blocker: native NetSuite projects don't produce it and Oracle's WIP SuiteApp isn't live, which is why the first partner stalled and Oracle brought us in. Their template (12 jobs, cost-to-cost % complete, earned revenue, over/under billing, YTD and prior years) is what segment 3 reproduces column for column.</td></tr>
<tr><th>Staying as is</th><td>ClockShark (time), HubSpot (CRM, awards), ADP (payroll), Zendesk (out of scope). Textura stays GC-facing; it may not need to come into NetSuite at all.</td></tr>
<tr><th>Do not</th><td>Quote any price or implementation estimate (Faizan sends ours to Connor; Jad pushed back to $15K, Connor showed $19K ARR and wants to close in November). Mention the competitor (Aduma). Commit to the Textura integration design or to enforcing designated vendors (Wesco-only jobs) &mdash; both are statement-of-work items.</td></tr>
</tbody></table>
<h3>Likely questions</h3>
<table><tbody>
<tr><th>"Is this standard NetSuite?"</th><td>The project, bills, invoices and journals are standard. The schedule is four fields on the project and one report, built on the platform and upgrade-safe; Oracle's WIP SuiteApp can take over when it's generally available.</td></tr>
<tr><th>"Where do prior years come from?"</th><td>Cost at last year-end over today's estimate, times contract. Their Excel carries last year's figures forward; in implementation we'd snapshot the year-end WIP so prior years never move.</td></tr>
<tr><th>"Can it run on our jobs?"</th><td>Yes: the next step is a targeted session on their own jobs from their current WIP file, so the numbers tie to what they know.</td></tr>
<tr><th>"What about history?"</th><td>They asked for 3 years. Recommended approach: monthly summarised trial balances plus open transactions and master data; detailed history costs more. Detail goes in the proposal, not the demo.</td></tr>
<tr><th>"Time and expenses?"</th><td>Time stays in ClockShark; labour cost comes in by job (step 2.2). Expenses: 10 Employee Center users code expense reports to jobs and they land on the WIP the same way.</td></tr>
<tr><th>"Loss jobs?"</th><td>Flagged on the schedule (01-00155); the full expected loss should be recognised now. In implementation the WIP journal can also book the loss provision.</td></tr>
</tbody></table>
"""

# ---------------------------------------------------------------- render
SHOT_DIR = HERE / "shots"
try:
    SHOT_CAPTIONS = {k: v["caption"] for k, v in json.load(open(HERE / "shots.json", encoding="utf-8")).items()}
except FileNotFoundError:
    SHOT_CAPTIONS = {}


def build():
    total = sum(s[1] for s in SEG) + 1
    rows = []
    for i, (title, mins, *_rest) in enumerate(SEG, 1):
        rows.append(f'<tr><td>{i}</td><td><a href="#s{i}">{html.escape(title)}</a></td><td>{mins}</td></tr>')
    legend = "".join(f"<li>{fit(k)} {html.escape(v[2])}</li>" for k, v in FIT.items())
    secs = []
    counts = {k: 0 for k in FIT}
    for i, (title, mins, obj, steps, caps, notes) in enumerate(SEG, 1):
        body = [f'<h2 id="s{i}">{i}. {html.escape(title)} ({mins} min)</h2>', f"<p><b>Objective.</b> {html.escape(obj)}</p>"]
        for (n, st, refs, fc, show, say) in steps:
            counts[fc] += 1
            body.append(f'<h3>{i}.{n} {html.escape(st)} <span class="ref">{html.escape(refs)}</span> {fit(fc)}</h3>')
            body.append(f"<p><b>Show:</b> {show}</p>")
            body.append(f"<blockquote>{html.escape(say)}</blockquote>")
            shots = sorted(SHOT_DIR.glob(f"{i}_{n}_*.jpg")) + sorted(SHOT_DIR.glob(f"{i}_{n}_*.png")) if SHOT_DIR.exists() else []
            for f in shots:
                cap = SHOT_CAPTIONS.get(f.stem, f"{i}.{n} {st}")
                mime = "image/png" if f.suffix == ".png" else "image/jpeg"
                src = f"data:{mime};base64," + base64.b64encode(f.read_bytes()).decode()
                body.append(f'<figure><img loading="lazy" src="{src}" alt="{html.escape(cap)}"><figcaption>{html.escape(cap)}</figcaption></figure>')
        if caps:
            body.append(f"<p><b>Capabilities to name:</b> {html.escape(caps)}</p>")
        if notes:
            body.append(f'<p class="note"><b>Presenter notes.</b> {html.escape(notes)}</p>')
        secs.append("\n".join(body))
    count_line = ", ".join(f"{FIT[k][0]} {v}" for k, v in counts.items())
    css = ("body{font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;max-width:1100px;margin:0 auto;padding:32px 24px;color:#1f2933;line-height:1.5;background:#fff}"
           "h1{font-size:30px;border-bottom:3px solid #0f2a44;padding-bottom:8px}h2{font-size:22px;margin-top:48px;color:#0f2a44;border-bottom:1px solid #d8dee6;padding-bottom:6px}"
           "h3{font-size:16px;margin-top:24px}code{background:#eef1f5;padding:1px 5px;border-radius:3px;font-size:.92em}"
           "table{border-collapse:collapse;margin:14px 0;font-size:14px}th,td{border:1px solid #d8dee6;padding:6px 10px;text-align:left;vertical-align:top}th{background:#eef1f5}"
           "a{color:#0b5fa5}blockquote{margin:8px 0;padding:10px 16px;border-left:4px solid #0b5fa5;background:#f4f8fc;font-style:italic}"
           ".fit{color:#fff;font-size:11px;font-weight:600;padding:2px 7px;border-radius:10px;vertical-align:middle;font-style:normal}"
           ".ref{font-size:12px;color:#5b6b7b;font-weight:400}.note{background:#fff8e6;border:1px solid #f0d58c;padding:10px 14px;border-radius:6px}"
           "ul.legend{list-style:none;padding:0}ul.legend li{margin:4px 0}"
           "figure{margin:12px 0 20px}figure img{max-width:100%;border:1px solid #d8dee6;border-radius:4px}figcaption{font-size:12px;color:#5b6b7b;margin-top:4px}")
    loaded = IDS.get("loadedAt", "")[:10] or "not yet loaded"
    page = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Genesys Impact on NetSuite — WIP and projects segment</title><style>{css}</style></head><body>
<h1>Genesys Impact on NetSuite — WIP and projects segment</h1>
<p><i>Run-of-show for Meadowport's ~30-minute segment of the Genesys + NetSuite alignment workshop (Fri 20 Nov, with Dillon Barclay leading). Generic demo with sample data: the general contractors, jobs and amounts are fictional, in Genesys' job-number format. Links open the demo account ({ACCT}); log in first.</i></p>
<p><b>Before you start.</b> Log in to {ACCT} as Administrator. Open {L('GI Demo Setup', SETUP)} and check the data is loaded and no live-demo transactions are left over (Reset after demo &rarr; preview should be empty). Open {L('the WIP schedule', WIP)}: totals should read contract $19,730,000, earned $13,323,336, billed $12,645,000, under-billed $988,336, over-billed $310,000. Keep tabs open on the schedule, {L('01-00177', project(J('01-00177')))} and {L('01-00170', project(J('01-00170')))}. Afterwards: GI Demo Setup &rarr; Reset after demo &rarr; Confirm (restores the estimate on 01-00170 and deletes the bill, invoice and WIP journal entered live). Rehearsed end to end on 19 Nov; every figure in this page matched.</p>
<table><thead><tr><th>#</th><th>Segment</th><th>Minutes</th></tr></thead><tbody>
<tr><td>0</td><td>Handoff from Dillon when he reaches projects</td><td>1</td></tr>
{''.join(rows)}<tr><td></td><td><b>Total</b></td><td><b>{total}</b></td></tr></tbody></table>
<p><a href="#context">Context for this session</a> (audience, why WIP matters, what not to say, likely questions) is at the end of this page.</p>
<p><b>Fit tags.</b> Every step carries one ({count_line}).</p><ul class="legend">{legend}</ul>
{''.join(secs)}
{CONTEXT_HTML}
<hr><p class="ref">Generated by runofshow/build.py from the Genesys demo repo. Record IDs as loaded into {ACCT}: {loaded}.</p>
</body></html>"""
    out = HERE / "genesys-run-of-show.html"
    out.write_text(page, encoding="utf-8")
    print(out, total, "min", count_line)


if __name__ == "__main__":
    build()
