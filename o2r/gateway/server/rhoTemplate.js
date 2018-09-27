// @flow strict

const { RHOCore } = require('rchain-api');
const { fromJSData, toRholang } = RHOCore;

/**
 * Rholang template string interpolation.
 * ISSUE: belongs in rchain-api's RHOCore.js
 */
// @flow strict
module.exports.rho = rho;
function rho(template /*: string[] */, ...subs /*: Json[] */) {
  const encoded = subs.map(it => toRholang(fromJSData(it)));

  const out = [];
  template.forEach((part, ix) => {
    out.push(part);
    out.push(encoded[ix]);
  });

  return out.join('');
}
