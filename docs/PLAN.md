# Genesys Impact - WIP demo implementation plan

Demo: **Fri 20 Nov 2026, 10:00-11:00 AM ET**, "Genesys + NetSuite | Alignment Workshop (Demo)", Connor's Zoom
(Faizan has asked Connor to move it; check before 9:00).
Audience: Jad Boustany (CEO, decision maker, very price-sensitive), possibly the PE firm's CFO consultant (name unknown),
Dillon Barclay (Oracle SC, runs the demo), Connor O'Grady and Bob Alario (Oracle).
Our slot: **about 30 minutes on WIP and project functionality**, slotted in where Dillon reaches projects.

## 1. What we are proving

Genesys runs WIP in Excel off Deltek. Native NetSuite projects don't produce their WIP schedule and Oracle's WIP
SuiteApp isn't live, which is why the first partner stalled. The demo has to show that:

1. Their WIP schedule comes straight out of NetSuite, **column for column with their template**, with no spreadsheet.
2. It is driven by normal work: a PM keeps contract value and estimate on the project, and costs and billings land from
   ordinary bills, labour journals and invoices.
3. It moves live: enter a bill or a pay app, or revise an estimate, then refresh and the numbers change.
4. Accounting gets what it needs: year-end view, drill-down to source, Excel export, and the over/under-billing journal.

