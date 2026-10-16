import { useRef } from "react";

export type Paper = { name: string; url: string; data: string };

/** Left-hand research paper viewer. Shows a scanning beam while Marg is reading it. */
export function PaperPanel({ paper, page, reading, onLoad, onClose }: {
  paper: Paper | null; page: number; reading: boolean; onLoad: (f: File) => void; onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <aside className={`paper glass ${reading ? "reading" : ""}`}>
      <header>
        <span className="pname" title={paper?.name}>📄 {paper?.name ?? "No paper loaded"}</span>
        <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} title="Open a PDF">＋</button>
        <button type="button" className="icon-btn" onClick={onClose} title="Hide panel">✕</button>
        <input ref={fileRef} type="file" accept="application/pdf" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onLoad(f); e.target.value = ""; }} />
      </header>
      <div className="pbody">
        {paper
          ? <iframe key={`${paper.url}#${page}`} title="paper" src={`${paper.url}#page=${page}&toolbar=0&navpanes=0&view=FitH`} />
          : <div className="pempty">Open a PDF and Marg will read it with you.</div>}
        {reading && (
          <div className="scan">
            <div className="beam" />
            <div className="scanlabel">Marg is reading…</div>
          </div>
        )}
      </div>
    </aside>
  );
}
