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
```javascript
const lockbase = require('lockbase');
const locks = lockbase();

locks.add(['users']).then(lock => {
  t.pass();
  setTimeout(() => locks.remove(lock), 500);
});

locks.add(['users']).then(lock => {
  // This will not be called for 500ms
  t.pass();
  locks.remove(lock);
});
```
