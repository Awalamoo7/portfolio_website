---
title: "Diagnosing a Broken Payment Funnel: Why 1 in 3 Transactions Was Failing"
subtitle: "A deep-dive into a card payment acceptance rate problem, where a 69.6% approval rate and $121M in declined volume pointed to structural problems hiding in plain sight inside the API integration."
date: 2026-03-25
tags: ["Product Management", "Payments", "Data Analysis", "Fintech", "Payroll"]
---

## 01 — Background

Velo is a global HRtech platform that allows companies to hire, pay, and manage employees and contractors across markets. A core part of Velo's product is the ability for clients to fund their accounts using credit and debit cards. A direct-to-account funding flow that sits at the very front of the payments experience.

To process these transactions, Velo had partnered with Nexus Pay, a global payment processor capable of handling cards from multiple countries and settling funds in USD. Clients enter their card details inside the Velo web application; Velo's systems pass those credentials and transaction parameters to Nexus Pay via API, which returns a binary outcome: accepted or declined.

This flow sounds straightforward, but payments are rarely simple. The card funding experience is the first financial touchpoint a Velo client has with the platform. A declined transaction is a moment of friction that erodes trust, interrupts payroll runs, and in some cases triggers a client to question whether the platform is reliable at all.

---

## 02 — The Problem

The payments team flagged that Velo's acceptance rate had been underperforming. The ask was to investigate: understand the scale of the problem, find out where and why it was happening, and come back with recommendations.

I was given three assets to work with: a transaction-level acceptance report covering H1 2019 (5,429 transactions), a chargeback report for the same population, and the Nexus Pay API specification. No decline reason codes. No processor-side diagnostics. Just the data.

> The core question was not just 'why are payments declining' — it was 'what does our data actually tell us, and what does it not tell us?' Both answers matter equally when making recommendations.

---

## 03 — The Data

Before drawing any conclusions, I needed to understand the shape and limits of the dataset.

**What I had:**

- 5,429 transactions across 6 months (January – June 2019)
- 6 countries: US, UK, France, Canada, Mexico, UAE
- 5 currencies: USD, GBP, EUR, CAD, MXN
- Binary outcome per transaction: ACCEPTED or DECLINED
- CVV flag: whether CVV was provided (TRUE/FALSE)
- Transaction amount and currency, with exchange rates for USD conversion
- Timestamps down to the minute

**What I did not have:**

- No decline reason codes — so I could not directly observe _why_ any transaction was declined
- No card scheme data (Visa vs Mastercard vs Amex)
- No issuing bank information
- No 3DS / SCA authentication signals
- No retry attempt flags

This absence of decline codes is the single most important structural constraint on this analysis. Every hypothesis I developed had to be inferred from patterns in the data. I made this explicit throughout.

---

## 04 — My Approach

Before I touched a single row of data, I read the API spec.

That decision ended up being the whole case. The Nexus Pay spec showed that CVV — the three-digit security code on the back of a card — was marked as **"optional but recommended."** That phrase is a red flag in payments. Anything "optional" tends to get treated as "skip it." And sure enough, when I ran the numbers, that's exactly what had happened.

### Methodology

**Step 1 — Map the payment chain.**
Velo to Nexus Pay to Acquiring Bank to Card Network to Issuing Bank. Every node is a potential failure point. You need this map before the data makes any sense.

**Step 2 — Read the API spec before the data.**
The Nexus Pay spec revealed CVV was "optional." That became hypothesis #1 before a single query was run. The API spec was a two-page HTML document.

**Step 3 — Clean and convert the data.**
I pulled the transaction and chargeback datasets into Python, joined them on transaction ID, and converted all monetary amounts to USD using the exchange rates embedded in each transaction record. This gave me a single, consistent dataset I could cut any way I needed.

**Step 4 — Cut the data across 7 dimensions.**
Time trend, geography, authentication (CVV), transaction value, currency, chargebacks, and data quality anomalies. Each cut was designed to isolate a different failure mode.

**Step 5 — Build hypotheses with confidence levels.**
What's the causal mechanism, what data supports it, and how would I test it.

