import { useEffect, useMemo, useState } from "react";

// Use env var in production, fallback to relative in dev (Vite proxy)
const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

function api(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

export default function App() {
  const [chapter, setChapter] = useState(1);
  const [verse, setVerse] = useState(1);
  const [chapters, setChapters] = useState<number[]>([]);
  const [verses, setVerses] = useState<number[]>([]);
  const [darby, setDarby] = useState("");
  const [commentaryHtml, setCommentaryHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [jump, setJump] = useState("");
  const [error, setError] = useState("");

  // Load chapters
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(api("/api/chapters"));
        setChapters(await r.json());
      } catch {
        setChapters(Array.from({ length: 21 }, (_, i) => i + 1));
      }
    })();
  }, []);

  // Load verse list for selected chapter
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(api(`/api/verses?chapter=${chapter}`));
        const arr = await r.json();
        setVerses(arr);
        if (!arr.includes(verse)) setVerse(arr[0] || 1);
      } catch {
        setVerses(Array.from({ length: 60 }, (_, i) => i + 1));
      }
    })();
  }, [chapter]);

  // Load Darby + Commentary for current ref
  const load = async (ch: number, v: number) => {
    setLoading(true);
    setError("");
    try {
      const [d, c] = await Promise.all([
        fetch(api(`/api/darby?chapter=${ch}&verse=${v}`)).then(r => r.json()).catch(() => ({ text: "" })),
        fetch(api(`/api/commentary?chapter=${ch}&verse=${v}`)).then(r => r.json())
      ]);
      setDarby(d?.text || "(Darby verse not found)");
      setCommentaryHtml(c?.commentaryHtml || "<p><em>No commentary found.</em></p>");
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(chapter, verse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter, verse]);

  const onJump = () => {
    const s = jump.trim().replace(/^John\s*/i, "");
    const [chStr, vStr] = s.split(":");
    const ch = parseInt(chStr || "", 10);
    const vs = parseInt(vStr || "", 10);
    if (!isNaN(ch) && !isNaN(vs)) { setChapter(ch); setVerse(vs); }
  };

  const goPrev = () => {
    const idx = verses.indexOf(verse);
    if (idx > 0) setVerse(verses[idx - 1]);
    else {
      const cIdx = chapters.indexOf(chapter);
      if (cIdx > 0) { setChapter(chapters[cIdx - 1]); }
    }
  };

  const goNext = () => {
    const idx = verses.indexOf(verse);
    if (idx >= 0 && idx < verses.length - 1) setVerse(verses[idx + 1]);
    else {
      const cIdx = chapters.indexOf(chapter);
      if (cIdx >= 0 && cIdx < chapters.length - 1) { setChapter(chapters[cIdx + 1]); setVerse(1); }
    }
  };

  const title = useMemo(() => `John ${chapter}:${verse}`, [chapter, verse]);

  return (
    <div style={{maxWidth:1050, margin:"24px auto", padding:"0 16px", fontFamily:"system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"}}>
      <h1 style={{textAlign:"center", fontWeight:700, fontSize:20, margin:"0 0 12px"}}>Gospel of John — Darby & Commentary</h1>

      <div style={{display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center", marginBottom:12}}>
        <select value={chapter} onChange={e => setChapter(parseInt(e.target.value,10))}>
          {chapters.map(c => <option key={c} value={c}>Chapter {c}</option>)}
        </select>

        <select value={verse} onChange={e => setVerse(parseInt(e.target.value,10))}>
          {verses.map(v => <option key={v} value={v}>Verse {v}</option>)}
        </select>

        <input
          placeholder="Jump e.g. John 3:16"
          value={jump}
          onChange={e => setJump(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onJump(); }}
          style={{padding:"8px 10px", borderRadius:8, border:"1px solid #d1d5db"}}
        />
        <button onClick={onJump} style={{padding:"8px 10px", borderRadius:8, background:"#111827", color:"#fff", border:0, cursor:"pointer"}}>Go</button>

        <button onClick={goPrev} style={{padding:"8px 10px", borderRadius:8, background:"#fff", border:"1px solid #d1d5db", cursor:"pointer"}}>← Prev</button>
        <button onClick={goNext} style={{padding:"8px 10px", borderRadius:8, background:"#fff", border:"1px solid #d1d5db", cursor:"pointer"}}>Next →</button>
      </div>

      {error && <p style={{color:"#b91c1c", textAlign:"center"}}>{error}</p>}

      <div style={{display:"flex", gap:16, flexWrap:"wrap"}}>
        <div style={{flex:"1 1 420px", border:"1px solid #e5e7eb", borderRadius:12, boxShadow:"0 1px 3px rgba(0,0,0,.06)", padding:16, background:"#fff"}}>
          <div style={{fontWeight:700, fontSize:18, marginBottom:8}}>{title} — Darby</div>
          <div style={{lineHeight:1.6}}><p>{loading ? "Loading…" : darby}</p></div>
        </div>

        <div style={{flex:"1 1 420px", border:"1px solid #e5e7eb", borderRadius:12, boxShadow:"0 1px 3px rgba(0,0,0,.06)", padding:16, background:"#fff"}}>
          <div style={{fontWeight:700, fontSize:18, marginBottom:8}}>Commentary — Hamilton Smith</div>
          <div style={{lineHeight:1.6}} dangerouslySetInnerHTML={{ __html: loading ? "<p>Loading…</p>" : commentaryHtml }} />
        </div>
      </div>
    </div>
  );
}
