import lockbase from '../index.js';
import test from 'node:test';
import assert from 'node:assert/strict';

test('remove wrong id', async t => {
  const locks = lockbase();

  assert.equal(locks.remove('not found'), undefined, 'lock could not be found');
});

test('top level lock works', async t => {
  const locks = lockbase();
  const changeEvents = [];

  locks.on('change', item => {
    changeEvents.push(item);
  });

  let queueInsertCalled = 0;
  let queueRemoveCalled = 0;

  locks.once('queue:insert', item => {
    assert.deepEqual(item, {
      id: 1,
      path: 'users'
    }, 'queue:insert was emitted');
    queueInsertCalled++;
  });

  locks.once('queue:remove', item => {
    assert.deepEqual(item, {
      id: 1,
      path: 'users'
    }, 'queue:remove was emitted');
    queueRemoveCalled++;
  });

  const lock1 = await locks.add('users');
  assert.ok(lock1, 'locks.add resolved');

  setTimeout(() => locks.remove(lock1));

  locks.once('queue:insert', item => {
    assert.deepEqual(item, {
      id: 2,
      path: 'users'
    }, 'queue.insert was emitted');
    queueInsertCalled++;
  });

  const lock2 = await locks.add('users');
  assert.ok(lock2, 'locks.add resolved');
  locks.remove(lock2);

  // Wait for all events to complete
  await new Promise(resolve => {
    const checkEvents = () => {
      if (changeEvents.length === 4) {
        resolve();
      } else {
        setTimeout(checkEvents, 10);
      }
    };
    checkEvents();
  });

  assert.deepEqual(changeEvents, [
    { eventName: 'queue:insert', item: { id: 1, path: 'users' } },
    { eventName: 'queue:insert', item: { id: 2, path: 'users' } },
    { eventName: 'queue:remove', item: { id: 1, path: 'users' } },
    { eventName: 'queue:remove', item: { id: 2, path: 'users' } }
  ]);
});

test('list existing locks', async t => {
  const locks = lockbase();

  locks.add('users1');
  locks.add('users2');

  const active = locks.queue.map(item => item.path);

  assert.deepEqual(active, ['users1', 'users2']);
});

test('cancel all locks', async t => {
  const locks = lockbase();

  locks.add('users1', { id: 1 });
  const lock2 = locks.add('users1', { id: 2 });

  lock2.catch(error => {
    assert.equal(error.message, 'lockbase: all locks cancelled');
  });

  locks.cancel();

  assert.deepEqual(locks.queue, []);
});

test('cancel all locks - custom error message', async t => {
  const locks = lockbase();

  locks.add('users1', { id: 1 });
  const lock2 = locks.add('users1', { id: 2 });

  lock2.catch(error => {
    assert.equal(error.message, 'boo');
  });

  locks.cancel(new Error('boo'));

  assert.deepEqual(locks.queue, []);
});

test('cancel lock before add', async t => {
  const locks = lockbase();

  locks.add('users1', { id: 1 });
  const lock2 = locks.add('users1', { id: 2 });

  lock2.catch(error => {
    assert.equal(error.message, 'lockbase: wait cancelled');
  });

  lock2.cancel();

  assert.deepEqual(locks.queue, [{
    id: 1,
    path: 'users1'
  }]);
});

test('cancel lock before add - with custom error message', async t => {
  const locks = lockbase();

  locks.add('users1', { id: 1 });
  const lock2 = locks.add('users1', { id: 2 });

  lock2.catch(error => {
    assert.equal(error.message, 'boo');
  });

  lock2.cancel(new Error('boo'));

  assert.deepEqual(locks.queue, [{
    id: 1,
    path: 'users1'
  }]);
});

test('add lock with additional meta data', async t => {
  const locks = lockbase();

  locks.add('users1', { id: 1, additional: 'info' });
  assert.deepEqual(locks.queue, [{
    id: 1,
    additional: 'info',
    path: 'users1'
  }]);
});

