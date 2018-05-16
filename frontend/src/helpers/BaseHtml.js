/* eslint-disable react/no-danger*/
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom/server';
import serialize from 'serialize-javascript';
import Helmet from 'react-helmet';


export default class BaseHtml extends Component {
  static propTypes = {
    assets: PropTypes.object,
    component: PropTypes.node,
    store: PropTypes.object
  };

  render() {
    const { assets, component, store } = this.props;
    const head = Helmet.rewind();

    return (
      <html lang="en-US">
        <head>
          <meta charSet="utf-8" />
          {head.base.toComponent()}
          {head.title.toComponent()}
          {head.meta.toComponent()}
          {head.link.toComponent()}
          {head.script.toComponent()}

          <link rel="shortcut icon" href="/static/favicon.png" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {/* styles (will be present only in production with webpack extract text plugin) */}
          {Object.keys(assets.styles).map((style, key) => (
            <link
              href={assets.styles[style]}
              key={key} media="screen, projection"
              rel="stylesheet" type="text/css" charSet="UTF-8" />
          ))}
        </head>
        <body>
          <div id="app">{component}</div>
          <div id="portal" />
          <script
            dangerouslySetInnerHTML={{ __html: `window.__data=${serialize(store.getState())};` }}
            charSet="UTF-8"
          />
          <script src="/static/app/bundle/wb_frame.js" />
          <script src={assets.javascript.main} charSet="UTF-8" />
        </body>
      </html>
    );
  }
}
