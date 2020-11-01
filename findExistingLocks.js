function findExistingLocks (locks, key) {
  return locks.find(lock => {
    const [, keys] = lock;

    const exact = keys.find(item => item === key);
    if (exact) {
      return lock[0];
    }

    const partial = keys.find(item => key.startsWith(`${item}.`));
    if (partial) {
      return lock[0];
    }

    return false;
  });
}

module.exports = findExistingLocks;
