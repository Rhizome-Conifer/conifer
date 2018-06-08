import { clientConfiguration } from 'universal-webpack';
import settings from './universal-webpack-settings.json';
import config from './webpack.config';

export default function (options) {
  return clientConfiguration(config, settings, options);
}
