const lockbase = require('../');
const test = require('basictap');

require('./findExistingLocks');

test('remove wrong id', t => {
  t.plan(1);

  const locks = lockbase();
  t.notOk(locks.remove('not found'), 'lock could not be found');
});

test('top level lock works', t => {
  t.plan(2);

  const locks = lockbase();

  locks.add(['users']).then(lock => {
    t.pass();
    setTimeout(() => locks.remove(lock), 100);
  });
  locks.add(['users']).then(lock => {
    t.pass();
    locks.remove(lock);
  });
});

test('top level lock with custom id works', t => {
  t.plan(2);

  const locks = lockbase();

  locks.add(['users'], 1).then(lock => {
    t.pass();
    setTimeout(() => locks.remove(1), 100);
  });
  locks.add(['users']).then(lock => {
    t.pass();
    locks.remove(lock);
  });
});

test('field based lock blocks', t => {
  t.plan(2);

  const locks = lockbase();

  locks.add(['users.email']).then(lock => {
    t.pass();
  });
  locks.add(['users.one']).then(lock => {
    t.pass();
    locks.remove(lock);
  });
  locks.add(['users.email']).then(lock => {
    t.fail();
  });
});

test('field based lock works', t => {
  t.plan(2);

  const locks = lockbase();

  locks.add(['users.email']).then(lock => {
    t.pass();
    locks.remove(lock);
  });
  locks.add(['users.email']).then(lock => {
    t.pass();
  });
});

test('check for locks', t => {
  t.plan(2);

  const locks = lockbase();

  locks.add(['users.email']).then(lock => {
    const lockedBefore = locks.check(['users.email']);
    t.deepEqual(lockedBefore, [
      lock,
      ['users.email']
    ]);

    locks.remove(lock);

    const lockedAfter = locks.check(['users.email']);
    t.notOk(lockedAfter);
  });
});

test('wait for locks', t => {
  t.plan(3);

  const locks = lockbase();
  let lockRemoved = false;

  locks.add(['users.email']).then(lock => {
    const lockedBefore = locks.check(['users.email']);
    t.deepEqual(lockedBefore, [
      lock,
      ['users.email']
    ]);

    lockRemoved = true;
    locks.remove(lock);

    const lockedAfter = locks.check(['users.email']);
    t.notOk(lockedAfter, 'no longer locked');
  });

  locks.wait(['users.email']).then(lock => {
    if (!lockRemoved) {
      t.fail('lock was not actually removed');
    }
    t.pass('lock was removed then wait passed');
  });
});

test('multiple locks', t => {
  t.plan(4);

  const locks = lockbase();

  locks.add(['users']).then(lock => {
    t.pass();
    setTimeout(() => locks.remove(lock), 100);
  });
  locks.add(['users']).then(lock => {
    t.pass();
    setTimeout(() => locks.remove(lock), 100);
  });
  locks.add(['users']).then(lock => {
    t.pass();
    setTimeout(() => locks.remove(lock), 100);
  });
  locks.add(['users']).then(lock => {
    t.pass();
    locks.remove(lock);
  });
});

test('single locks - multiple waits', async t => {
  t.plan(2);

  const locks = lockbase();

  const lock = await locks.add(['users']);

  locks.wait(['users']).then(() => t.pass('first wait was resolved'));
  locks.wait(['users']).then(() => t.pass('second wait was resolved'));

  locks.remove(lock);
});

test('locks cancelled', async t => {
  t.plan(1);

  const locks = lockbase();

  await locks.add(['users.email']);

  const wait = locks.wait(['users.email']);
  wait.catch((error) => {
    t.equal(error.message, 'lockbase: wait cancelled');
  });
  wait.cancel();
});

test('locks being waited fail when cancelled', t => {
  t.plan(1);

  const locks = lockbase();

  locks.add(['users.email']).then(lock => {
    setTimeout(() => {
      locks.cancel();
    }, 100);
  });

  locks.wait(['users.email'])
    .then(lock => {
      t.fail('should not have passed successfully');
    })
    .catch(error => {
      t.equal(error.message, 'lockbase: locks where cancelled');
    });
});