Out of our slot (Dillon's, or a later targeted demo): platform overview, NetSuite Next, MSP recurring billing,
federal T&M invoicing, Textura/AIA integration, T&E in Employee Center. **Don't quote a price.** Faizan is sending
our estimate to Connor separately.

## 2. The template (Genesys WIP.xlsx), reproduced

One row per job plus totals, with the same 23 columns and group headings: Job, Description, Client, State, Status,
Billings Proof | Contract Revenues, Estimated Costs, Est. GP $, Est. GP %, Percent Complete | JTD Contract Revenues, JTD
Contract Costs, JTD Gross Profit, JTD Billings, Costs & GM in Excess of Billings, Billings in Excess of Costs & GM |
YTD Revenues, YTD Costs, YTD Gross Margin | Prior Years' Revenues, Costs, Gross Margin.

Formulas taken from the workbook (row 18 is `#REF!`, so we use it for layout only, not numbers):

| Column | Formula |
|---|---|
| Percent complete | JTD cost / estimated cost (cost-to-cost) |
| JTD revenue (earned) | ROUND(% complete x contract value, 2) |
| Under-billed (asset) | earned - billed, if positive |
| Over-billed (liability) | billed - earned, if positive |
| Billings proof | contract value - billed to date |
| YTD revenue / cost | JTD - prior years |
| Prior years' revenue | In Excel this is typed in from last year's WIP. **We compute it**: cost to prior year end / current estimate x contract value |

The prior-years calculation is our one simplification. It uses today's estimate rather than the one in force at year
end. Say so if the CFO consultant asks. In implementation we would snapshot the year-end WIP instead.

## 3. Build: standard project record plus one Suitelet

All in `sdf/` (SuiteCloud project, auth ID `genesys-demo`), deployed from your Mac like Värde, one commit per deploy.

| Piece | What it is |
|---|---|
| 4 project custom fields | Include on WIP Schedule (checkbox), Contract Value, Estimated Total Cost, Job State. They sit on the standard project record. |
| `gi_wip_lib.js` | Calculation library. It reads WIP projects with N/search, then job cost from the GL with SuiteQL (posting COGS/Expense lines whose line name is the project: bills, labour JEs, expense reports). Billings come from posted invoices and credit memos on the project. |
| `GI WIP Schedule` Suitelet | The report has KPI tiles (contract, earned, billed, under, over, backlog), the 23-column table with totals and a loss-job flag, an as-of date, a status filter, drill-down on JTD cost and JTD billings to the source transactions, links to each project, **Export to Excel (CSV)**, and **Post WIP Adjustment JE**. The JE is a reversing entry: Dr contract asset / Cr revenue for under-billing, and Dr revenue / Cr contract liability for over-billing. It is tagged to each project and auto-reverses the next day. It is idempotent per date. |
| `GI Demo Setup` Suitelet | **Load** creates everything below from `data/jobs.json`. It looks records up by `GI-` external IDs, so it is safe to re-run after a timeout. It then writes `gi_config.json`. **Reset** shows a preview and then, after Confirm, restores project values and deletes any transaction on the demo projects the loader didn't create, i.e. live-demo entries and the WIP JE. |

Why custom fields rather than native project budgets: they guarantee the same field IDs in any account, and Dillon
asked us to build on the standard record. Once we see the account, if Project Budgets or the native
estimated cost/revenue fields are on, we can point the library at those instead. Talk track: *"upgrade-safe:
standard project record, a few fields and one report; the Oracle WIP SuiteApp can replace it when it ships."*

### Dummy data (generic, fictional GCs, their job-number format)

- Accounts: GI Contract Revenue 4950; Job Cost Materials 5950 / Subcontractors 5951 / Field Labor 5952 (COGS);
  CIEB contract asset 1395; BIEC contract liability 2395; payroll clearing 2396.
- Customers (general contractors): Harborline Construction, Kestrel Builders, Summit Ridge GC, Atlas Federal Builders.
- Vendors: Westline Electrical Supply (materials), Keystone Low Voltage Subcontracting.
- Item: GI Progress Billing (AIA), a service item that posts to contract revenue.
- 12 projects, 01-00044 to 01-00177, in DC/VA/NY/FL/NC/CA. Five are completed and seven in progress, with $19.7M contract value.
- Per job and per year (last year and this year): a materials bill, a subcontract bill, and 1-2 pay-app invoices
  ("submitted via Textura"). Labour comes from one allocation JE per year ("ClockShark hours x ADP cost"). There are about 70 transactions in all (34 bills, 33 invoices, 2 JEs).
  Years shift automatically to the current year.

What the report shows on load (as of today, verified in code against the template formulas):

| | |
|---|---|
| Contract value | $19,730,000 |
| Earned to date | $13,323,336 |
| Billed to date | $12,645,000 |
| Under-billed | $988,336 (01-00079 retainage, 01-00152, 01-00170, 01-00177) |
| Over-billed | $310,000 (01-00139 front-loaded SOV, 01-00155, 01-00158) |
| Loss job | 01-00155 Charlotte HQ: estimate $1.52M on a $1.45M contract, flagged red |

## 4. Steps and timing (today, Thu 19 Nov)

| # | Step | Needs |
|---|---|---|
| 1 | Get the account. Use your TestDrive, or the one Dillon may share. | **You send it** |
| 2 | Check the account: OneWorld or not, Projects feature, SuiteCloud/token auth enabled, last year's periods open, project auto-numbering, bill/JE approval routing, existing projects to avoid | me, in the browser |
| 3 | Create the repo in the meadowport org and push the SDF project | your OK |
| 4 | `suitecloud account:setup` (auth ID `genesys-demo`), then `project:deploy` (deploy 1) | you, on your Mac |
| 5 | Run GI Demo Setup, then Load. Check the WIP totals match section 3 | me, in the browser |
| 6 | Fix anything account-specific (deploy 2+) | |
| 7 | Rehearse the live steps once, then Reset | |
| 8 | HTML run-of-show (Show / Say / presenter notes, live URLs, minutes) for the second monitor | me |
| 9 | Email Dillon with the handoff point | **you send** (draft below) |
| 10 | Commit: CONTEXT.md with record IDs and URLs | |

## 5. Our ~30 minutes, draft running order

| Min | Show | Point |
|---|---|---|
| 2 | Pick up from Dillon at Projects | "This is the report that stalled the last evaluation. Here it is in NetSuite." |
| 5 | Project **01-00177 Orlando Airport Terminal C**: customer = GC, status, contract value, estimated cost, start date | Contract value and the PM's estimate live on the project. The award comes from HubSpot. |
| 5 | **Enter a $180,000 Westline materials bill** coded to 01-00177 | Cost lands on the job, with no re-keying into Excel |
| 3 | **Progress invoice (pay app) $350,000 on 01-00152 Miami Medical** | Billing lands, which is the Textura pay app recorded in NetSuite |
| 10 | **WIP Schedule**: walk the columns against their template. Refresh: 01-00177 goes from 18.0% to 23.1% complete and under-billing from $335.5K to $549.7K; 01-00152 under-billing drops from $356.3K to $6.3K. Drill into JTD cost. Point to the 01-00155 loss flag. **Revise 01-00170's estimate from $905K to $1.01M**: it moves from 75.1% to 67.3% complete and JTD GP from $161.5K to $74.1K. Change the as-of date to 12/31 last year for the year-end WIP. Export to Excel. **Post WIP Adjustment JE** and show the GL impact and auto-reversal. | The whole template, live, from transactions |
| 3 | Wrap | Standard project record plus one report. Native project profitability still works. A targeted demo on their own jobs follows. |

Fallback if live entry fails: the report already tells the story on loaded data, so skip to the WIP schedule.

## 6. Open questions

- **Which account** (yours or Dillon's)? If Dillon's, agree we can add the GI records and that Reset only touches them.
- **Handoff with Dillon:** does he show the project record and Project Center first? Then we start at the bill.
  Does he cover expense reports / Employee Center coded to projects?
- **Length:** Granola (16 Nov) says the demo was agreed at 90 min with our slot about 30 min; the invite is 60 min. Is ~30 min still right, or nearer 20?
- **Meeting time:** will it move (Faizan's request to Connor)?
- **Scope fence:** don't demo the Textura integration, PO vendor restriction (Wesco-only jobs), or AIA G702/G703 print. If
  asked, these are implementation-design items from the briefing.
- **Loss jobs:** we flag projected losses (ASC 606 recognises the full loss now) but don't post a loss provision.
  Fine for the demo?

## 7. Draft email to Dillon (send from your account)

> Subject: Genesys demo tomorrow - WIP handoff
>
> Hi Dillon,
>
> I'm covering the Genesys WIP segment tomorrow in place of Faizan. Proposed shape for our ~30 minutes:
>
> - Handoff: when you reach projects, I take over from the project record.
> - I show a project's contract value and estimated cost, enter a vendor bill and a progress invoice against jobs,
>   then open a WIP schedule built on the standard project record that matches their Excel template column for column
>   (% complete on cost-to-cost, earned revenue, over/under billing, YTD and prior years), with drill-down, Excel export
>   and the over/under-billing journal.
> - Dummy data: 12 construction jobs for fictional GCs, in their job-number format.
> - I'll hand back to you for the wrap-up / NetSuite Next.
>
> Two questions: are you sharing a TestDrive account, or shall I use ours? And do you want to cover the project record
> and Project Center yourself, so I start at cost entry?
>
> Thanks,
