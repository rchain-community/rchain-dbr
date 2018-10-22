/** keyPair -- ed25519 signing keys as Capper persistent objects

    key parts (publicKey, seed) are persisted in hex, which
    should integrate nicely with rho:pubkey:ed25519:xxxxx.

*/
// @flow strict

// for customizing the way objects appear in logs
// ref https://nodejs.org/api/util.html#util_custom_inspection_functions_on_objects
// ack: https://stackoverflow.com/a/46870568
const inspect = require('util').inspect;

const rchain = require('../../lib/rchain-api/rnodeAPI');
const { once } = require('../../capper_start');

/*::  // ISSUE: belongs in rchain-api?

export opaque type Hex<T> = string;
export opaque type Signature = Uint8Array;
export opaque type PublicKey = Uint8Array;

export interface SigningKey {
 signBytes(message: Uint8Array): Signature,
 signBytesHex(message: Uint8Array): Hex<Signature>,
 signText(text: string): Signature,
 signTextHex(text: string): Hex<Signature>,
 publicKey(): Hex<PublicKey>,
 label(): string,
};


*/

/*::
import type { Persistent, Context } from '../../capper_start';

export interface DataSigningKey extends SigningKey {
 signDataHex(data: mixed): Hex<Signature>, // ISSUE: belongs in rchain-api?
};

interface KeyP extends Persistent, DataSigningKey {
 init(label: mixed): void,
}

type KeyGenPowers = {
 randomBytes(number): Uint8Array
}
*/

const { RHOCore, b2h, h2b, verify } = rchain;
const { fromJSData, toByteArray } = RHOCore;
const def = Object.freeze; // cf. ocap design note


module.exports.appFactory = appFactory;
function appFactory({ randomBytes } /*: KeyGenPowers */) {
  return def({ keyPair });

  function keyPair(context /*: Context<*> */) {
    const state = context.state;

    function init(label /*: string*/) {
      once(state);
      const seed = randomBytes(32);
      const key = rchain.keyPair(seed);

      state.label = label;
      state.publicKey = key.publicKey();
      state.seed = b2h(seed);
    }

    const toString = () => `<keyPair ${state.label}: ${state.publicKey.substring(0, 12)}...>`;

    return def({
      init,
      toString,
      signBytes: bytes => getKey().signBytes(bytes),
      signBytesHex: bytes => getKey().signBytesHex(bytes),
      signText: text => getKey().signText(text),
      signTextHex: text => getKey().signTextHex(text),
      signDataHex: item => getKey().signBytesHex(toByteArray(fromJSData(item))),
      publicKey: () => state.publicKey,
      label: () => state.label,
      [inspect.custom]: toString,
    });

    function getKey() {
      return rchain.keyPair(h2b(state.seed));
    }
  }
}


exports.verifyDataSigHex = verifyDataSigHex;
function verifyDataSigHex(data, sigHex, pubKeyHex) {
  const message = toByteArray(fromJSData(data));
  console.log({ sigHex, pubKeyHex, dataHex: b2h(message) });
  return verify(message, h2b(sigHex), h2b(pubKeyHex));
}


function integrationTest({ randomBytes }) {
  const kpApp = appFactory({ randomBytes });

  // $FlowFixMe: too lazy to stub drop, make
  const context1 /*: Context<*> */ = { state: {} };
  const pair1 = kpApp.keyPair(context1);
  pair1.init('k1');
  console.log('inspect keyPair:', pair1);
  console.log('keyPair.toString():', pair1.toString());
  console.log('public key:', pair1.publicKey());
  console.log('signature:', pair1.signTextHex('hello world'));
}


if (require.main === module) {
  // ocap: Import powerful references only when invoked as a main module.
  /* eslint-disable global-require */
  integrationTest({ randomBytes: require('crypto').randomBytes });
}
