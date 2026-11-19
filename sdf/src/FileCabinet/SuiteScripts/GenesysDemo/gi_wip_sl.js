/**
 * Genesys Impact demo - WIP Schedule Suitelet.
 * One row per job with the columns of Genesys' WIP template, totals, as-of date,
 * drill-down to the transactions behind cost and billings, CSV export for Excel,
 * and an optional reversing over/under-billing journal entry.
 *
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/ui/serverWidget', 'N/url', 'N/record', 'N/search', 'N/runtime', 'N/redirect', 'N/format', './gi_wip_lib'],
    (ui, url, record, search, runtime, redirect, format, lib) => {

    const SCRIPT = 'customscript_gi_wip_sl', DEPLOY = 'customdeploy_gi_wip_sl';
    const today = () => {
        const d = new Date(); // server time; fine for a demo default
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const selfUrl = (params) => url.resolveScript({ scriptId: SCRIPT, deploymentId: DEPLOY, params: params || {} });
    const recUrl = (type, id) => url.resolveRecord({ recordType: type, recordId: id });
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    const money = (n) => {
        const v = Math.round(Number(n) || 0);
        if (v === 0) return '<span class="z">-</span>';
        const s = Math.abs(v).toLocaleString('en-US');
        return v < 0 ? `<span class="neg">(${s})</span>` : s;
    };
    const pct = (n) => `${((Number(n) || 0) * 100).toFixed(1)}%`;

    const TRAN_TYPES = { VendBill: 'vendorbill', Journal: 'journalentry', CustInvc: 'invoice', CustCred: 'creditmemo',
        ExpRept: 'expensereport', VendCred: 'vendorcredit', ItemRcpt: 'itemreceipt', Check: 'check' };

    function parseAsOf(v) {
        return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : today();
    }

    // ---------- HTML ----------
    const CSS = `<style>
      .gi-wrap{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1f2933}
      .gi-kpis{display:flex;gap:12px;margin:6px 0 14px}
      .gi-kpi{border:1px solid #d9dee5;border-radius:6px;padding:8px 14px;min-width:150px;background:#f8fafc}
      .gi-kpi b{display:block;font-size:18px;margin-top:2px}
      .gi-kpi.u b{color:#0b6e4f}.gi-kpi.o b{color:#b54708}
      table.gi{border-collapse:collapse;white-space:nowrap}
      table.gi th,table.gi td{border:1px solid #d9dee5;padding:4px 6px}
      table.gi th{background:#1f3a5f;color:#fff;font-weight:600;font-size:11px;text-align:center;position:sticky;top:0}
      table.gi th.grp{background:#294b78}
      table.gi td.n{text-align:right;font-variant-numeric:tabular-nums}
      table.gi tr:nth-child(even) td{background:#f6f8fb}
      table.gi tr.loss td{background:#fdecea !important}
      table.gi tr.tot td{font-weight:700;border-top:2px solid #1f3a5f;background:#eef2f7 !important}
      .neg{color:#b42318}.z{color:#9aa5b1}
      .ub{color:#0b6e4f;font-weight:600}.ob{color:#b54708;font-weight:600}
      .flag{display:inline-block;margin-left:4px;padding:0 4px;border-radius:3px;background:#b42318;color:#fff;font-size:10px}
      .gi a{color:#1d4ed8;text-decoration:none}.gi a:hover{text-decoration:underline}
      .gi-note{color:#52606d;margin-top:10px;max-width:1100px}
    </style>`;

    function reportHtml(rep, statusFilter) {
        const p = (extra) => selfUrl(Object.assign({ asof: rep.asOf, status: statusFilter || '' }, extra));
        const t = rep.totals;
        const kpis = `<div class="gi-kpis">
            <div class="gi-kpi">Contract value<b>${money(t.contract)}</b></div>
            <div class="gi-kpi">Earned to date<b>${money(t.jtdRev)}</b></div>
            <div class="gi-kpi">Billed to date<b>${money(t.jtdBill)}</b></div>
            <div class="gi-kpi u">Under-billed (asset)<b>${money(t.under)}</b></div>
            <div class="gi-kpi o">Over-billed (liability)<b>${money(t.over)}</b></div>
            <div class="gi-kpi">Backlog (unearned)<b>${money(t.contract - t.jtdRev)}</b></div>
          </div>`;
        const head = `<tr>
            <th class="grp" colspan="6"></th><th class="grp" colspan="5">CONTRACT TOTALS</th>
            <th class="grp" colspan="6">FROM INCEPTION THROUGH ${esc(rep.asOf)}</th>
            <th class="grp" colspan="3">CURRENT YEAR ${esc(rep.year)}</th>
            <th class="grp" colspan="3">PRIOR YEARS (THROUGH ${esc(rep.priorEnd)})</th></tr>
          <tr><th>Job</th><th>Description</th><th>Client</th><th>State</th><th>Status</th><th>Billings<br>Proof</th>
            <th>Contract<br>Revenues</th><th>Estimated<br>Costs</th><th>Est. Gross<br>Profit $</th><th>Est. Gross<br>Profit %</th><th>Percent<br>Complete</th>
            <th>JTD Contract<br>Revenues</th><th>JTD Contract<br>Costs</th><th>JTD Gross<br>Profit</th><th>JTD<br>Billings</th>
            <th>Costs &amp; GM in<br>Excess of Billings</th><th>Billings in Excess<br>of Costs &amp; GM</th>
            <th>YTD<br>Revenues</th><th>YTD<br>Costs</th><th>YTD Gross<br>Margin</th>
            <th>Prior Years'<br>Revenues</th><th>Prior Years'<br>Costs</th><th>Prior Years'<br>Gross Margin</th></tr>`;
        const body = rep.rows.map((r) => `<tr class="${r.isLoss ? 'loss' : ''}">
            <td><a href="${recUrl('job', r.id)}" target="_blank">${esc(r.job)}</a></td>
            <td>${esc(r.desc)}${r.isLoss ? '<span class="flag">LOSS JOB</span>' : ''}${r.overrun ? '<span class="flag">COST &gt; EST</span>' : ''}</td>
            <td>${esc(r.client)}</td><td>${esc(r.state)}</td><td>${esc(r.status)}</td>
            <td class="n">${money(r.billProof)}</td>
            <td class="n">${money(r.contract)}</td><td class="n">${money(r.estCost)}</td><td class="n">${money(r.estGP)}</td>
            <td class="n">${pct(r.estGPPct)}</td><td class="n">${pct(r.pctComplete)}</td>
            <td class="n">${money(r.jtdRev)}</td>
            <td class="n"><a href="${p({ action: 'detail', kind: 'cost', job: r.id })}">${money(r.jtdCost)}</a></td>
            <td class="n">${money(r.jtdGP)}</td>
            <td class="n"><a href="${p({ action: 'detail', kind: 'bill', job: r.id })}">${money(r.jtdBill)}</a></td>
            <td class="n ub">${money(r.under)}</td><td class="n ob">${money(r.over)}</td>
            <td class="n">${money(r.ytdRev)}</td><td class="n">${money(r.ytdCost)}</td><td class="n">${money(r.ytdGM)}</td>
            <td class="n">${money(r.pyRev)}</td><td class="n">${money(r.pyCost)}</td><td class="n">${money(r.pyGM)}</td></tr>`).join('');
        const tot = `<tr class="tot"><td colspan="5">TOTAL (${rep.rows.length} jobs)</td>
            <td class="n">${money(t.billProof)}</td><td class="n">${money(t.contract)}</td><td class="n">${money(t.estCost)}</td>
            <td class="n">${money(t.estGP)}</td><td class="n">${pct(t.estGPPct)}</td><td class="n"></td>
            <td class="n">${money(t.jtdRev)}</td><td class="n">${money(t.jtdCost)}</td><td class="n">${money(t.jtdGP)}</td>
            <td class="n">${money(t.jtdBill)}</td><td class="n ub">${money(t.under)}</td><td class="n ob">${money(t.over)}</td>
            <td class="n">${money(t.ytdRev)}</td><td class="n">${money(t.ytdCost)}</td><td class="n">${money(t.ytdGM)}</td>
            <td class="n">${money(t.pyRev)}</td><td class="n">${money(t.pyCost)}</td><td class="n">${money(t.pyGM)}</td></tr>`;
        const losses = rep.rows.filter((r) => r.isLoss);
        const note = `<div class="gi-note">Percent complete = job-to-date cost / estimated cost (cost-to-cost). Earned revenue = percent complete x contract value.
            Costs come from posted vendor bills, labour journals and expense reports coded to the project; billings from posted invoices and credit memos on the project.
            Contract value and estimated cost are maintained on the project record by the project manager.
            ${losses.length ? `<br><b>Projected losses:</b> ${losses.map((r) => `${esc(r.job)} ${money(r.estGP)}`).join(', ')} - under US GAAP the full expected loss is recognised now, not as work is performed.` : ''}</div>`;
        return `${CSS}<div class="gi-wrap">${kpis}<div style="overflow:auto;max-height:640px"><table class="gi">${head}${body}${tot}</table></div>${note}</div>`;
    }

    function detailHtml(rows, title, back) {
        const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const body = rows.map((r) => {
            const t = TRAN_TYPES[r.type];
            const link = t ? `<a href="${recUrl(t, r.id)}" target="_blank">${esc(r.tranid || r.id)}</a>` : esc(r.tranid || r.id);
            return `<tr><td>${esc(r.trandate)}</td><td>${esc(r.typename)}</td><td>${link}</td><td>${esc(r.name)}</td>
                <td>${esc(r.account)}</td><td>${esc(r.memo)}</td><td class="n">${money(r.amount)}</td></tr>`;
        }).join('');
        return `${CSS}<div class="gi-wrap"><p><a href="${back}">&larr; Back to WIP schedule</a></p><h3>${esc(title)}</h3>
          <table class="gi"><tr><th>Date</th><th>Type</th><th>Number</th><th>Name</th><th>Account</th><th>Memo</th><th>Amount</th></tr>
          ${body}<tr class="tot"><td colspan="6">Total</td><td class="n">${money(total)}</td></tr></table></div>`;
    }

    function csv(rep) {
        const cols = [['Job', 'job'], ['Description', 'desc'], ['Client', 'client'], ['State', 'state'], ['Status', 'status'],
            ['Billings Proof', 'billProof'], ['Contract Revenues', 'contract'], ['Estimated Costs', 'estCost'],
            ['Estimated Gross Profit $', 'estGP'], ['Estimated Gross Profit %', 'estGPPct'], ['Percent Complete', 'pctComplete'],
            ['JTD Contract Revenues', 'jtdRev'], ['JTD Contract Costs', 'jtdCost'], ['JTD Gross Profit', 'jtdGP'],
            ['JTD Billings', 'jtdBill'], ['Costs & GM in Excess of Billings', 'under'], ['Billings in Excess of Costs & GM', 'over'],
            ['YTD Revenues', 'ytdRev'], ['YTD Costs', 'ytdCost'], ['YTD Gross Margin', 'ytdGM'],
            ["Prior Years' Revenues", 'pyRev'], ["Prior Years' Costs", 'pyCost'], ["Prior Years' Gross Margin", 'pyGM']];
        const q = (v) => (typeof v === 'number' ? (Math.abs(v) < 10 && v % 1 ? v.toFixed(4) : v.toFixed(2)) : `"${String(v == null ? '' : v).replace(/"/g, '""')}"`);
        const lines = [`"GENESYS IMPACT - WIP SCHEDULE AS OF ${rep.asOf}"`, cols.map((c) => q(c[0])).join(',')];
        rep.rows.forEach((r) => lines.push(cols.map((c) => q(r[c[1]])).join(',')));
        lines.push(cols.map((c, i) => (i === 0 ? q('TOTAL') : (typeof rep.totals[c[1]] === 'number' && ['estGPPct', 'pctComplete'].indexOf(c[1]) < 0 ? q(rep.totals[c[1]]) : '""'))).join(','));
        return lines.join('\r\n');
    }

    // ---------- WIP journal ----------
    function findJe(ext) {
        let id = null;
        search.create({ type: search.Type.JOURNAL_ENTRY, filters: [['externalidstring', 'is', ext], 'AND', ['mainline', 'is', 'T']] })
            .run().each((r) => { id = r.id; return false; });
        return id;
    }

    function postWipJe(asOf) {
        const cfg = lib.loadConfig();
        if (!cfg || !cfg.accounts) throw new Error('Run the Genesys demo setup first (gi_config.json not found).');
        const ext = `GI-WIPJE-${asOf.replace(/-/g, '')}`;
        // Re-posting for the same date replaces the earlier journal with the latest figures.
        // Deleting the original also removes its automatic reversal.
        const rep = lib.buildReport(asOf);
        const lines = [];
        rep.rows.forEach((r) => {
            if (r.under > 0) {
                lines.push({ account: cfg.accounts.cieb, debit: r.under, entity: r.id, memo: `${r.job} under-billed (costs & GM in excess of billings)` });
                lines.push({ account: cfg.accounts.revenue, credit: r.under, entity: r.id, memo: `${r.job} WIP revenue adjustment` });
            }
            if (r.over > 0) {
                lines.push({ account: cfg.accounts.revenue, debit: r.over, entity: r.id, memo: `${r.job} WIP revenue adjustment` });
                lines.push({ account: cfg.accounts.biec, credit: r.over, entity: r.id, memo: `${r.job} over-billed (billings in excess of costs & GM)` });
            }
        });
        if (!lines.length) throw new Error('Nothing to post: no over or under billing at this date.');
        const existing = findJe(ext);
        if (existing) {
            record.delete({ type: record.Type.JOURNAL_ENTRY, id: existing });
            log.audit('WIP JE replaced', `Deleted ${existing} for ${asOf}`);
        }
        const je = record.create({ type: record.Type.JOURNAL_ENTRY });
        if (cfg.subsidiary) je.setValue('subsidiary', cfg.subsidiary);
        je.setValue('trandate', new Date(Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7)) - 1, Number(asOf.slice(8, 10))));
        // reverses on the first day of the next month (standard month-end WIP entry)
        const rev = new Date(Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7)), 1);
        try { je.setValue('reversaldate', rev); } catch (e) { log.audit('reversaldate not set', e.message); }
        je.setValue('memo', `WIP over/under billing adjustment as of ${asOf} (auto-reverses ${lib.ymd(rev)})`);
        je.setValue('externalid', ext);
        try { je.setValue('approvalstatus', 2); } catch (e) { /* approvals off */ }
        lines.forEach((l, i) => {
            je.setSublistValue({ sublistId: 'line', fieldId: 'account', line: i, value: l.account });
            je.setSublistValue({ sublistId: 'line', fieldId: l.debit ? 'debit' : 'credit', line: i, value: lib.r2(l.debit || l.credit) });
            je.setSublistValue({ sublistId: 'line', fieldId: 'entity', line: i, value: l.entity });
            je.setSublistValue({ sublistId: 'line', fieldId: 'memo', line: i, value: l.memo });
        });
        return je.save({ ignoreMandatoryFields: true });
    }

    // ---------- entry ----------
    function onRequest(ctx) {
        const req = ctx.request, P = req.parameters;
        const asOf = parseAsOf(P.asof || P.custpage_asof_iso);
        const status = P.status || '';

        if (req.method === 'POST') {
            let iso = asOf;
            if (P.custpage_asof) {
                const dt = format.parse({ value: P.custpage_asof, type: format.Type.DATE });
                iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            }
            if (P.custpage_action === 'postje') {
                redirect.toRecord({ type: record.Type.JOURNAL_ENTRY, id: postWipJe(iso) });
                return;
            }
            redirect.toSuitelet({ scriptId: SCRIPT, deploymentId: DEPLOY, parameters: { asof: iso, status: P.custpage_status || '' } });
            return;
        }

        if (P.action === 'csv') {
            ctx.response.setHeader({ name: 'Content-Type', value: 'text/csv' });
            ctx.response.setHeader({ name: 'Content-Disposition', value: `attachment; filename="Genesys_WIP_${asOf}.csv"` });
            ctx.response.write(csv(lib.buildReport(asOf, status)));
            return;
        }

        const form = ui.createForm({ title: 'Genesys Impact - WIP Schedule' });
        if (P.action === 'detail') {
            const rows = lib.getDetail(P.job, P.kind, asOf);
            let jobName;
            try { jobName = search.lookupFields({ type: search.Type.JOB, id: P.job, columns: ['entityid', 'companyname', 'externalid'] }); }
            catch (e) { jobName = search.lookupFields({ type: search.Type.JOB, id: P.job, columns: ['entityid', 'companyname'] }); }
            const ext = Array.isArray(jobName.externalid) ? (jobName.externalid[0] || {}).text : jobName.externalid;
            const no = /^GI-JOB-/.test(ext || '') ? ext.slice(7) : jobName.entityid;
            const title = `${no} ${String(jobName.companyname || '').split(' : ').pop()} - ${P.kind === 'cost' ? 'job-to-date costs' : 'billings to date'} through ${asOf}`;
            form.addField({ id: 'custpage_html', type: ui.FieldType.INLINEHTML, label: ' ' })
                .defaultValue = detailHtml(rows, title, selfUrl({ asof: asOf, status }));
            ctx.response.writePage(form);
            return;
        }

        const fAsOf = form.addField({ id: 'custpage_asof', type: ui.FieldType.DATE, label: 'As of' });
        fAsOf.defaultValue = format.format({ value: new Date(Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7)) - 1, Number(asOf.slice(8, 10))), type: format.Type.DATE });
        const fStatus = form.addField({ id: 'custpage_status', type: ui.FieldType.SELECT, label: 'Job status' });
        [['', 'All jobs'], ['progress', 'In progress only'], ['done', 'Completed / closed only']]
            .forEach((o) => fStatus.addSelectOption({ value: o[0], text: o[1], isSelected: o[0] === status }));
        form.addField({ id: 'custpage_action', type: ui.FieldType.TEXT, label: 'action' }).updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN });
        form.addField({ id: 'custpage_asof_iso', type: ui.FieldType.TEXT, label: 'asof' }).updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN }).defaultValue = asOf;
        form.addSubmitButton({ label: 'Refresh' });
        form.addButton({ id: 'custpage_csv', label: 'Export to Excel (CSV)', functionName: `(function(){window.location=${JSON.stringify(selfUrl({ action: 'csv', asof: asOf, status }))};})` });
        form.addButton({ id: 'custpage_je', label: 'Post WIP Adjustment JE',
            functionName: `(function(){document.getElementById('custpage_action').value='postje';(document.getElementById('main_form')||document.forms[0]).submit();})` });

        const rep = lib.buildReport(asOf, status);
        const html = form.addField({ id: 'custpage_html', type: ui.FieldType.INLINEHTML, label: ' ' });
        html.updateLayoutType({ layoutType: ui.FieldLayoutType.OUTSIDEBELOW });
        html.defaultValue = reportHtml(rep, status);
        ctx.response.writePage(form);
    }

    return { onRequest };
});
