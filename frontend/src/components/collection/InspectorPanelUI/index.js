import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import { defaultBookmarkDesc, untitledEntry } from 'config';
import { getCollectionLink } from 'helpers/utils';

import InlineEditor from 'components/InlineEditor';
import RemoteBrowserDisplay from 'components/collection/RemoteBrowserDisplay';
import SidebarHeader from 'components/SidebarHeader';
import TimeFormat from 'components/TimeFormat';
import WYSIWYG from 'components/WYSIWYG';
import { BookmarkIcon, InfoIcon } from 'components/icons';

import './style.scss';


class InspectorPanelUI extends PureComponent {
  static contextTypes = {
    canAdmin: PropTypes.bool
  };

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
      collection.get('owner'),
      collection.get('id'),
      list.get('id'),
      selectedBk,
      data
    );
  }

  editBookmarkTitle = title => this.saveEdit({ title })

  editBookmarkDesc = desc => this.saveEdit({ desc })

  render() {
    const { canAdmin } = this.context;
    const {
      bkEdited, browsers, collection, list, multiSelect,
      selectedPage, selectedBk
    } = this.props;

    const bk = selectedBk ? list.get('bookmarks').find(o => o.get('id') === selectedBk) : false;
    const pg = bk ? bk.get('page') : collection.getIn(['pages', selectedPage]);
    const selectedIndex = selectedBk ? list.get('bookmarks').findIndex(o => o.get('id') === selectedBk) : null;

    return (
      <div className="wr-inspector">
        <SidebarHeader label="Metadata" />
        <div className="inspector-body">
          {
            multiSelect ?
              <h5>{multiSelect} Pages Selected</h5> :
              <React.Fragment>
                {
                  bk &&
                    <header className="bookmark-cap">
                      <h4><BookmarkIcon /> Bookmark {selectedIndex + 1} of {list.get('bookmarks').size}</h4>

                      <InlineEditor
                        blockDisplay
                        canAdmin={canAdmin}
                        initial={bk.get('title') || untitledEntry}
                        onSave={this.editBookmarkTitle}
                        readOnly={!canAdmin}
                        success={bkEdited}>
                        <h2>{bk.get('title')}</h2>
                      </InlineEditor>

                      {
                        (bk.get('desc') || canAdmin) &&
                          <React.Fragment>
                            <h4>Description</h4>
                            <WYSIWYG
                              clickToEdit
                              initial={bk.get('desc')}
                              placeholder="Add annotation"
                              readOnly={!canAdmin}
                              onSave={this.editBookmarkDesc}
                              success={bkEdited} />
                          </React.Fragment>
                      }
                    </header>
                }
                {
                  pg ?
                    <div className="page-metadata">
                      <h4><InfoIcon /> Page Properties</h4>
                      <ul>
                        <li>
                          <h5>Page Title</h5>
                          <span className="value">{pg.get('title')}</span>
                        </li>
                        <li>
                          <h5>Page Url</h5>
                          <span className="value">
                            <Link to={`${getCollectionLink(collection)}/${pg.get('timestamp')}/${pg.get('url')}`}>{pg.get('url')}</Link>
                          </span>
                        </li>
                        <li>
                          <h5>Captured At</h5>
                          <span className="value">
                            <TimeFormat dt={pg.get('timestamp')} />
                          </span>
                        </li>
                        {
                          pg.get('rec') && !__PLAYER__ &&
                          <li>
                            <h5>Session ID</h5>
                            <span className="value">
                              {
                                canAdmin ?
                                  <Link to={`${getCollectionLink(collection)}/management?session=${pg.get('rec')}`}>{pg.get('rec')}</Link> :
                                  <Link to={`${getCollectionLink(collection, true)}?query=session:${pg.get('rec')}`}>{pg.get('rec')}</Link>
                              }
                            </span>
                          </li>
                        }
                        {
                          pg.get('browser') &&
                          <li>
                            <h5>Preconfigured Browser</h5>
                            {
                              !__PLAYER__ ?
                                <span className="value"><RemoteBrowserDisplay browser={browsers.getIn(['browsers', pg.get('browser')])} /></span> :
                                <span className="value">{pg.get('browser')}</span>
                            }
                          </li>
                        }
                      </ul>
                    </div> :
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
