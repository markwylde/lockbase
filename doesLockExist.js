function doesLockExist (locks, key) {
  return locks.find(lock => {
    const [, keys] = lock;

    const exact = keys.find(item => item === key);
    if (exact) {
      return true;
    }

    const partial = keys.find(item => key.startsWith(`${item}.`));
    if (partial) {
      return true;
    }

    return false;
  });
}

module.exports = doesLockExist;
