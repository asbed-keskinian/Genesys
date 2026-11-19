/**
 * Genesys Impact demo - setup, data loader and reset.
 *  Load : creates (or finds, by external ID) accounts, customers, vendors, a billing item, 12 projects
 *         and their cost / billing history from data/jobs.json, then writes gi_config.json.
 *         Safe to run again: anything already created is skipped, so a timed-out run can be resumed.
 *  Reset: re-applies jobs.json values to the projects and deletes transactions on the demo projects
 *         that the loader did not create (things entered live in the demo, and the WIP JE).
 *         Shows the list first and deletes only after Confirm.
 * Only touches records tagged with GI- external IDs or linked to the demo projects.
 *
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/query', 'N/file', 'N/runtime', 'N/url', './gi_wip_lib'],
    (ui, record, search, query, file, runtime, url, lib) => {

    const DATA_PATH = 'SuiteScripts/GenesysDemo/data/jobs.json';
    const BASE_YEAR = 2026; // years in jobs.json are shifted by (current year - BASE_YEAR)
    const isOW = () => runtime.isFeatureInEffect({ feature: 'SUBSIDIARIES' });

    const ACCOUNTS = [
        { key: 'revenue', ext: 'GI-ACCT-REV', name: 'GI Contract Revenue', type: 'Income', num: '4950' },
        { key: 'materials', ext: 'GI-ACCT-MAT', name: 'GI Job Cost - Materials', type: 'COGS', num: '5950' },
        { key: 'subs', ext: 'GI-ACCT-SUB', name: 'GI Job Cost - Subcontractors', type: 'COGS', num: '5951' },
        { key: 'labor', ext: 'GI-ACCT-LAB', name: 'GI Job Cost - Field Labor', type: 'COGS', num: '5952' },
        { key: 'cieb', ext: 'GI-ACCT-CIEB', name: 'GI Costs & Est. Earnings in Excess of Billings', type: 'OthCurrAsset', num: '1395' },
        { key: 'biec', ext: 'GI-ACCT-BIEC', name: 'GI Billings in Excess of Costs & Est. Earnings', type: 'OthCurrLiab', num: '2395' },
        { key: 'laborClr', ext: 'GI-ACCT-LABCLR', name: 'GI Payroll Clearing - Field Labor', type: 'OthCurrLiab', num: '2396' }
    ];
    const VENDORS = [
        { key: 'materials', ext: 'GI-VEND-WESTLINE', name: 'Westline Electrical Supply (DEMO)' },
        { key: 'subs', ext: 'GI-VEND-KEYSTONE', name: 'Keystone Low Voltage Subcontracting (DEMO)' }
    ];
    // cost split of each period's job cost
    const SPLIT = { materials: 0.45, subs: 0.25, labor: 0.30 };

    // ---------- helpers ----------
    let log_ = [];
    const note = (s) => { log_.push(s); log.audit('GI setup', s); };

    function findByExt(type, ext) {
        let id = null;
        const filters = [['externalidstring', 'is', ext]];
        if (['vendorbill', 'invoice', 'journalentry'].indexOf(type) >= 0) filters.push('AND', ['mainline', 'is', 'T']);
        try {
            search.create({ type, filters }).run().each((r) => { id = r.id; return false; });
        } catch (e) {
            search.create({ type, filters: [['externalid', 'anyof', ext]] }).run().each((r) => { id = r.id; return false; });
        }
        return id;
    }

    function ensure(type, ext, build) {
        const found = findByExt(type, ext);
        if (found) return Number(found);
        const rec = record.create({ type });
        build(rec);
        rec.setValue('externalid', ext);
        const id = rec.save({ ignoreMandatoryFields: true });
        note(`Created ${type} ${ext} (${id})`);
        return id;
    }

    const trySet = (rec, field, value) => { try { rec.setValue(field, value); } catch (e) { /* field not in this account */ } };
    const toDate = (s) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const shiftYear = (s, k) => `${Number(s.slice(0, 4)) + k}${s.slice(4)}`;
    const between = (a, b, f) => new Date(a.getTime() + (b.getTime() - a.getTime()) * f);

    function loadData() { return JSON.parse(file.load({ id: DATA_PATH }).getContents()); }

    function jobStatusIds() {
        const map = {};
        search.create({ type: 'jobstatus', columns: ['name'] }).run().each((r) => { map[r.getValue('name').toLowerCase()] = r.id; return true; });
        const pick = (...names) => { for (const n of names) for (const k in map) if (k.indexOf(n) >= 0) return map[k]; return null; };
        return { 'In Progress': pick('in progress', 'progress', 'open'), 'Completed': pick('closed', 'complete') };
    }

    function setJobFields(rec, j, cfg, statuses) {
        rec.setValue('companyname', j.desc);
        trySet(rec, 'entityid', j.job);
        rec.setValue('parent', cfg.customers[j.client]);
        if (cfg.subsidiary) trySet(rec, 'subsidiary', cfg.subsidiary);
        if (statuses[j.status]) rec.setValue('entitystatus', statuses[j.status]);
        trySet(rec, 'startdate', toDate(j.startShifted));
        rec.setValue('custentity_gi_wip_job', true);
        rec.setValue('custentity_gi_contract_value', j.contract);
        rec.setValue('custentity_gi_est_cost', j.estCost);
        rec.setValue('custentity_gi_job_state', j.state);
        trySet(rec, 'comments', j.note);
    }

    // ---------- load ----------
    function runLoad() {
        const data = loadData();
        const now = new Date();
        const Y = now.getFullYear(), k = Y - BASE_YEAR;
        const cfg = { loadedAt: now.toISOString(), year: Y, accounts: {}, vendors: {}, customers: {}, jobs: {} };
        if (isOW()) cfg.subsidiary = Number(runtime.getCurrentUser().subsidiary);
        const sub = (rec, multi) => { if (cfg.subsidiary) trySet(rec, 'subsidiary', multi ? [cfg.subsidiary] : cfg.subsidiary); };

        ACCOUNTS.forEach((a) => {
            cfg.accounts[a.key] = ensure('account', a.ext, (r) => {
                r.setValue('accttype', a.type);
                trySet(r, 'acctnumber', a.num);
                r.setValue('acctname', a.name);
                sub(r, true);
                trySet(r, 'includechildren', true);
            });
        });
        data.customers.forEach((c) => {
            cfg.customers[c.key] = ensure('customer', `GI-CUST-${c.key}`, (r) => {
                trySet(r, 'isperson', 'F');
                r.setValue('companyname', c.name);
                sub(r);
            });
        });
        VENDORS.forEach((v) => {
            cfg.vendors[v.key] = ensure('vendor', v.ext, (r) => {
                trySet(r, 'isperson', 'F');
                r.setValue('companyname', v.name);
                sub(r);
            });
        });
        cfg.item = ensure('serviceitem', 'GI-ITEM-PROGBILL', (r) => {
            r.setValue('itemid', 'GI Progress Billing (AIA)');
            trySet(r, 'displayname', 'Progress Billing - Schedule of Values');
            r.setValue('incomeaccount', cfg.accounts.revenue);
            sub(r, true);
            trySet(r, 'includechildren', true);
            trySet(r, 'istaxable', false);
        });

        const statuses = jobStatusIds();
        data.jobs.forEach((j) => {
            j.startShifted = shiftYear(j.start, k);
            const ext = `GI-JOB-${j.job}`;
            const found = findByExt('job', ext);
            if (found) { cfg.jobs[j.job] = Number(found); return; }
            const rec = record.create({ type: record.Type.JOB });
            setJobFields(rec, j, cfg, statuses);
            rec.setValue('externalid', ext);
            cfg.jobs[j.job] = rec.save({ ignoreMandatoryFields: true });
            note(`Created project ${j.job} (${cfg.jobs[j.job]})`);
        });
        saveConfig(cfg); // checkpoint so a timeout still leaves usable config

        // ---- transactions ----
        const ytdEnd = toDate(`${Y}-${data.ytdLastActivity || '10-31'}`);
        const labourLines = { prior: [], ytd: [] };
        data.jobs.forEach((j) => {
            const start = toDate(j.startShifted);
            const periods = [
                { key: 'prior', cost: j.costPrior, bill: j.billPrior, from: new Date(Math.max(start, toDate(`${Y - 1}-01-01`))), to: toDate(`${Y - 1}-12-15`) },
                { key: 'ytd', cost: j.costYTD, bill: j.billYTD, from: new Date(Math.max(start, toDate(`${Y}-01-01`))), to: ytdEnd }
            ];
            periods.forEach((p) => {
                const tag = `${j.job}-${p.key.toUpperCase()}`;
                const jobId = cfg.jobs[j.job];
                if (p.cost) {
                    ['materials', 'subs'].forEach((kind, i) => {
                        const amt = lib.r2(p.cost * SPLIT[kind]);
                        ensure('vendorbill', `GI-LOAD-BILL-${kind.toUpperCase()}-${tag}`, (r) => {
                            r.setValue('entity', cfg.vendors[kind]);
                            r.setValue('trandate', between(p.from, p.to, i ? 0.6 : 0.35));
                            trySet(r, 'tranid', `${kind === 'subs' ? 'KLV' : 'WES'}-${tag}`);
                            trySet(r, 'approvalstatus', 2);
                            r.setValue('memo', `${j.job} ${kind === 'subs' ? 'subcontract work' : 'materials'}`);
                            r.setSublistValue({ sublistId: 'expense', fieldId: 'account', line: 0, value: cfg.accounts[kind] });
                            r.setSublistValue({ sublistId: 'expense', fieldId: 'amount', line: 0, value: amt });
                            r.setSublistValue({ sublistId: 'expense', fieldId: 'customer', line: 0, value: jobId });
                            r.setSublistValue({ sublistId: 'expense', fieldId: 'memo', line: 0, value: `${j.job} ${j.desc}` });
                        });
                    });
                    const labour = lib.r2(p.cost - lib.r2(p.cost * SPLIT.materials) - lib.r2(p.cost * SPLIT.subs));
                    labourLines[p.key].push({ jobId, job: j.job, amt: labour });
                }
                if (p.bill) {
                    const apps = p.bill >= 100000 ? 2 : 1;
                    for (let n = 0; n < apps; n++) {
                        const amt = n === apps - 1 ? lib.r2(p.bill - lib.r2(p.bill / apps) * (apps - 1)) : lib.r2(p.bill / apps);
                        ensure('invoice', `GI-LOAD-INV-${tag}-${n + 1}`, (r) => {
                            r.setValue('entity', jobId);
                            r.setValue('trandate', between(p.from, p.to, apps === 1 ? 0.7 : (n ? 0.85 : 0.45)));
                            r.setValue('memo', `Pay application ${p.key === 'prior' ? 'PY' : 'CY'}-${n + 1} (submitted via Textura)`);
                            r.setSublistValue({ sublistId: 'item', fieldId: 'item', line: 0, value: cfg.item });
                            r.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: 0, value: 1 });
                            r.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: 0, value: amt });
                            r.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: 0, value: amt });
                            r.setSublistValue({ sublistId: 'item', fieldId: 'description', line: 0, value: `Progress billing - ${j.desc}` });
                            try { r.setSublistValue({ sublistId: 'item', fieldId: 'istaxable', line: 0, value: false }); } catch (e) { /* SuiteTax */ }
                        });
                    }
                }
            });
        });
        // one labour allocation journal per period (ClockShark hours x cost rate, payroll from ADP)
        [['prior', toDate(`${Y - 1}-12-31`)], ['ytd', ytdEnd]].forEach(([key, date]) => {
            const lines = labourLines[key];
            if (!lines.length) return;
            cfg.labourJe = cfg.labourJe || {};
            cfg.labourJe[key] = ensure('journalentry', `GI-LOAD-JE-LABOR-${key.toUpperCase()}`, (r) => {
                if (cfg.subsidiary) r.setValue('subsidiary', cfg.subsidiary);
                r.setValue('trandate', date);
                trySet(r, 'approvalstatus', 2);
                trySet(r, 'approved', true);
                r.setValue('memo', `Field labour allocation to projects (${key === 'prior' ? Y - 1 : Y} hours from ClockShark, payroll cost from ADP)`);
                let i = 0, total = 0;
                lines.forEach((l) => {
                    r.setSublistValue({ sublistId: 'line', fieldId: 'account', line: i, value: cfg.accounts.labor });
                    r.setSublistValue({ sublistId: 'line', fieldId: 'debit', line: i, value: l.amt });
                    r.setSublistValue({ sublistId: 'line', fieldId: 'entity', line: i, value: l.jobId });
                    r.setSublistValue({ sublistId: 'line', fieldId: 'memo', line: i, value: `${l.job} field labour` });
                    total += l.amt; i++;
                });
                r.setSublistValue({ sublistId: 'line', fieldId: 'account', line: i, value: cfg.accounts.laborClr });
                r.setSublistValue({ sublistId: 'line', fieldId: 'credit', line: i, value: lib.r2(total) });
                r.setSublistValue({ sublistId: 'line', fieldId: 'memo', line: i, value: 'Payroll clearing' });
            });
        });
        saveConfig(cfg);
        note(`Done. Governance remaining: ${runtime.getCurrentScript().getRemainingUsage()}`);
        return cfg;
    }

    function saveConfig(cfg) {
        const folder = file.load({ id: DATA_PATH }).folder;
        const parent = search.lookupFields({ type: 'folder', id: folder, columns: ['parent'] }).parent;
        const f = file.create({ name: 'gi_config.json', fileType: file.Type.JSON, contents: JSON.stringify(cfg, null, 1),
            folder: parent && parent[0] ? Number(parent[0].value) : folder });
        f.save();
    }

    // ---------- reset ----------
    const DELETE_TYPES = { CustPymt: 'customerpayment', VendPymt: 'vendorpayment', CustCred: 'creditmemo', CustInvc: 'invoice',
        VendBill: 'vendorbill', VendCred: 'vendorcredit', Journal: 'journalentry', ExpRept: 'expensereport',
        ItemRcpt: 'itemreceipt', PurchOrd: 'purchaseorder', TimeBill: 'timebill' };
    const DELETE_ORDER = ['CustPymt', 'VendPymt', 'CustCred', 'CustInvc', 'VendCred', 'VendBill', 'ItemRcpt', 'PurchOrd', 'ExpRept', 'Journal', 'TimeBill'];

    function resetCandidates(cfg) {
        const ids = Object.keys(cfg.jobs).map((k) => Number(cfg.jobs[k])).filter(Boolean).join(',') || '0';
        return query.runSuiteQL({ query: `
            SELECT DISTINCT t.id, t.type, t.tranid, t.trandate, t.externalid, BUILTIN.DF(t.entity) AS name, t.memo
            FROM transaction t JOIN transactionline tl ON tl.transaction = t.id
            WHERE (tl.entity IN (${ids}) OR t.entity IN (${ids}))
              AND (t.externalid IS NULL OR t.externalid NOT LIKE 'GI-LOAD-%')
            ORDER BY t.id` }).asMappedResults();
    }

    function runReset(cfg) {
        const data = loadData();
        const k = cfg.year - BASE_YEAR;
        const statuses = jobStatusIds();
        data.jobs.forEach((j) => {
            if (!cfg.jobs[j.job]) return;
            j.startShifted = shiftYear(j.start, k);
            const rec = record.load({ type: record.Type.JOB, id: cfg.jobs[j.job] });
            setJobFields(rec, j, cfg, statuses);
            rec.save({ ignoreMandatoryFields: true });
        });
        note('Project contract values, estimates and statuses restored from jobs.json');
        const rows = resetCandidates(cfg);
        DELETE_ORDER.forEach((type) => rows.filter((r) => r.type === type).forEach((r) => {
            try { record.delete({ type: DELETE_TYPES[type], id: r.id }); note(`Deleted ${type} ${r.tranid || r.id}`); }
            catch (e) { note(`Could not delete ${type} ${r.tranid || r.id}: ${e.message}`); }
        }));
        rows.filter((r) => DELETE_ORDER.indexOf(r.type) < 0)
            .forEach((r) => note(`Left in place (type ${r.type} not handled): ${r.tranid || r.id}`));
    }

    // ---------- page ----------
    function page(ctx, html, buttons) {
        const form = ui.createForm({ title: 'Genesys Impact demo - setup' });
        form.addField({ id: 'custpage_action', type: ui.FieldType.TEXT, label: 'action' })
            .updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN });
        (buttons || []).forEach(([id, label, action]) => form.addButton({ id, label,
            functionName: `(function(){document.getElementById('custpage_action').value='${action}';(document.getElementById('main_form')||document.forms[0]).submit();})` }));
        form.addField({ id: 'custpage_html', type: ui.FieldType.INLINEHTML, label: ' ' }).defaultValue =
            `<div style="font:13px Arial;max-width:900px">${html}</div>`;
        ctx.response.writePage(form);
    }
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const list = () => `<ul>${log_.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
    const wipLink = () => `<p><a href="${url.resolveScript({ scriptId: 'customscript_gi_wip_sl', deploymentId: 'customdeploy_gi_wip_sl' })}">Open the WIP schedule</a></p>`;

    function onRequest(ctx) {
        log_ = [];
        const action = ctx.request.method === 'POST' ? ctx.request.parameters.custpage_action : '';
        const cfg = lib.loadConfig();
        try {
            if (action === 'load') {
                runLoad();
                return page(ctx, `<h3>Load finished</h3>${list()}${wipLink()}`, [['custpage_load', 'Run load again', 'load']]);
            }
            if (action === 'resetpreview' || action === 'resetconfirm') {
                if (!cfg) return page(ctx, '<p>Nothing loaded yet.</p>', [['custpage_load', 'Load demo data', 'load']]);
                if (action === 'resetconfirm') {
                    runReset(cfg);
                    return page(ctx, `<h3>Reset finished</h3>${list()}${wipLink()}`);
                }
                const rows = resetCandidates(cfg);
                const tbl = rows.length ? `<table border="1" cellpadding="4" style="border-collapse:collapse"><tr><th>Type</th><th>Number</th><th>Date</th><th>Name</th><th>Memo</th></tr>${
                    rows.map((r) => `<tr><td>${esc(r.type)}</td><td>${esc(r.tranid || r.id)}</td><td>${esc(r.trandate)}</td><td>${esc(r.name)}</td><td>${esc(r.memo)}</td></tr>`).join('')}</table>` : '<p>No live-demo transactions found.</p>';
                return page(ctx, `<h3>Reset preview</h3><p>Project values will be restored from jobs.json and these transactions deleted:</p>${tbl}`,
                    [['custpage_confirm', 'Confirm reset', 'resetconfirm']]);
            }
        } catch (e) {
            return page(ctx, `<h3 style="color:#b42318">Stopped: ${esc(e.name)} ${esc(e.message)}</h3>${list()}<p>Fix the cause and run again; finished steps are skipped.</p>`,
                [['custpage_load', 'Run load again', 'load']]);
        }
        const status = cfg ? `<p>Loaded ${esc(cfg.loadedAt)}: ${Object.keys(cfg.jobs).length} projects.</p>${wipLink()}` : '<p>Demo data not loaded yet.</p>';
        page(ctx, `<h3>Genesys Impact WIP demo</h3>${status}<p>Load creates GI accounts, 4 GC customers, 2 vendors, a progress-billing item, 12 projects and their bills, labour journals and pay applications. Reset restores project values and removes transactions entered during the demo.</p>`,
            [['custpage_load', 'Load demo data', 'load'], ['custpage_reset', 'Reset after demo', 'resetpreview']]);
    }

    return { onRequest };
});
