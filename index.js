const uuid = require('uuid').v4;

const findExistingLocks = require('./findExistingLocks');

function sync (locks, queue) {
  queue.forEach((item, index) => {
    const existingLocks = item.keys
      .map(key => findExistingLocks(locks, key))
      .filter(key => !!key)
      .length;

    if (existingLocks === 0) {
      if (item.id) {
        locks.push([item.id, item.keys]);
      }
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
    if (index > -1) {
      locks.splice(index, 1);
      sync(locks, queue);
      return true;
    }
  }

  function check (keys) {
    const existingLocks = keys
      .map(key => findExistingLocks(locks, key))
      .filter(key => !!key);

    return existingLocks[0];
  }

  function wait (keys) {
    return new Promise(resolve => {
      queue.push({ keys, resolve });
      sync(locks, queue);
    });
  }

  return {
    add,
    remove,
    check,
    wait
  };
}

module.exports = lockbase;
