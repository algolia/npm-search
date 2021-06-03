/* eslint-disable import/no-commonjs */

const { join } = require('path');

const { config } = require('dotenv');

const dotenv = jest.createMockFromModule('dotenv');

dotenv.config = () => config({ path: join(__dirname, 'mock.env') });

module.exports = dotenv;
