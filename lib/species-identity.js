'use strict';

class SpeciesIdentityError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'SpeciesIdentityError';
    this.statusCode = statusCode;
  }
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanText(value, maxLength) {
  const text = firstQueryValue(value);
  return typeof text === 'string' ? text.trim().slice(0, maxLength) : '';
}

async function resolveSpeciesIdentity(query, getTaxonomy) {
  const code = cleanText(query?.code, 20).toLowerCase();
  const suppliedName = cleanText(query?.name, 120);
  const suppliedSciName = cleanText(query?.sci, 160);

  if (!code || !/^[a-z0-9]+$/.test(code)) {
    throw new SpeciesIdentityError('A valid species code is required', 400);
  }

  // Preserve existing named links without adding a new upstream dependency.
  if (suppliedName) {
    return { code, name: suppliedName, sciName: suppliedSciName };
  }

  const taxonomy = await getTaxonomy({ species: code });
  const match = Array.isArray(taxonomy)
    ? taxonomy.find((species) => species?.speciesCode === code)
    : null;

  if (!match?.comName) {
    throw new SpeciesIdentityError('Species not found', 404);
  }

  return {
    code,
    name: match.comName,
    sciName: match.sciName || '',
  };
}

module.exports = {
  SpeciesIdentityError,
  resolveSpeciesIdentity,
};
