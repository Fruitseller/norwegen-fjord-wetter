/**
 * Norwegens Fjorde – Wetter zur Reise.
 *
 * Lädt bei jedem Seitenaufruf die aktuelle Vorhersage von Open-Meteo
 * (kostenlos, ohne API-Key) und stellt sie zusammen mit einer Leaflet-Karte
 * für jeden Hafen der Reise dar.
 */

/* ----------------------------------------------------------------------
 * WMO-Wettercodes -> Symbol, Beschreibung, Farbkategorie
 * https://open-meteo.com/en/docs (WMO Weather interpretation codes)
 * -------------------------------------------------------------------- */
const WMO = {
  0: { icon: "☀️", label: "Klar", cat: "sun" },
  1: { icon: "🌤️", label: "Überwiegend klar", cat: "sun" },
  2: { icon: "⛅", label: "Teilweise bewölkt", cat: "partly" },
  3: { icon: "☁️", label: "Bedeckt", cat: "cloud" },
  45: { icon: "🌫️", label: "Nebel", cat: "fog" },
  48: { icon: "🌫️", label: "Reifnebel", cat: "fog" },
  51: { icon: "🌦️", label: "Leichter Nieselregen", cat: "rain" },
  53: { icon: "🌦️", label: "Nieselregen", cat: "rain" },
  55: { icon: "🌦️", label: "Starker Nieselregen", cat: "rain" },
  56: { icon: "🌧️", label: "Gefrierender Nieselregen", cat: "rain" },
  57: { icon: "🌧️", label: "Gefrierender Nieselregen", cat: "rain" },
  61: { icon: "🌧️", label: "Leichter Regen", cat: "rain" },
  63: { icon: "🌧️", label: "Regen", cat: "rain" },
  65: { icon: "🌧️", label: "Starker Regen", cat: "rain" },
  66: { icon: "🌧️", label: "Gefrierender Regen", cat: "rain" },
  67: { icon: "🌧️", label: "Gefrierender Regen", cat: "rain" },
  71: { icon: "🌨️", label: "Leichter Schneefall", cat: "snow" },
  73: { icon: "🌨️", label: "Schneefall", cat: "snow" },
  75: { icon: "🌨️", label: "Starker Schneefall", cat: "snow" },
  77: { icon: "🌨️", label: "Schneegriesel", cat: "snow" },
  80: { icon: "🌦️", label: "Leichte Regenschauer", cat: "rain" },
  81: { icon: "🌦️", label: "Regenschauer", cat: "rain" },
  82: { icon: "⛈️", label: "Heftige Regenschauer", cat: "rain" },
  85: { icon: "🌨️", label: "Schneeschauer", cat: "snow" },
  86: { icon: "🌨️", label: "Starke Schneeschauer", cat: "snow" },
  95: { icon: "⛈️", label: "Gewitter", cat: "storm" },
  96: { icon: "⛈️", label: "Gewitter mit Hagel", cat: "storm" },
  99: { icon: "⛈️", label: "Schweres Gewitter mit Hagel", cat: "storm" },
};

const CAT_COLOR = {
  sun: "var(--w-sun)",
  partly: "var(--w-partly)",
  cloud: "var(--w-cloud)",
  rain: "var(--w-rain)",
  storm: "var(--w-storm)",
  snow: "var(--w-snow)",
  fog: "var(--w-fog)",
};

function wmo(code) {
  return WMO[code] || { icon: "❓", label: "Unbekannt", cat: "cloud" };
}

/* ----------------------------------------------------------------------
 * Hilfsfunktionen
 * -------------------------------------------------------------------- */
const dateFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "long",
});

function formatDate(iso) {
  // "2026-06-21" -> "So., 21. Juni"
  return dateFmt.format(new Date(iso + "T12:00:00"));
}

function round(n) {
  return n == null ? null : Math.round(n);
}

/* ----------------------------------------------------------------------
 * Wetterabruf (eine einzige Multi-Standort-Anfrage für alle Häfen)
 * -------------------------------------------------------------------- */
