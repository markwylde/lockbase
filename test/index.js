import lockbase from '../index.js';
import test from 'basictap';

test('remove wrong id', t => {
  t.plan(1);

  const locks = lockbase();

  t.notOk(locks.remove('not found'), 'lock could not be found');
});

test('top level lock works', async t => {
  t.plan(6);

  const locks = lockbase();

  const changeEvents = [];

  locks.on('change', item => {
    changeEvents.push(item);
  });

  locks.once('queue:insert', item => {
    t.deepEqual(item, {
      id: 1,
      path: 'users'
    }, 'queue:insert was emitted');
  });

  locks.once('queue:remove', item => {
    t.deepEqual(item, {
      id: 1,
      path: 'users'
    }, 'queue:remove was emitted');
  });

  locks.add('users').then(lock => {
    t.pass('locks.add resolved');

    setTimeout(() => locks.remove(lock));
  });

  locks.once('queue:insert', item => {
    t.deepEqual(item, {
      id: 2,
      path: 'users'
    }, 'queue.insert was emitted');
  });

  locks.add('users').then(lock => {
    t.pass('locks.add resolved');
    locks.remove(lock);
  });

  await t.waitFor(() => {
    t.deepEqual(changeEvents, [
      { eventName: 'queue:insert', item: { id: 1, path: 'users' } },
      { eventName: 'queue:insert', item: { id: 2, path: 'users' } },
      { eventName: 'queue:remove', item: { id: 1, path: 'users' } },
      { eventName: 'queue:remove', item: { id: 2, path: 'users' } }
    ]);
  });
});

test('list existing locks', async t => {
  t.plan(1);

  const locks = lockbase();

  locks.add('users1');
  locks.add('users2');

  const active = locks.queue.map(item => item.path);

  t.deepEqual(active, ['users1', 'users2']);
});

test('cancel all locks', async t => {
  t.plan(2);

  const locks = lockbase();

  locks.add('users1', { id: 1 });
  const lock2 = locks.add('users1', { id: 2 });

  lock2.catch(error => {
    t.equal(error.message, 'lockbase: all locks cancelled');
  });

  locks.cancel();

  t.deepEqual(locks.queue, []);
});

test('cancel all locks - custom error message', async t => {
  t.plan(2);

  const locks = lockbase();

  locks.add('users1', { id: 1 });
  const lock2 = locks.add('users1', { id: 2 });

  lock2.catch(error => {
    t.equal(error.message, 'boo');
  });

  locks.cancel(new Error('boo'));

  t.deepEqual(locks.queue, []);
});

test('cancel lock before add', async t => {
  t.plan(2);

  const locks = lockbase();

  locks.add('users1', { id: 1 });
  const lock2 = locks.add('users1', { id: 2 });

  lock2.catch(error => {
    t.equal(error.message, 'lockbase: wait cancelled');
  });

  lock2.cancel();

  t.deepEqual(locks.queue, [{
    id: 1,
    path: 'users1'
  }]);
});

test('cancel lock before add - with custom error message', async t => {
  t.plan(2);

  const locks = lockbase();

  locks.add('users1', { id: 1 });
  const lock2 = locks.add('users1', { id: 2 });

  lock2.catch(error => {
    t.equal(error.message, 'boo');
  });

  lock2.cancel(new Error('boo'));

  t.deepEqual(locks.queue, [{
    id: 1,
    path: 'users1'
  }]);
});

test('add lock with additional meta data', async t => {
  t.plan(1);

  const locks = lockbase();

  locks.add('users1', { id: 1, additional: 'info' });
  t.deepEqual(locks.queue, [{
    id: 1,
    additional: 'info',
    path: 'users1'
  }]);
});

test('top level lock with custom id works', t => {
  t.plan(2);

  const locks = lockbase();

  locks.add('users', { id: 'baz' }).then(lock => {
    t.pass();
    setTimeout(() => locks.remove('baz'));
  });
  locks.add('users').then(lock => {
    t.pass();
    locks.remove(lock);
  });
});

test('field based lock blocks', t => {
  t.plan(2);

  const locks = lockbase();

  locks.add('users.email').then(lock => {
    t.pass();
  });
  locks.add('users.one').then(lock => {
    t.pass();
    locks.remove(lock);
  });
  locks.add('users.email').then(lock => {
    t.fail();
  });
});

test('field based lock works', t => {
  t.plan(2);

  const locks = lockbase();

  locks.add('users.email').then(lock => {
    t.pass();
    locks.remove(lock);
  });
  locks.add('users.email').then(lock => {
    t.pass();
  });
});

test('find locks', t => {
  t.plan(2);

  const locks = lockbase();

  locks.add('users.email').then(lock => {
    const lockedBefore = locks.find('users.email');
    t.deepEqual(lockedBefore, [{
      id: lock,
      path: 'users.email'
    }]);

    locks.remove(lock);

    const lockedAfter = locks.find('users.email');
    t.deepEqual(lockedAfter, []);
  });
});

test('wait for locks', t => {
  t.plan(3);

  const locks = lockbase();
  let lockRemoved = false;

  locks.add('users.email').then(lock => {
    const lockedBefore = locks.find('users.email');
    t.deepEqual(lockedBefore, [{
      id: lock,
      path: 'users.email'
    }]);

    setTimeout(() => {
      lockRemoved = true;
      locks.remove(lock);

      const lockedAfter = locks.find('users.email');
      t.deepEqual(lockedAfter, []);
    });
  });

  locks.wait('users.email').then(lock => {
    if (!lockRemoved) {
      t.fail('lock was not actually removed');
    }
    t.pass('lock was removed then wait passed');
  });
});

