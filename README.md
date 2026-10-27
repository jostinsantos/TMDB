# TMDB Full Catalog

Addon de catálogo **100 % TMDB** (no usa listas fijas tipo BingeCat).

## Qué incluye

| Área | Detalle |
|------|---------|
| **Home** | Destacados / En cines / Emisión (layout `backdrop`) + filas de posters (tendencias, populares, top, géneros) |
| **Catálogos** | Trending, popular, top, now playing, upcoming, on the air + **un catálogo por género** (movie y TV por separado) |
| **Discover** | Selectores: **tipo** (movie/TV) · **género** (listas distintas) · **orden** (popularidad, valoración, fecha, título, recaudación) |
| **Meta** | Logo, overview, cast, directors, **todas las temporadas y episodios**, stills, **imdbId** |
| **Intro/Outro** | Con el IMDb de TMDB llama a **IntroDB** y adjunta `segments` / `skip` a cada stream para el player |
| **Streams** | Extractores: Embed69, Vimeus, LaMovie, EliFilms, **HomeCine**, **SeriesMetro**, **CineCalidad**, **TioPlus**, **VerPelis** |

## Configuración (`userConfig`)

| Clave | Valores | Default |
|-------|---------|---------|
| `tmdb_api_key` | tu clave TMDB | la del addon |
| `tmdb_lang` | `es-MX` · `es-ES` · `en-US` | `es-ES` |
| `image_quality` | `w185` `w342` `w500` `w780` `original` | `w500` |
| `backdrop_quality` | `w780` `w1280` `original` | `w1280` |
| `region` | `ES` `MX` `US`… | `ES` |
| `include_theater` | `true`/`false` | `true` |
| `only_digital` | solo fechas ≤ hoy | `false` |
| `hide_unreleased_eps` | oculta capítulos futuros | `true` |
| `enabled_sources` | lista separada por comas | ver package.json |
| `max_concurrent_sources` | 1–8 | `3` |

## Uso en runtime de un solo archivo

```bash
node build-embed.js
# → index.embedded.js  (index + código de sources/ embebido en __EXTRACTOR_SOURCES)
```

Carga `index.embedded.js` en Nuvio / tu host de addons.

## Uso por carpetas

- `index.js` — catálogo TMDB + orquestación de streams  
- `sources/<nombre>/index.js` — extractores (copiados de Latinuvio)

El loader busca, en orden:

1. `__EXTRACTOR_SOURCES[name]` (embebido)  
2. `globalThis.extractor_<name>` / `globalThis[name]`

## IDs de contenido

- Película: `movie:550`  
- Serie: `tv:1396`  
- También acepta `tt…` (IMDb) y resuelve vía TMDB `/find`.

## Player (intro/outro)

Cada stream puede llevar:

```json
"segments": { "intro": [12, 95], "outro": [2400, 2520] }
```

El player (`_applySegmentsFromServer`) lee eso y muestra **Omitir intro/outro**.

Si no ves el botón: sin `imdb_id`, IntroDB sin datos, o reanudación pasada el intro (ver explicación anterior en el chat).
