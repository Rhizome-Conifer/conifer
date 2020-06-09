import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet';
import { List } from 'immutable';

import config from 'config';

import { setSort as collSetSort } from 'store/modules/collection';
import { setSort as listSetSort } from 'store/modules/list';
import { getCollectionLink, getListLink, range, truncate } from 'helpers/utils';
import { AppContext } from 'store/contexts';

import {
  CollectionHeader,
  InspectorPanel,
  Lists,
  Sidebar,
  Temp404,
  TempUserAlert
} from 'containers';

import HttpStatus from 'components/HttpStatus';
import RedirectWithStatus from 'components/RedirectWithStatus';
import Resizable from 'components/Resizable';
import TableRenderer from 'components/collection/TableRenderer';

import 'react-virtualized/styles.css';

import CustomDragLayer from './dragLayer';
import './style.scss';


class CollectionDetailUI extends Component {
  static contextType = AppContext;

  static propTypes = {
    auth: PropTypes.object,
    bookmarks: PropTypes.object,
    browsers: PropTypes.object,
    bkDeleting: PropTypes.bool,
    bkDeleteError: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.string
    ]),
    clearInspector: PropTypes.func,
    clearSearch: PropTypes.func,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    list: PropTypes.object,
    match: PropTypes.object,
    pages: PropTypes.object,
    publicIndex: PropTypes.bool,
    removeBookmark: PropTypes.func,
    saveBookmarkSort: PropTypes.func,
    searched: PropTypes.bool,
    setMultiInspector: PropTypes.func,
    setBookmarkInspector: PropTypes.func,
    setPageInspector: PropTypes.func
  };

  static getDerivedStateFromProps(props, state) {
    if (props.bookmarks !== state.bookmarks) {
      return {
        bookmarks: props.bookmarks,
        sortedBookmarks: props.bookmarks
      };
    }

    return null;
  }

  constructor(props) {
    super(props);

    this.keyBuffer = List();
    this.keyCommands = [
      // ctrl + a
      {
        keys: List([17, 65]),
        action: this.selectAll
      },
      // cmd + a
      {
        keys: List([91, 65]),
        action: this.selectAll
      },
    ];

    this.state = {
      listBookmarks: props.bookmarks,
      sortedBookmarks: props.bookmarks,
      overrideHeight: null,
      selectedPageIdx: null
    };

    this.props.clearInspector();
  }

  componentDidMount() {
    if (!this.context.isMobile) {
      document.addEventListener('keydown', this.handleKeyInput);
    }
  }

  shouldComponentUpdate(nextProps) {
    // don't rerender for loading changes
    if (!nextProps.loaded && this.props.list === nextProps.list) {
      return false;
    }

    return true;
  }

  componentDidUpdate(prevProps) {
    if (this.props.loaded && !prevProps.loaded) {
      if (this.props.searched) {
        this.props.clearSearch();
      }
    }
  }

  componentWillUnmount() {
    if (!this.context.isMobile) {
      document.removeEventListener('keydown', this.handleKeyInput);
    }
  }

  onKeyNavigate = ({ scrollToRow }) => {
    const { match: { params: { list } }, pages, setBookmarkInspector, setPageInspector } = this.props;
    const { listBookmarks } = this.state;

    if (list) {
      setBookmarkInspector(listBookmarks.getIn([scrollToRow, 'id']));
    } else {
      setPageInspector(pages.getIn([scrollToRow, 'id']));
    }

    this.setState({ selectedPageIdx: scrollToRow });
  }

  onSelectRow = ({ event, index }) => {
    const {
      clearInspector,
      match: { params: { list } },
      pages,
      setBookmarkInspector,
      setMultiInspector,
      setPageInspector
    } = this.props;
    const { listBookmarks, selectedPageIdx } = this.state;

    if (selectedPageIdx === index) {
      // clear selection
      this.setState({
        selectedPageIdx: null
      });

      // clear inspector
      clearInspector();
    } else {
      let selectedIndex;
      if (event.shiftKey && selectedPageIdx !== null) {
        let start;
        let end;

        // if selection is already a range, compute within that
        if (typeof selectedPageIdx !== 'number') {
          const arrMin = Math.min.apply(null, selectedPageIdx);
          const arrMax = Math.max.apply(null, selectedPageIdx);
          start = Math.min(arrMin, index);
          end = Math.max(arrMax, index);
        } else {
          start = Math.min(selectedPageIdx, index);
          end = Math.max(selectedPageIdx, index);
        }

        selectedIndex = range(start, end);
        setMultiInspector(selectedIndex.length);
      } else if (event.metaKey && selectedPageIdx !== null) {
        if (typeof selectedPageIdx === "object") {
          selectedIndex = selectedPageIdx;
          if (selectedIndex.includes(index)) {
            selectedIndex.splice(selectedIndex.indexOf(index), 1);
          } else {
            selectedIndex.push(index);
          }
        } else {
          selectedIndex = [selectedPageIdx, index];
        }
        setMultiInspector(selectedIndex.length);
      } else {
        selectedIndex = index;

        if (list) {
          setBookmarkInspector(listBookmarks.getIn([index, 'id']));
        } else {
          setPageInspector(pages.getIn([index, 'id']));
        }
      }

      this.setState({
        selectedPageIdx: selectedIndex
      });
    }
  }

  handleKeyInput = (evt) => {
    this.keyBuffer = this.keyBuffer.push(evt.keyCode);

    this.keyCommands.forEach((cmd) => {
      if (this.keyBuffer.equals(cmd.keys)) {
        cmd.action(evt);
      }
    });

    clearTimeout(this.kbHandle);
    this.kbHandle = setTimeout(() => { this.keyBuffer = this.keyBuffer.clear(); }, 1000);
  }

  deselect = () => {
    if (this.state.selectedPageIdx !== null) {
      this.setState({ selectedPageIdx: null });
      //this.props.clearInspector();
    }
  }

  selectAll = (evt) => {
    // ignore when edtiors in use
    if (['input', 'textarea'].includes(evt.target.nodeName.toLowerCase()) || evt.target.classList.contains('public-DraftEditor-content')) {
      return;
    }

    evt.preventDefault();
    const { pages, match: { params: { list } } } = this.props;
    const { listBookmarks } = this.state;
    // fill page index with page count
    this.setState({ selectedPageIdx: [...Array(list ? listBookmarks.size : pages.size).keys()] });
  }

  sort = ({ sortBy, sortDirection }) => {
    const { collection, dispatch, list, match: { params } } = this.props;
    const activeList = Boolean(params.list);

    const access = activeList ? list : collection;
    const prevSort = access.getIn(['sortBy', 'sort']);
    const prevDir = access.getIn(['sortBy', 'dir']);

    // clear selected pages
    this.setState({ selectedPageIdx: null });

    if (activeList && prevSort === sortBy && prevDir === 'DESC') {
      return dispatch(listSetSort({ sort: null, dir: null }));
    }

    const sortFn = activeList ? listSetSort : collSetSort;
    if (prevSort !== sortBy) {
      dispatch(sortFn({ sort: sortBy, dir: sortDirection }));
    } else {
      dispatch(sortFn({ sort: sortBy, dir: prevDir === 'ASC' ? 'DESC' : 'ASC' }));
    }
  }

  sortBookmark = (origIndex, hoverIndex) => {
    const { sortedBookmarks } = this.state;
    const o = sortedBookmarks.get(origIndex);
    const sorted = sortedBookmarks.splice(origIndex, 1)
                                  .splice(hoverIndex, 0, o); // eslint-disable-line

    this.setState({ sortedBookmarks: sorted });
  }

  saveSort = () => {
    const { list, saveBookmarkSort } = this.props;
    const { sortedBookmarks } = this.state;
    const order = sortedBookmarks.map(o => o.get('id')).toArray();
    this.setState({ listBookmarks: sortedBookmarks });
    saveBookmarkSort(list.get('id'), order);
  }

  collapsibleToggle = (isOpen) => {
    this.setState({ overrideHeight: isOpen ? null : 'auto' });
  }

  render() {
    const { isAnon } = this.context;
    const { auth, pages, browsers, collection, list, match: { params }, publicIndex, removeBookmark } = this.props;
    const { listBookmarks, selectedPageIdx, sortedBookmarks } = this.state;
    const activeList = Boolean(params.list);
    const canAdmin = auth.getIn(['user', 'username']) === params.user;

    const collRedirect = collection.get('loaded') && !collection.get('slug_matched') && params.coll !== collection.get('slug');

    if (collection.get('error') || !canAdmin) {
      return params.user.startsWith('temp-') ?
        <Temp404 /> :
        <HttpStatus>{collection.getIn(['error', 'error_message'])}</HttpStatus>;
    } else if (collRedirect) {
      const toUrl = activeList ? getListLink(collection, list, true) : getCollectionLink(collection, true);
      return <RedirectWithStatus to={toUrl} status={301} />;
    } else if (activeList && (list.get('error') || (!list.get('slug_matched') && params.list !== list.get('slug')))) {
      if (list.get('loaded') && !list.get('slug_matched')) {
        return (
          <RedirectWithStatus to={getListLink(collection, list, true)} status={301} />
        );
      }
      return (
        <HttpStatus>
          {
            list.get('error') === 'no_such_list' &&
              <span>Sorry, we couldn't find that list.</span>
          }
        </HttpStatus>
      );
    }

    // don't render until loaded
    if (!collection.get('loaded')) {
      return null;
    }

    const activeListSlug = params.list;
    const indexPages = !canAdmin && !publicIndex ? List() : pages;
    const objects = activeList ? listBookmarks : indexPages;
    const displayObjects = activeList ? sortedBookmarks : indexPages;

    return (
      <div className={classNames('wr-coll-detail', { 'with-list': activeList })}>
        {
          activeList ?
            <Helmet>
              {
                !__PLAYER__ ?
                  <title>{`${list.get('title')} (List by ${collection.get('owner')})`}</title> :
                  <title>{list.get('title')}</title>
              }

              <meta property="og:url" content={`${config.appHost}${getListLink(collection, list, true)}`} />
              <meta property="og:type" content="website" />
              <meta property="og:title" content={list.get('title')} />
              <meta property="og:description" content={list.get('desc') ? truncate(list.get('desc'), 3, new RegExp(/([.!?])/)) : config.tagline} />
            </Helmet> :
            <Helmet>
              {
                !__PLAYER__ ?
                  <title>{`${collection.get('title')} (Web archive collection by ${collection.get('owner')})`}</title> :
                  <title>{collection.get('title')}</title>
              }
              <meta property="og:url" content={`${config.appHost}${getCollectionLink(collection, true)}`} />
              <meta property="og:type" content="website" />
              <meta property="og:title" content={collection.get('title')} />
              <meta property="og:description" content={collection.get('desc') ? truncate(collection.get('desc'), 3, new RegExp(/([.!?])/)) : config.tagline} />
            </Helmet>
        }

        {
          !__PLAYER__ &&
            <CustomDragLayer
              pages={objects}
              pageSelection={selectedPageIdx} />
        }

        {
          isAnon && canAdmin &&
            <TempUserAlert />
        }

        {/*
          canAdmin &&
            <Automation collection={collection} />
        */}

        <Sidebar storageKey="collSidebar">
          <CollectionHeader />
          <div className="resizable-container">
            <Resizable
              axis="y"
              flexGrow={0}
              minHeight={200}
              storageKey="collNavigator"
              overrideHeight={this.state.overrideHeight}>
              <Lists
                activeListSlug={activeListSlug}
                collapsibleToggle={this.collapsibleToggle}
                pages={objects}
                pageSelection={selectedPageIdx} />
            </Resizable>
            <InspectorPanel canAdmin={canAdmin} />
          </div>
        </Sidebar>

        <TableRenderer {...{
          activeList,
          browsers,
          collection,
          deselect: this.deselect,
          displayObjects,
          isMobile: this.context.isMobile,
          list,
          onKeyNavigate: this.onKeyNavigate,
          onSelectRow: this.onSelectRow,
          removeBookmark,
          saveSort: this.saveSort,
          selectedPageIdx,
          sort: this.sort,
          sortBookmark: this.sortBookmark
        }} />
      </div>
    );
  }
}

export default CollectionDetailUI;
