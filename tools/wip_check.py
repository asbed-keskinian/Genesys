"""Recompute the Genesys WIP template columns from sdf/src/FileCabinet/SuiteScripts/GenesysDemo/data/jobs.json.
Prior-years revenue = earned at prior year end using the current estimate."""
import json, sys
d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "sdf/src/FileCabinet/SuiteScripts/GenesysDemo/data/jobs.json"))
cols = "Job State Status Contract EstCost EstGP GP% %Cmp JTDRev JTDCost JTDGP JTDBill Under Over YTDRev YTDCost YTDGM PYRev PYCost PYGM BillProof".split()
print(("{:>10}"*len(cols)).format(*cols))
tot = [0]*len(cols)
for j in d["jobs"]:
    G, H = j["contract"], j["estCost"]
    M = j["costPrior"] + j["costYTD"]; O = j["billPrior"] + j["billYTD"]
    K = M / H; L = round(K * G, 2)
    U = round(j["costPrior"] / H * G, 2); V = j["costPrior"]
    row = [j["job"], j["state"], j["status"][:4], G, H, G-H, (G-H)/G, K, L, M, L-M, O,
           max(L-O, 0), max(O-L, 0), L-U, M-V, (L-U)-(M-V), U, V, U-V, G-O]
    for i in (3,4,5,8,9,10,11,12,13,14,15,16,17,18,19,20): tot[i] += row[i]
    print("".join(f"{v:>10.0%}" if i in (6,7) else (f"{v:>10,.0f}" if isinstance(v,(int,float)) else f"{v:>10}") for i, v in enumerate(row)))
print("".join(f"{v:>10,.0f}" if i in (3,4,5,8,9,10,11,12,13,14,15,16,17,18,19,20) else f"{'':>10}" for i, v in enumerate(tot)))