**Step 6 — Prioritise by effort × impact.**
The highest-impact fix was also the cheapest.

---

## 05 — The Numbers

### Overall picture

| Metric                | Value   | Note                        |
| --------------------- | ------- | --------------------------- |
| Total transactions    | 5,429   | H1 2019                     |
| Accepted              | 3,777   | 69.6% of total              |
| Declined              | 1,652   | 30.4% of total              |
| Total volume (USD)    | $397.5M | Across all currencies       |
| Declined volume (USD) | $121.2M | Revenue not captured        |
| Avg transaction size  | $73,200 | Predominantly large top-ups |
| Chargeback rate       | 4.1%    | 223 of 5,429 transactions   |
| CVV inclusion rate    | 0.7%    | 40 of 5,429 transactions    |
| Countries covered     | 6       | US, UAE, UK, FR, CA, MX     |

> **The scale of the problem:** Nearly one in three payment attempts was failing. That's a structural fault in how the integration was built.

### Reframing the 'decline' narrative

The team's initial framing was that the acceptance rate had 'declined recently.' This is an important distinction to interrogate. When I looked at the monthly trend, what I found was not a rate that was falling, it was a rate that had been **consistently poor** across the entire period:

| Jan   | Feb   | Mar   | Apr   | May   | Jun   |
| ----- | ----- | ----- | ----- | ----- | ----- |
| 69.6% | 70.1% | 68.9% | 67.8% | 69.4% | 71.7% |

The rate oscillates within a tight band: 68–72%. There is no visible deterioration. What is increasing is the volume of declined dollars i.e from $3.8M declined in January to $35.5M in June. The platform was processing larger top-ups over time, so the same ~30% decline rate was hitting proportionally bigger amounts.

This reframe matters. A declining trend asks _what changed_. A flat, low rate asks _what was never set up correctly_. They lead you to completely different root causes, and completely different recommendations.

### Acceptance rate by country

| Country | Transactions | Acceptance Rate | Declined Vol (USD) | Key Signal                          |
| ------- | ------------ | --------------- | ------------------ | ----------------------------------- |
| US      | 905          | 67.2%           | $25.1M             | Lowest rate; USD only               |
| UAE     | 905          | 67.9%           | $26.3M             | USD only; no local currency routing |
| CA      | 905          | 69.6%           | $18.1M             | CAD currency; near average          |
| FR      | 905          | 70.1%           | $26.6M             | EUR; CVV anomaly (see below)        |
| MX      | 905          | 71.2%           | $0.9M              | MXN; low value transactions         |
| UK      | 905          | 71.5%           | $24.2M             | GBP; best performing                |

All six markets sit 15–25 points below industry benchmark (85–95%). This is a platform-wide problem.

Two findings stand out immediately. First, US and UAE are the weakest performing markets and share a critical characteristic: both transact exclusively in USD. Every other market transacts in its local currency. Second, UK outperforms all markets despite having the second-highest declined volume in absolute terms — GBP-denominated transactions are simply better accepted, suggesting local currency routing has a protective effect on acceptance rates.

---

## 06 — Key Findings

### Finding 1 — CVV data is missing from 99.3% of transactions `HIGH CONFIDENCE`

Of 5,429 transactions, only 40 included a CVV code. In card-not-present payments, CVV is the primary signal an issuing bank uses to determine whether the person initiating the payment actually has the card in front of them. Without it, issuers default to conservative decline behaviour.

The distribution wasn't random: 38 of the 40 CVV-present transactions came from France. Canada, Mexico, and the UK had **zero** CVV transactions across six months. This is a localised integration bug, not a user behaviour pattern.

> **Data point:** 40 / 5,429 transactions include CVV (0.74%). Industry norm for card-not-present flows is >95%.

### Finding 2 — Chargeback rate at 4.1%, four times Visa's threshold `HIGH CONFIDENCE`

Visa's Dispute Monitoring Programme triggers at 0.9%. Mastercard's Early Warning triggers at 1.5%. At 4.1%, Velo is operating well inside monitoring territory for both networks.

This creates a compounding problem: when a processor sees a merchant with elevated chargebacks, they tighten their own fraud scoring, thereby reducing approval rates further. High chargebacks cause more declines, which causes more chargebacks. It's a feedback loop.

