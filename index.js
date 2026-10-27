/**
 * TMDB Full Catalog Addon
 * ───────────────────────
 * Base de datos: The Movie Database (TMDB) completo.
 * - Home con filas mixtas (backdrop horizontal + posters)
 * - Catálogos por género (movie / TV)
 * - Discover: tipo · género · orden
 * - Meta completa: logo, temporadas, episodios, IMDb
 * - Intro/Outro vía IntroDB (imdb_id → player.segments)
 * - Streams: extractores latinos (HomeCine, SeriesMetro, CineCalidad,
 *   TioPlus, VerPelis, Embed69, Vimeus, LaMovie, EliFilms, FuegoCine,
 *   PelisGo, PelisPanda, Cine24h, Cinemitas, PelisPlus, HackStore, …)
 * - Catálogos de colecciones / franquicias con portada de la colección
 *
 * Configuración (userConfig / __nuvioConfig):
 *   tmdb_api_key          — clave propia (vacío = default del addon)
 *   tmdb_lang             — es-MX | es-ES | en-US
 *   image_quality         — w185 | w342 | w500 | w780 | original
 *   backdrop_quality      — w780 | w1280 | original
 *   include_theater       — true/false (en cines)
 *   only_digital          — true/false (solo con fecha digital/release)
 *   hide_unreleased_eps   — true/false (ocultar capítulos futuros)
 *   enabled_sources       — lista separada por comas (todos los extractores)
 *   max_concurrent_sources— número (default 4)
 *   region                — código región TMDB (ES, MX, US…)
 */
'use strict';

const ADDON_ID = 'tmdb-full-catalog';
const DEFAULTS = {
  tmdb_api_key: 'a2d9bbed370d9f678e34006f8750a5a5',
  tmdb_lang: 'es-ES',
  image_quality: 'w500',
  backdrop_quality: 'w1280',
  include_theater: 'false',
  only_digital: 'true',
  hide_unreleased_eps: 'true',
  exclude_in_theater: 'true',
  // Todos los servidores activos a la vez (el usuario puede recortar la lista)
  enabled_sources:
    'embed69,homecine,seriesmetro,cinecalidad,verpelis,vimeus,lamovie,elifilms,tioplus,' +
    'cine24h,cinemitas,hackstore,areshd,sololatino,pelisgratishd,peliculasflix,' +
    'entrepeliculasyseries,pelisgo,fuegocine',
  max_concurrent_sources: '4',
  region: 'ES',
};

/** Franquicias / colecciones TMDB (id + nombre). La portada se obtiene de /collection/{id}. */
const FRANCHISE_COLLECTIONS = [
  { id: 10, name: 'Star Wars' },
  { id: 119, name: 'El Señor de los Anillos' },
  { id: 1241, name: 'Harry Potter' },
  { id: 295, name: 'Piratas del Caribe' },
  { id: 328, name: 'Jurassic Park' },
  { id: 263, name: 'The Dark Knight (Batman Nolan)' },
  { id: 131296, name: 'Avengers (MCU)' },
  { id: 230, name: 'The Marvels / MCU highlights' },
  { id: 645, name: 'James Bond' },
  { id: 84, name: 'Indiana Jones' },
  { id: 1570, name: 'Fast & Furious' },
  { id: 9485, name: 'The Fast and the Furious' },
  { id: 87359, name: 'Mission: Impossible' },
  { id: 528, name: 'The Terminator' },
  { id: 8091, name: 'Alien' },
  { id: 529, name: 'Predator' },
  { id: 5039, name: 'X-Men' },
  { id: 556, name: 'Spider-Man' },
  { id: 531, name: 'Transformers' },
  { id: 86058, name: 'Ghostbusters' },
  { id: 8650, name: 'Transformers (legacy)' },
  { id: 13588, name: 'Rocky' },
  { id: 173710, name: 'Planet of the Apes' },
  { id: 121938, name: 'Creed / Rocky' },
  { id: 10195, name: 'Toy Story' },
  { id: 86311, name: 'The Hunger Games' },
  { id: 131292, name: 'Dune' },
  { id: 2344, name: 'The Matrix' },
  { id: 8354, name: 'Avatar' },
  { id: 468552, name: 'Wonder Woman' },
  { id: 119674, name: 'John Wick' },
  { id: 656, name: 'Saw' },
  { id: 72750, name: 'Conjuring' },
  { id: 115782, name: 'Despicable Me / Minions' },
  { id: 137697, name: 'Finding Nemo / Dory' },
  { id: 10194, name: 'Toy Story (Pixar)' },
  { id: 8917, name: 'Shrek' },
  { id: 77816, name: 'How to Train Your Dragon' },
  { id: 2150, name: 'Back to the Future' },
  { id: 120794, name: 'Jurassic World' },
  { id: 86066, name: 'Kingsman' },
  { id: 97456, name: 'Fifty Shades' },
  { id: 4488, name: 'Friday the 13th' },
  { id: 9735, name: 'Halloween' },
  { id: 8580, name: 'Scream' },
  { id: 10455, name: 'Die Hard' },
  { id: 508, name: 'Ice Age' },
  { id: 101438, name: 'Kung Fu Panda' },
  { id: 86029, name: 'Despicable Me' },
  { id: 121938, name: 'Creed' },
];

const IMG = 'https://image.tmdb.org/t/p/';
const TMDB = 'https://api.themoviedb.org/3';
const INTRODB = 'https://api.introdb.app/segments';

// ─── Config ───────────────────────────────────────────────────────────────
function cfg() {
  let supplied = {};
  try {
    const all = globalThis.__nuvioConfig || {};
    supplied = all[ADDON_ID] || all.current || all.tmdb || {};
  } catch (_) {}
  try {
    if (typeof userConfig !== 'undefined' && userConfig) {
      supplied = Object.assign({}, supplied, userConfig);
    }
  } catch (_) {}
  return Object.assign({}, DEFAULTS, supplied);
}

function getConfig(key, def) {
  const c = cfg();
  if (c[key] != null && c[key] !== '') return c[key];
  return def != null ? def : DEFAULTS[key];
}

function apiKey() {
  const k = String(getConfig('tmdb_api_key', DEFAULTS.tmdb_api_key) || '').trim();
  return k || DEFAULTS.tmdb_api_key;
}

function lang() {
  const l = String(getConfig('tmdb_lang', 'es-ES') || 'es-ES').replace('_', '-');
  if (/^es[-_]?mx$/i.test(l)) return 'es-MX';
  if (/^es[-_]?es$/i.test(l) || /^es$/i.test(l)) return 'es-ES';
  if (/^en/i.test(l)) return 'en-US';
  return l;
}

