import { useState, useEffect } from "react";
import { SK, sGet, sSet } from "../../storage.js";
import NamesView from "./NamesView.jsx";
import ThemesTracker from "./ThemesTracker.jsx";

// ◎ Watchlist tab: Names (synced with Gloomberg — prices, valuation, news,
// levels) and Themes (the keyword tracker over this app's news feeds).
const VIEWS = [
  { id: "names", label: "Names" },
  { id: "themes", label: "Themes & keywords" },
];

export default function WatchTab({ w, setAppKey, allArticles, setAllArticles }) {
  const [view, setView] = useState("names");
  useEffect(() => { sGet(SK.watchView).then(v => { if (VIEWS.some(x => x.id === v)) setView(v); }); }, []);
  const choose = v => { setView(v); sSet(SK.watchView, v); };
  return (
    <>
      <div style={{ display: "flex", marginBottom: 14, background: "#fff", border: "1px solid #e8e2d6", borderRadius: 8, overflow: "hidden" }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => choose(v.id)}
            style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, padding: "8px 18px", border: "none", flex: 1,
              borderBottom: view === v.id ? "2px solid #c0392b" : "2px solid transparent",
              background: view === v.id ? "#fdecea" : "none", color: view === v.id ? "#c0392b" : "#555",
              fontWeight: view === v.id ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }}>
            {v.label}{v.id === "names" && w.alerts.length ? ` (${w.alerts.length})` : ""}
          </button>
        ))}
      </div>
      {view === "names" ? <NamesView w={w} setAppKey={setAppKey} /> : <ThemesTracker allArticles={allArticles} setAllArticles={setAllArticles} />}
    </>
  );
}
