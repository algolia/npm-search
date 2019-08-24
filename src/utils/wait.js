export default waitTime => {
  return new Promise(resolve => setTimeout(resolve, waitTime));
};
