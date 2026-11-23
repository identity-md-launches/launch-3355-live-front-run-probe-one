import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MAX_SLIPPAGE, probe, safeSlippage } from "./sandwich";
import {
  EXAMPLES,
  FIELDS,
  type FieldKey,
  type Values,
  parseField,
  readLegacyHash,
  readQuery,
  writeQuery,
} from "./fields";
import { formatAmount, formatPercent } from "./format";

export function App() {
  const [values, setValues] = useState<Values>(
    () => readQuery(window.location.search) ?? readLegacyHash(window.location.hash) ?? EXAMPLES[1].values,
  );
  const [copied, setCopied] = useState(false);
  const verdictRef = useRef<HTMLDivElement>(null);
  // The query string this page last wrote or loaded, so history moves to another scenario can be told
  // apart from in-page anchor jumps that leave the query alone.
  const lastSearch = useRef(window.location.search);

  const parsed = useMemo(() => {
    const out = {} as Record<FieldKey, number>;
    const errors: Partial<Record<FieldKey, string>> = {};
    for (const field of FIELDS) {
      const result = parseField(field, values[field.key]);
      if (typeof result === "string") errors[field.key] = result;
      else out[field.key] = result;
    }
    return { numbers: out, errors };
  }, [values]);

  const valid = Object.keys(parsed.errors).length === 0;

  const report = useMemo(() => {
    if (!valid) return null;
    const n = parsed.numbers;
    const input = {
      amountIn: n.amountIn,
      reserveIn: n.reserveIn,
      reserveOut: n.reserveOut,
      fee: n.fee / 100,
      slippage: n.slippage / 100,
      gasCost: n.gasCost,
    };
    return { result: probe(input), safe: safeSlippage(input), slippage: input.slippage };
  }, [parsed, valid]);

  // Scenario in the query, section links in the fragment. An older #a=… scenario link is moved to the query.
  useEffect(() => {
    if (!valid) return;
    const query = writeQuery(parsed.numbers);
    const legacy = readLegacyHash(window.location.hash) !== null;
    lastSearch.current = query;
    if (window.location.search === query && !legacy) return;
    const hash = legacy ? "" : window.location.hash;
    window.history.replaceState(window.history.state, "", window.location.pathname + query + hash);
  }, [parsed, valid]);

  // Same-page navigation (back/forward, or following a scenario link in an open tab) restores that scenario.
  useEffect(() => {
    const sync = () => {
      const legacy = readLegacyHash(window.location.hash);
      if (legacy) {
        setValues(legacy);
        return;
      }
      if (window.location.search === lastSearch.current) return;
      const fromQuery = readQuery(window.location.search);
      lastSearch.current = window.location.search;
      if (fromQuery) setValues(fromQuery);
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const update = (key: FieldKey, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const copyLink = async () => {
    const shareUrl = window.location.href.split(/[?#]/)[0] + writeQuery(parsed.numbers);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      window.prompt("Copy this link", shareUrl);
    }
  };

  const safeLabel = report ? formatPercent(report.safe) : "";
  const canApplySafe = report !== null && report.safe < MAX_SLIPPAGE && report.safe < report.slippage;

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Sandwich Probe, back to top">
          <img src="./favicon.svg" alt="" width="28" height="28" />
          <span>Sandwich Probe</span>
        </a>
        <a className="header-link" href="#method">
          How it works
        </a>
      </header>

      <main id="top">
        <div className="intro">
          <h1>Will your swap get sandwiched?</h1>
          <p className="lede">
            Enter a swap on a constant-product pool to see what a front-runner could take within your slippage.
          </p>
        </div>

        <div className="workspace">
          <section className="panel inputs" aria-labelledby="inputs-title">
            <div className="panel-head">
              <h2 id="inputs-title">Your swap</h2>
              <div className="examples" role="group" aria-label="Load an example pool">
                {EXAMPLES.map((example) => (
                  <button key={example.name} type="button" className="chip" onClick={() => setValues(example.values)}>
                    {example.name}
                  </button>
                ))}
              </div>
            </div>
            <form className="field-grid" onSubmit={(event) => event.preventDefault()} noValidate>
              {FIELDS.map((field) => (
                <Field
                  key={field.key}
                  name={field.key}
                  label={field.label}
                  unit={field.unit}
                  spokenUnit={field.spokenUnit}
                  hint={field.hint}
                  value={values[field.key]}
                  error={parsed.errors[field.key]}
                  onChange={(value) => update(field.key, value)}
                />
              ))}
            </form>
          </section>

          <section
            className="panel results"
            aria-labelledby="results-title"
            data-state={report === null ? "idle" : report.result.exposed ? "exposed" : "safe"}
          >
            <h2 id="results-title" className="visually-hidden">
              Result
            </h2>
            <div role="status" aria-live="polite" className="verdict-region" tabIndex={-1} ref={verdictRef}>
              {report === null ? (
                <p className="verdict verdict-idle">Fix the highlighted field to see the result.</p>
              ) : report.result.exposed ? (
                <div className="verdict verdict-exposed">
                  <p className="verdict-title">
                    <WarnIcon /> Exposed: a sandwich nets {formatAmount(report.result.netProfit)} A
                  </p>
                  <p className="verdict-body">
                    You would get {formatAmount(report.result.victimOut)} B instead of{" "}
                    {formatAmount(report.result.expectedOut)} B.
                  </p>
                </div>
              ) : (
                <div className="verdict verdict-safe">
                  <p className="verdict-title">
                    <CheckIcon /> Safe: no profitable sandwich in this model
                  </p>
                  <p className="verdict-body">You get {formatAmount(report.result.expectedOut)} B.</p>
                </div>
              )}
            </div>

            {report && (
              <>
                <div className="safe-row">
                  <p>
                    {report.safe >= MAX_SLIPPAGE ? (
                      <>No sandwich pays at any slippage up to {formatPercent(MAX_SLIPPAGE)}.</>
                    ) : (
                      <>
                        Suggested slippage (rounded down): <strong className="num">{safeLabel}</strong>
                      </>
                    )}
                  </p>
                  {canApplySafe && (
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => {
                        update("slippage", String(+(report.safe * 100).toFixed(2)));
                        // The button disappears once applied; keep keyboard focus on the updated result.
                        verdictRef.current?.focus();
                      }}
                    >
                      Use {safeLabel} slippage
                    </button>
                  )}
                </div>

                <dl className="figures">
                  <Figure term="Expected output" value={`${formatAmount(report.result.expectedOut)} B`} />
                  <Figure term="Lowest output you accept" value={`${formatAmount(report.result.minOut)} B`} />
                  <Figure term="Price impact" value={formatPercent(report.result.priceImpact)} />
                  <Figure term="Best front-run size" value={`${formatAmount(report.result.frontRun)} A`} />
                  <Figure term="Your loss to the sandwich" value={`${formatAmount(report.result.victimLoss)} B`} />
                  <Figure
                    term="Attacker profit after gas"
                    value={`${formatAmount(report.result.exposed ? report.result.netProfit : 0)} A`}
                  />
                </dl>

                <div className="share-row">
                  <button type="button" className="button-secondary" onClick={copyLink}>
                    {copied ? "Link copied" : "Copy link to this result"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        <section id="method" className="method" aria-labelledby="method-title">
          <h2 id="method-title">How it works</h2>
          <p>
            The probe models a Uniswap v2 style pool. An attacker buys B just before your swap, your swap fills at the
            worse price, and the attacker sells the B back.
          </p>
          <code className="formula">out = in × (1 − fee) × B ÷ (A + in × (1 − fee))</code>
          <p>
            Your slippage caps the attack: the price can only move until you get the lowest output you accept. The
            probe searches for the most profitable front-run size within that cap and subtracts gas.
          </p>
          <p>
            It assumes one attacker, no other pending trades and a public mempool. Nothing is read from a chain; the
            example pools are illustrations.
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <p>Runs entirely in your browser. Values stay in the page address so a copied link reopens this result.</p>
      </footer>
    </>
  );
}

interface FieldProps {
  name: string;
  label: string;
  unit: string;
  spokenUnit?: string;
  hint?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function Field({ name, label, unit, spokenUnit, hint, value, error, onChange }: FieldProps) {
  const id = useId();
  const described = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ");
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {spokenUnit && (
          <>
            {" "}
            <span className="visually-hidden">({spokenUnit})</span>
          </>
        )}
      </label>
      <div className={`input-wrap${error ? " has-error" : ""}`}>
        <input
          id={id}
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={described || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="unit" aria-hidden="true">
          {unit}
        </span>
      </div>
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Figure({ term, value }: { term: string; value: string }) {
  return (
    <div className="figure">
      <dt>{term}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}

function WarnIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path d="M10 3 18 17H2L10 3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 8.5v3.5M10 14.5v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m6.5 10.2 2.3 2.3 4.7-4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
