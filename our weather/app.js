/* Our Weather — client-side, no API key.
   Data source: Open-Meteo (forecast + geocoding). */

const $ = (id) => document.getElementById(id);

const els = {
  todayLabel: $("todayLabel"),
  refreshBtn: $("refreshBtn"),
  searchForm: $("searchForm"),
  cityInput: $("cityInput"),
  searchBtn: $("searchBtn"),
  geoBtn: $("geoBtn"),

  tempValue: $("tempValue"),
  placeValue: $("placeValue"),
  descValue: $("descValue"),
  hiValue: $("hiValue"),
  loValue: $("loValue"),
  windValue: $("windValue"),
  updatedValue: $("updatedValue"),

  statusPill: $("statusPill"),
  statusText: $("statusText"),
};

function formatLocalTodayLabel() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  els.todayLabel.textContent = fmt.format(now);
}

function setStatus(message, tone = "info") {
  if (!message) {
    els.statusPill.hidden = true;
    els.statusText.textContent = "";
    els.statusPill.dataset.tone = "";
    return;
  }

  els.statusPill.hidden = false;
  els.statusText.textContent = message;
  els.statusPill.dataset.tone = tone;
}

function setLoading(isLoading) {
  const toToggle = [
    els.tempValue,
    els.placeValue,
    els.descValue,
    els.hiValue,
    els.loValue,
    els.windValue,
    els.updatedValue,
  ];

  for (const el of toToggle) {
    el.classList.toggle("skeleton", isLoading);
  }

  els.refreshBtn.disabled = isLoading;
  els.searchBtn.disabled = isLoading;
  els.geoBtn.disabled = isLoading;
  els.cityInput.disabled = isLoading;
}

