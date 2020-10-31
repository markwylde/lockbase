const doesLockExist = require('../doesLockExist');
const tape = require('tape');

tape('doesLockExist -> exact lock exists works', t => {
  t.plan(1);

  const exists = doesLockExist([
    ['1', ['users.email']]
  ], 'users.email');

  t.ok(exists);
});

tape('doesLockExist -> partial lock exists works', t => {
  t.plan(1);

  const exists = doesLockExist([
    ['1', ['users']]
  ], 'users.email');

  t.ok(exists);
});

tape('doesLockExist -> partial lock different field', t => {
  t.plan(1);

  const exists = doesLockExist([
    ['1', ['users.email']]
  ], 'users.name');

  t.notOk(exists);
});

tape('doesLockExist -> partial lock different table', t => {
  t.plan(1);

  const exists = doesLockExist([
    ['1', ['members.email']]
  ], 'users.email');

  t.notOk(exists);
});
