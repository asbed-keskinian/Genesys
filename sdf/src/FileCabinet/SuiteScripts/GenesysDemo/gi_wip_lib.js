/**
 * Genesys Impact demo - WIP calculation library.
 * Reads WIP jobs from the standard project (job) record and actuals from the GL,
 * then reproduces the columns of Genesys' Excel WIP template.
 *
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/query', 'N/file', 'N/format'], (search, query, file, format) => {

    const CONFIG_PATH = 'SuiteScripts/GenesysDemo/gi_config.json';
    const COST_TYPES = ['COGS', 'Expense'];
    const BILL_TYPES = ['CustInvc', 'CustCred'];

    const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const ymd = (d) => d.toISOString().slice(0, 10);

    function parseDate(v) {
        if (!v) return null;
        try { return format.parse({ value: v, type: format.Type.DATE }); } catch (e) { return null; }
    }

    function loadConfig() {
        try { return JSON.parse(file.load({ id: CONFIG_PATH }).getContents()); }
        catch (e) { return null; }
    }

    /** WIP jobs: projects with "Include on WIP" ticked. */
    function getJobs() {
        const jobs = [];
        search.create({
            type: search.Type.JOB,
            filters: [['custentity_gi_wip_job', 'is', 'T'], 'AND', ['isinactive', 'is', 'F']],
            columns: [
                search.createColumn({ name: 'entityid', sort: search.Sort.ASC }),
                'companyname', 'customer', 'entitystatus', 'startdate',
                'custentity_gi_contract_value', 'custentity_gi_est_cost', 'custentity_gi_job_state'
            ]
        }).run().each((r) => {
            jobs.push({
                id: r.id,
                job: r.getValue('entityid'),
                desc: r.getValue('companyname'),
                client: (r.getText('customer') || '').replace(/\s*\(DEMO\)$/, ''),
                status: r.getText('entitystatus'),
                start: r.getValue('startdate'),
                state: r.getValue('custentity_gi_job_state'),
                contract: Number(r.getValue('custentity_gi_contract_value')) || 0,
                estCost: Number(r.getValue('custentity_gi_est_cost')) || 0
            });
            return true;
        });
        return jobs;
    }

    const inList = (ids) => ids.map((id) => Number(id)).filter((n) => n > 0).join(',') || '0';

    /** Job cost from the GL: posting COGS/Expense lines whose line-level name is the project. */
    function getCosts(jobIds, asOf, priorEnd) {
        const sql = `
            SELECT tl.entity AS job,
                   SUM(CASE WHEN t.trandate <= TO_DATE(?, 'YYYY-MM-DD')
                            THEN NVL(tal.debit,0) - NVL(tal.credit,0) ELSE 0 END) AS prior,
                   SUM(NVL(tal.debit,0) - NVL(tal.credit,0)) AS jtd
            FROM transactionaccountingline tal
            JOIN transactionline tl ON tl.transaction = tal.transaction AND tl.id = tal.transactionline
            JOIN transaction t ON t.id = tal.transaction
            JOIN account a ON a.id = tal.account
            WHERE tal.posting = 'T'
              AND a.accttype IN ('${COST_TYPES.join("','")}')
              AND t.trandate <= TO_DATE(?, 'YYYY-MM-DD')
              AND tl.entity IN (${inList(jobIds)})
            GROUP BY tl.entity`;
        const out = {};
        query.runSuiteQL({ query: sql, params: [priorEnd, asOf] }).asMappedResults()
            .forEach((r) => { out[r.job] = { prior: r2(r.prior), jtd: r2(r.jtd) }; });
        return out;
    }

    /** Billings: revenue lines of invoices / credit memos issued to the project. */
    function getBillings(jobIds, asOf) {
        const sql = `
            SELECT t.entity AS job, SUM(NVL(tal.credit,0) - NVL(tal.debit,0)) AS jtd
            FROM transactionaccountingline tal
            JOIN transaction t ON t.id = tal.transaction
            JOIN account a ON a.id = tal.account
            WHERE tal.posting = 'T'
              AND t.type IN ('${BILL_TYPES.join("','")}')
              AND a.accttype IN ('Income', 'OthIncome')
              AND t.trandate <= TO_DATE(?, 'YYYY-MM-DD')
              AND t.entity IN (${inList(jobIds)})
            GROUP BY t.entity`;
        const out = {};
        query.runSuiteQL({ query: sql, params: [asOf] }).asMappedResults()
            .forEach((r) => { out[r.job] = r2(r.jtd); });
        return out;
    }

    /**
     * Template maths (Genesys WIP.xlsx):
     *   % complete = JTD cost / estimated cost; earned = ROUND(% x contract, 2)
     *   under-billed (costs & GM in excess of billings) = earned - billed when positive; over-billed the reverse
     *   prior years' revenue = earned at prior year end (prior cost / current estimate x contract)
     *   YTD = JTD - prior years; billings proof = contract - billed to date
     */
    function calcRow(j, cost, billed) {
        const G = j.contract, H = j.estCost;
        const M = cost.jtd, O = billed, V = cost.prior;
        const K = H ? M / H : 0;
        const L = H ? r2(M / H * G) : 0;
        const U = H ? r2(V / H * G) : 0;
        return Object.assign({}, j, {
            billProof: r2(G - O),
            estGP: r2(G - H), estGPPct: G ? (G - H) / G : 0,
            pctComplete: K,
            jtdRev: L, jtdCost: M, jtdGP: r2(L - M), jtdBill: O,
            under: L > O ? r2(L - O) : 0, over: O > L ? r2(O - L) : 0,
            ytdRev: r2(L - U), ytdCost: r2(M - V), ytdGM: r2((L - U) - (M - V)),
            pyRev: U, pyCost: V, pyGM: r2(U - V),
            isLoss: H > G, overrun: K > 1
        });
    }

    const SUM_KEYS = ['contract', 'estCost', 'estGP', 'jtdRev', 'jtdCost', 'jtdGP', 'jtdBill', 'under', 'over',
        'ytdRev', 'ytdCost', 'ytdGM', 'pyRev', 'pyCost', 'pyGM', 'billProof'];

    /** Full report as of a date (YYYY-MM-DD). */
    function buildReport(asOf, statusFilter) {
        const priorEnd = `${Number(asOf.slice(0, 4)) - 1}-12-31`;
        let jobs = getJobs();
        // a job not yet started at the as-of date is left off (e.g. year-end view)
        const asOfDate = new Date(Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7)) - 1, Number(asOf.slice(8, 10)));
        jobs = jobs.filter((j) => { const d = parseDate(j.start); return !d || d <= asOfDate; });
        if (statusFilter) jobs = jobs.filter((j) => (j.status || '').toLowerCase().indexOf(statusFilter.toLowerCase()) >= 0);
        const ids = jobs.map((j) => j.id);
        const costs = getCosts(ids, asOf, priorEnd);
        const bills = getBillings(ids, asOf);
        const rows = jobs.map((j) => calcRow(j, costs[j.id] || { prior: 0, jtd: 0 }, bills[j.id] || 0));
        const totals = {};
        SUM_KEYS.forEach((k) => { totals[k] = r2(rows.reduce((s, r) => s + r[k], 0)); });
        totals.estGPPct = totals.contract ? totals.estGP / totals.contract : 0;
        totals.pctComplete = totals.estCost ? totals.jtdCost / totals.estCost : 0;
        return { asOf, priorEnd, year: asOf.slice(0, 4), rows, totals };
    }

    /** Transactions behind a job's cost or billing figure, for drill-down. */
    function getDetail(jobId, kind, asOf) {
        const isCost = kind === 'cost';
        const sql = isCost ? `
            SELECT t.id, t.type, BUILTIN.DF(t.type) AS typename, t.tranid, t.trandate,
                   BUILTIN.DF(t.entity) AS name, a.accountsearchdisplayname AS account, tl.memo,
                   NVL(tal.debit,0) - NVL(tal.credit,0) AS amount
            FROM transactionaccountingline tal
            JOIN transactionline tl ON tl.transaction = tal.transaction AND tl.id = tal.transactionline
            JOIN transaction t ON t.id = tal.transaction
            JOIN account a ON a.id = tal.account
            WHERE tal.posting = 'T' AND a.accttype IN ('${COST_TYPES.join("','")}')
              AND t.trandate <= TO_DATE(?, 'YYYY-MM-DD') AND tl.entity = ?
            ORDER BY t.trandate, t.id` : `
            SELECT t.id, t.type, BUILTIN.DF(t.type) AS typename, t.tranid, t.trandate,
                   BUILTIN.DF(t.entity) AS name, a.accountsearchdisplayname AS account, t.memo,
                   SUM(NVL(tal.credit,0) - NVL(tal.debit,0)) AS amount
            FROM transactionaccountingline tal
            JOIN transaction t ON t.id = tal.transaction
            JOIN account a ON a.id = tal.account
            WHERE tal.posting = 'T' AND t.type IN ('${BILL_TYPES.join("','")}')
              AND a.accttype IN ('Income', 'OthIncome')
              AND t.trandate <= TO_DATE(?, 'YYYY-MM-DD') AND t.entity = ?
            GROUP BY t.id, t.type, BUILTIN.DF(t.type), t.tranid, t.trandate, BUILTIN.DF(t.entity),
                     a.accountsearchdisplayname, t.memo
            ORDER BY t.trandate, t.id`;
        return query.runSuiteQL({ query: sql, params: [asOf, Number(jobId)] }).asMappedResults();
    }

    return { loadConfig, buildReport, getDetail, calcRow, r2, ymd, CONFIG_PATH };
});