async function fetchWeather() {
  const lats = TRIP.days.map((d) => d.lat).join(",");
  const lons = TRIP.days.map((d) => d.lon).join(",");
  const start = TRIP.days[0].date;
  const end = TRIP.days[TRIP.days.length - 1].date;

  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lats}&longitude=${lons}` +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min," +
    "precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset" +
    "&hourly=temperature_2m,weather_code,precipitation_probability" +
    "&wind_speed_unit=kmh&timezone=auto" +
    `&start_date=${start}&end_date=${end}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Open-Meteo antwortete mit Status " + res.status);
  let data = await res.json();
  // Bei mehreren Koordinaten liefert Open-Meteo ein Array – ansonsten ein Objekt.
  if (!Array.isArray(data)) data = [data];

  const byDay = {};
  TRIP.days.forEach((day, i) => {
    byDay[day.day] = extractDay(day, data[i]);
  });
  return byDay;
}

function extractDay(day, result) {
  if (!result || !result.daily) return { ok: false };
  const daily = result.daily;
  const di = daily.time.indexOf(day.date);
  if (di < 0 || daily.temperature_2m_max[di] == null) return { ok: false };

  const out = {
    ok: true,
    code: daily.weather_code[di],
    tmax: round(daily.temperature_2m_max[di]),
    tmin: round(daily.temperature_2m_min[di]),
    precipProb: daily.precipitation_probability_max?.[di] ?? null,
    precipSum: daily.precipitation_sum?.[di] ?? null,
    wind: round(daily.wind_speed_10m_max?.[di]),
    sunrise: daily.sunrise?.[di] ?? null,
    sunset: daily.sunset?.[di] ?? null,
    hours: [],
  };

  // Stundenwerte für das Zeitfenster im Hafen (Ankunft -> Abfahrt)
  if (result.hourly && day.arrival && day.departure) {
    const fromH = parseInt(day.arrival.slice(0, 2), 10);
    const toH = parseInt(day.departure.slice(0, 2), 10);
    result.hourly.time.forEach((t, idx) => {
      if (!t.startsWith(day.date)) return;
      const h = parseInt(t.slice(11, 13), 10);
      if (h < fromH || h > toH) return;
      out.hours.push({
        hour: h,
        temp: round(result.hourly.temperature_2m[idx]),
        code: result.hourly.weather_code[idx],
        precipProb: result.hourly.precipitation_probability?.[idx] ?? null,
      });
    });
  }
  return out;
}

/* ----------------------------------------------------------------------
 * Karte
 * -------------------------------------------------------------------- */
let map;
let routeBounds;
const markers = {};

function initMap() {
  map = L.map("map", { scrollWheelZoom: false });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende',
  }).addTo(map);

  // Routenlinie in Reihenfolge der Tage
  const route = TRIP.days.map((d) => [d.lat, d.lon]);
  L.polyline(route, {
    color: "#1d6fa5",
    weight: 3,
    opacity: 0.7,
    dashArray: "6 8",
  }).addTo(map);

  routeBounds = L.latLngBounds(route);
  fitRoute();

  // Nach dem Layout neu einpassen, damit der Zoom genau auf die Route sitzt.
  setTimeout(() => {
    map.invalidateSize();
    fitRoute();
  }, 250);
  window.addEventListener("resize", () => {
    map.invalidateSize();
    fitRoute();
  });
}

// Zoomt die Karte exakt auf die Route (knappe Pixel-Ränder statt großzügigem Puffer).
function fitRoute() {
  if (map && routeBounds) {
    map.fitBounds(routeBounds, { padding: [34, 34], maxZoom: 9 });
  }
}

