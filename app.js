// 1) Paste your published Google Sheet CSV link here:
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQx5Jg1cLHd5ubW2idSU1NtySJbu1VdaJL7BLusCEY0vBEsimWBQUWSed804Jb1S-ihcxlgJvffb1on/pub?gid=0&single=true&output=csv";

let rows = [];
let filtered = [];

const el = (id) => document.getElementById(id);

// ---------- CSV parsing ----------
function csvToRows(csvText) {
  const lines = csvText.replace(/\r/g, "").split("\n").filter(Boolean);
  const headers = parseLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = (cells[i] ?? "").trim());
    return obj;
  });

  function parseLine(line) {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  }
}

function pick(row, key) { return (row[key] ?? "").trim(); }

function normalise(row) {
  const swatchList = pick(row, "swatch_urls")
  .split("|")
  .map(s => s.trim())
  .filter(Boolean);

  return {
    collection_name: pick(row, "collection_name"),
    collection_order: Number(pick(row, "collection_order")) || 9999,
    range_name: pick(row, "range_name"),
    range_order: Number(pick(row, "range_order")) || 9999,
    collection_colours: pick(row, "collection_colours"),
    hero_image_url: pick(row, "hero_image_url"),
    texture_image_url: pick(row, "texture_image_url"),
    product_type: pick(row, "product_type"),
    size: pick(row, "size"),
    carton_qty: pick(row, "carton_qty"),
    price_unit: pick(row, "price_unit"),

    swatches: swatchList,

    thumbs: [
      pick(row, "thumb_1_url"),
      pick(row, "thumb_2_url"),
    ].filter(Boolean)
  };
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a,b) => a.localeCompare(b));
}

function populateFilters(data) {
  const cSel = el("filterCollection");
  const rSel = el("filterRange");

  const collections = uniqueSorted(data.map(x => x.collection_name));
  const ranges = uniqueSorted(data.map(x => x.range_name));

  for (const c of collections) {
    const o = document.createElement("option");
    o.value = c; o.textContent = c;
    cSel.appendChild(o);
  }
  for (const r of ranges) {
    const o = document.createElement("option");
    o.value = r; o.textContent = r;
    rSel.appendChild(o);
  }
}

function applyFilters() {
  const q = el("q").value.trim().toLowerCase();
  const collection = el("filterCollection").value;
  const range = el("filterRange").value;

  filtered = rows.filter(x => {
    if (collection && x.collection_name !== collection) return false;
    if (range && x.range_name !== range) return false;
    if (!q) return true;

    const hay = `${x.collection_name} ${x.range_name} ${x.collection_colours} ${x.product_type} ${x.size}`.toLowerCase();
    return hay.includes(q);
  });

  render();
}

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item) || "";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

function escapeHtml(s) {
  return (s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

function render() {
  const container = el("brochure");
  container.innerHTML = "";

  const byRange = groupBy(filtered, x => x.range_name);

  const sortedRanges = Array.from(byRange.entries()).sort((a, b) => {
  const A = a[1][0]; // first row for range A
  const B = b[1][0]; // first row for range B

  // 1) collection order
  if (A.collection_order !== B.collection_order) {
    return A.collection_order - B.collection_order;
  }

  // 2) collection name (tie-breaker, optional)
  const cn = (A.collection_name || "").localeCompare(B.collection_name || "");
  if (cn !== 0) return cn;

  // 3) range order
  if (A.range_order !== B.range_order) {
    return A.range_order - B.range_order;
  }

  // 4) range name (final tie-breaker)
  return (A.range_name || "").localeCompare(B.range_name || "");
});

for (const [rangeName, items] of sortedRanges) {
  const first = items[0];
  // ... your existing render code
}

  el("meta").textContent = `${filtered.length} lines • ${byRange.size} ranges`;

  for (const [rangeName, items] of byRange.entries()) {
    const first = items[0];

    const swatchesHtml = first.swatches?.length
      ? `<div class="swatches-left">
          ${first.swatches.map(u => `<img src="${u}" alt="Swatch" loading="lazy" referrerpolicy="no-referrer">`).join("")}
        </div>`
      : "";

    // group by product_type for the right-side blocks
    const byType = groupBy(items, x => x.product_type);

    // build the right-side table blocks
    const orderSizes = ["Single","Double","King","Super King"];
    const typeBlocksHtml = Array.from(byType.entries()).map(([type, lines]) => {
      lines.sort((a,b) => {
        const ai = orderSizes.indexOf(a.size);
        const bi = orderSizes.indexOf(b.size);
        if (ai === -1 && bi === -1) return (a.size||"").localeCompare(b.size||"");
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });

      const rowsHtml = lines.map(l => `
        <tr>
          <td>${escapeHtml(l.size)}</td>
          <td>${escapeHtml(l.carton_qty)}</td>
          <td>${l.price_unit ? `£${escapeHtml(l.price_unit)}` : ""}</td>
        </tr>
      `).join("");

      return `
        <div class="type-block">
          <div class="type-head">
            <div class="type-name">${escapeHtml(type)}</div>
            <div class="type-cols">Ctn Qty</div>
            <div class="type-cols">Price/ Unit</div>
          </div>
          <table class="table">
            <colgroup>
              <col style="width:55%">
              <col style="width:18%">
              <col style="width:27%">
            </colgroup>
            <tbody>${rowsHtml}</tbody>
          </table>

      `;
    }).join("");

    const thumbsHtml = first.thumbs?.length
      ? `<div class="thumbs">${first.thumbs.map(u => `<img src="${u}" alt="Thumbnail" loading="lazy" referrerpolicy="no-referrer">`).join("")}</div>`
      : "";

    const sheet = document.createElement("section");
    sheet.className = "sheet";
    sheet.innerHTML = `
      <div class="sheet-header">${escapeHtml(first.collection_name || "")}</div>

      <div class="sheet-body">
        <div class="left">
          ${first.hero_image_url ? `<img class="hero" src="${first.hero_image_url}" alt="Hero" loading="lazy" referrerpolicy="no-referrer">` : ""}
          ${swatchesHtml}
          ${first.texture_image_url ? `<img class="texture" src="${first.texture_image_url}" alt="Texture" loading="lazy" referrerpolicy="no-referrer">` : ""}
        </div>

        <div class="right">
          <div class="range-title">${escapeHtml(rangeName || "")}</div>
          <div class="colours"><b>Colours:</b> ${escapeHtml(first.collection_colours || "")}</div>

          ${typeBlocksHtml}
          ${thumbsHtml}
        </div>
      </div>
    `;

    container.appendChild(sheet);
  }
}

async function init() {
  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load CSV");
  const csv = await res.text();

  rows = csvToRows(csv).map(normalise)
    .filter(x => x.range_name && x.product_type); // minimum

  filtered = rows;

  populateFilters(rows);
  render();
}

el("q").addEventListener("input", applyFilters);
el("filterCollection").addEventListener("change", applyFilters);
el("filterRange").addEventListener("change", applyFilters);

init().catch(err => {
  el("meta").textContent = `Error: ${err.message}`;
});
