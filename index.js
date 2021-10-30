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
      const eventual = context.eventuals.get(item);
      if (eventual) {
        eventual.resolve(item.id);
        context.eventuals.delete(eventual);
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
  const context = {
    queue: [],
    incremental: 0,
    eventuals: new WeakMap()
  };

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

      context.eventuals.set(item, { resolve, reject });

      sync(context);
    });

    promise.cancel = (customError) => {
      const { reject } = context.eventuals.get(item);
      reject(customError || new Error('lockbase: wait cancelled'));
    };

    return promise;
  }

  function remove (id) {
    const index = context.queue.findIndex(item => item.id === id);
    if (index > -1) {
      context.queue.splice(index, 1);
      sync(context);
      return true;
    }
  }

  function cancel (customError) {
    context.queue.forEach((item, index) => {
      const eventual = context.eventuals.get(item);
      eventual.reject(customError || new Error('lockbase: all locks cancelled'));
    });

    context.queue = [];
    context.eventuals = new WeakMap();
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
        const existingItem = newState.queue.find(newItem => newItem.id === item.id);

        if (!existingItem) {
          const eventual = context.eventuals.get(item);
          eventual.reject(new Error('imported state did not hold lock'));
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

module.exports = lockbase;
