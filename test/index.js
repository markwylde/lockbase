const lockbase = require('../');
const test = require('tape');

require('./doesLockExist');

test('top level lock works', t => {
  t.plan(2);

  const locks = lockbase();

  locks.add(['users']).then(lock => {
    t.pass();
    setTimeout(() => locks.remove(lock), 500);
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
    setTimeout(() => locks.remove(1), 500);
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
    t.ok(lockedBefore);

    locks.remove(lock);

    const lockedAfter = locks.check(['users.email']);
    t.notOk(lockedAfter);
  });
});
