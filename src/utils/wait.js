export default waitTime => {
  if (waitTime <= 0) {
    return Promise.resolve();
  }

  return new Promise(resolve => setTimeout(resolve, waitTime));
};
