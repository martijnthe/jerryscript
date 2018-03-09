// Copyright JS Foundation and other contributors, http://js.foundation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { ChromeDevToolsProxyServer } from '../lib/cdt-proxy';
import { JerryDebuggerClient } from '../lib/debugger-client';
import parseArgs from 'minimist';

/**
 * Converts string of format [host:][port] to an object with host and port,
 * each possibly undefined
 */
function getHostAndPort(input: string) {
  const hostAndPort = input.split(':');
  const portIndex = hostAndPort.length - 1;
  const host = hostAndPort[portIndex - 1];
  const port = hostAndPort[portIndex];
  return {
    host: host ? host : undefined,
    port: port ? Number(port) : undefined,
  };
}

export function getOptionsFromArgs(argv: Array<string>) {
  const args = parseArgs(argv, {
    default: {
      'verbose': false,
      'inspect-brk': '',
      'jerry-remote': '',
    },
    alias: {
      'verbose': 'v',
    },
    boolean: [
      'verbose',
    ],
    string: [
      'inspect-brk',
      'jerry-remote',
    ],
  });

  return {
    proxyAddress: getHostAndPort(args['inspect-brk']),
    remoteAddress: getHostAndPort(args['jerry-remote']),
    jsfile: args._[0] || 'untitled.js',
    verbose: args['verbose'],
  };
}

export function main(proc: NodeJS.Process) {
  const options = getOptionsFromArgs(proc.argv.slice(2));
  const jdebug = new JerryDebuggerClient(options.remoteAddress);
  const debuggerUrl = `ws://${jdebug.host}:${jdebug.port}`;
  jdebug.connect().then(() => {
    console.log(`Connected to debugger at ${debuggerUrl}`);
    const proxy = new ChromeDevToolsProxyServer({
      ...options.proxyAddress,
      jsfile: options.jsfile,
      debugger: jdebug,
    });
    console.log(`Proxy listening at ws://${proxy.host}:${proxy.port}`);
  }).catch((err) => {
    console.log(`Error connecting to debugger at ${debuggerUrl}`);
    console.log(err);
  });
}