function posterSize() {
  const q = String(getConfig('image_quality', 'w500'));
  if (['w185', 'w342', 'w500', 'w780', 'original'].includes(q)) return q;
  return 'w500';
}

function backdropSize() {
  const q = String(getConfig('backdrop_quality', 'w1280'));
  if (['w780', 'w1280', 'original'].includes(q)) return q;
  return 'w1280';
}

function region() {
  return String(getConfig('region', 'ES') || 'ES').toUpperCase();
}

function truthy(v) {
  return /^(1|true|yes|on|si|sí)$/i.test(String(v == null ? '' : v).trim());
}

function includeTheater() {
  return truthy(getConfig('include_theater', 'true'));
}

function onlyDigital() {
  return truthy(getConfig('only_digital', 'true'));
}
function excludeInTheater() {
  // Preferencia general: no mostrar lo que sigue solo en cines
  if (truthy(getConfig('exclude_in_theater', 'true'))) return true;
  // Compat: only_digital / include_theater invertido
  if (truthy(getConfig('only_digital', 'true'))) return true;
  if (!truthy(getConfig('include_theater', 'false'))) return true;
  return false;
}

function digitalReleaseParams(params, isTv) {
  params = params || {};
  if (!excludeInTheater()) return params;
  const today = new Date().toISOString().slice(0, 10);
  if (isTv) {
    params['first_air_date.lte'] = today;
  } else {
    // Tipos digitales/físicos/TV (no solo estreno en sala)
    params.with_release_type = '4|5|6';
    params['primary_release_date.lte'] = today;
  }
  return params;
}


function hideUnreleasedEps() {
  return truthy(getConfig('hide_unreleased_eps', 'true'));
}

function enabledSources() {
  return String(getConfig('enabled_sources', DEFAULTS.enabled_sources))
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function maxConcurrent() {
  const n = parseInt(getConfig('max_concurrent_sources', '4'), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 4;
}

// ─── HTTP / cache ─────────────────────────────────────────────────────────
const responseCache = new Map();
const inFlight = new Map();
const MAX_CACHE = 200;

function limitMap(map, max) {
  while (map.size > max) {
    const first = map.keys().next().value;
    map.delete(first);
  }
}

async function cached(key, ttl, work) {
  const now = Date.now();
  const hit = responseCache.get(key);
  if (hit && hit.expires > now) return hit.value;
  if (hit) responseCache.delete(key);
  if (inFlight.has(key)) return inFlight.get(key);

  const task = Promise.resolve()
    .then(work)
    .then((value) => {
      if (ttl > 0) {
        responseCache.set(key, { value, expires: Date.now() + ttl });
        limitMap(responseCache, MAX_CACHE);
      }
      return value;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, task);
  return task;
}

async function tmdbFetch(path, params) {
  const q = Object.assign(
    { api_key: apiKey(), language: lang() },
    params || {}
  );
  const qs = Object.keys(q)
    .filter((k) => q[k] != null && q[k] !== '')
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(String(q[k])))
    .join('&');
  const url = TMDB + path + (path.includes('?') ? '&' : '?') + qs;
  const opts = { method: 'GET', headers: { Accept: 'application/json' } };
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    opts.signal = AbortSignal.timeout(12000);
  }
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error('TMDB ' + res.status + ' ' + path);
  return res.json();
}

function posterUrl(path, size) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return IMG + (size || posterSize()) + path;
}

function backdropUrl(path, size) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return IMG + (size || backdropSize()) + path;
}

