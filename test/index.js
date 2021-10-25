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

test('list existing locks', async t => {
  t.plan(1);

  const locks = lockbase();

  locks.add(['users1', 'more2']);
  locks.add(['users2', 'users2']);
  locks.add(['users2', 'users2']);
  locks.add(['users3']);

  t.deepEqual(locks.active, ['users1', 'more2', 'users2', 'users3']);
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

test('locks wait with ignore', async t => {
  t.plan(1);

  const locks = lockbase();

  const lockId = await locks.add(['users']);

  setTimeout(() => {
    locks.remove(lockId);
  }, 100);

  await locks.wait(['users'], { ignore: [lockId] });

  t.pass();
});

test('locks wait with multiple ignores', async t => {
  t.plan(1);

  const locks = lockbase();

  const lockId = await locks.add(['users']);

  setTimeout(() => {
    locks.remove(lockId);
  }, 100);

  await locks.wait(['users'], { ignore: [0, lockId] });

  t.pass();
});

test('manually mutate state', t => {
  t.plan(1);

  const locks = lockbase();

  locks.locks = [
    ['2401685e-77ef-423a-9ad6-bd4b8db1af80', ['users']]
  ];

  locks.wait(['users']).then(() => t.pass('first wait was resolved'));

  locks.setLocks([]);
});

test('single locks - multiple waits', async t => {
  t.plan(2);

  const locks = lockbase();

  const lock = await locks.add(['users']);

  locks.wait(['users']).then(() => t.pass('first wait was resolved'));
  locks.wait(['users']).then(() => t.pass('second wait was resolved'));

  locks.remove(lock);
});

test('wait cancelled', async t => {
  t.plan(1);

  const locks = lockbase();

  await locks.add(['users.email']);

  const wait = locks.wait(['users.email']);
  wait.catch((error) => {
    t.equal(error.message, 'lockbase: wait cancelled');
  });
  wait.cancel();
});

test('wait cancelled with custom error', async t => {
  t.plan(1);

  const locks = lockbase();

  await locks.add(['users.email']);

  const wait = locks.wait(['users.email']);
  wait.catch((error) => {
    t.equal(error.message, 'some unknown reason');
  });
  wait.cancel(new Error('some unknown reason'));
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
      t.equal(error.message, 'lockbase: all locks cancelled');
    });
});

test('locks being waited fail when cancelled with custom error', t => {
  t.plan(1);

  const locks = lockbase();

  locks.add(['users.email']).then(lock => {
    setTimeout(() => {
      locks.cancel(new Error('why?'));
    }, 100);
  });

  locks.wait(['users.email'])
    .then(lock => {
      t.fail('should not have passed successfully');
    })
    .catch(error => {
      t.equal(error.message, 'why?');
    });
});