All 223 chargebacks cluster in January 2019, which is worth investigating separately. It could be either a specific fraud event, a reporting lag, or a data quality issue.

> **Data point:** 223 chargebacks on 5,429 transactions = 4.11%. Total chargeback volume: $1.46M USD.

### Finding 3 — USD charging of non-USD cards is causing issuer-side declines `HIGH CONFIDENCE`

Both the US and UAE transact exclusively in USD, while all other markets use local currency. For UAE clients, their cards are almost certainly issued in AED, but Velo is charging them in USD. Issuing banks in markets like the UAE often apply stricter fraud rules to cross-currency transactions, and some will automatically decline international currency charges above certain thresholds.

Countries processing in local currency (UK: 71.5%, MX: 71.2%) consistently outperform. The US processing domestically in USD but still declining at 67.2% confirms that currency routing is not the only issue — fraud model sensitivity (driven by missing CVV) compounds the problem.

### Finding 4 — No 3DS / SCA implementation `MEDIUM CONFIDENCE`

The API spec and transaction data contain no 3DS or Strong Customer Authentication signals. For European markets (UK, FR) especially, post-PSD2, card issuers are increasingly requiring SCA for online transactions. Transactions submitted without a 3DS flow may be declined at the issuer level for compliance reasons, rather than fraud reasons.

### Finding 5 — No intelligent retry logic `LOW-MEDIUM CONFIDENCE`

Without retry attempt flags in the data, I cannot confirm this directly. However, soft declines (temporary issuer-side declines that can be retried) represent a meaningful percentage of declines on most payment platforms — often 20–30%. If Velo's integration is not distinguishing soft from hard declines and retrying appropriately, a recoverable share of that $121M is being left on the table.

### A note on data limitations

> **Worth flagging explicitly:** Nexus Pay returns only a binary ACCEPTED/DECLINED state — no decline reason codes. This is the single biggest constraint on diagnosis. Standard ISO codes (e.g., "05 — Do Not Honour", "51 — Insufficient Funds", "59 — Suspected Fraud") would let you identify whether declines are fraud-driven, limit-driven, or technical. Without them, every hypothesis carries uncertainty. Getting Nexus Pay to surface these codes should be treated as a P0 alongside the CVV fix.

---

## 07 — Recommendations

Prioritised by impact and sequenced by dependencies:

| Priority | Initiative                                                         | Effort | Expected Lift                 | Timeline   | Owner                    |
| -------- | ------------------------------------------------------------------ | ------ | ----------------------------- | ---------- | ------------------------ |
| **P0**   | Mandate CVV collection and pass it in the API request              | Low    | +3–7pp globally               | 2–4 weeks  | Engineering / PM         |
| **P0**   | Request decline reason codes from Nexus Pay                        | Low    | Unlocks all further diagnosis | 2–3 weeks  | Payments PM              |
| **P1**   | Implement 3D Secure / SCA for European markets                     | High   | +5–8pp in EU                  | 8–12 weeks | Engineering / Compliance |
| **P1**   | Chargeback reduction programme (fraud screening + velocity limits) | Medium | Prevents rate degradation     | Ongoing    | Risk / Finance           |
| **P2**   | Enable local currency routing for UAE (AED)                        | Medium | +2–3pp in AE                  | 6–8 weeks  | Payments PM              |
| **P2**   | Smart retry logic for soft declines _(depends on P0 reason codes)_ | Medium | +2–4pp globally               | 4–6 weeks  | Engineering              |
| **P3**   | BIN-level analytics and intelligent routing                        | High   | +1–3pp globally               | Quarter+   | Payments PM / Infra      |
| **P3**   | Explore processor diversification (backup PSP)                     | High   | +1–2pp globally               | Quarter+   | Payments PM / Infra      |

> **The 80/20:** Just mandating CVV collection (2–4 weeks) and implementing 3DS for EU would likely recover 8–15 percentage points of acceptance rate — moving Velo from the bottom quartile into a competitive range, without touching backend infrastructure.

### What the cost of inaction looks like