// ─── Genres (movie ≠ TV) ──────────────────────────────────────────────────
const MOVIE_GENRES = [
  { id: 28, name: 'Acción' },
  { id: 12, name: 'Aventura' },
  { id: 16, name: 'Animación' },
  { id: 35, name: 'Comedia' },
  { id: 80, name: 'Crimen' },
  { id: 99, name: 'Documental' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Familia' },
  { id: 14, name: 'Fantasía' },
  { id: 36, name: 'Historia' },
  { id: 27, name: 'Terror' },
  { id: 10402, name: 'Música' },
  { id: 9648, name: 'Misterio' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Ciencia ficción' },
  { id: 10770, name: 'TV Movie' },
  { id: 53, name: 'Suspense' },
  { id: 10752, name: 'Bélica' },
  { id: 37, name: 'Western' },
];

const TV_GENRES = [
  { id: 10759, name: 'Acción y Aventura' },
  { id: 16, name: 'Animación' },
  { id: 35, name: 'Comedia' },
  { id: 80, name: 'Crimen' },
  { id: 99, name: 'Documental' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Familia' },
  { id: 10762, name: 'Kids' },
  { id: 9648, name: 'Misterio' },
  { id: 10763, name: 'News' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10766, name: 'Soap' },
  { id: 10767, name: 'Talk' },
  { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
];

const SORT_OPTIONS = [
  { id: 'popularity.desc', title: 'Popularidad ↓' },
  { id: 'popularity.asc', title: 'Popularidad ↑' },
  { id: 'vote_average.desc', title: 'Valoración ↓' },
  { id: 'vote_average.asc', title: 'Valoración ↑' },
  { id: 'primary_release_date.desc', title: 'Fecha salida ↓ (movies)' },
  { id: 'primary_release_date.asc', title: 'Fecha salida ↑ (movies)' },
  { id: 'first_air_date.desc', title: 'Fecha estreno ↓ (TV)' },
  { id: 'first_air_date.asc', title: 'Fecha estreno ↑ (TV)' },
  { id: 'original_title.asc', title: 'Título A–Z (movies)' },
  { id: 'title.asc', title: 'Título A–Z' },
  { id: 'revenue.desc', title: 'Recaudación ↓' },
];

// ─── Map TMDB item ────────────────────────────────────────────────────────
function mapTmdbItem(r, forcedType) {
  const mt =
    forcedType ||
    (r.media_type === 'tv' || r.name
      ? 'tv'
      : r.media_type === 'movie' || r.title
        ? 'movie'
        : 'movie');
  const isTv = mt === 'tv' || mt === 'series';
  const type = isTv ? 'series' : 'movie';
  const title = r.title || r.name || 'Sin título';
  const year = String(r.release_date || r.first_air_date || '').slice(0, 4);
  const poster = posterUrl(r.poster_path);
  const backdrop = backdropUrl(r.backdrop_path) || poster;
  const id = (isTv ? 'tv:' : 'movie:') + String(r.id);

  return {
    id,
    contentId: id,
    tmdbId: String(r.id),
    title,
    name: title,
    type,
    media_type: type,
    programType: type,
    year: year || null,
    poster,
    image: poster,
    backdrop,
    background: backdrop,
    overview: r.overview || '',
    description: r.overview || '',
    rating: r.vote_average != null ? Number(r.vote_average) : null,
    genres: Array.isArray(r.genre_ids) ? r.genre_ids : [],
    adult: !!r.adult,
    popularity: r.popularity,
  };
}

function parseContentId(id) {
  const raw = id && typeof id === 'object'
    ? String(id.contentId || id.id || id.tmdbId || '')
    : String(id || '');
  const m = raw.match(/^(movie|tv|series)[:/](\d+)/i);
  if (m) {
    const mediaType = /tv|series/i.test(m[1]) ? 'tv' : 'movie';
    return { tmdbId: m[2], mediaType, raw };
  }
  if (/^\d+$/.test(raw)) return { tmdbId: raw, mediaType: 'movie', raw };
  if (/^tt\d+/i.test(raw)) return { tmdbId: raw, mediaType: 'movie', raw, isImdb: true };
  return { tmdbId: raw, mediaType: 'movie', raw };
}

// ─── Home ─────────────────────────────────────────────────────────────────
async function fetchList(path, params) {
  const data = await tmdbFetch(path, params);
  return (data.results || []).map((r) => mapTmdbItem(r));
}

/**
 * Home: mezcla de filas.
 * - Algunas filas “hero/backdrop” (layout hint horizontal)
 * - Otras en poster vertical
 */
async function getHome() {
  return cached('home:' + lang() + ':' + region() + ':' + (excludeInTheater() ? '1' : '0'), 5 * 60e3, async () => {
    const rows = [];
    const push = (title, items, layout) => {
      if (!items || !items.length) return;
      rows.push({
        id: 'home_' + title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, ''),
        title: title,
        name: title,
        layout: layout || 'poster',
        imageStyle: layout === 'backdrop' ? 'backdrop' : 'poster',
        type: layout === 'backdrop' ? 'hero' : 'rail',
        items: items.slice(0, layout === 'backdrop' ? 12 : 18),
      });
    };

    const tasks = [
      fetchList('/trending/all/week', { page: 1 }),
      fetchList('/trending/movie/week', { page: 1 }),
      fetchList('/trending/tv/week', { page: 1 }),
      fetchList('/movie/popular', digitalReleaseParams({ page: 1, region: region() }, false)),
      fetchList('/tv/popular', digitalReleaseParams({ page: 1 }, true)),
      fetchList('/movie/top_rated', digitalReleaseParams({ page: 1 }, false)),
      fetchList('/tv/top_rated', digitalReleaseParams({ page: 1 }, true)),
      fetchList('/tv/on_the_air', digitalReleaseParams({ page: 1 }, true)),
    ];
    if (!excludeInTheater()) {
      tasks.push(fetchList('/movie/now_playing', { page: 1, region: region() }));
      tasks.push(fetchList('/movie/upcoming', { page: 1, region: region() }));
    } else {
      tasks.push(Promise.resolve([]));
      tasks.push(Promise.resolve([]));
    }

    const [
      trendingAll,
      trendingMovie,
      trendingTv,
      popularMovie,
      popularTv,
      topMovie,
      topTv,
      onAir,
      nowPlaying,
      upcoming,
    ] = await Promise.all(tasks.map((t) => t.catch(() => [])));

    // Novedades launcher: mezcla TV + movie recientes/tendencia
    const novedades = [];
    const seen = {};
    function addMix(list) {
      (list || []).forEach(function (it) {
        if (!it || !it.id || seen[it.id]) return;
        seen[it.id] = true;
        novedades.push(it);
      });
    }
    addMix(trendingAll);
    addMix(trendingMovie);
    addMix(trendingTv);
    addMix(onAir);
    addMix(popularMovie);
    addMix(popularTv);
    // Intercalar movie/tv
    const mix = [];
    const movies = novedades.filter((x) => x.type === 'movie');
    const series = novedades.filter((x) => x.type === 'series' || x.type === 'tv');
    const n = Math.max(movies.length, series.length);
    for (let i = 0; i < n && mix.length < 20; i++) {
      if (i < movies.length) mix.push(movies[i]);
      if (i < series.length) mix.push(series[i]);
    }
    push('Novedades', mix.length ? mix : novedades, 'backdrop');

    push('Destacados', trendingAll, 'backdrop');
    if (!excludeInTheater() && nowPlaying.length) push('En cines', nowPlaying, 'backdrop');
    push('Series en emisión', onAir, 'backdrop');
    push('Películas en tendencia', trendingMovie, 'poster');
    push('Series en tendencia', trendingTv, 'poster');
    push('Películas populares', popularMovie, 'poster');
    push('Series populares', popularTv, 'poster');
    push('Mejor valoradas · Cine', topMovie, 'poster');
    push('Mejor valoradas · Series', topTv, 'poster');
    if (!excludeInTheater() && upcoming.length) push('Próximos estrenos', upcoming, 'poster');

    // Géneros en home
    try {
      const action = await fetchList(
        '/discover/movie',
        digitalReleaseParams({ with_genres: 28, sort_by: 'popularity.desc', page: 1 }, false)
      );
      push('Acción', action, 'poster');
    } catch (_) {}
    try {
      const dramaTv = await fetchList(
        '/discover/tv',
        digitalReleaseParams({ with_genres: 18, sort_by: 'popularity.desc', page: 1 }, true)
      );
      push('Drama en series', dramaTv, 'poster');
    } catch (_) {}
    try {
      const comedy = await fetchList(
        '/discover/movie',
        digitalReleaseParams({ with_genres: 35, sort_by: 'popularity.desc', page: 1 }, false)
      );
      push('Comedia', comedy, 'poster');
    } catch (_) {}

    // Franquicias en home: 1 ítem representativo por colección (con poster de la colección)
    try {
      const frRows = [];
      const sample = FRANCHISE_COLLECTIONS.slice(0, 12);
      for (let i = 0; i < sample.length; i++) {
        const c = sample[i];
        try {
          const cov = await loadCollectionCover(c.id);
          const data = await tmdbFetch('/collection/' + c.id, {});
          const parts = (data.parts || []).slice().sort(function (a, b) {
            return String(a.release_date || '').localeCompare(String(b.release_date || ''));
          });
          let pick = parts[0];
          if (excludeInTheater()) {
            const today = new Date().toISOString().slice(0, 10);
            pick = parts.filter(function (x) { return x.release_date && x.release_date <= today; }).pop() || pick;
          }
          if (!pick) continue;
          const item = mapTmdbItem(pick, 'movie');
          item.title = cov.title || c.name;
          item.name = item.title;
          // Portada de la franquicia
          if (cov.poster) {
            item.poster = cov.poster;
            item.image = cov.poster;
          }
          if (cov.backdrop) {
            item.backdrop = cov.backdrop;
            item.background = cov.backdrop;
          }
          item.extra = Object.assign({}, item.extra || {}, { collectionId: c.id, catalogId: 'collection_' + c.id });
          frRows.push(item);
        } catch (_) {}
      }
      push('Franquicias', frRows, 'poster');
    } catch (_) {}

    return { rows: rows, sections: rows, items: rows.flatMap(function (r) { return r.items || []; }) };
  });
}


// ─── Catalogs ─────────────────────────────────────────────────────────────
/** Caché de portadas de colecciones (poster/backdrop TMDB). */
const collectionCovers = new Map();

async function loadCollectionCover(collectionId) {
  const id = String(collectionId);
  if (collectionCovers.has(id)) return collectionCovers.get(id);
  try {
    const data = await tmdbFetch('/collection/' + id, {});
    const cover = {
      title: data.name || '',
      overview: data.overview || '',
      poster: posterUrl(data.poster_path, 'w500'),
      backdrop: backdropUrl(data.backdrop_path, 'w1280'),
      parts: Array.isArray(data.parts) ? data.parts.length : 0,
    };
    collectionCovers.set(id, cover);
    limitMap(collectionCovers, 120);
    return cover;
  } catch (_) {
    const empty = { title: '', overview: '', poster: null, backdrop: null, parts: 0 };
    collectionCovers.set(id, empty);
    return empty;
  }
}

/**
 * Lista de catálogos.
 * - Básicos + géneros
 * - Colecciones / franquicias con poster de la colección como portada
 */
async function getCatalogs() {
  const catalogs = [
    { id: 'trending_movie', title: 'Películas en tendencia', type: 'movie', group: 'Destacados' },
    { id: 'trending_tv', title: 'Series en tendencia', type: 'series', group: 'Destacados' },
    { id: 'popular_movie', title: 'Películas populares', type: 'movie', group: 'Destacados' },
    { id: 'popular_tv', title: 'Series populares', type: 'series', group: 'Destacados' },
    { id: 'top_movie', title: 'Películas mejor valoradas', type: 'movie', group: 'Destacados' },
    { id: 'top_tv', title: 'Series mejor valoradas', type: 'series', group: 'Destacados' },
    { id: 'now_playing', title: 'En cines', type: 'movie', group: 'Destacados' },
    { id: 'upcoming', title: 'Próximos estrenos', type: 'movie', group: 'Destacados' },
    { id: 'on_the_air', title: 'Series en emisión', type: 'series', group: 'Destacados' },
    { id: 'airing_today', title: 'Series hoy', type: 'series', group: 'Destacados' },
  ];

  for (const g of MOVIE_GENRES) {
    catalogs.push({
      id: 'genre_movie_' + g.id,
      title: g.name + ' · Películas',
      type: 'movie',
      genreId: g.id,
      group: 'Géneros cine',
    });
  }
  for (const g of TV_GENRES) {
    catalogs.push({
      id: 'genre_tv_' + g.id,
      title: g.name + ' · Series',
      type: 'series',
      genreId: g.id,
      group: 'Géneros series',
    });
  }

  // Franquicias / colecciones — portada = imagen de la colección TMDB
  // Cargamos covers en paralelo (limitado) para no saturar
  const franchiseEntries = [];
  const batch = 8;
  for (let i = 0; i < FRANCHISE_COLLECTIONS.length; i += batch) {
    const chunk = FRANCHISE_COLLECTIONS.slice(i, i + batch);
    const covers = await Promise.all(
      chunk.map((c) => loadCollectionCover(c.id).then((cov) => ({ c, cov })))
    );
    for (const { c, cov } of covers) {
      const title = cov.title || c.name;
      const poster = cov.poster || cov.backdrop;
      franchiseEntries.push({
        id: 'collection_' + c.id,
        title: title,
        name: title,
        type: 'movie',
        group: 'Franquicias',
        collectionId: c.id,
        // Portada del catálogo = arte de la colección / franquicia
        poster: poster,
        image: poster,
        cover: poster,
        backdrop: cov.backdrop || poster,
        background: cov.backdrop || poster,
        overview: cov.overview || '',
        description: cov.overview || '',
        parts: cov.parts,
      });
    }
  }
  catalogs.push(...franchiseEntries);

  return catalogs;
}

async function getCatalog(catalogId, opts) {
  opts = opts || {};
  const page = parseInt(opts.page || 1, 10) || 1;
  const cid = String(catalogId || '').trim();

  return cached('cat:' + cid + ':' + page + ':' + lang(), 3 * 60e3, async () => {
    // ── Colección / franquicia ──
    const colMatch = cid.match(/^collection[_:](\d+)$/i);
    if (colMatch) {
      const collectionId = colMatch[1];
      const data = await tmdbFetch('/collection/' + collectionId, {});
      const coverPoster = posterUrl(data.poster_path, 'w500');
      const coverBackdrop = backdropUrl(data.backdrop_path, 'w1280') || coverPoster;
      let parts = Array.isArray(data.parts) ? data.parts.slice() : [];
      // Orden por fecha de estreno
      parts.sort((a, b) =>
        String(a.release_date || '9999').localeCompare(String(b.release_date || '9999'))
      );
      if (onlyDigital()) {
        const today = new Date().toISOString().slice(0, 10);
        parts = parts.filter((p) => p.release_date && p.release_date <= today);
      }
      const perPage = 40;
      const totalPages = Math.max(1, Math.ceil(parts.length / perPage));
      const start = (page - 1) * perPage;
      const slice = parts.slice(start, start + perPage);
      const items = slice.map((r) => mapTmdbItem(r, 'movie'));
      return {
        items,
        metas: items,
        results: items,
        page,
        totalPages,
        hasMore: page < totalPages,
        catalogId: cid,
        title: data.name || 'Colección',
        // Portada del catálogo = imagen de la franquicia
        poster: coverPoster,
        cover: coverPoster,
        backdrop: coverBackdrop,
        overview: data.overview || '',
      };
    }

    let path = '/movie/popular';
    let params = { page, region: region() };
    let typeHint = 'movie';

    if (cid === 'trending_movie') {
      path = '/trending/movie/week';
      typeHint = 'movie';
    } else if (cid === 'trending_tv') {
      path = '/trending/tv/week';
      typeHint = 'tv';
    } else if (cid === 'popular_movie') {
      path = '/movie/popular';
    } else if (cid === 'popular_tv') {
      path = '/tv/popular';
      typeHint = 'tv';
    } else if (cid === 'top_movie') {
      path = '/movie/top_rated';
    } else if (cid === 'top_tv') {
      path = '/tv/top_rated';
      typeHint = 'tv';
    } else if (cid === 'now_playing') {
      path = '/movie/now_playing';
    } else if (cid === 'upcoming') {
      path = '/movie/upcoming';
    } else if (cid === 'on_the_air') {
      path = '/tv/on_the_air';
      typeHint = 'tv';
    } else if (cid === 'airing_today') {
      path = '/tv/airing_today';
      typeHint = 'tv';
    } else if (/^genre_movie_(\d+)$/.test(cid)) {
      path = '/discover/movie';
      params = {
        page,
        with_genres: RegExp.$1,
        sort_by: 'popularity.desc',
        region: region(),
      };
      typeHint = 'movie';
    } else if (/^genre_tv_(\d+)$/.test(cid)) {
      path = '/discover/tv';
      params = {
        page,
        with_genres: RegExp.$1,
        sort_by: 'popularity.desc',
      };
      typeHint = 'tv';
    }

    if (onlyDigital() && path.includes('discover/movie')) {
      params['release_date.lte'] = new Date().toISOString().slice(0, 10);
    }

    const data = await tmdbFetch(path, params);
    const items = (data.results || []).map((r) =>
      mapTmdbItem(r, typeHint === 'tv' ? 'tv' : 'movie')
    );
    const totalPages = data.total_pages || 1;
    return {
      items,
      metas: items,
      results: items,
      page,
      totalPages,
      hasMore: page < totalPages,
      catalogId: cid,
    };
  });
}

// ─── Discover + filters ───────────────────────────────────────────────────
/**
 * Filtros para la UI (selects):
 *  1) type: movie | tv
 *  2) genre: depende del tipo
 *  3) sort: fecha, valoración, letras, popularidad…
 */
async function getDiscoverFilters() {
  // La app solo muestra hasta 3 filtros, cada uno con { id, label, options:[{id,label}] }
  const typeOpts = [
    { id: 'movie', label: 'Películas' },
    { id: 'tv', label: 'Series' },
  ];

  const genreMovie = MOVIE_GENRES.map(function (g) {
    return { id: 'm' + g.id, label: g.name };
  });
  const genreTv = TV_GENRES.map(function (g) {
    return { id: 't' + g.id, label: g.name };
  });
  // Un solo select de género con prefijo m/t para distinguir
  const genreOpts = [{ id: 'all', label: 'Todos' }]
    .concat(genreMovie.map(function (g) { return { id: g.id, label: '🎬 ' + g.label }; }))
    .concat(genreTv.map(function (g) { return { id: g.id, label: '📺 ' + g.label }; }));

  const sortOpts = [
    { id: 'popularity.desc', label: 'Popularidad ↓' },
    { id: 'popularity.asc', label: 'Popularidad ↑' },
    { id: 'vote_average.desc', label: 'Valoración ↓' },
    { id: 'vote_average.asc', label: 'Valoración ↑' },
    { id: 'date.desc', label: 'Fecha ↓' },
    { id: 'date.asc', label: 'Fecha ↑' },
    { id: 'title.asc', label: 'Título A–Z' },
    { id: 'title.desc', label: 'Título Z–A' },
    { id: 'revenue.desc', label: 'Recaudación ↓' },
  ];

  return [
    { id: 'type', label: 'Tipo', options: typeOpts },
    { id: 'genre', label: 'Género', options: genreOpts },
    { id: 'sort', label: 'Ordenar', options: sortOpts },
  ];
}


async function getDiscover(opts) {
  opts = opts || {};
  const page = parseInt(opts.page || 1, 10) || 1;

  // App envía { page, type, genre, sort } según ids de getDiscoverFilters
  let type = String(opts.type || opts.kind || opts.media || 'movie').toLowerCase();
  let genre = String(opts.genre || opts.genreId || opts.with_genres || '').trim();
  let sort = String(opts.sort || opts.sort_by || opts.order || 'popularity.desc').trim();
  const filter = String(opts.filter || opts.catalog || opts.category || '').trim();

  if (filter === 'movie' || filter === 'tv') type = filter;
  if (type === 'series' || type === 'show') type = 'tv';
  if (type !== 'tv') type = 'movie';

  // Género con prefijo m28 / t18
  if (/^m\d+$/i.test(genre)) {
    type = 'movie';
    genre = genre.slice(1);
  } else if (/^t\d+$/i.test(genre)) {
    type = 'tv';
    genre = genre.slice(1);
  } else if (genre === 'all') {
    genre = '';
  }

  // Orden genérico date/title → campo TMDB
  if (sort === 'date.desc') sort = type === 'tv' ? 'first_air_date.desc' : 'primary_release_date.desc';
  if (sort === 'date.asc') sort = type === 'tv' ? 'first_air_date.asc' : 'primary_release_date.asc';
  if (sort === 'title.asc') sort = type === 'tv' ? 'name.asc' : 'original_title.asc';
  if (sort === 'title.desc') sort = type === 'tv' ? 'name.desc' : 'original_title.desc';
  if (type === 'tv') {
    sort = sort.replace('primary_release_date', 'first_air_date').replace('original_title', 'name');
  } else {
    sort = sort.replace('first_air_date', 'primary_release_date');
  }
  if (!sort) sort = 'popularity.desc';

  const path = type === 'tv' ? '/discover/tv' : '/discover/movie';
  let params = {
    page: page,
    sort_by: sort,
    include_adult: false,
    region: region(),
  };
  if (genre) params.with_genres = genre;
  params = digitalReleaseParams(params, type === 'tv');

  return cached(
    'disc:' + type + ':' + genre + ':' + sort + ':' + page + ':' + lang() + ':' + (excludeInTheater() ? '1' : '0'),
    90e3,
    async () => {
      const data = await tmdbFetch(path, params);
      const items = (data.results || []).map((r) =>
        mapTmdbItem(r, type === 'tv' ? 'tv' : 'movie')
      );
      const totalPages = data.total_pages || 1;
      return {
        items: items,
        metas: items,
        results: items,
        page: page,
        totalPages: totalPages,
        hasMore: page < totalPages,
      };
    }
  );
}


// ─── Meta (logo, seasons, all episodes, IMDb) ─────────────────────────────
const imdbByTmdb = new Map(); // "movie:123" | "tv:123" → tt…

async function pickLogo(images) {
  const logos = (images && images.logos) || [];
  if (!logos.length) return null;
  const scored = logos
    .filter((l) => l.file_path)
    .map((l) => {
      let s = 0;
      if (l.iso_639_1 === 'es') s += 12;
      else if (l.iso_639_1 === 'en') s += 6;
      else if (!l.iso_639_1) s += 3;
      const ar = l.aspect_ratio || 0;
      if (ar >= 1.5 && ar <= 5) s += 4;
      s += Math.min(3, (l.vote_average || 0) / 3);
      return { path: l.file_path, s };
    })
    .sort((a, b) => b.s - a.s);
  return scored.length ? posterUrl(scored[0].path, 'w500') : null;
}

async function getMeta(id, options) {
  const opts =
    options && typeof options === 'object'
      ? options
      : typeof options === 'string'
        ? { type: options }
        : {};
  let { tmdbId, mediaType, isImdb } = parseContentId(id);

  if (opts.type === 'series' || opts.type === 'tv' || opts.type === 'show') {
    mediaType = 'tv';
  } else if (opts.type === 'movie') {
    mediaType = 'movie';
  }

  // IMDb → TMDB
  if (isImdb || /^tt\d+/i.test(String(tmdbId))) {
    const find = await tmdbFetch('/find/' + tmdbId, {
      external_source: 'imdb_id',
    });
    const movie = (find.movie_results || [])[0];
    const tv = (find.tv_results || [])[0];
    if (movie) {
      tmdbId = String(movie.id);
      mediaType = 'movie';
    } else if (tv) {
      tmdbId = String(tv.id);
      mediaType = 'tv';
    } else {
      return { id: String(id), title: 'No encontrado', type: mediaType };
    }
  }

  return cached(
    'meta:' + mediaType + ':' + tmdbId + ':' + lang(),
    6 * 60e3,
    async () => {
      let data;
      try {
        data = await tmdbFetch('/' + mediaType + '/' + tmdbId, {
          append_to_response: 'credits,external_ids,videos,images',
          include_image_language: lang().slice(0, 2) + ',en,null',
        });
      } catch (e1) {
        const other = mediaType === 'tv' ? 'movie' : 'tv';
        data = await tmdbFetch('/' + other + '/' + tmdbId, {
          append_to_response: 'credits,external_ids,videos,images',
          include_image_language: lang().slice(0, 2) + ',en,null',
        });
        mediaType = other;
      }

      const isTv = mediaType === 'tv';
      const title = data.title || data.name || 'Sin título';
      const year = String(data.release_date || data.first_air_date || '').slice(0, 4);
      const genres = (data.genres || []).map((g) => g.name);
      const imdb = (data.external_ids && data.external_ids.imdb_id) || null;
      const key = (isTv ? 'tv:' : 'movie:') + tmdbId;
      if (imdb) {
        imdbByTmdb.set(key, imdb);
        imdbByTmdb.set(String(tmdbId), imdb);
        limitMap(imdbByTmdb, 500);
      }

      const logo = await pickLogo(data.images);
      const poster = posterUrl(data.poster_path);
      const backdrop = backdropUrl(data.backdrop_path) || poster;

      const cast = ((data.credits && data.credits.cast) || [])
        .slice(0, 15)
        .map((c) => ({
          name: c.name,
          character: c.character,
          profile: posterUrl(c.profile_path, 'w185'),
        }));

      const directors = ((data.credits && data.credits.crew) || [])
        .filter((c) => c.job === 'Director' || c.job === 'Creator')
        .map((c) => c.name);

      // Temporadas + episodios
      const seasons = [];
      if (isTv && Array.isArray(data.seasons)) {
        const list = data.seasons.filter((s) => s.season_number > 0);
        // Cargar todas las temporadas (en paralelo, batches de 4)
        const batch = 4;
        for (let i = 0; i < list.length; i += batch) {
          const chunk = list.slice(i, i + batch);
          await Promise.all(
            chunk.map(async (s) => {
              try {
                const sd = await tmdbFetch(
                  '/tv/' + tmdbId + '/season/' + s.season_number
                );
                let episodes = (sd.episodes || []).map((ep) => ({
                  episode: ep.episode_number,
                  number: ep.episode_number,
                  id: 'tv:' + tmdbId,
                  contentId: 'tv:' + tmdbId,
                  title: ep.name || 'Episodio ' + ep.episode_number,
                  name: ep.name || 'Episodio ' + ep.episode_number,
                  overview: ep.overview || '',
                  description: ep.overview || '',
                  still: posterUrl(ep.still_path, 'w300'),
                  backdrop: posterUrl(ep.still_path, 'w780'),
                  runtime: ep.runtime || null,
                  airDate: ep.air_date || null,
                  rating: ep.vote_average || null,
                  season: s.season_number,
                }));

                if (hideUnreleasedEps()) {
                  const today = new Date().toISOString().slice(0, 10);
                  episodes = episodes.filter(
                    (ep) => !ep.airDate || ep.airDate <= today
                  );
                }

                seasons.push({
                  number: s.season_number,
                  season: s.season_number,
                  title: s.name || 'Temporada ' + s.season_number,
                  name: s.name || 'Temporada ' + s.season_number,
                  poster: posterUrl(s.poster_path),
                  overview: s.overview || '',
                  episodeCount: episodes.length,
                  episodes,
                });
              } catch (_) {
                seasons.push({
                  number: s.season_number,
                  season: s.season_number,
                  title: s.name || 'Temporada ' + s.season_number,
                  name: s.name || 'Temporada ' + s.season_number,
                  poster: posterUrl(s.poster_path),
                  overview: s.overview || '',
                  episodeCount: s.episode_count || 0,
                  episodes: [],
                });
              }
            })
          );
        }
        seasons.sort((a, b) => a.number - b.number);
      }

      // Intro/outro a nivel meta (película) — el player también los pide en streams
      let segments = null;
      if (imdb) {
        try {
          segments = await fetchIntroDbSegments(
            imdb,
            0,
            0,
            !isTv
          );
        } catch (_) {}
      }

      return {
        id: key,
        contentId: key,
        tmdbId: String(tmdbId),
        imdbId: imdb,
        imdb,
        title,
        name: title,
        originalTitle: data.original_title || data.original_name || title,
        poster,
        backdrop,
        background: backdrop,
        logo,
        overview: data.overview || '',
        description: data.overview || '',
        type: isTv ? 'series' : 'movie',
        media_type: isTv ? 'series' : 'movie',
        programType: isTv ? 'series' : 'movie',
        rating: data.vote_average,
        year,
        genres,
        runtime:
          data.runtime ||
          (data.episode_run_time && data.episode_run_time[0]) ||
          null,
        status: data.status,
        seasons,
        cast,
        directors,
        tagline: data.tagline || '',
        segments: segments || undefined,
        skip: segments || undefined,
        extra: { logo, imdbId: imdb },
      };
    }
  );
}

// ─── IntroDB ──────────────────────────────────────────────────────────────
const introdbCache = new Map();

function rangeFromSegment(seg) {
  if (!seg || typeof seg !== 'object') return null;
  const a = Number(seg.start_sec);
  const b = Number(seg.end_sec);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return [Math.floor(a), Math.ceil(b)];
}

async function fetchIntroDbSegments(imdbId, season, episode, isMovie) {
  const id = String(imdbId || '').trim();
  if (!/^tt\d{7,}$/i.test(id)) return null;
  const ck =
    id.toLowerCase() +
    (isMovie ? ':movie' : ':s' + Number(season || 1) + 'e' + Number(episode || 1));
  if (introdbCache.has(ck)) return introdbCache.get(ck);

  let url = INTRODB + '?imdb_id=' + encodeURIComponent(id);
  if (!isMovie) {
    url +=
      '&season=' +
      encodeURIComponent(String(Number(season || 1) || 1)) +
      '&episode=' +
      encodeURIComponent(String(Number(episode || 1) || 1));
  }
  try {
    const opts = { method: 'GET', headers: { Accept: 'application/json' } };
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      opts.signal = AbortSignal.timeout(5000);
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
      introdbCache.set(ck, null);
      return null;
    }
    const json = await res.json();
    const intro = rangeFromSegment(json && json.intro);
    const outro = rangeFromSegment(json && json.outro);
    const segments = {};
    if (intro) segments.intro = intro;
    if (outro) segments.outro = outro;
    const out = segments.intro || segments.outro ? segments : null;
    introdbCache.set(ck, out);
    limitMap(introdbCache, 300);
    return out;
  } catch (_) {
    introdbCache.set(ck, null);
    return null;
  }
}

async function resolveImdbFor(tmdbId, mediaType) {
  const key = (mediaType === 'tv' ? 'tv:' : 'movie:') + tmdbId;
  if (imdbByTmdb.has(key)) return imdbByTmdb.get(key);
  if (imdbByTmdb.has(String(tmdbId))) return imdbByTmdb.get(String(tmdbId));
  try {
    const data = await tmdbFetch('/' + mediaType + '/' + tmdbId + '/external_ids');
    const imdb = data && data.imdb_id;
    if (imdb && /^tt\d+/i.test(imdb)) {
      imdbByTmdb.set(key, imdb);
      imdbByTmdb.set(String(tmdbId), imdb);
      return imdb;
    }
  } catch (_) {}
  return '';
}

// ─── Search ───────────────────────────────────────────────────────────────
async function search(query) {
  if (!query || !String(query).trim()) return { items: [] };
  return cached('search:' + query + ':' + lang(), 30e3, async () => {
    const data = await tmdbFetch('/search/multi', {
      query: String(query).trim(),
      include_adult: false,
      page: 1,
    });
    const items = (data.results || [])
      .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
      .map((r) => mapTmdbItem(r, r.media_type));
    return { items, metas: items, results: items };
  });
}

// ─── Extractors / Streams ─────────────────────────────────────────────────
/**
 * Extractores: se cargan desde __EXTRACTOR_SOURCES (código embebido) si existe,
 * o desde globalThis[name], o se dejan stubs documentados.
 * Firma: getStreams(tmdbId, mediaType, season, episode) → streams[]
 *
 * Fuentes por defecto:
 *   embed69, vimeus, lamovie, elifilms, homecine,
 *   seriesmetro, cinecalidad, tioplus, verpelis
 */
const __loadedExtractors = {};

function loadExtractor(name) {
  if (__loadedExtractors[name] !== undefined) return __loadedExtractors[name];
  const n = String(name).toLowerCase();

  // 1) Código embebido (mismo patrón que el repo de catálogos)
  try {
    const code =
      typeof __EXTRACTOR_SOURCES !== 'undefined' && __EXTRACTOR_SOURCES
        ? __EXTRACTOR_SOURCES[n]
        : null;
    if (code) {
      const module = { exports: {} };
      const exports = module.exports;
      const fn = new Function(
        'module',
        'exports',
        code + '\n;return module.exports;'
      );
      const exp = fn(module, exports);
      let getStreamsFn = null;
      if (exp && typeof exp.getStreams === 'function') getStreamsFn = exp.getStreams;
      else if (typeof module.exports.getStreams === 'function')
        getStreamsFn = module.exports.getStreams;
      else if (typeof module.exports === 'function') getStreamsFn = module.exports;
      __loadedExtractors[n] = getStreamsFn;
      return getStreamsFn;
    }
  } catch (e) {
    console.log('[extractor] load error ' + n + ': ' + (e && e.message));
  }

  // 2) globalThis registrado
  try {
    const g = globalThis['extractor_' + n] || globalThis[n];
    if (g && typeof g.getStreams === 'function') {
      __loadedExtractors[n] = g.getStreams.bind(g);
      return __loadedExtractors[n];
    }
    if (typeof g === 'function') {
      __loadedExtractors[n] = g;
      return g;
    }
  } catch (_) {}

  __loadedExtractors[n] = null;
  return null;
}

function normalizeStream(s, sourceName) {
  if (!s) return null;
  const url = String(s.url || s.file || s.src || s.link || s.stream || '').trim();
  if (!url || url.indexOf('http') !== 0) return null;
  const lower = url.toLowerCase();
  return {
    name: s.name || sourceName,
    title: s.title || s.name || sourceName,
    url,
    quality: s.quality || s.q || 'HD',
    language: s.language || s.lang || s.Audio || 'Latino',
    server: s.server || s.serverLabel || sourceName,
    headers: s.headers || null,
    isHls: /\.m3u8|hls|manifest/i.test(lower),
    isMp4: /\.mp4/i.test(lower),
    source: sourceName,
    provider: sourceName,
    // Passthrough segmentos si el extractor los trae
    segments: s.segments || s.skip || null,
    subtitles: s.subtitles || s.subs || null,
  };
}

async function getStreams(id, type, season, episode) {
  let { tmdbId, mediaType } = parseContentId(id);

  if (id && typeof id === 'object') {
    tmdbId = String(id.tmdbId || id.id || tmdbId).replace(/^(movie|tv|series)[:/]/i, '');
    mediaType =
      id.type === 'tv' || id.type === 'series'
        ? 'tv'
        : id.type === 'movie'
          ? 'movie'
          : mediaType;
    season = id.season != null ? id.season : season;
    episode = id.episode != null ? id.episode : episode;
  }

  if (type === 'series' || type === 'tv' || type === 'show') mediaType = 'tv';
  else if (type === 'movie') mediaType = 'movie';

  if (/^tt\d+/i.test(String(tmdbId))) {
    try {
      const find = await tmdbFetch('/find/' + tmdbId, { external_source: 'imdb_id' });
      const movie = (find.movie_results || [])[0];
      const tv = (find.tv_results || [])[0];
      if (movie) {
        tmdbId = String(movie.id);
        mediaType = 'movie';
      } else if (tv) {
        tmdbId = String(tv.id);
        mediaType = 'tv';
      }
    } catch (_) {}
  }

  tmdbId = String(tmdbId).replace(/^(movie|tv|series)[:/]/i, '');

  // IMDb + IntroDB siempre (para el player, independientemente del extractor)
  let streamSegments = null;
  try {
    const imdb = await resolveImdbFor(tmdbId, mediaType);
    if (imdb) {
      if (mediaType === 'tv') {
        streamSegments = await fetchIntroDbSegments(
          imdb,
          season || 1,
          episode || 1,
          false
        );
      } else {
        streamSegments = await fetchIntroDbSegments(imdb, 0, 0, true);
      }
    }
  } catch (_) {}

  const names = enabledSources();
  const limit = maxConcurrent();
  const allStreams = [];
  const seen = {};
  const queue = names.slice();

  async function worker() {
    while (queue.length) {
      const name = queue.shift();
      try {
        const fn = loadExtractor(name);
        if (!fn) {
          console.log('[getStreams] extractor no cargado: ' + name);
          continue;
        }
        const raw = await Promise.race([
          Promise.resolve(
            fn.call(null, String(tmdbId), mediaType, season || null, episode || null)
          ),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error('timeout')), 22000)
          ),
        ]);
        const list = Array.isArray(raw) ? raw : (raw && raw.streams) || [];
        for (let i = 0; i < list.length; i++) {
          const ns = normalizeStream(list[i], name);
          if (!ns) continue;
          const key = ns.url.split('?')[0];
          if (seen[key]) continue;
          seen[key] = true;
          if (streamSegments && !ns.segments) {
            ns.segments = streamSegments;
            ns.skip = streamSegments;
            ns.markers = streamSegments;
          }
          allStreams.push(ns);
        }
      } catch (e) {
        console.log(
          '[getStreams] ' + name + ' error: ' + (e && e.message ? e.message : e)
        );
      }
    }
  }

  const workers = [];
  for (let w = 0; w < Math.min(limit, names.length); w++) workers.push(worker());
  await Promise.all(workers);

  allStreams.sort((a, b) => {
    if (a.isHls && !b.isHls) return -1;
    if (!a.isHls && b.isHls) return 1;
    return 0;
  });

  // Si no hubo extractores, devolver placeholder con segmentos para depurar player
  if (!allStreams.length && streamSegments) {
    return [
      {
        name: 'IntroDB only',
        title: 'Sin servidores — segmentos intro/outro disponibles',
        url: 'https://example.invalid/no-stream',
        quality: 'N/A',
        language: '—',
        segments: streamSegments,
        skip: streamSegments,
        markers: streamSegments,
      },
    ];
  }

  return allStreams;
}

