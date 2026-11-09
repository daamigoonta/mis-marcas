import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const UA = "Mozilla/5.0 (compatible; MisMarcas/1.0)";
const MAX_POR_MARCA = 30;

async function get(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.text();
}

const ent = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const limpio = s => ent(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const cdata = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

function etiqueta(bloque, nombre) {
  const m = bloque.match(new RegExp(`<${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</${nombre}>`, "i"));
  return m ? m[1] : "";
}

export function parsear(xml, base) {
  const bloques = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].map(m => m[0]);
  return bloques.map(b => {
    const titulo = limpio(etiqueta(b, "title"));
    let enlace = limpio(etiqueta(b, "link"));
    if (!enlace) {
      const tags = [...b.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]);
      const t = tags.find(x => /rel=["']alternate["']/i.test(x)) || tags[0];
      const h = t && t.match(/href=["']([^"']+)["']/i);
      enlace = h ? ent(h[1]) : "";
    }
    try { enlace = new URL(enlace, base).href; } catch { enlace = ""; }
    const fechaTxt = limpio(etiqueta(b, "pubDate") || etiqueta(b, "published") || etiqueta(b, "updated") || etiqueta(b, "dc:date"));
    const f = new Date(fechaTxt);
    const bruto = cdata(etiqueta(b, "content:encoded") || etiqueta(b, "content") || etiqueta(b, "description") || etiqueta(b, "summary"));
    const resumen = limpio(bruto).slice(0, 180);
    let imagen = "";
    const cand = (b.match(/<(?:enclosure|media:content|media:thumbnail)\b[^>]*\burl=["']([^"']+)["']/i) || [])[1]
      || (ent(bruto).match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i) || [])[1] || "";
    try { if (cand) imagen = new URL(ent(cand), base).href; } catch {}
    return { titulo, enlace, fecha: isNaN(f) ? null : f.toISOString(), resumen, imagen };
  }).filter(a => a.titulo && a.enlace);
}

async function buscarFeed(web) {
  try {
    const html = await get(web);
    const t = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]).find(x => /alternate/i.test(x) && /(rss|atom)\+xml/i.test(x));
    const h = t && t.match(/href=["']([^"']+)["']/i);
    if (h) return new URL(ent(h[1]), web).href;
  } catch {}
  for (const p of ["/blogs/news.atom", "/feed", "/feed.xml", "/blog/feed", "/rss.xml", "/news/feed"]) {
    try {
      const url = new URL(p, web).href;
      if (/<(rss|feed)[\s>]/i.test(await get(url))) return url;
    } catch {}
  }
  return null;
}


const slug = n => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const MAX_PRODUCTOS = 60;

export async function instagram(usuario, idCuenta, token) {
  const campos = "name,website,profile_picture_url,media.limit(12){caption,media_type,media_url,thumbnail_url,permalink,timestamp}";
  const q = encodeURIComponent(`business_discovery.username(${usuario}){${campos}}`);
  const r = await fetch(`https://graph.facebook.com/v25.0/${idCuenta}?fields=${q}&access_token=${token}`, { signal: AbortSignal.timeout(20000) });
  const j = await r.json();
  if (j.error) throw new Error("Instagram: " + j.error.message);
  const bd = j.business_discovery || {};
  const publicaciones = (((bd.media || {}).data) || []).map(p => ({
    imagen: (p.media_type === "VIDEO" ? p.thumbnail_url || p.media_url : p.media_url || p.thumbnail_url) || "",
    texto: (p.caption || "").replace(/\s+/g, " ").trim().slice(0, 160),
    enlace: p.permalink,
    fecha: p.timestamp ? new Date(p.timestamp).toISOString() : null,
    tipo: p.media_type
  })).filter(p => p.enlace);
  return { publicaciones, nombre: bd.name || "", web: bd.website || "", logo: bd.profile_picture_url || "" };
}

export async function productos(web) {
  const origin = new URL(web).origin;
  try {
    const j = JSON.parse(await get(origin + "/products.json?limit=250"));
    if (Array.isArray(j.products) && j.products.length) {
      return j.products.map(p => ({
        titulo: p.title, enlace: `${origin}/products/${p.handle}`,
        imagen: (p.images && p.images[0] && p.images[0].src) || "",
        precio: (p.variants && p.variants[0] && p.variants[0].price) || "",
        fecha: p.published_at || p.created_at || null
      }));
    }
  } catch {}
  try {
    const raiz = origin + "/sitemap.xml";
    const idx = await get(raiz);
    const urls = /<sitemapindex/i.test(idx)
      ? [...idx.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => ent(m[1])).filter(u => /product/i.test(u)).slice(0, 3)
      : [raiz];
    const out = [];
    for (const u of urls) {
      const x = u === raiz ? idx : await get(u);
      for (const b of x.matchAll(/<url>[\s\S]*?<\/url>/gi)) {
        const t = b[0];
        const loc = (t.match(/<loc>\s*([^<\s]+)\s*<\/loc>/i) || [])[1];
        const img = (t.match(/<image:loc>\s*([^<\s]+)\s*<\/image:loc>/i) || [])[1];
        if (!loc || !img) continue;
        const tit = limpio((t.match(/<image:title>([\s\S]*?)<\/image:title>/i) || [])[1] || "");
        const lm = (t.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i) || [])[1];
        const f = lm ? new Date(lm) : null;
        out.push({
          titulo: tit || decodeURIComponent(ent(loc).split("/").filter(Boolean).pop()).replace(/[-_]+/g, " "),
          enlace: ent(loc), imagen: ent(img), precio: "", fecha: f && !isNaN(f) ? f.toISOString() : null
        });
      }
    }
    return out;
  } catch {}
  return [];
}

