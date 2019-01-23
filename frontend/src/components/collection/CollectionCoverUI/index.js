import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import classNames from 'classnames';
import memoize from 'memoize-one';
import { Link } from 'react-router-dom';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

import { appHost, tagline } from 'config';
import { doubleRAF, getCollectionLink, truncate } from 'helpers/utils';
import { collection as collectionErr } from 'helpers/userMessaging';

import { setSort } from 'store/modules/collection';

import { CollectionFilters, Temp404 } from 'containers';

import Capstone from 'components/collection/Capstone';
import HttpStatus from 'components/HttpStatus';
import RedirectWithStatus from 'components/RedirectWithStatus';
import TableRenderer from 'components/collection/TableRenderer';

import ScrollspyEntry from './ScrollspyEntry';
import ListsScrollable from './ListsScrollable';

import 'react-tabs/style/react-tabs.css';
import './style.scss';


class CollectionCoverUI extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool,
    isMobile: PropTypes.bool
  };

  static propTypes = {
    browsers: PropTypes.object,
    collection: PropTypes.object,
    match: PropTypes.object,
    orderdPages: PropTypes.object,
    pages: PropTypes.object
  };

  constructor(options, { collection }) {
    super(options);

    this.waypoints = [];
    this.halfWidth = 0;
    this.scrollable = React.createRef();
    this.state = { activeList: 0 };
  }

  componentDidMount() {
    doubleRAF(this.setWaypoints);

    // if there's a list id in the hash, focus on that item
    if (window.location.hash) {
      const active = this.scrollable.current.querySelector(window.location.hash);
      if (active) {
        active.scrollIntoView({ block: 'start', behavior: 'instant' });
        this.setState({ activeList: [...active.parentNode.children].indexOf(active) });
      }
    }
  }

  getLists = memoize(collection => collection.get('lists').filter(o => o.get('public') && o.get('bookmarks') && o.get('bookmarks').size))

  goToList = (idx) => {
    const { collection, history } = this.props;
    const ele = this.scrollable.current.querySelectorAll('.lists > li')[idx];
    ele.scrollIntoView({ block: 'start', behavior: Math.abs(ele.getBoundingClientRect().top) > 10000 ? 'instant' : 'smooth' });
    window.history.replaceState({}, '', `#list-${collection.getIn(['lists', idx, 'id'])}`);
  }

  scrollHandler = () => {
    requestAnimationFrame(() => {
      const t = this.scrollable.current.scrollTop;
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
    const ref = this.scrollable.current;
    const topOffset = ref.scrollTop - ref.getBoundingClientRect().top;
    this.waypoints = [...ref.querySelectorAll('.lists > li')].map(li => li.getBoundingClientRect().top + topOffset);
    this.halfWidth = ref.getBoundingClientRect().height * 0.5;
    this.waypoints.reverse();
  }

  sort = ({ sortBy, sortDirection }) => {
    const { collection, dispatch } = this.props;
    const prevSort = collection.getIn(['sortBy', 'sort']);
    const prevDir = collection.getIn(['sortBy', 'dir']);

    if (prevSort !== sortBy) {
      dispatch(setSort({ sort: sortBy, dir: sortDirection }));
    } else {
      dispatch(setSort({ sort: sortBy, dir: prevDir === 'ASC' ? 'DESC' : 'ASC' }));
    }
  }

  render() {
    const { browsers, collection, match: { params: { user, coll } }, pages } = this.props;

    if (collection.get('error')) {
      return user.startsWith('temp-') ?
        <Temp404 /> :
        <HttpStatus>{collectionErr[collection.getIn(['error', 'error'])]}</HttpStatus>;
    }

    if (collection.get('loaded') && !collection.get('slug_matched') && coll !== collection.get('slug')) {
      return (
        <RedirectWithStatus to={getCollectionLink(collection)} status={301} />
      );
    }

    const lists = collection.get('loaded') && this.getLists(collection);

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
          this.context.canAdmin && !this.context.isAnon && !collection.get('public') && collection.get('loaded') &&
            <div className="visibility-warning">
              Note: this collection is set to 'private' so only you can see it. <Link to={getCollectionLink(collection, true)}>If you set this collection to 'public'</Link> you can openly share the web pages you have collected.
            </div>
        }
        <Capstone title={collection.get('title')} user={collection.get('owner')} />
        <Tabs>
          <TabList>
            <Tab>Overview</Tab>
            <Tab><span className={classNames({ 'private-index': !collection.get('public_index') })}>Browse All</span></Tab>
          </TabList>

          <TabPanel className="react-tabs__tab-panel overview-tab">
            <ul className="scrollspy hidden-xs">
              {
                lists && lists.map((list, idx) => {
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

            <ListsScrollable
              collection={collection}
              lists={lists}
              ref={this.scrollable}
              scrollHandler={this.scrollHandler} />
          </TabPanel>

          <TabPanel className="react-tabs__tab-panel browse-all-tab">
            {
              collection.get('public_index') ?
                <TableRenderer {...{
                  browsers,
                  collection,
                  displayObjects: pages,
                  sort: this.sort
                }} /> :
                <div className="table-container">
                  <div className="collection-header">
                    <h2>Pages</h2>
                    <CollectionFilters disabled />
                  </div>
                  <div className="private-index">This collection does not have a public index.</div>
                </div>
            }
          </TabPanel>
        </Tabs>
      </div>
    );
  }
}


export default CollectionCoverUI;