function clampText(s, max = 80) {
  const t = String(s ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function cToRounded(c) {
  if (c === null || c === undefined || Number.isNaN(Number(c))) return "—";
  return `${Math.round(Number(c))}°`;
}

function kmhToText(kmh) {
  if (kmh === null || kmh === undefined || Number.isNaN(Number(kmh))) return "—";
  return `${Math.round(Number(kmh))} km/h`;
}

function weatherCodeToText(code) {
  const c = Number(code);
  if (Number.isNaN(c)) return "—";

  // Open-Meteo weather codes: https://open-meteo.com/en/docs
  if (c === 0) return "Clear sky";
  if (c === 1) return "Mainly clear";
  if (c === 2) return "Partly cloudy";
  if (c === 3) return "Overcast";
  if (c === 45 || c === 48) return "Fog";
  if (c === 51 || c === 53 || c === 55) return "Drizzle";
  if (c === 56 || c === 57) return "Freezing drizzle";
  if (c === 61 || c === 63 || c === 65) return "Rain";
  if (c === 66 || c === 67) return "Freezing rain";
  if (c === 71 || c === 73 || c === 75) return "Snowfall";
  if (c === 77) return "Snow grains";
  if (c === 80 || c === 81 || c === 82) return "Rain showers";
  if (c === 85 || c === 86) return "Snow showers";
  if (c === 95) return "Thunderstorm";
  if (c === 96 || c === 99) return "Thunderstorm with hail";
  return "—";
}

function fmtUpdated(ts, timeZone) {
  try {
    const d = new Date(ts);
    const fmt = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    });
    return fmt.format(d);
  } catch {
    return "—";
  }
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}). ${text}`.trim());
  }
  return await res.json();
}

async function geocodeCity(cityQuery) {
  const q = clampText(cityQuery, 80);
  if (!q || q.length < 2) {
    throw new Error("Type at least 2 characters to search a city.");
  }

  const url =
    "https://geocoding-api.open-meteo.com/v1/search" +
    `?name=${encodeURIComponent(q)}` +
    "&count=1&language=en&format=json";

  const data = await fetchJson(url);
  const r = data?.results?.[0];
  if (!r) throw new Error("No matching city found. Try a different name.");

  const place = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
  return {
    latitude: r.latitude,
    longitude: r.longitude,
    place,
    timeZone: r.timezone,
  };
}

async function fetchTodayWeather({ latitude, longitude }) {
  // We'll use:
  // - current: temperature_2m, weather_code, wind_speed_10m
  // - daily: temperature_2m_max, temperature_2m_min
  // Timezone: auto ensures daily "today" matches locale of the coordinates.
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    "&current=temperature_2m,weather_code,wind_speed_10m" +
    "&daily=temperature_2m_max,temperature_2m_min" +
    "&timezone=auto";

  const data = await fetchJson(url);

  const current = data?.current ?? {};
  const daily = data?.daily ?? {};
  const tz = data?.timezone ?? "UTC";

  const todayHi = Array.isArray(daily.temperature_2m_max)
    ? daily.temperature_2m_max[0]
    : null;
  const todayLo = Array.isArray(daily.temperature_2m_min)
    ? daily.temperature_2m_min[0]
    : null;

  return {
    timeZone: tz,
    tempC: current.temperature_2m,
    weatherCode: current.weather_code,
    windKmh: current.wind_speed_10m,
    hiC: todayHi,
    loC: todayLo,
    updatedIso: current.time,
  };
}

function renderWeather({ place, timeZone, tempC, weatherCode, windKmh, hiC, loC, updatedIso }) {
  els.tempValue.textContent = cToRounded(tempC);
  els.placeValue.textContent = clampText(place || "Your location", 52);
  els.descValue.textContent = weatherCodeToText(weatherCode);

  els.hiValue.textContent = `High: ${cToRounded(hiC)}`;
  els.loValue.textContent = `Low: ${cToRounded(loC)}`;
  els.windValue.textContent = `Wind: ${kmhToText(windKmh)}`;
  els.updatedValue.textContent = `Updated: ${fmtUpdated(updatedIso, timeZone)}`;
}

function hardError(message) {
  setStatus(message, "error");
  // keep existing values, just stop skeleton if any
  setLoading(false);
}

async function loadByCoords({ latitude, longitude }, placeLabel = "Your location") {
  setLoading(true);
  setStatus("Loading today’s weather…");

  try {
    const w = await fetchTodayWeather({ latitude, longitude });
    renderWeather({ place: placeLabel, ...w });
    setStatus("");
  } catch (e) {
    hardError(clampText(e?.message || "Could not load weather right now.", 140));
  } finally {
    setLoading(false);
  }
}

async function loadByCity(city) {
  setLoading(true);
  setStatus("Searching city…");

  try {
    const loc = await geocodeCity(city);
    setStatus("Loading today’s weather…");
    const w = await fetchTodayWeather(loc);
    renderWeather({ place: loc.place, timeZone: loc.timeZone ?? w.timeZone, ...w });
    setStatus("");
  } catch (e) {
    hardError(clampText(e?.message || "Could not find that city.", 140));
  } finally {
    setLoading(false);
  }
}

function getBrowserCoords() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        if (err?.code === 1) {
          reject(new Error("Location permission was blocked. Search a city instead."));
          return;
        }
        reject(new Error("Could not get your location. Search a city instead."));
      },
      {
        enableHighAccuracy: false,
        timeout: 9000,
        maximumAge: 60_000,
      }
    );
  });
}

async function loadDefault() {
  // Progressive enhancement: try geolocation, but never block the app.
  setLoading(true);
  setStatus("Trying your location…");

  try {
    const coords = await getBrowserCoords();
    await loadByCoords(coords, "Your location");
  } catch {
    // fallback: show a useful default (New York)
    await loadByCoords({ latitude: 40.7128, longitude: -74.006 }, "New York, US");
    setStatus("Using a default location. Search a city or enable location.");
  } finally {
    setLoading(false);
  }
}

function wireEvents() {
  els.searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const city = els.cityInput.value;
    await loadByCity(city);
  });

  els.geoBtn.addEventListener("click", async () => {
    setLoading(true);
    setStatus("Requesting location…");
    try {
      const coords = await getBrowserCoords();
      await loadByCoords(coords, "Your location");
    } catch (e) {
      hardError(clampText(e?.message || "Location is unavailable.", 140));
    } finally {
      setLoading(false);
    }
  });

  els.refreshBtn.addEventListener("click", async () => {
    const city = els.cityInput.value?.trim();
    if (city) {
      await loadByCity(city);
      return;
    }
    await loadDefault();
  });
}

function main() {
  formatLocalTodayLabel();
  wireEvents();
  loadDefault();
}

main();
