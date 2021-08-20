const uuid = require('uuid').v4;

const findExistingLocks = require('./findExistingLocks');

function sync (locks, queue) {
  queue.forEach((item, index) => {
    const existingLocks = item.keys
      .filter(key => findExistingLocks(locks, key))
      .length;

    if (existingLocks === 0) {
      if (item.id) {
        locks.push([item.id, item.keys]);
      }
      queue.splice(index, 1);
      item.resolve(item.id);
      sync(locks, queue);
    }
  });
}

function lockbase () {
  const locks = [];
  const queue = [];

  function add (keys, id) {
    return new Promise((resolve, reject) => {
      id = id || uuid();
      queue.push({ id, keys, resolve, reject });
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

  function cancel (error) {
    queue.forEach((item, index) => {
      queue.splice(index, 1);
      item.reject(error || new Error('lockbase: all locks cancelled'));
    });
  }

  function check (keys) {
    const existingLocks = keys
      .map(key => findExistingLocks(locks, key))
      .filter(key => !!key);

    return existingLocks[0];
  }

  function wait (keys) {
    const queueItem = {};

    const promise = new Promise((resolve, reject) => {
      queueItem.keys = keys;
      queueItem.resolve = resolve;
      queueItem.reject = reject;
      queue.push(queueItem);
      sync(locks, queue);
    });

    promise.cancel = (error) => {
      const index = queue.indexOf(queueItem);
      queue.splice(index, 1);
      queueItem.reject(error || new Error('lockbase: wait cancelled'));
    };

    return promise;
  }

  return {
    add,
    remove,
    cancel,
    check,
    wait
  };
}

module.exports = lockbase;
