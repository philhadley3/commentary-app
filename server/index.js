import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";

const app = express();
app.use(cors());

// Resolve data files relative to THIS file (reliable)
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const commentaryPath = path.join(__dirname, "../web/public/HS_Gospel_John_tagged.html");
const darbyPath      = path.join(__dirname, "../web/public/darby_john.json");

// Log for quick sanity check
console.log("[API] commentaryPath:", commentaryPath, fs.existsSync(commentaryPath) ? "(found)" : "(NOT found)");
console.log("[API] darbyPath:", darbyPath, fs.existsSync(darbyPath) ? "(found)" : "(NOT found)");

// Helper: extract commentary slice for chapter:verse
function extractCommentaryFor(html, chapter, verse) {
  const root = parse(html);
  const blocks = root.querySelectorAll("h2, h3, p");
  const pattern = new RegExp(`^John\\s+${chapter}:(\\d+)(?:\\s*[-–—]\\s*(\\d+))?`, "i");

  const matchFor = (t) => {
    const m = (t || "").trim().match(pattern);
    if (!m) return null;
    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : start;
    return { start, end };
  };

  let anchorIdx = -1;
  for (let i = 0; i < blocks.length; i++) {
    const txt = blocks[i].text.trim();
    const m = matchFor(txt);
    if (m && verse >= m.start && verse <= m.end) {
      anchorIdx = i;
      break;
    }
  }
  if (anchorIdx === -1) {
    return {
      title: `John ${chapter}:${verse}`,
      commentaryHtml: `<p><em>No commentary found for John ${chapter}:${verse}.</em></p>`
    };
  }

  const startBlock = blocks[anchorIdx];
  const found = matchFor(startBlock.text.trim());
  const title = found.start === found.end
    ? `John ${chapter}:${found.start}`
    : `John ${chapter}:${found.start}-${found.end}`;

  const out = [startBlock.toString()];
  for (let i = anchorIdx + 1; i < blocks.length; i++) {
    const el = blocks[i];
    const tag = (el.tagName || "").toUpperCase();
    if (tag === "H2" || tag === "H3") break;            // next section/verse
    const nm = matchFor(el.text.trim());
    if (nm) break;                                      // next verse chunk
    out.push(el.toString());
  }
  return { title, commentaryHtml: out.join("\n") };
}

// ---- API ----
app.get("/api/chapters", (_req, res) => {
  res.json(Array.from({ length: 21 }, (_, i) => i + 1));
});

app.get("/api/verses", (req, res) => {
  const ch = parseInt(String(req.query.chapter || "1"), 10);
  try {
    const j = JSON.parse(fs.readFileSync(darbyPath, "utf-8"));
    const verses = Object.keys(j[String(ch)] || {})
      .map(n => parseInt(n, 10))
      .sort((a,b)=>a-b);
    if (verses.length) return res.json(verses);
  } catch {}
  return res.json(Array.from({ length: 60 }, (_, i) => i + 1));
});

app.get("/api/darby", (req, res) => {
  const ch = parseInt(String(req.query.chapter || "1"), 10);
  const v  = parseInt(String(req.query.verse   || "1"), 10);
  try {
    const j = JSON.parse(fs.readFileSync(darbyPath, "utf-8"));
    const text = j?.[String(ch)]?.[String(v)] || "";
    res.json({ text });
  } catch {
    res.json({ text: "" });
  }
});

app.get("/api/commentary", (req, res) => {
  const ch = parseInt(String(req.query.chapter || "1"), 10);
  const v  = parseInt(String(req.query.verse   || "1"), 10);
  try {
    const html = fs.readFileSync(commentaryPath, "utf-8");
    const out = extractCommentaryFor(html, ch, v);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: "Failed to read commentary file" });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`API running http://localhost:${port}`));
