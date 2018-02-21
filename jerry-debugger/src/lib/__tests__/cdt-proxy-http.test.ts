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

import { onHttpRequest } from '../cdt-proxy-http';

describe('onHttpRequest', () => {
  let endCalled = false;
  let jsonResult: string;
  const obj = {
    host: '127.0.0.1',
    port: 9229,
  };
  const response = {
    statusCode: 200,
    setHeader: () => {},
    end: () => {
      endCalled = true;
    },
    write: (json: string) => {
      jsonResult = json;
    }
  };

  it('responds to POST with 405', () => {
    endCalled = false;
    const request = {};
    onHttpRequest.bind(obj)(request, response);
    expect(response.statusCode).toEqual(405);
    expect(endCalled).toEqual(true);
  });

  it('responds to unexpected path with 404', () => {
    endCalled = false;
    const request = {
      method: 'GET',
      url: '/foo',
    };
    onHttpRequest.bind(obj)(request, response);
    expect(response.statusCode).toEqual(404);
    expect(endCalled).toEqual(true);
  });

  it('responds to version query with JSON', () => {
    endCalled = false;
    const request = {
      method: 'GET',
      url: '/json/version',
    };
    onHttpRequest.bind(obj)(request, response);
    expect(response.statusCode).toEqual(200);
    expect(endCalled).toEqual(true);
  });
});