test('multiple locks', t => {
  t.plan(4);

  const locks = lockbase();

  locks.add('users').then(lock => {
    t.pass();
    setTimeout(() => locks.remove(lock));
  });
  locks.add('users').then(lock => {
    t.pass();
    setTimeout(() => locks.remove(lock));
  });
  locks.add('users').then(lock => {
    t.pass();
    setTimeout(() => locks.remove(lock));
  });
  locks.add('users').then(lock => {
    t.pass();
    locks.remove(lock);
  });
});

test('locks wait', async t => {
  t.plan(1);

  const locks = lockbase();

  const lockId = await locks.add('users');

  let removed;
  setTimeout(() => {
    locks.remove(lockId);
    removed = true;
  });

  await locks.wait('users');

  if (!removed) {
    t.fail('did not wait until cancelled');
    return;
  }

  t.pass();
});

test('locks wait with ignore', async t => {
  t.plan(1);

  const locks = lockbase();

  const lockId = await locks.add('users');

  let removed;
  setTimeout(() => {
    locks.remove(lockId);
    removed = true;
  });

  await locks.wait('users', lockId);
  if (removed) {
    t.fail('should have resolved before removal');
    return;
  }

  t.pass();
});

test('locks wait with multiple ignores', async t => {
  t.plan(1);

  const locks = lockbase();

  const lockId = await locks.add('users');

  setTimeout(() => {
    locks.remove(lockId);
  });

  await locks.wait('users', [0, lockId]);

  t.pass();
});

test('manually mutate state - resolves missing locks', async t => {
  t.plan(2);

  const locks = lockbase();

  await locks.add('users');

  locks.add('users').then(() => {
    t.pass('second lock was applied');
  }).catch(() => {
    t.fail('second lock should not have failed');
  });

  locks.wait('users').then(() => {
    t.pass('wait was resolved');
  }).catch((error) => {
    t.equal(error.message, 'imported state did not hold lock');
  });

  locks.importState({
    incremental: 0,
    queue: []
  });
});

test('manually mutate state', async t => {
  t.plan(1);

  const locks = lockbase();

  await locks.add('users');

  locks.add('users').then(() => {
    t.pass('second lock was applied');
  });

  locks.add('users').then(() => {
    t.fail('second lock should never have been applied');
  });

  locks.wait('users').then(() => {
    t.fail('wait should never have resolved');
  });

  const exportedState = locks.exportState();
  locks.importState({
    queue: exportedState.queue.slice(1),
    incremental: exportedState.incremental
  });
});

test('single locks - multiple waits', async t => {
  t.plan(2);

  const locks = lockbase();

  const lock = await locks.add('users');

  locks.wait('users').then(() => t.pass('first wait was resolved'));
  locks.wait('users').then(() => t.pass('second wait was resolved'));

  locks.remove(lock);
});

test('wait cancelled', async t => {
  t.plan(1);

  const locks = lockbase();

  await locks.add('users.email');

  const wait = locks.wait('users.email');
  wait.catch((error) => {
    t.equal(error.message, 'lockbase: wait cancelled');
  });
  wait.cancel();
});

test('wait cancelled does not throw if not set', async t => {
  t.plan(1);

  const locks = lockbase();

  const lockId = await locks.add('users.email');

  setTimeout(() => {
    locks.remove(lockId);
  }, 200);

  const wait = locks.wait('users.email');
  wait.then(() => {
    t.pass('wait was resolved');
  });

  locks.importState({
    queue: [
      { id: lockId, path: 'users.email' }
      // { id: 2, path: 'users.email' }
    ],
    incremental: 2
  });
});

test('wait cancelled with custom error', async t => {
  t.plan(1);

  const locks = lockbase();

  await locks.add('users.email');

  const wait = locks.wait('users.email');
  wait.catch((error) => {
    t.equal(error.message, 'some unknown reason');
  });
  wait.cancel(new Error('some unknown reason'));
});

test('locks being waited fail when cancelled', t => {
  t.plan(1);

  const locks = lockbase();

  locks.add('users.email').then(lock => {
    setTimeout(() => {
      locks.cancel();
    });
  });

  locks.wait('users.email')
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

  locks.add('users.email').then(lock => {
    setTimeout(() => {
      locks.cancel(new Error('why?'));
    });
  });

  locks.wait('users.email')
    .then(lock => {
      t.fail('should not have passed successfully');
    })
    .catch(error => {
      t.equal(error.message, 'why?');
    });
});

test('emit events after multiple locks added', async t => {
  t.plan(3);

  const locks = lockbase();

  locks.once('resolved.one', () => {
    t.pass('resolved first lock');
  });

  locks.once('resolved.two', () => {
    t.pass('resolved second lock');
  });

  locks.add('users.email', { id: 'one' });
  locks.add('users.email', { id: 'two' }).then(() => {
    t.pass('second lock took priority');
    locks.remove('two');
  });

  locks.remove('one');
});

test('locks being waited remain when reimported', async t => {
  t.plan(5);

  const locks = lockbase();

  locks.once('resolved.one', () => {
    t.pass('resolved first lock');
  });

  locks.once('resolved.two', () => {
    t.pass('resolved second lock');
  });

  locks.add('users.email', { id: 'one' }).then(() => {
    t.pass('first lock took priority');
  });
  locks.add('users.email', { id: 'two' }).then(() => {
    t.pass('second lock took priority');
    locks.remove('two');
  });

  locks.wait('users.email')
    .then(lock => {
      t.pass('wait was released');
    });

  locks.importState(
    // stringified to lose any state
    JSON.parse(JSON.stringify(locks.exportState()))
  );

  locks.remove('one');
});

test('isLockActive - empty queue', t => {
  const isActive = lockbase.isLockActive({
    queue: []
  }, null);
  t.equal(isActive, true);
});
