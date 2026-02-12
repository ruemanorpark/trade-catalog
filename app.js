// 1) Paste your published Google Sheet CSV link here:
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQx5Jg1cLHd5ubW2idSU1NtySJbu1VdaJL7BLusCEY0vBEsimWBQUWSed804Jb1S-ihcxlgJvffb1on/pub?gid=0&single=true&output=csv";

// paging
const PAGE_SIZE = 24;
let all = [];
let filtered = [];
let page = 1;

const el = (id) => document.getElementById(id);

function csvToRows(csvText) {
  // Basic CSV parser that handles quoted commas reasonably
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

function stripHtml(html) {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function pick(row, keys) {
  for (const k of keys) if (row[k] && row[k].trim()) return row[k].trim();
  return "";
}

function normaliseProduct(row) {
  // Map common Shopify headers to a consistent internal schema
  const title = pick(row, ["Title", "Product Title", "Name"]);
  const handle = pick(row, ["Handle", "SKU", "Variant SKU", "Product ID"]);
  const img = pick(row, ["Image Src", "Image", "Image URL", "Main Image"]);
  const price = pick(row, ["Variant Price", "Price"]);
  const type = pick(row, ["Type", "Product Type", "Category"]);
  const vendor = pick(row, ["Vendor", "Brand"]);
  const tags = pick(row, ["Tags"]);
  const swatch = pick(row, ["Swatch", "Swatch URL", "Swatch Link"]);
  const body = pick(row, ["Body (HTML)", "Description", "Body"]);
  const url = pick(row, ["Product URL", "URL", "Link"]);

  return {
    handle,
    title,
    img,
    swatch,
    price,
    type,
    vendor,
    tags,
    desc: stripHtml(body),
    url
  };
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a,b) => a.localeCompare(b));
}

function populateFilters(products) {
  const typeSel = el("filterType");
  const vendorSel = el("filterVendor");

  const types = uniqueSorted(products.map(p => p.type));
  const vendors = uniqueSorted(products.map(p => p.vendor));

  for (const t of types) {
    const o = document.createElement("option");
    o.value = t; o.textContent = t;
    typeSel.appendChild(o);
  }
  for (const v of vendors) {
    const o = document.createElement("option");
    o.value = v; o.textContent = v;
    vendorSel.appendChild(o);
  }
}

function applyFilters() {
  const q = el("q").value.trim().toLowerCase();
  const t = el("filterType").value;
  const v = el("filterVendor").value;

  filtered = all.filter(p => {
    if (t && p.type !== t) return false;
    if (v && p.vendor !== v) return false;
    if (!q) return true;
    const hay = `${p.title} ${p.handle} ${p.type} ${p.vendor} ${p.tags} ${p.desc}`.toLowerCase();
    return hay.includes(q);
  });

  page = 1;
  render();
}

function render() {
  const grid = el("grid");
  grid.innerHTML = "";

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = Math.min(page, pages);

  const start = (page - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  for (const p of slice) {
    const card = document.createElement("article");
    card.className = "card";

    const img = document.createElement("img");
    img.src = p.img || "";
    img.alt = p.title || "Product";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";

    const pad = document.createElement("div");
    pad.className = "pad";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = p.title || "(Untitled)";

    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = p.desc || "";

    const row = document.createElement("div");
    row.className = "row";

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = p.price ? `£${p.price}` : "";

    row.appendChild(price);

    if (p.swatch) {
      const sw = document.createElement("img");
      sw.className = "swatch";
      sw.src = p.swatch;
      sw.alt = "Swatch";
      sw.loading = "lazy";
      sw.referrerPolicy = "no-referrer";
      row.appendChild(sw);
    }

    if (p.url) {
      const a = document.createElement("a");
      a.href = p.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "View";
      a.style.marginLeft = "auto";
      a.style.textDecoration = "none";
      a.style.color = "#111";
      a.style.fontWeight = "650";
      row.appendChild(a);
    }

    pad.appendChild(title);
    pad.appendChild(desc);
    pad.appendChild(row);

    card.appendChild(img);
    card.appendChild(pad);

    grid.appendChild(card);
  }

  el("meta").textContent = `${total} products • showing ${slice.length} on this page`;
  el("pageInfo").textContent = `Page ${page} of ${pages}`;
  el("prev").disabled = page <= 1;
  el("next").disabled = page >= pages;
}

async function init() {
  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load CSV");
  const csv = await res.text();

  const rows = csvToRows(csv);
  all = rows.map(normaliseProduct).filter(p => p.title && p.img); // require basics
  filtered = all;

  populateFilters(all);
  render();
}

el("q").addEventListener("input", applyFilters);
el("filterType").addEventListener("change", applyFilters);
el("filterVendor").addEventListener("change", applyFilters);

el("prev").addEventListener("click", () => { page--; render(); });
el("next").addEventListener("click", () => { page++; render(); });

init().catch(err => {
  el("meta").textContent = `Error: ${err.message}`;
});
