const assert = require('assert');
const helpers = require('./helpers/helpers.js');
const libHelpers = require('../lib/helpers.js');

const closeAll = helpers.closeAll;
const testTypes = helpers.testTypes;
const createServer = helpers.createServer;
const createHotShotsClient = helpers.createHotShotsClient;

describe('#globalTags', () => {
  let server;
  let statsd;

  afterEach(done => {
    closeAll(server, statsd, false, done);
    delete process.env.DD_ENTITY_ID;
    delete process.env.DD_ENV;
    delete process.env.DD_SERVICE;
    delete process.env.DD_VERSION;
  });

  testTypes().forEach(([description, serverType, clientType, metricEnd]) => {
    describe(description, () => {
      it('should not add global tags if they are not specified', done => {
        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(opts, clientType);
          statsd.increment('test');
        });
        server.on('metrics', metrics => {
          assert.strictEqual(metrics, `test:1|c${metricEnd}`);
          done();
        });
      });

      it('should add global tags if they are specified', done => {
        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(Object.assign(opts, {
            global_tags: ['gtag'],
          }), clientType);
          statsd.increment('test');
        });
        server.on('metrics', metrics => {
          assert.strictEqual(metrics, `test:1|c|#gtag${metricEnd}`);
          done();
        });
      });

      it('should add global tags from DD_ prefixed env vars', done => {
        // set DD_ prefixed env vars
        process.env.DD_ENTITY_ID = '04652bb7-19b7-11e9-9cc6-42010a9c016d';
        process.env.DD_ENV = 'test';
        process.env.DD_SERVICE = 'test-service';
        process.env.DD_VERSION = '1.0.0';

        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(Object.assign(opts, {
            global_tags: ['gtag'],
          }), clientType);
          statsd.increment('test');
        });
        server.on('metrics', metrics => {
          assert.strictEqual(
            metrics,
            `test:1|c|#gtag,dd.internal.entity_id:04652bb7-19b7-11e9-9cc6-42010a9c016d,env:test,service:test-service,version:1.0.0${metricEnd}`
          );
          done();
        });
      });

      it('should combine global tags and metric tags', done => {
        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(Object.assign(opts, {
            global_tags: ['gtag:1', 'gtag:2', 'bar'],
          }), clientType);
          statsd.increment('test', 1337, ['foo']);
        });
        server.on('metrics', metrics => {
          assert.strictEqual(metrics, `test:1337|c|#gtag:1,gtag:2,bar,foo${metricEnd}`);
          done();
        });
      });

      it('only global tags - array, no metric tags', done => {
        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(Object.assign(opts, {
            global_tags: ['gtag:1', 'gtag:2', 'bar'],
          }), clientType);
          statsd.increment('test', 1337, {});
        });
        server.on('metrics', metrics => {
          assert.strictEqual(metrics, `test:1337|c|#gtag:1,gtag:2,bar${metricEnd}`);
          done();
        });
      });

      it('only global tags - object, no metric tags', done => {
        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(Object.assign(opts, {
            global_tags: { gtag: 1, gtagb: 2, }
          }), clientType);
          statsd.increment('test', 1337, {});
        });
        server.on('metrics', metrics => {
          assert.strictEqual(metrics, `test:1337|c|#gtag:1,gtagb:2${metricEnd}`);
          done();
        });
      });


      it('should override global tags with metric tags', done => {
        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(Object.assign(opts, {
            global_tags: ['foo', 'gtag:1', 'gtag:2'],
          }), clientType);
          statsd.increment('test', 1337, ['gtag:234', 'bar']);
        });
        server.on('metrics', metrics => {
          assert.strictEqual(metrics, `test:1337|c|#foo,gtag:234,bar${metricEnd}`);
          done();
        });
      });

      it('should format global tags', done => {
        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(Object.assign(opts, {
            globalTags: { gtag: '123', foo: 'bar' },
          }), clientType);
          statsd.increment('test', 1337, { gtag: '234' });
        });
        server.on('metrics', metrics => {
          assert.strictEqual(metrics, `test:1337|c|#foo:bar,gtag:234${metricEnd}`);
          done();
        });
      });

      it('should format tags using prefix', done => {
        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(Object.assign(opts, {
            globalTags: { gtag: '123', foo: 'bar' },
            tagPrefix: '~',
          }), clientType);
          statsd.increment('test', 1337, { gtag: '234' });
        });
        server.on('metrics', metrics => {
          assert.strictEqual(metrics, `test:1337|c|~foo:bar,gtag:234${metricEnd}`);
          done();
        });
      });

      it('should format tags using separator', done => {
        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(Object.assign(opts, {
            globalTags: { gtag: '123', foo: 'bar' },
            tagSeparator: '~',
          }), clientType);
          statsd.increment('test', 1337, { gtag: '234' });
        });
        server.on('metrics', metrics => {
          assert.strictEqual(metrics, `test:1337|c|#foo:bar~gtag:234${metricEnd}`);
          done();
        });
      });

      it('should format tags using prefix & separator', done => {
        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(Object.assign(opts, {
            globalTags: { gtag: '123', foo: 'bar' },
            tagPrefix: '~',
            tagSeparator: '~',
          }), clientType);
          statsd.increment('test', 1337, { gtag: '234' });
        });
        server.on('metrics', metrics => {
          assert.strictEqual(metrics, `test:1337|c|~foo:bar~gtag:234${metricEnd}`);
          done();
        });
      });

      it('should replace reserved characters with underscores in tags', done => {
        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(Object.assign(opts, {
            globalTags: { foo: 'b,a,r' },
          }), clientType);
          statsd.increment('test', 1337, { 'reserved:character': 'is@replaced@' });
        });
        server.on('metrics', metrics => {
          assert.strictEqual(metrics, `test:1337|c|#foo:b_a_r,reserved_character:is_replaced_${metricEnd}`);
          done();
        });
      });

      it('should add global tags using telegraf format when enabled', done => {
        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(Object.assign(opts, {
            globalTags: ['gtag:gvalue', 'gtag:gvalue2', 'gtag2:gvalue2'],
            telegraf: true,
          }), clientType);
          statsd.increment('test');
        });
        server.on('metrics', metrics => {
          assert.strictEqual(metrics, `test,gtag=gvalue,gtag=gvalue2,gtag2=gvalue2:1|c${metricEnd}`);
          done();
        });
      });

      it('should combine global tags and metric tags using telegraf format when enabled', done => {
        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(Object.assign(opts, {
            globalTags: ['gtag=gvalue'],
            telegraf: true,
          }), clientType);
          statsd.increment('test', 1337, ['foo:bar']);
        });
        server.on('metrics', metrics => {
          assert.strictEqual(metrics, `test,gtag=gvalue,foo=bar:1337|c${metricEnd}`);
          done();
        });
      });

      it('should format global key-value tags using telegraf format when enabled', done => {
        server = createServer(serverType, opts => {
          statsd = createHotShotsClient(Object.assign(opts, {
            globalTags: { gtag: 'gvalue' },
            telegraf: true,
          }), clientType);
          statsd.increment('test', 1337, { foo: 'bar' });
        });
        server.on('metrics', metrics => {
          assert.strictEqual(metrics, `test,gtag=gvalue,foo=bar:1337|c${metricEnd}`);
          done();
        });
      });
    });
  });
});

