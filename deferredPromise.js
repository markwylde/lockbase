const deferredPromise = () => {
  const self = {};
  self.promise = new Promise(function (resolve, reject) {
    self.resolve = resolve;
    self.reject = reject;
  });
  return self;
};

export default deferredPromise;
