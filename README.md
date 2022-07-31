# lockbase
![Node.js Test Runner](https://github.com/markwylde/lockbase/workflows/Node.js%20Test%20Runner/badge.svg)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/markwylde/lockbase)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/markwylde/lockbase)](https://github.com/markwylde/lockbase/releases)
[![GitHub](https://img.shields.io/github/license/markwylde/lockbase)](https://github.com/markwylde/lockbase/blob/master/LICENSE)

A queued locking library useful for databases.

## Installation
```bash
npm install --save lockbase
```

## Usage
The `lockbase` module has the following methods:
- `add` a new lock
- `remove` an existing lock
- `cancel` all locks
- `find` all locks
- `wait` for key to have no more locks
- `importState`
- `exportState`
- `on` for adding a listener
- `off` for removing a listener

```javascript
import lockbase from 'lockbase';
const locks = lockbase();

// Add a lock, and wait until it becomes active
const lockId = await locks.add(
  'users', // path to lock
  {
    id: 'optional custom id' // defaults to increments starting at 1,
    somethingElse: 'abc' // add custom metadata
  }
);

// Remove a lock when you're finished with it
locks.remove(lockId);

const usersLocks = locks.find('users');
/*
usersLocks === [{
  id: 1,
  path: 'users'
}]
*/

// Wait until a key has no locks associated with it
// This will wait until `users` is unlocked.
await locks.wait('users.email')

// Cancel all locks, rejecting any promises that are waiting.
locks.cancel(new Error('server is closing down'))
```

## Queue and Events
The queue holds all active locks, future locks and waits.

The `lockbase` module is actually an [EventEmitter](https://nodejs.org/api/events.html#class-eventemitter) that emits two events:

- `queue:insert` when an item is added to the queue
- `queue:remove` when an item is removed

```javascript
locks.on('queue.insert', item => {
  console.log('item has been inserted', item);
});

locks.on('queue.remove', item => {
  console.log('item has been removed', item);
});

locks.on('change', ({ item, event } => {
  console.log(`item has been ${event}`, { event, item });
});
```

## Export lock state
If you are running multiple servers, where a primary server is used, you may need to hand over lock state. For example, if using [raft](https://raft.github.io/), following a leader election.

You can export the lock state as a JSON object and import it into another server.

```javascript
const exportedState = locks1.exportState();
/*
exportedState === {
    queue: [{
      id: 1,
      path: 'users'  
    }],
    incremental: 1
  }
*/

locks2.importState(exportedState);
```

## Paths
Paths follow dot notation and will match partially.

- `users` will match `users`, `users.email`, `users.anythingElse`
- `users.email` will match `users.email` and `users.email.subpath`

## Example
```javascript
const lockbase = require('lockbase');
const locks = lockbase();

locks.add('users').then(lock => {
  const isLocked = locks.find('users.email')
  console.log(isLocked) // === true
  setTimeout(() => locks.remove(lock), 500);
});

locks.add('users').then(lock => {
  // This will not be called for 500ms
  locks.remove(lock);
});
```