describe('#globalTags performance benchmarks', () => {
  function time(f, iterations, opName) {
    const startTime = process.hrtime.bigint();
    for (let i = 0; i < iterations; ++i) {
      f();
    }
    const endTime = process.hrtime.bigint();
    const elapsedMs = Number(endTime - startTime) / 1e6;
    console.log(opName + ' performance benchmark: %d ms', elapsedMs);

  }
  it('adhoc performance benchmark - overrideTags', () => {
    const globalTags = { gtag: '123', foo: 'bar', dfjkserhu: 'fasdfheasdf', sdfygthsf: 'asdfuhtbhadsf', aslfkah4thutuehtrheu: 'asdfhasuihetlhstjlkfsjlk;f' };
    const tags = { gtag: '234', asdfwer: 'weradfsdsf',  foo: 'bar', asfiehtjasdflksf: 'asdfkljfeuhtbasf', bbuhrewiuhfasknjasdflkjsdfjlksdfjlkafdsljkadsfjlkdfsjlkdfsjlfsjlkfdsjlkdsfjlkdsfjlkdfsljkadfshkaghk: 'asdfuhthb', asdfhjkasdfhjafsjlhfdsjlfd: 'ashdfhuaewrlhkjareshljkarshjklfdshklj', asflkjasdfhjhthiuatwekjhashfkjlf: 'asdfhhkuawrehljkatelhkjatslhkjfshlk' };
    const ITERATIONS = 100;

    const fakeMemo = JSON.stringify(globalTags);
    const formattedGlobalTags =  libHelpers.formatTags(globalTags, false);
    time(() => {
      libHelpers.overrideTags(formattedGlobalTags, tags, false);
    }, ITERATIONS, 'overrideTags');

    time(() => {
      libHelpers.overrideTags2(globalTags, tags, false);
    }, ITERATIONS, 'overrideTags2');

    time(() => {
      libHelpers.overrideTags5(globalTags, fakeMemo, tags, false);
    }, ITERATIONS, 'overrideTags5');
    time(() => {
      libHelpers.overrideTags3(globalTags, tags, false);
    }, ITERATIONS, 'overrideTags3');
    time(() => {
      libHelpers.overrideTags4(globalTags,  tags, false);
    }, ITERATIONS, 'overrideTags4');

  });
  it('adhoc performance benchmark - serializeTags', () => {
    const strings = ['ahsdf', 'asdfgyiaestiyaser', 'asf@fsadf', 'asdfkjlsdf,asdf'];
    const ITERATIONS = 1000000;

    time(() => {
      for (const x of strings) {
        libHelpers.sanitizeTags(x, false);
      }
    }, ITERATIONS, 'sanitizeTags');

    time(() => {
      for (const x of strings) {
        libHelpers.sanitizeTags2(x, false);
      }
    }, ITERATIONS, 'sanitizeTags2');
  });
  it('adhoc performance benchmark - string joins', () => {
    // const strings = ['ahsdf', 'asdfgyiaestiyaser', 'asf@fsadf', 'asdfkjlsdf,asdf', 'asdfkljserh', 'asdfhubgsdfhjfsd', 'abkjateghiufsdkhjf', 'giyasefhfdbh'];
    const fakeTags = { gtag: '123', foo: 'bar', dfjkserhu: 'fasdfheasdf', sdfygthsf: 'asdfuhtbhadsf', aslfkah4thutuehtrheu: 'asdfhasuihetlhstjlkfsjlk;f', asdfljhsdf: 'asdfjkhsghjastej' };
    const ITERATIONS = 1000000;

    time(() => {
      let arr = '';
      for (const x of Object.keys(fakeTags)) {
        arr = arr.concat(x);
      }
    }, ITERATIONS, 'string concat');
    time(() => {
      const arr = [];
      for (const x of Object.keys(fakeTags)) {
        arr.push(x);
      }
      const x = arr.join(',');
    }, ITERATIONS, 'arrayJoin');

  });
  it('adhoc performance benchmark - concat vs no concat', () => {
    // const strings = ['ahsdf', 'asdfgyiaestiyaser', 'asf@fsadf', 'asdfkjlsdf,asdf', 'asdfkljserh', 'asdfhubgsdfhjfsd', 'abkjateghiufsdkhjf', 'giyasefhfdbh'];
    // const fakeTags = { gtag: '123', foo: 'bar', dfjkserhu: 'fasdfheasdf', sdfygthsf: 'asdfuhtbhadsf', aslfkah4thutuehtrheu: 'asdfhasuihetlhstjlkfsjlk;f', asdfljhsdf: 'asdfjkhsghjastej' };
    const ITERATIONS = 1000000;

    time(() => {
      const x = 'asdfkljsflkjsadflkjsdfkljsdfa';
      const y = 'asdflkjfdljdfss' + x;
      if (y.length !== 44) {
        throw new Error('bad');
      }
    }, ITERATIONS, 'concat');
    time(() => {
      const y = 'asdflkjfdljdfssasdfkljsflkjsadflkjsdfkljsdfa';
      if (y.length !== 44) {
        throw new Error('bad');
      }
    }, ITERATIONS, 'no concat');
  });
  it('adhoc performance benchmark - concat vs no concat 2', () => {
    // const strings = ['ahsdf', 'asdfgyiaestiyaser', 'asf@fsadf', 'asdfkjlsdf,asdf', 'asdfkljserh', 'asdfhubgsdfhjfsd', 'abkjateghiufsdkhjf', 'giyasefhfdbh'];
    // const fakeTags = { gtag: '123', foo: 'bar', dfjkserhu: 'fasdfheasdf', sdfygthsf: 'asdfuhtbhadsf', aslfkah4thutuehtrheu: 'asdfhasuihetlhstjlkfsjlk;f', asdfljhsdf: 'asdfjkhsghjastej' };
    const ITERATIONS = 1000000;

    time(() => {
      const x = 'asdfkljsflkjsadflkjsdfkljsdfa';
      const y = 'asdflkjfdljdfss' + x;
      if (y.length !== 44) {
        throw new Error('bad');
      }
    }, ITERATIONS, 'concat');
  });
});
