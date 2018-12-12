import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

import { appHost, tagline } from 'config';
import { getCollectionLink, getListLink, truncate } from 'helpers/utils';
import { collection as collectionErr } from 'helpers/userMessaging';

import { Temp404 } from 'containers';

import Capstone from 'components/collection/Capstone';
import HttpStatus from 'components/HttpStatus';
import RedirectWithStatus from 'components/RedirectWithStatus';
import TimeFormat from 'components/TimeFormat';
import Truncate from 'components/Truncate';
import WYSIWYG from 'components/WYSIWYG';
import { ListIcon } from 'components/icons';

import ScrollspyEntry from './ScrollspyEntry';

import 'react-tabs/style/react-tabs.css';
import './style.scss';


class CollectionCoverUI extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool,
    isMobile: PropTypes.bool
  };

  static propTypes = {
    collection: PropTypes.object,
    history: PropTypes.object,
    match: PropTypes.object,
    orderdPages: PropTypes.object
  };

  constructor(options) {
    super(options);

    this.waypoints = [];
    this.halfWidth = 0;
    this.state = { activeList: 0 };
  }

  componentDidMount() {
    this.handle = setTimeout(this.setWaypoints, 50);
  }

  componentWillUnmount() {
    this.clearTimeout(this.handle);
  }

  goToList = (idx) => {
    this.scrollable.querySelectorAll('.lists > li')[idx].scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  scrollHandler = () => {
    requestAnimationFrame(() => {
      const t = this.scrollable.scrollTop;
      this.waypoints.some((wp, idx) => {
        if (t + this.halfWidth >= wp) {
          const index = (this.waypoints.length - 1) - idx;
          if (this.state.activeList !== index) {
            this.setState({ activeList: index });
          }

          return true;
        }

        return false;
      });
    });
  }

  setWaypoints = () => {
    const topOffset = this.scrollable.getBoundingClientRect().top + this.scrollable.scrollTop;
    this.waypoints = [...this.scrollable.querySelectorAll('.lists > li')].map(li => li.getBoundingClientRect().top - topOffset);
    this.halfWidth = this.scrollable.getBoundingClientRect().height * 0.5;
    this.waypoints.reverse();
    console.log('waypoints:', this.waypoints);
  }

  render() {
    const { collection, history, match: { params: { user, coll } } } = this.props;

    if (collection.get('error')) {
      return user.startsWith('temp-') ?
        <Temp404 /> :
        <HttpStatus>{collectionErr[collection.getIn(['error', 'error'])]}</HttpStatus>;
    } else if (collection.get('loaded') && !collection.get('slug_matched') && coll !== collection.get('slug')) {
      return (
        <RedirectWithStatus to={getCollectionLink(collection)} status={301} />
      );
    }

    const lists = collection.get('lists') ? collection.get('lists').filter(o => o.get('public') && o.get('bookmarks') && o.get('bookmarks').size) : [];

    return (
      <div className="coll-cover">
        <Helmet>
          {
            !__PLAYER__ ?
              <title>{`${collection.get('title')} (Web archive collection by ${collection.get('owner')})`}</title> :
              <title>{collection.get('title')}</title>
          }
          <meta property="og:url" content={`${appHost}${getCollectionLink(collection)}`} />
          <meta property="og:type" content="website" />
          <meta property="og:title" content={collection.get('title')} />
          <meta property="og:description" content={collection.get('desc') ? truncate(collection.get('desc'), 3, new RegExp(/([.!?])/)) : tagline} />
        </Helmet>
        {
          this.context.canAdmin && !this.context.isAnon && !collection.get('public') &&
          <div className="visibility-warning">
            Note: this collection is set to 'private' so only you can see it. <Link to={getCollectionLink(collection, true)}>If you set this collection to 'public'</Link> you can openly share the web pages you have collected.
          </div>
        }
        <Capstone user={collection.get('owner')} />
        <Tabs>
          <TabList>
            <Tab>Overview</Tab>
            {
              collection.get('public_index') &&
                <Tab>Browse All</Tab>
            }
          </TabList>

          <TabPanel className="react-tabs__tab-panel overview-tab">
            <ul className="scrollspy">
              {
                lists.map((list, idx) => {
                  return (
                    <ScrollspyEntry
                      key={list.get('id')}
                      index={idx}
                      onSelect={this.goToList}
                      selected={idx === this.state.activeList}
                      title={list.get('title')} />
                  );
                })
              }
            </ul>
            <div className="scroll-wrapper">
              <div className="lists-container" onScroll={this.scrollHandler} ref={(o) => { this.scrollable = o; }}>
                <h1>{collection.get('title')}</h1>
                <div className="coll-description">
                  <WYSIWYG
                    readOnly
                    initial={collection.get('desc')} />
                </div>
                <ul className="lists">
                  {
                    lists.map((list) => {
                      return (
                        <li key={list.get('id')}>
                          <Link to={getListLink(collection, list)}>
                            <div className="list-title">
                              <div>
                                <ListIcon />
                              </div>
                              <h3>{list.get('title')}</h3>
                            </div>
                          </Link>
                          <div className="desc">
                            {
                              list.get('desc') &&
                                <Truncate height={1000}>
                                  <WYSIWYG
                                    readOnly
                                    initial={list.get('desc')} />
                                </Truncate>
                            }
                          </div>
                          <ol>
                            {
                              list.get('bookmarks').map((bk) => {
                                const replay = `${getListLink(collection, list)}/b${bk.get('id')}/${bk.get('timestamp')}/${bk.get('url')}`;
                                return (
                                  <li key={bk.get('id')}>
                                    <h4><Link to={replay}>{bk.get('title')}</Link></h4>
                                    <a className="source-link" href={bk.get('url')} target="_blank">{bk.get('url')}</a>
                                    <TimeFormat classes="bk-timestamp" dt={bk.get('timestamp')} />
                                    {
                                      bk.get('desc') &&
                                        <WYSIWYG readOnly initial={bk.get('desc')} />
                                    }
                                  </li>
                                );
                              })
                            }
                          </ol>
                        </li>
                      );
                    })
                  }
                </ul>
              </div>
            </div>
          </TabPanel>
          <TabPanel>
            Browse All
          </TabPanel>
        </Tabs>
      </div>
    );
  }
}


export default CollectionCoverUI;
