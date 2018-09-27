/** capper_start
 *
 * ISSUE: this belongs in the capper library.
 */
// @flow strict
// $FlowFixMe
const Capper = require('Capper');

/*::
type DropCommand = {|
  drop: true,
  WEBKEY: string,
|}
type MakeCommand = {|
  make: true,
  REVIVER: string,
  ARG: string[],
|}
type PostCommand = {|
  post: true,
  WEBKEY: string,
  METHOD: string,
  ARG: string[],
|}
export type CLI = DropCommand | MakeCommand | PostCommand;

export type Sturdy = {
  idToWebkey(id: Id): string,
  vowAnsToVowJSONString(v: Promise<mixed>): Promise<string>,
  webkeyToLive(k: mixed): mixed,
  wkeyStringToLive(ks: string): mixed,
};

export type Config = {
  domain: string,
  port: number
};

export type Context<S> = {
  drop(): void,
  state: S,
  make<T>(objectSpec: string, ...args: mixed[]): T,
};

export interface Persistent {
  init(...args: mixed[]): void
}

 */


exports.command = command;
/**
 * Handle make / drop / post commands.
 *
 * @return true if cli command was handled; false if there was no
 *         command, which indicates the server should be started.
 */
function command(cli /*: CLI*/, config /*: Config */, saver /*: Saver */, sturdy /*: Sturdy */) {
    const parseArg = Capper.caplib.makeParseArg(sturdy.wkeyStringToLive);

    if (cli.drop) {
        saver.drop(saver.credToId(parseArg(cli.WEBKEY)));
        saver.checkpoint().then(() => console.log("drop done"));
    } else if (cli.make){
        const obj /*: Id */ = saver.make(cli.REVIVER, ...cli.ARG.map(parseArg))
        if (!obj) {console.error("cannot find maker " + cli["REVIVER"]); return true;}
        saver.checkpoint().then(
            () => console.log(sturdy.idToWebkey(saver.asId(obj)))
        ).done();
    } else if (cli.post) {
        const rx = sturdy.wkeyStringToLive(cli.WEBKEY.substring(1));
        if (typeof rx !== "object") {
            console.error("bad target object webkey; forget '@'?");
        } else {
            const vowAns = saver.deliver(saver.asId(rx), cli.METHOD, ...cli.ARG.map(parseArg));
            sturdy.vowAnsToVowJSONString(vowAns).then(
                answer => console.log(answer));
        }
    } else {
        return false;
    }
    
    return true;
}


exports.makeReviver = makeReviver;
function makeReviver(apps /*: { [string]: { [string]: mixed } } */) /*: Reviver */ {
    function check(name, cond) {
        if (!cond) {
            console.log('cannot revive', name);
            throw new Error(name);
        }
    }
    
    function parseName(name) {
        const parts = name.split('.');
        check(name, parts.length == 2);
        return { app: parts[0], method: parts[1] };
    }

    return Object.freeze({
        toMaker: (name) => {
	    // console.log('DEBUG Reviver.toMaker:', name);
            const n = parseName(name);
	    // console.log('DEBUG Reviver.toMaker:', n);
            const maker = apps[n.app][n.method];
	    // console.log('DEBUG Reviver.toMaker:', maker);
            check(name, maker);
            return maker;
        },
        sendUI: (res, name, path) => {
            if (path) {
                res.sendfile(`${__dirname}/${name}/ui/${path}`);
            } else {
                const n = parseName(name);
                res.sendfile(`${__dirname}/${n.app}/ui/${n.method}.html`);
            }
        }
    });
}

module.exports.once = once;
function once/*:: <T: {}>*/(state/*: T | {| |}*/) /*: void*/{
  if (Object.keys(state).length > 0) { throw new TypeError('do not call init() more than once.'); }
}

/**
 * persisted
 * ISSUE: not typesafe. Assumes de-serialized data is of the right type.
 */
module.exports.persisted = persisted;
function persisted/*:: <T>*/(something /*: mixed*/) /*: T*/ {
  // $FlowFixMe
  return ((something/*: any*/)/*: T*/);
}