If none of this is addressed:

- **Card network monitoring programmes** kick in due to the 4.1% chargeback rate. Visa fines start at $25,000/month and escalate. Mastercard can force per-transaction fees of $0.10–$0.25.
- **Processor relationship deteriorates** as Nexus Pay continues to see an elevated-risk merchant, tightening their own scoring further.
- **Client friction compounds** — every failed payment is a contractor who doesn't get paid on time, and a Velo customer who considers using something else.
- **PSD2 non-compliance** in European markets as SCA enforcement ramps up.

The 15–25pp gap to industry benchmark represents roughly **$80M+ in recoverable declined volume** per half-year at current transaction volumes.

---

## 08 — Communication

One of the clearest lessons from payments work is that the same set of facts lands very differently depending on who you are talking to. I prepared two versions of this analysis, each structured for a different audience and a different desired outcome.

### Executive summary (CEO, COO, Finance, Legal)

The executive version led with the business impact: $121M in declined transactions over six months, an acceptance rate of 69.6% against an industry benchmark of 85%+, and a clear through-line to client trust and platform reliability. I avoided technical language, framed the CVV and currency routing issues in plain terms ('we are not sending a required security signal to the processor' and 'we are charging UAE clients in a foreign currency'), and presented the recommendation stack as a short-term, medium-term, and long-term roadmap with expected outcomes.

The exec version also flagged the chargeback rate as a reputational and contractual risk — card schemes can place merchants on monitoring programmes or escalate to termination if chargeback rates persist above threshold. This was not in the original brief but was a necessary signal for a Legal and Finance audience.

### Product and engineering brief

The product team version was a technical brief structured around the API spec and the data findings. It included the full breakdown by country, CVV analysis, currency routing logic, and a detailed table of decline hypotheses with supporting evidence. It called out the absence of decline reason codes explicitly and framed the decline code request as a dependency that unlocks everything else.

I also included my full analysis workings — the Python script and the Excel workbook — so that the engineering team could validate my currency conversion logic and QA the data joins. Transparency about methodology matters in cross-functional settings. If a data engineer spots a flaw in my conversion logic, I want them to tell me before we ship a roadmap built on a bad number.

---

## 09 — Reflection

### What worked

- **Reframing the problem** — distinguishing between 'acceptance rate is declining' and 'acceptance rate has always been low' changed the entire shape of the recommendations. The brief said the former. The data said the latter. Noticing that distinction, and saying it out loud, is what the work actually is.
- **Reading the API spec as primary source material** — the Nexus Pay spec was a two-page HTML document most people would skim past. It contained the entire root cause.
- **Acknowledging data limits explicitly** — stating what I could and could not conclude from the data built credibility rather than undermining it.
- **Separating audience versions** — the exec summary and the product brief served very different purposes and needed to be written as distinct documents, not the same content with different fonts.

### What I would do differently

- **Get decline codes first** — if I were setting this up from scratch, the first API call would return structured decline reason codes. Analysing payment failures without them is like doing a post-mortem without a cause of death.
- **Build a cohort analysis** — I would track individual clients across months to see if the same clients are experiencing repeated declines (suggesting a card-level issue) or if declines are evenly distributed (suggesting a platform-level issue).
- **Benchmark against Nexus Pay's own data** — the processor will have acceptance benchmarks for Velo's merchant category. Requesting that data would immediately show whether Velo is underperforming relative to comparable merchants on the same processor, or whether the processor itself is underperforming.
- **Quantify the retry opportunity more precisely** — even without retry flags, I could have estimated a recovery range by applying typical soft vs hard decline ratios from industry data and sizing the addressable opportunity more concretely.

---

## 10 — Tools Used

| Tool                            | Purpose                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Python**                      | Data cleaning, currency conversion, joins across transaction and chargeback datasets, exploratory analysis |
| **Excel**                       | Pivot tables for country-level breakdowns, summary tables, shareable workbook for engineering QA           |
| **Nexus Pay API Specification** | Primary source for identifying the CVV integration gap and understanding the processor's data model        |

---

_This case study is based on a real analytical exercise completed as part of a product operations role application. Company names have been anonymised._