test('top level lock with custom id works', async t => {
  const locks = lockbase();
  let lock1Resolved = false;
  let lock2Resolved = false;

  locks.add('users', { id: 'baz' }).then(lock => {
    lock1Resolved = true;
    setTimeout(() => locks.remove('baz'));
  });

  locks.add('users').then(lock => {
    lock2Resolved = true;
    locks.remove(lock);
  });

  // Wait for promises to resolve
  await new Promise(resolve => {
    const check = () => {
      if (lock1Resolved && lock2Resolved) {
        resolve();
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });

  assert.ok(lock1Resolved);
  assert.ok(lock2Resolved);
});

test('field based lock blocks', async t => {
  const locks = lockbase();
  let lock1Resolved = false;
  let lock2Resolved = false;
  let lock3Resolved = false;

  locks.add('users.email').then(lock => {
    lock1Resolved = true;
  });

  locks.add('users.one').then(lock => {
    lock2Resolved = true;
    locks.remove(lock);
  });

  const lock3Promise = locks.add('users.email');

  // Wait a bit to ensure lock3 doesn't resolve
  await new Promise(resolve => setTimeout(resolve, 100));

  assert.ok(lock1Resolved);
  assert.ok(lock2Resolved);
  assert.equal(lock3Resolved, false);
});

test('field based lock works', async t => {
  const locks = lockbase();
  let lock1Resolved = false;
  let lock2Resolved = false;

  locks.add('users.email').then(lock => {
    lock1Resolved = true;
    locks.remove(lock);
  });

  await new Promise(resolve => setTimeout(resolve, 50));

  locks.add('users.email').then(lock => {
    lock2Resolved = true;
  });

  // Wait for promises to resolve
  await new Promise(resolve => {
    const check = () => {
      if (lock1Resolved && lock2Resolved) {
        resolve();
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });

  assert.ok(lock1Resolved);
  assert.ok(lock2Resolved);
});

test('find locks', async t => {
  const locks = lockbase();

  const lock = await locks.add('users.email');

  const lockedBefore = locks.find('users.email');
  assert.deepEqual(lockedBefore, [{
    id: lock,
    path: 'users.email'
  }]);

  locks.remove(lock);

  const lockedAfter = locks.find('users.email');
  assert.deepEqual(lockedAfter, []);
});

test('wait for locks', async t => {
  const locks = lockbase();
  let lockRemoved = false;

  const lock = await locks.add('users.email');

  const lockedBefore = locks.find('users.email');
  assert.deepEqual(lockedBefore, [{
    id: lock,
    path: 'users.email'
  }]);

  setTimeout(() => {
    lockRemoved = true;
    locks.remove(lock);
  });

  await locks.wait('users.email');
  assert.ok(lockRemoved, 'lock was removed then wait passed');
});

test('multiple locks', async t => {
  const locks = lockbase();
  let resolvedCount = 0;

  locks.add('users').then(lock => {
    resolvedCount++;
    setTimeout(() => locks.remove(lock));
  });

  locks.add('users').then(lock => {
    resolvedCount++;
    setTimeout(() => locks.remove(lock));
  });

  locks.add('users').then(lock => {
    resolvedCount++;
    setTimeout(() => locks.remove(lock));
  });

  locks.add('users').then(lock => {
    resolvedCount++;
    locks.remove(lock);
  });

  // Wait for all promises to resolve
  await new Promise(resolve => {
    const check = () => {
      if (resolvedCount === 4) {
        resolve();
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });

  assert.equal(resolvedCount, 4);
});

test('locks wait', async t => {
  const locks = lockbase();

  const lockId = await locks.add('users');

  let removed = false;
  setTimeout(() => {
    locks.remove(lockId);
    removed = true;
  });

  await locks.wait('users');

  assert.ok(removed, 'did not wait until cancelled');
});

test('locks wait with ignore', async t => {
  const locks = lockbase();

  const lockId = await locks.add('users');

  let removed = false;
  setTimeout(() => {
    locks.remove(lockId);
    removed = true;
  }, 100);

  await locks.wait('users', lockId);
  assert.equal(removed, false, 'should have resolved before removal');
});

test('locks wait with multiple ignores', async t => {
  const locks = lockbase();

  const lockId = await locks.add('users');

  setTimeout(() => {
    locks.remove(lockId);
  });

  await locks.wait('users', [0, lockId]);
  assert.ok(true);
});

test('manually mutate state - resolves missing locks', async t => {
  const locks = lockbase();

  await locks.add('users');

  let lock2Resolved = false;
  let waitResolved = false;

  locks.add('users').then(() => {
    lock2Resolved = true;
  }).catch(() => {
    assert.fail('second lock should not have failed');
  });

  locks.wait('users').then(() => {
    waitResolved = true;
  }).catch((error) => {
    assert.equal(error.message, 'imported state did not hold lock');
  });

  locks.importState({
    incremental: 0,
    queue: []
  });

  // Give time for promises to resolve
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.ok(lock2Resolved, 'second lock was applied');
});

test('manually mutate state', async t => {
  const locks = lockbase();

  await locks.add('users');

  let lock2Resolved = false;
  let lock3Resolved = false;
  let waitResolved = false;

  locks.add('users').then(() => {
    lock2Resolved = true;
  });

  locks.add('users').then(() => {
    lock3Resolved = true;
  });

  locks.wait('users').then(() => {
    waitResolved = true;
  });

  const exportedState = locks.exportState();
  locks.importState({
    queue: exportedState.queue.slice(1),
    incremental: exportedState.incremental
  });

  // Give time for promises to resolve
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.ok(lock2Resolved, 'second lock was applied');
  assert.equal(lock3Resolved, false, 'third lock should not have been applied');
  assert.equal(waitResolved, false, 'wait should not have resolved');
});

test('single locks - multiple waits', async t => {
  const locks = lockbase();

  const lock = await locks.add('users');

  let wait1Resolved = false;
  let wait2Resolved = false;

  locks.wait('users').then(() => wait1Resolved = true);
  locks.wait('users').then(() => wait2Resolved = true);

  locks.remove(lock);

  // Wait for promises to resolve
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.ok(wait1Resolved, 'first wait was resolved');
  assert.ok(wait2Resolved, 'second wait was resolved');
});

test('wait cancelled', async t => {
  const locks = lockbase();

  await locks.add('users.email');

  const wait = locks.wait('users.email');

  let errorMessage;
  wait.catch((error) => {
    errorMessage = error.message;
  });

  wait.cancel();

  // Wait for promise to reject
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(errorMessage, 'lockbase: wait cancelled');
});

test('wait cancelled does not throw if not set', async t => {
  const locks = lockbase();

  const lockId = await locks.add('users.email');

  setTimeout(() => {
    locks.remove(lockId);
  }, 200);

  const wait = locks.wait('users.email');

  let waitResolved = false;
  wait.then(() => {
    waitResolved = true;
  });

  locks.importState({
    queue: [
      { id: lockId, path: 'users.email' }
    ],
    incremental: 2
  });

  // Wait for promise to resolve
  await new Promise(resolve => setTimeout(resolve, 250));

  assert.ok(waitResolved, 'wait was resolved');
});

test('wait cancelled with custom error', async t => {
  const locks = lockbase();

  await locks.add('users.email');

  const wait = locks.wait('users.email');

  let errorMessage;
  wait.catch((error) => {
    errorMessage = error.message;
  });

  wait.cancel(new Error('some unknown reason'));

  // Wait for promise to reject
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(errorMessage, 'some unknown reason');
});

test('locks being waited fail when cancelled', async t => {
  const locks = lockbase();

  locks.add('users.email').then(lock => {
    setTimeout(() => {
      locks.cancel();
    });
  });

  let errorMessage;
  await locks.wait('users.email')
    .then(lock => {
      assert.fail('should not have passed successfully');
    })
    .catch(error => {
      errorMessage = error.message;
    });

  assert.equal(errorMessage, 'lockbase: all locks cancelled');
});

test('locks being waited fail when cancelled with custom error', async t => {
  const locks = lockbase();

  locks.add('users.email').then(lock => {
    setTimeout(() => {
      locks.cancel(new Error('why?'));
    });
  });

  let errorMessage;
  await locks.wait('users.email')
    .then(lock => {
      assert.fail('should not have passed successfully');
    })
    .catch(error => {
      errorMessage = error.message;
    });

  assert.equal(errorMessage, 'why?');
});

test('emit events after multiple locks added', async t => {
  const locks = lockbase();

  let resolvedOne = false;
  let resolvedTwo = false;
  let lock2Resolved = false;

  locks.once('resolved.one', () => {
    resolvedOne = true;
  });

  locks.once('resolved.two', () => {
    resolvedTwo = true;
  });

  locks.add('users.email', { id: 'one' });
  locks.add('users.email', { id: 'two' }).then(() => {
    lock2Resolved = true;
    locks.remove('two');
  });

  locks.remove('one');

  // Wait for events to complete
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.ok(resolvedOne, 'resolved first lock');
  assert.ok(resolvedTwo, 'resolved second lock');
  assert.ok(lock2Resolved, 'second lock took priority');
});

test('locks being waited remain when reimported', async t => {
  const locks = lockbase();

  let resolvedOne = false;
  let resolvedTwo = false;
  let lock1Resolved = false;
  let lock2Resolved = false;
  let waitResolved = false;

  locks.once('resolved.one', () => {
    resolvedOne = true;
  });

  locks.once('resolved.two', () => {
    resolvedTwo = true;
  });

  locks.add('users.email', { id: 'one' }).then(() => {
    lock1Resolved = true;
  });

  locks.add('users.email', { id: 'two' }).then(() => {
    lock2Resolved = true;
    locks.remove('two');
  });

  locks.wait('users.email')
    .then(lock => {
      waitResolved = true;
    });

  locks.importState(
    // stringified to lose any state
    JSON.parse(JSON.stringify(locks.exportState()))
  );

  locks.remove('one');

  // Wait for events to complete
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.ok(resolvedOne, 'resolved first lock');
  assert.ok(resolvedTwo, 'resolved second lock');
  assert.ok(lock1Resolved, 'first lock took priority');
  assert.ok(lock2Resolved, 'second lock took priority');
  assert.ok(waitResolved, 'wait was released');
});

test('isLockActive - empty queue', async t => {
  const isActive = lockbase.isLockActive({
    queue: []
  }, null);
  assert.equal(isActive, true);
});
