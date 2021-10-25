function findExistingLocks (locks, key, ignore = []) {
  const locksWithoutIgnore = locks.filter(lock => {
    const isIgnored = ignore.find(ignoredLockId => {
      return ignoredLockId === lock[0];
    });
    return !isIgnored;
  });

  return locksWithoutIgnore.find(lock => {
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
