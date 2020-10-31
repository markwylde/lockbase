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
