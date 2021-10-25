const EventEmitter = require('events');
const uuid = require('uuid').v4;

const findExistingLocks = require('./findExistingLocks');

function sync (context) {
  context.queue.forEach((item, index) => {
    const existingLocks = item.keys
      .filter(key => findExistingLocks(context.locks, key, item.ignore));

    if (existingLocks.length === 0) {
      if (item.id) {
        context.locks.push([item.id, item.keys, ...item.additional]);
      }
      context.queue.splice(index, 1);
      item.resolve(item.id);
      sync(context);
    }
  });

  const activeLocksWithDuplicates = context.locks.reduce((result, lock) => {
    return result.concat(lock[1]);
  }, []);

  context.active = Array.from(new Set(activeLocksWithDuplicates));
}

function lockbase () {
  const context = new EventEmitter();

  context.locks = [];
  context.queue = [];
  context.active = [];

  function add (keys, id, ...additional) {
    return new Promise((resolve, reject) => {
      id = id || uuid();
      context.queue.push({ id, keys, additional, resolve, reject });
      sync(context);
    });
  }

  function remove (uuid) {
    const index = context.locks.findIndex(lock => lock[0] === uuid);
    if (index > -1) {
      context.locks.splice(index, 1);
      sync(context);
      return true;
    }
  }

  function cancel (error) {
    context.queue.forEach((item, index) => {
      context.queue.splice(index, 1);
      item.reject(error || new Error('lockbase: all locks cancelled'));
    });
  }

  function check (keys) {
    const existingLocks = keys
      .map(key => findExistingLocks(context.locks, key))
      .filter(key => !!key);

    return existingLocks[0];
  }

  function wait (keys, options) {
    const ignore = options && options.ignore;
    const queueItem = {};

    const promise = new Promise((resolve, reject) => {
      queueItem.ignore = ignore || [];
      queueItem.keys = keys;
      queueItem.resolve = resolve;
      queueItem.reject = reject;
      context.queue.push(queueItem);
      sync(context);
    });

    promise.cancel = (error) => {
      const index = context.queue.indexOf(queueItem);
      context.queue.splice(index, 1);
      queueItem.reject(error || new Error('lockbase: wait cancelled'));
    };

    return promise;
  }

  Object.assign(context, {
    setLocks: locks => {
      context.locks = locks;
      sync(context);
    },

    add,
    remove,
    cancel,
    check,
    wait
  });

  return context;
}

module.exports = lockbase;
