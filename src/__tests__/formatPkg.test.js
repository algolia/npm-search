import formatPkg from '../formatPkg';
import rawPackages from './rawPackages.json';
import isISO8601 from 'validator/lib/isISO8601';

it('transforms correctly', () => {
  const transformed = rawPackages.map(formatPkg).map(element => {
    expect(isISO8601(element.lastCrawl)).toBe(true);
    // eslint-disable-next-line no-param-reassign
    element.lastCrawl = '<!-- date replaced -->';
    return element;
  });
  expect(transformed).toMatchSnapshot();
});

it('truncates long readmes', () => {
  const object = {
    name: 'long-boy',
    lastPublisher: { name: 'unknown' },
    readme: 'Hello, World! '.repeat(40000),
  };
  const formatted = formatPkg(object);
  const truncatedEnding = '**TRUNCATED**';
  const ending = formatted.readme.substr(
    formatted.readme.length - truncatedEnding.length
  );

  expect(formatted.readme).toHaveLength(451050);
  expect(ending).toBe(truncatedEnding);

  formatted.lastCrawl = '<!-- date replaced -->';
  expect(formatted).toMatchSnapshot();
});
