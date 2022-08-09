import EventEmitter from 'events';

function isLockActive (context, testItem) {
  for (const item of context.queue) {
    const isIgnored = (testItem.ignore || []).find(ignoreId => ignoreId === item.id);

    if (isIgnored) {
      continue;
    }

    if (item === testItem) {
      return true;
    }

    if (item.path.startsWith(testItem.path)) {
      return false;
    }
  }

  return true;
}

function sync (context) {
  for (const item of context.queue) {
    const isActive = isLockActive(context, item);
    if (isActive) {
      const eventual = context.eventuals[item.id];
      if (eventual) {
        eventual.resolve(item.id);
        delete context.eventuals[item.id];
      }
      if (item.autoRemove) {
        const index = context.queue.indexOf(item);
        context.queue.splice(index, 1);
        sync(context);
      }
    }
  }
}

function lockbase () {
  const context = Object.assign(new EventEmitter(), {
    queue: [],
    incremental: 0,
    eventuals: {}
  });

  function add (path, meta = {}) {
    if (!meta.id) {
      context.incremental = context.incremental + 1;
      meta.id = context.incremental;
    }

    const item = {
      ...meta,
      path
    };

    const promise = new Promise((resolve, reject) => {
      context.queue.push(item);
      context.emit('queue:insert', item);
      context.emit('change', { eventName: 'queue:insert', item });

      context.eventuals[item.id] = { resolve, reject };

      sync(context);
    });

    promise.cancel = (customError) => {
      const { reject } = context.eventuals[item.id];
      reject(customError || new Error('lockbase: wait cancelled'));
    };

    return promise;
  }

  function remove (id) {
    const item = context.queue.find(item => item.id === id);
    const index = context.queue.indexOf(item);
    if (index > -1) {
      context.queue.splice(index, 1);
      context.emit('queue:remove', item, index);
      context.emit('change', { eventName: 'queue:remove', item });
      sync(context);
      return true;
    }
  }

  function cancel (customError) {
    context.queue.forEach((item, index) => {
      const eventual = context.eventuals[item.id];
      eventual?.reject(customError || new Error('lockbase: all locks cancelled'));
    });

    context.queue = [];
    context.eventuals = {};
  }

  function find (path) {
    return context.queue
      .filter(item => {
        return item.path.startsWith(path);
      })
      .filter(item => {
        return isLockActive(context, item);
      });
  }

  function wait (path, ignore) {
    return context.add(path, { ignore, autoRemove: true });
  }

  Object.assign(context, {
    importState: newState => {
      context.queue.forEach(item => {
        const lockExistsInNewState = newState.queue.find(newItem => newItem.id === item.id);

        if (!lockExistsInNewState) {
          const eventual = context.eventuals[item.id];
          eventual?.resolve();
        }
      });
      context.queue = newState.queue;
      context.incremental = newState.incremental;
      sync(context);
    },

    exportState: () => {
      return {
        queue: context.queue,
        incremental: context.incremental
      };
    },

    add,
    remove,
    cancel,
    find,
    wait
  });

  return context;
}

lockbase.isLockActive = isLockActive;

export default lockbase;