export async function inspeccionar(web) {
  try {
    const r = await fetch(web, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    const xfo = (r.headers.get("x-frame-options") || "").toLowerCase();
    const csp = (r.headers.get("content-security-policy") || "").toLowerCase();
    const fa = (csp.match(/frame-ancestors([^;]*)/) || [])[1] || "";
    let incrustable = /^https:/i.test(r.url || web);
    if (/deny|sameorigin/.test(xfo)) incrustable = false;
    if (fa && !/\*|https:(?!\/)/.test(fa)) incrustable = false;
    let logo = "";
    try {
      const html = await r.text();
      const tags = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]);
      const t = tags.find(x => /rel=["'][^"']*apple-touch-icon/i.test(x)) || tags.find(x => /rel=["'][^"']*\bicon\b/i.test(x));
      const h = t && t.match(/href=["']([^"']+)["']/i);
      if (h) logo = new URL(ent(h[1]), r.url || web).href;
    } catch {}
    return { incrustable, logo };
  } catch { return { incrustable: null, logo: "" }; }
}

async function main() {
  const marcas = JSON.parse(await fs.readFile("marcas.json", "utf8"));
  let previo = { marcas: [] };
  try { previo = JSON.parse(await fs.readFile("data/articulos.json", "utf8")); } catch {}
  const { IG_USER_ID, IG_TOKEN } = process.env;
  const ahora = new Date().toISOString();
  const https = u => (/^https?:\/\//i.test(u) ? u : "https://" + u);
  const salida = [];
  for (const m of marcas) {
    const usuario = (m.instagram || "").replace(/^@/, "");
    const clave = m.slug || slug(usuario || m.nombre || "");
    if (!clave) continue;
    const ant = previo.marcas.find(x => x.slug === clave) || {};
    const r = {
      nombre: m.nombre || ant.nombre || usuario, slug: clave, web: m.web || ant.web || "", instagramUsuario: usuario,
      publicaciones: ant.publicaciones || [], productos: ant.productos || [], articulos: ant.articulos || [], avisos: []
    };
    // Instagram: publicaciones y, si faltan, nombre, web y logo de la cuenta
    let logoIG = "";
    if (usuario && IG_USER_ID && IG_TOKEN) {
      try {
        const p = await instagram(usuario, IG_USER_ID, IG_TOKEN);
        r.publicaciones = p.publicaciones;
        logoIG = p.logo;
        if (!m.nombre && p.nombre) r.nombre = p.nombre;
        if (!m.web && p.web) r.web = https(p.web.trim());
      } catch (e) { r.avisos.push(e.message.split(IG_TOKEN).join("***")); }
    }
    // Logo y si la web se puede mostrar dentro de la app
    const info = r.web ? await inspeccionar(r.web) : { incrustable: null, logo: "" };
    r.logo = m.logo || logoIG || info.logo || ant.logo || "";
    r.incrustable = typeof m.incrustar === "boolean" ? m.incrustar : (info.incrustable ?? ant.incrustable ?? false);
    // Artículos de la tienda
    if (r.web) {
      const viejos = new Map((ant.productos || []).map(p => [p.enlace, p.primeraVez]));
      const nuevos = await productos(r.web).catch(() => []);
      if (nuevos.length) {
        nuevos.forEach(p => { p.primeraVez = viejos.get(p.enlace) || ahora; });
        nuevos.sort((a, b) => (b.fecha || b.primeraVez).localeCompare(a.fecha || a.primeraVez));
        r.productos = nuevos.slice(0, MAX_PRODUCTOS);
      } else r.avisos.push("No se pudieron leer los artículos de la tienda.");
    }
    // Blog / novedades
    try {
      const feed = m.feed || (r.web && await buscarFeed(r.web));
      if (feed) {
        const nuevos = parsear(await get(feed), feed);
        const vistos = new Set(nuevos.map(a => a.enlace));
        const todos = [...nuevos, ...r.articulos.filter(a => !vistos.has(a.enlace))];
        todos.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
        r.articulos = todos.slice(0, MAX_POR_MARCA);
      }
    } catch (e) { console.error(r.nombre + " (blog): " + e.message); }
    if (r.avisos.length) console.error(r.nombre + ": " + r.avisos.join(" | "));
    salida.push(r);
  }
  await fs.writeFile("data/articulos.json", JSON.stringify({ actualizado: ahora, instagramActivo: !!(IG_USER_ID && IG_TOKEN), marcas: salida }, null, 1));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
