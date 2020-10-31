const uuid = require('uuid').v4;

const doesLockExist = require('./doesLockExist');

function sync (locks, queue) {
  queue.forEach((item, index) => {
    const existingLocks = item.keys
      .map(key => doesLockExist(locks, key))
      .filter(key => !!key)
      .length;

    if (existingLocks === 0) {
      locks.push([item.id, item.keys]);
      queue.splice(index, 1);
      item.resolve(item.id);
    }
  });
}

function lockbase () {
  const locks = [];
  const queue = [];

  function add (keys, id) {
    return new Promise(resolve => {
      id = id || uuid();
      queue.push({ id, keys, resolve });
      sync(locks, queue);
    });
  }

  function remove (uuid) {
    const index = locks.findIndex(lock => lock[0] === uuid);
    locks.splice(index, 1);
    sync(locks, queue);
  }

  function check (keys) {
    const existingLocks = keys
      .map(key => doesLockExist(locks, key))
      .filter(key => !!key)
      .length;

    return existingLocks > 0;
  }

  return {
    add,
    remove,
    check
  };
}

module.exports = lockbase;
