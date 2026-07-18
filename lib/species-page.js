'use strict';

const SITE_URL = 'https://michiganbirdingreport.com';
const SITE_NAME = 'Michigan Birding Report';
const DEFAULT_IMAGE = `${SITE_URL}/og-card.png`;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function replaceRequired(source, marker, replacement) {
  if (!source.includes(marker)) {
    throw new Error(`Species page template marker not found: ${marker.slice(0, 60)}`);
  }
  return source.replace(marker, replacement);
}

function getSpeciesMetadata(identity) {
  const scientific = identity.sciName ? ` (${identity.sciName})` : '';
  const title = `${identity.name} in Michigan: ${SITE_NAME}`;
  const description = `${identity.name}${scientific} in Michigan: identification, habitat, seasonal activity, and recent eBird sightings.`;
  const canonical = `${SITE_URL}/species/${encodeURIComponent(identity.code)}`;

  return { title, description, canonical };
}

function renderSpeciesPage(template, identity) {
  const { title, description, canonical } = getSpeciesMetadata(identity);
  const escapedName = escapeHtml(identity.name);
  const escapedSciName = escapeHtml(identity.sciName);
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const escapedCanonical = escapeHtml(canonical);

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        name: title,
        description,
        url: canonical,
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: SITE_URL,
        },
        author: {
          '@type': 'Person',
          name: 'Chris Izworski',
          url: 'https://chrisizworski.com',
        },
        about: {
          '@type': 'Thing',
          name: identity.name,
          ...(identity.sciName ? { alternateName: identity.sciName } : {}),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: SITE_NAME,
            item: SITE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: identity.name,
            item: canonical,
          },
        ],
      },
    ],
  };

  const head = `
  <title>${escapedTitle}</title>
  <meta name="description" content="${escapedDescription}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${escapedCanonical}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:url" content="${escapedCanonical}">
  <meta property="og:image" content="${DEFAULT_IMAGE}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
  <meta name="twitter:image" content="${DEFAULT_IMAGE}">
  <script type="application/ld+json" id="speciesStructuredData">${safeJson(structuredData)}</script>`;

  const shell = `  <div id="pageContent">
    <main class="species-loading-shell">
      <a href="/" class="back">&larr; Michigan Birding Report</a>
      <h1>${escapedName}</h1>
      ${identity.sciName ? `<p class="species-sci">${escapedSciName}</p>` : ''}
      <p>Explore ${escapedName} identification, habitat, seasonal activity, and recent eBird sightings across Michigan.</p>
      <div class="loading-spinner" aria-hidden="true"></div>
      <p class="loading-status" role="status">Loading the live species profile and recent sightings&hellip;</p>
    </main>
  </div>`;

  const seed = `<script>window.__SPECIES_IDENTITY__=${safeJson(identity)};</script>\n  <script>`;

  let html = replaceRequired(
    template,
    '  <title>Species Profile: Michigan Birding Report</title>',
    head
  );
  html = replaceRequired(
    html,
    `  <div id="pageContent">
    <div class="loading-page">
      <div class="loading-spinner"></div>
      <p>Loading species profile...</p>
    </div>
  </div>`,
    shell
  );
  html = replaceRequired(html, '  <script>\n  (function() {', `  ${seed}\n  (function() {`);

  return html;
}

function renderSpeciesErrorPage(statusCode, heading, message) {
  const title = `${heading}: ${SITE_NAME}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="robots" content="noindex, follow">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="loading-page">
    <p>${statusCode}</p>
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(message)}</p>
    <p><a href="/">Return to Michigan Birding Report</a></p>
  </main>
</body>
</html>`;
}

module.exports = {
  getSpeciesMetadata,
  renderSpeciesErrorPage,
  renderSpeciesPage,
};
