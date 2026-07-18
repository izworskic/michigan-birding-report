'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getTaxonomy } = require('../lib/ebird');
const { SpeciesIdentityError, resolveSpeciesIdentity } = require('../lib/species-identity');
const { renderSpeciesErrorPage, renderSpeciesPage } = require('../lib/species-page');

let speciesTemplate;

function getSpeciesTemplate() {
  if (!speciesTemplate) {
    speciesTemplate = fs.readFileSync(
      path.join(process.cwd(), 'public', 'species.html'),
      'utf8'
    );
  }

  return speciesTemplate;
}

function sendHtml(res, statusCode, html, cacheControl) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  return res.status(statusCode).send(html);
}

module.exports = async (req, res) => {
  try {
    // Resolve from the route code rather than user-supplied name parameters so
    // titles and metadata always come from the authoritative taxonomy.
    const identity = await resolveSpeciesIdentity({ code: req.query?.code }, getTaxonomy);
    const html = renderSpeciesPage(getSpeciesTemplate(), identity);

    return sendHtml(
      res,
      200,
      html,
      'public, s-maxage=86400, stale-while-revalidate=604800'
    );
  } catch (error) {
    if (error instanceof SpeciesIdentityError) {
      const notFound = error.statusCode === 404;
      return sendHtml(
        res,
        error.statusCode,
        renderSpeciesErrorPage(
          error.statusCode,
          notFound ? 'Species not found' : 'Invalid species page',
          notFound
            ? 'That species could not be found in the eBird taxonomy.'
            : 'A valid eBird species code is required.'
        ),
        'public, s-maxage=300, stale-while-revalidate=600'
      );
    }

    console.error('Species page error:', error);
    return sendHtml(
      res,
      503,
      renderSpeciesErrorPage(
        503,
        'Species profile temporarily unavailable',
        'Please try this species page again shortly.'
      ),
      'no-store'
    );
  }
};
