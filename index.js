const uuid = require('uuid').v4;

const findExistingLocks = require('./findExistingLocks');

function sync (state) {
  state.queue.forEach((item, index) => {
    const existingLocks = item.keys
      .filter(key => findExistingLocks(state.locks, key))
      .length;

    if (existingLocks === 0) {
      if (item.id) {
        state.locks.push([item.id, item.keys]);
      }
      state.queue.splice(index, 1);
      item.resolve(item.id);
      sync(state);
    }
  });

  const activeLocksWithDuplicates = state.locks.reduce((result, lock) => {
    return result.concat(lock[1]);
  }, []);

  state.active = Array.from(new Set(activeLocksWithDuplicates));
}

function lockbase () {
  const state = {
    locks: [],
    queue: [],
    active: []
  };

  function add (keys, id) {
    return new Promise((resolve, reject) => {
      id = id || uuid();
      state.queue.push({ id, keys, resolve, reject });
      sync(state);
    });
  }

  function remove (uuid) {
    const index = state.locks.findIndex(lock => lock[0] === uuid);
    if (index > -1) {
      state.locks.splice(index, 1);
      sync(state);
      return true;
    }
  }

  function cancel (error) {
    state.queue.forEach((item, index) => {
      state.queue.splice(index, 1);
      item.reject(error || new Error('lockbase: all locks cancelled'));
    });
  }

  function check (keys) {
    const existingLocks = keys
      .map(key => findExistingLocks(state.locks, key))
      .filter(key => !!key);

    return existingLocks[0];
  }

  function wait (keys) {
    const queueItem = {};

    const promise = new Promise((resolve, reject) => {
      queueItem.keys = keys;
      queueItem.resolve = resolve;
      queueItem.reject = reject;
      state.queue.push(queueItem);
      sync(state);
    });

    promise.cancel = (error) => {
      const index = state.queue.indexOf(queueItem);
      state.queue.splice(index, 1);
      queueItem.reject(error || new Error('lockbase: wait cancelled'));
    };

    return promise;
  }

  return {
    state,

    add,
    remove,
    cancel,
    check,
    wait
  };
}

module.exports = lockbase;
