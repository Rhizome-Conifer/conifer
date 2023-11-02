import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Col, Dropdown, Row } from 'react-bootstrap';

import config from 'config';


class InlineBrowserSelectUI extends PureComponent {
  static propTypes = {
    accessed: PropTypes.number,
    bookmark: PropTypes.object,
    browsers: PropTypes.object,
    collection: PropTypes.object,
    editBk: PropTypes.func,
    getBrowsers: PropTypes.func,
    list: PropTypes.object,
  };

  getRemoteBrowsers = () => {
    if (!this.props.browsers) {
      this.props.getBrowsers();
    }
  }

  updateBrowser = (key, evt) => {
    console.log(key, evt);
    const { bookmark, collection, list } = this.props;
    this.props.editBk(collection.get('owner'), collection.get('id'), list.get('id'), bookmark.get('id'), {browser: key});
  }

  render() {
    const { browsers, bookmark } = this.props;

    const availBrowsers = [];
    config.filterBrowsers.forEach((id) => {
      const browser = browsers.get(id);
      if (browser) {
        availBrowsers.push(browser);
      }
    });

    const bkBrowser = browsers ? browsers.find(b => b.get('id') === bookmark.get('browser')) : null;

    return (
      <Dropdown
        onSelect={this.updateBrowser}
        onToggle={this.getRemoteBrowsers}>
        <Dropdown.Toggle variant="outline-secondary" size="sm">
          {
            bkBrowser ?
              <React.Fragment>
                <img src={`/api/browsers/browsers/${bkBrowser.get('id')}/icon`} alt={`${bkBrowser.get('name')} version ${bkBrowser.get('version')}`} />
                {` ${bkBrowser.get('name')} v${bkBrowser.get('version')}`}
              </React.Fragment> :
              'Current Browser'
          }
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {
            availBrowsers.map((b) => {
              return (
                <Dropdown.Item key={b.get('id')} eventKey={b.get('id')} active={bkBrowser && b.get('id') === bkBrowser.get('id')}>
                  <img src={`/api/browsers/browsers/${b.get('id')}/icon`} alt={`${b.get('name')} version ${b.get('version')}`} />
                  {` ${b.get('name')} v${b.get('version')}`}
                </Dropdown.Item>
              );
            })
          }

          <Dropdown.Item eventKey={null} active={!bkBrowser}>
            Current browser
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

export default InlineBrowserSelectUI;
