import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import { defaultBookmarkDesc, untitledEntry } from 'config';

import InlineEditor from 'components/InlineEditor';
import RemoteBrowserDisplay from 'components/collection/RemoteBrowserDisplay';
import SidebarHeader from 'components/SidebarHeader';
import TimeFormat from 'components/TimeFormat';
import WYSIWYG from 'components/WYSIWYG';
import { BookmarkIcon } from 'components/icons';

import './style.scss';


class InspectorPanelUI extends PureComponent {
  static propTypes = {
    bkEdited: PropTypes.bool,
    browsers: PropTypes.object,
    collection: PropTypes.object,
    list: PropTypes.object,
    multiSelect: PropTypes.number,
    saveBookmarkEdit: PropTypes.func,
    selectedBk: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    selectedPage: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ])
  };

  saveEdit = (data) => {
    const { collection, list, selectedBk } = this.props;
    this.props.saveBookmarkEdit(
      collection.get('user'),
      collection.get('id'),
      list.get('id'),
      selectedBk,
      data
    );
  }

  editBookmarkTitle = title => this.saveEdit({ title })
  editBookmarkDesc = desc => this.saveEdit({ desc })

  render() {
    const { bkEdited, browsers, collection, list, multiSelect,
            selectedPage, selectedBk } = this.props;

    const bk = selectedBk ? list.get('bookmarks').find(o => o.get('id') === selectedBk) : false;
    const pg = bk ? bk.get('page') : collection.getIn(['pages', selectedPage]);


    return (
      <div className="wr-inspector">
        <SidebarHeader label="Inspector" />
        <div className="inspector-body">
          {
            multiSelect ?
              <h5>{multiSelect} Pages Selected</h5> :
              <React.Fragment>
                {
                  bk &&
                    <header className="bookmark-cap">
                      <h4><BookmarkIcon /> Archived Page</h4>

                      <InlineEditor
                        blockDisplay
                        initial={bk.get('title') || untitledEntry}
                        onSave={this.editBookmarkTitle}
                        success={bkEdited}>
                        <h2>{bk.get('title')}</h2>
                      </InlineEditor>

                      <h4>Description</h4>
                      <WYSIWYG
                        minimal
                        initial={bk.get('desc') || defaultBookmarkDesc}
                        onSave={this.editBookmarkDesc}
                        success={bkEdited} />
                    </header>
                }
                {
                  pg ?
                    <ul>
                      <li>
                        <h5>Page Title</h5>
                        <span className="value">{pg.get('title')}</span>
                      </li>
                      <li>
                        <h5>Page Url</h5>
                        <span className="value">
                          <Link to={`/${collection.get('user')}/${collection.get('id')}/${pg.get('timestamp')}/${pg.get('url')}`}>{pg.get('url')}</Link>
                        </span>
                      </li>
                      <li>
                        <h5>Captured At</h5>
                        <span className="value">
                          <TimeFormat dt={pg.get('timestamp')} />
                        </span>
                      </li>
                      {
                        pg.get('rec') &&
                        <li>
                          <h5>Session ID</h5>
                          <span className="value">
                            <Link to={`/${collection.get('user')}/${collection.get('id')}/pages?query=session:${pg.get('rec')}`}>{pg.get('rec')}</Link>
                          </span>
                        </li>
                      }
                      {
                        pg.get('browser') &&
                        <li>
                          <h5>Preconfigured Browser</h5>
                          <span className="value"><RemoteBrowserDisplay browser={browsers.getIn(['browsers', pg.get('browser')])} /></span>
                        </li>
                      }
                    </ul> :
                    <h5><em>Select a page to see metadata</em></h5>
                }
              </React.Fragment>
          }
        </div>
      </div>
    );
  }
}


export default InspectorPanelUI;
