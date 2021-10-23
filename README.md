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
The `lockbase` module returns an object with five methods:

**add -> Array(keys) -> id -> Promise(id)**

To add a lock, run the `add` function with an array of keys. If the second `id` argument
is left blank, then a uuid will be used.

**remove -> id -> boolean**

To remove a lock, run the `remove` function with the id of the lock. It will return `true` if
a lock was found and removed successfully.

**check -> Array(keys) -> id || false**

To check if a lock exists, run the `check` function with an array of keys. It will return
the first lock to match, or `undefined` if no locks where found.

**wait -> Array(keys)**

To wait until all locks for a key set have finished, run the `wait` function with an array of
keys. It will return a promise that will resolve when there are no more locks.

**cancel -> Optional(reason)**

Cancel all locks, rejecting any promises that are waiting.

**keys** follow dot notation and will match partially.

- `users` will match `users`, `users.email`, `users.anythingElse`
- `users.email` will match `users.email` and `users.email.subKey`

**setLocks -> Array(locks)** set the lock state manually.
> This is useful for syncing the lock state with another service

```json
setLocks([
  ["2401685e-77ef-423a-9ad6-bd4b8db1af80", ["users"]]
]);
```

## Example
```javascript
const lockbase = require('lockbase');
const locks = lockbase();

locks.add(['users']).then(lock => {
  const isLocked = locks.check(['users.email'])
  console.log(isLocked) // === true
  setTimeout(() => locks.remove(lock), 500);
});

locks.add(['users']).then(lock => {
  // This will not be called for 500ms
  locks.remove(lock);
});
```
