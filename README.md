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
The `lockbase` module returns an object with three methods:

**add -> Array(keys) -> id -> id**
To add a lock, run the `add` function with an array of keys. If the second `id` argument
is left blank, then a uuid will be used.

**remove -> id**
To remove a lock, run the `remove` function with the id of the lock.

**check -> Array(keys) -> boolean**
To check if a lock exists, run the `check` function with an array of keys. If *any* of the keys
are locked, it will return `true`.

**keys** follow dot notation and will match partially.
`users` will match `users`, `users.email`, `users.anythingElse`
`users.email` will match `users.email` and potentially `users.email.subKey`

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