function renderMarkers(byDay) {
  TRIP.days.forEach((day) => {
    const w = byDay[day.day];
    const cond = w && w.ok ? wmo(w.code) : null;
    const temp = w && w.ok ? `${w.tmax}°` : "";
    const icon = cond ? cond.icon : day.type === "sea" ? "⚓" : "📍";
    const bubbleClass = day.type === "sea" ? "pin__bubble pin__bubble--sea" : "pin__bubble";

    const html =
      `<div class="pin"><div class="${bubbleClass}">` +
      `<span>${icon}</span>${temp ? `<span>${temp}</span>` : ""}` +
      `</div><div class="pin__stem"></div></div>`;

    const marker = L.marker([day.lat, day.lon], {
      icon: L.divIcon({
        className: "port-pin",
        html,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
    }).addTo(map);

    marker.bindPopup(popupHtml(day, w));
    markers[day.day] = marker;
  });
}

function popupHtml(day, w) {
  const title = day.type === "sea" ? `Seetag (Tag ${day.day})` : day.name;
  let html = `<div class="popup__name">${title}</div>`;
  html += `<div class="popup__row">${formatDate(day.date)}</div>`;
  if (day.type === "port") {
    html += `<div class="popup__row">An ${day.arrival} – Ab ${day.departure} Uhr</div>`;
  } else {
    html += `<div class="popup__row">ungefähre Position auf See</div>`;
  }
  if (w && w.ok) {
    const c = wmo(w.code);
    html += `<div class="popup__big">${c.icon} ${w.tmax}° <small style="font-weight:500;color:#9fc0d4">/ ${w.tmin}°</small></div>`;
    html += `<div class="popup__row">${c.label}`;
    if (w.precipProb != null) html += ` · 🌧️ ${w.precipProb}%`;
    html += `</div>`;
  } else {
    html += `<div class="popup__row">Keine Vorhersage verfügbar</div>`;
  }
  return html;
}

/* ----------------------------------------------------------------------
 * Wochenüberblick (Streifen)
 * -------------------------------------------------------------------- */
function renderStrip(byDay) {
  const el = document.getElementById("weather-strip");
  el.innerHTML = "";
  TRIP.days.forEach((day) => {
    const w = byDay[day.day];
    const cond = w && w.ok ? wmo(w.code) : null;
    const btn = document.createElement("button");
    btn.className = "wcard";
    btn.style.setProperty("--accent", cond ? CAT_COLOR[cond.cat] : "var(--w-cloud)");
    btn.innerHTML =
      `<div class="wcard__day">Tag ${day.day} · ${day.weekday}</div>` +
      `<div class="wcard__name">${day.type === "sea" ? "⚓ Seetag" : day.name}</div>` +
      `<div class="wcard__icon">${cond ? cond.icon : "…"}</div>` +
      `<div class="wcard__temp">${
        w && w.ok ? `${w.tmax}°<small> / ${w.tmin}°</small>` : "–"
      }</div>` +
      `<div class="wcard__rain">${
        w && w.ok && w.precipProb != null ? `🌧️ ${w.precipProb}%` : ""
      }</div>`;
    btn.addEventListener("click", () => {
      const card = document.getElementById("day-" + day.day);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      if (markers[day.day]) markers[day.day].openPopup();
    });
    el.appendChild(btn);
  });
  refreshScrollShadows();
}

/* ----------------------------------------------------------------------
 * Tag-für-Tag-Karten
 * -------------------------------------------------------------------- */
function renderDays(byDay) {
  const grid = document.getElementById("day-grid");
  grid.innerHTML = "";
  TRIP.days.forEach((day) => {
    const w = byDay[day.day];
    const cond = w && w.ok ? wmo(w.code) : null;
    const accent = cond ? CAT_COLOR[cond.cat] : "var(--w-cloud)";

    const card = document.createElement("article");
    card.className = "day" + (day.type === "sea" ? " day--sea" : "");
    card.id = "day-" + day.day;
    card.style.setProperty("--accent", accent);

    card.innerHTML =
      headHtml(day, w, cond) +
      timesHtml(day) +
      metricsHtml(w) +
      hoursHtml(w) +
      excursionHtml(day) +
      aboutHtml(day);

    grid.appendChild(card);
  });
  refreshScrollShadows();
}

function headHtml(day, w, cond) {
  const icon = cond ? cond.icon : day.type === "sea" ? "⚓" : "📍";
  const name =
    day.type === "sea" ? "Seetag" : `${day.name} ${day.flag || ""}`;
  const condLabel = cond
    ? cond.label
    : w && !w.ok
    ? "Keine Vorhersage verfügbar"
    : "lädt …";
  const temps =
    w && w.ok
      ? `<div class="day__temp-max">${w.tmax}°</div><div class="day__temp-min">min ${w.tmin}°</div>`
      : "";
  return (
    `<div class="day__head">` +
    `<div class="day__icon">${icon}</div>` +
    `<div class="day__heading">` +
    `<div class="day__date">Tag ${day.day} · ${formatDate(day.date)}</div>` +
    `<div class="day__name">${name}</div>` +
    `<div class="day__cond">${condLabel}</div>` +
    `</div>` +
    `<div class="day__temps">${temps}</div>` +
    `</div>`
  );
}

function timesHtml(day) {
  if (day.type === "sea") return "";
  const cell = (label, value) =>
    `<div class="day__time"><div class="day__time-label">${label}</div>` +
    `<div class="day__time-value">${value || "–"}</div></div>`;
  return (
    `<div class="day__times">` +
    cell("Ankunft", day.arrival) +
    cell("Alle an Bord", day.aboard) +
    cell("Abfahrt", day.departure) +
    `</div>`
  );
}

function metricsHtml(w) {
  if (!w || !w.ok) return "";
  const m = (label, value) =>
    `<div class="metric"><span class="metric__label">${label}</span>` +
    `<span class="metric__value">${value}</span></div>`;
  return (
    `<div class="day__metrics">` +
    m("Regen", w.precipProb != null ? `${w.precipProb} %` : "–") +
    m("Wind", w.wind != null ? `${w.wind} km/h` : "–") +
    m("Niederschlag", w.precipSum != null ? `${w.precipSum} mm` : "–") +
    `</div>`
  );
}

function hoursHtml(w) {
  if (!w || !w.ok || !w.hours || !w.hours.length) return "";
  let html =
    `<p class="hours__title">Während des Aufenthalts</p>` +
    `<div class="scroll-wrap"><div class="hours scroller">`;
  w.hours.forEach((h) => {
    const c = wmo(h.code);
    html +=
      `<div class="hour"><div>${String(h.hour).padStart(2, "0")}</div>` +
      `<div class="hour__icon">${c.icon}</div>` +
      `<div class="hour__temp">${h.temp}°</div>` +
      `<div>${h.precipProb != null ? h.precipProb + "%" : ""}</div></div>`;
  });
  html += `</div></div>`;
  return html;
}

// Gebuchter Ausflug für den Tag (sofern in den Reisedaten hinterlegt).
function excursionHtml(day) {
  const ex = day.excursion;
  if (!ex) return "";
  const code = ex.code ? `<span class="excursion__code">${ex.code}</span>` : "";
  const time = ex.time ? `<div class="excursion__meta">🕐 ${ex.time} Uhr</div>` : "";
  const people =
    ex.participants && ex.participants.length
      ? `<div class="excursion__meta">👤 ${ex.participants.join(", ")}</div>`
      : "";
  return (
    `<div class="excursion">` +
    `<div class="excursion__badge">Gebuchter Ausflug</div>` +
    `<div class="excursion__title">${ex.title}${code}</div>` +
    time +
    people +
    `</div>`
  );
}

function aboutHtml(day) {
  let html = day.about ? `<p class="day__about">${day.about}</p>` : "";
  if (day.type === "port") {
    html +=
      `<ul class="day__info">` +
      `<li>${day.flag || ""} ${day.country}</li>` +
      `<li>🗣️ ${day.language}</li>` +
      `<li>💶 ${day.currency}</li>` +
      `<li>🕐 ${day.tz}</li>` +
      `</ul>`;
  }
  return html;
}

/* ----------------------------------------------------------------------
 * Scroll-Schatten: zeigt an jedem horizontal scrollbaren Bereich an,
 * dass es links/rechts weitergeht.
 * -------------------------------------------------------------------- */
function updateShadow(wrap, sc) {
  const max = sc.scrollWidth - sc.clientWidth;
  wrap.classList.toggle("shadow-left", sc.scrollLeft > 2);
  wrap.classList.toggle("shadow-right", sc.scrollLeft < max - 2);
}

function refreshScrollShadows() {
  document.querySelectorAll(".scroll-wrap").forEach((wrap) => {
    const sc = wrap.querySelector(".scroller");
    if (!sc) return;
    if (!wrap.dataset.shadowBound) {
      sc.addEventListener("scroll", () => updateShadow(wrap, sc), { passive: true });
      wrap.dataset.shadowBound = "1";
    }
    updateShadow(wrap, sc);
  });
}

window.addEventListener("resize", refreshScrollShadows);

/* ----------------------------------------------------------------------
 * Schiffsbild-Fallback: wenn das Foto nicht lädt, eine SVG-Illustration
 * eines Kreuzfahrtschiffs einsetzen, damit die Seite immer hübsch bleibt.
 * -------------------------------------------------------------------- */
function shipImageFallback(img) {
  img.onerror = null; // Endlosschleife vermeiden
  img.src =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 320">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#6fb7df"/><stop offset="1" stop-color="#cfeaf7"/>
          </linearGradient>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#1d6fa5"/><stop offset="1" stop-color="#0b3d5c"/>
          </linearGradient>
        </defs>
        <rect width="1280" height="320" fill="url(#sky)"/>
        <rect y="210" width="1280" height="110" fill="url(#sea)"/>
        <g transform="translate(340,86)">
          <rect x="0" y="70" width="600" height="60" rx="10" fill="#0b3d5c"/>
          <path d="M0 130 L600 130 L560 168 L40 168 Z" fill="#0b3d5c"/>
          <rect x="40" y="34" width="470" height="40" rx="8" fill="#fff"/>
          <rect x="90" y="2" width="330" height="36" rx="8" fill="#fff"/>
          <g fill="#6fb7df">
            <rect x="60" y="46" width="18" height="18" rx="3"/><rect x="92" y="46" width="18" height="18" rx="3"/>
            <rect x="124" y="46" width="18" height="18" rx="3"/><rect x="156" y="46" width="18" height="18" rx="3"/>
            <rect x="188" y="46" width="18" height="18" rx="3"/><rect x="220" y="46" width="18" height="18" rx="3"/>
            <rect x="252" y="46" width="18" height="18" rx="3"/><rect x="284" y="46" width="18" height="18" rx="3"/>
            <rect x="316" y="46" width="18" height="18" rx="3"/><rect x="348" y="46" width="18" height="18" rx="3"/>
            <rect x="380" y="46" width="18" height="18" rx="3"/><rect x="412" y="46" width="18" height="18" rx="3"/>
            <rect x="444" y="46" width="18" height="18" rx="3"/><rect x="476" y="46" width="18" height="18" rx="3"/>
          </g>
          <rect x="360" y="-44" width="70" height="52" rx="8" fill="#1d6fa5"/>
          <rect x="0" y="86" width="600" height="14" fill="#1d6fa5"/>
        </g>
        <text x="640" y="300" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="20" opacity="0.9">Mein Schiff 3 (Illustration)</text>
      </svg>`
    );
  const cap = document.getElementById("ship-cap");
  if (cap) cap.innerHTML = "<strong>Mein Schiff 3</strong> · Illustration (Foto nicht verfügbar)";
}

/* ----------------------------------------------------------------------
 * Skeleton (vor dem Laden) + Start
 * -------------------------------------------------------------------- */
function renderSkeleton() {
  document.getElementById("hero-subtitle").textContent = TRIP.subtitle;
  const empty = {};
  TRIP.days.forEach((d) => (empty[d.day] = null)); // null => "lädt …"
  renderStrip(empty);
  renderDays(empty);
}

async function start() {
  renderSkeleton();
  initMap();

  const updated = document.getElementById("last-updated");
  try {
    const byDay = await fetchWeather();
    renderStrip(byDay);
    renderDays(byDay);
    renderMarkers(byDay);
    const now = new Date().toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    updated.textContent = `Wetter aktualisiert: ${now} Uhr · Quelle: Open-Meteo`;
  } catch (err) {
    console.error(err);
    renderMarkers({}); // Marker ohne Wetter, damit die Karte nutzbar bleibt
    updated.textContent =
      "⚠️ Wetterdaten konnten nicht geladen werden. Bitte später erneut versuchen.";
  }
}

document.addEventListener("DOMContentLoaded", start);