// ─── Config schema (para la UI de la app) ─────────────────────────────────
function getConfigSchema() {
  return {
    id: ADDON_ID,
    title: 'TMDB Full',
    fields: [
      {
        key: 'tmdb_api_key',
        type: 'string',
        label: 'API Key TMDB',
        default: '',
        placeholder: 'Dejar vacío para usar la del addon',
      },
      {
        key: 'tmdb_lang',
        type: 'select',
        label: 'Idioma',
        options: [
          { value: 'es-MX', label: 'Español (México)' },
          { value: 'es-ES', label: 'Español (España)' },
          { value: 'en-US', label: 'English' },
        ],
        default: 'es-ES',
      },
      {
        key: 'image_quality',
        type: 'select',
        label: 'Calidad posters',
        options: [
          { value: 'w185', label: 'Baja (w185)' },
          { value: 'w342', label: 'Media (w342)' },
          { value: 'w500', label: 'Alta (w500)' },
          { value: 'w780', label: 'Muy alta (w780)' },
          { value: 'original', label: 'Original' },
        ],
        default: 'w500',
      },
      {
        key: 'backdrop_quality',
        type: 'select',
        label: 'Calidad backdrops',
        options: [
          { value: 'w780', label: 'w780' },
          { value: 'w1280', label: 'w1280' },
          { value: 'original', label: 'Original' },
        ],
        default: 'w1280',
      },
      {
        key: 'region',
        type: 'string',
        label: 'Región (ES, MX, US…)',
        default: 'ES',
      },
      {
        key: 'exclude_in_theater',
        type: 'boolean',
        label: 'Ocultar contenido solo en cines (solo digital)',
        default: true,
      },
      {
        key: 'include_theater',
        type: 'boolean',
        label: 'Incluir fila “En cines” en Home',
        default: false,
      },
      {
        key: 'only_digital',
        type: 'boolean',
        label: 'Solo fechas ya lanzadas',
        default: true,
      },
      {
        key: 'hide_unreleased_eps',
        type: 'boolean',
        label: 'Ocultar capítulos no estrenados',
        default: true,
      },
      {
        key: 'enabled_sources',
        type: 'string',
        label: 'Extractores activos (coma)',
        default: DEFAULTS.enabled_sources,
      },
      {
        key: 'max_concurrent_sources',
        type: 'number',
        label: 'Extractores en paralelo',
        default: 3,
      },
    ],
  };
}

// ─── API pública ──────────────────────────────────────────────────────────
const addon = {
  id: ADDON_ID,
  getHome,
  getCatalogs,
  getCatalog,
  getDiscover,
  getDiscoverFilters,
  getMeta,
  search,
  getStreams,
  getConfigSchema,
};

if (typeof module !== 'undefined' && module.exports) module.exports = addon;
if (typeof globalThis !== 'undefined') {
  globalThis.getHome = getHome;
  globalThis.getCatalogs = getCatalogs;
  globalThis.getCatalog = getCatalog;
  globalThis.getDiscover = getDiscover;
  globalThis.getDiscoverFilters = getDiscoverFilters;
  globalThis.getMeta = getMeta;
  globalThis.search = search;
  globalThis.getStreams = getStreams;
  globalThis.getConfigSchema = getConfigSchema;
  globalThis[ADDON_ID] = addon;
}
