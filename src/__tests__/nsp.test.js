import { getSecurity } from '../nsp';

it('gets secure package', async () => {
  const recommendations = await getSecurity([{ name: 'holmes' }]);
  const [holmes] = recommendations;
  expect(holmes).toEqual({ name: 'holmes', securityRecommendation: false });
});

it('gets secure packages', async () => {
  const recommendations = await getSecurity([
    { name: 'holmes' },
    { name: 'react' },
  ]);
  expect(recommendations).toEqual([
    { name: 'holmes', securityRecommendation: false },
    { name: 'react', securityRecommendation: false },
  ]);
});

it('gets an insecure package', async () => {
  const recommendations = await getSecurity([
    { name: 'mathjs', version: '3.10.0' },
  ]);
  const [mathjs] = recommendations;
  expect(mathjs).toEqual({
    name: 'mathjs',
    securityRecommendation: {
      created: '2017-12-06T04:27:25.910Z',
      cvssScore: 9.8,
      dependencyPath: ['mathjs@3.10.0'],
      module: 'mathjs',
      nspId: 551,
      patched: '>=3.17.0',
      recommendation: 'Upgrade to version 3.17.0 or greater.',
      title: 'Arbitrary Code Execution',
      version: '3.10.0',
      vulnerable: '<3.17.0',
    },
  });
});
