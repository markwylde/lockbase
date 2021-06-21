const findExistingLocks = require('../findExistingLocks');
const test = require('basictap');

test('findExistingLocks -> exact lock exists works', t => {
  t.plan(1);

  const exists = findExistingLocks([
    ['1', ['users.email']]
  ], 'users.email');

  t.ok(exists);
});

test('findExistingLocks -> partial lock exists works', t => {
  t.plan(1);

  const exists = findExistingLocks([
    ['1', ['users']]
  ], 'users.email');

  t.ok(exists);
});

test('findExistingLocks -> partial lock different field', t => {
  t.plan(1);

  const exists = findExistingLocks([
    ['1', ['users.email']]
  ], 'users.name');

  t.notOk(exists);
});

test('findExistingLocks -> partial lock different table', t => {
  t.plan(1);

  const exists = findExistingLocks([
    ['1', ['members.email']]
  ], 'users.email');

  t.notOk(exists);
});
