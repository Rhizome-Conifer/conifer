/* eslint-disable react/no-danger, global-require, no-underscore-dangle */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom/server';
import serialize from 'serialize-javascript';
import Helmet from 'react-helmet';


export default class BaseHtml extends Component { // eslint-disable-line react/prefer-stateless-function
  static propTypes = {
    assets: PropTypes.object, // eslint-disable-line react/forbid-prop-types
    component: PropTypes.node,
    store: PropTypes.object // eslint-disable-line react/forbid-prop-types
  };

  render() {
    const { assets, component, store } = this.props;
    const content = component ? ReactDOM.renderToString(component) : '';
    const head = Helmet.rewind();

    return (
      <html lang="en-US">
        <head>
          {head.base.toComponent()}
          {head.title.toComponent()}
          {head.meta.toComponent()}
          {head.link.toComponent()}
          {head.script.toComponent()}

          { /*<link rel="shortcut icon" href="/favicon.ico" />*/ }
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {/* styles (will be present only in production with webpack extract text plugin) */}
          {Object.keys(assets.styles).map((style, key) =>
            <link
              href={assets.styles[style]}
              key={key} media="screen, projection"
              rel="stylesheet" type="text/css" charSet="UTF-8"
            />
          )}
        </head>
        <body>
          <div id="app" dangerouslySetInnerHTML={{ __html: content }} />
          <script
            dangerouslySetInnerHTML={{ __html: `window.__data=${serialize(store.getState())};` }}
            charSet="UTF-8"
          />
          <script src={assets.javascript.main} charSet="UTF-8" />
        </body>
      </html>
    );
  }
}
