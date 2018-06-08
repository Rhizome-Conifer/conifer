import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import HTML5Backend from 'react-dnd-html5-backend';
import renderRoutes from 'react-router-config/renderRoutes';
import { matchPath } from 'react-router-dom';
import { withRouter } from 'react-router';
import { DragDropContext } from 'react-dnd';

import playerRoutes from 'playerRoutes';
import { openFile } from 'helpers/playerUtils';

import PlayerNav from 'containers/PlayerNav';

import 'shared/fonts/fonts.scss';
import './style.scss';

const { ipcRenderer } = window.require('electron');


class PlayerApp extends Component {

  static propTypes = {
    children: PropTypes.node,
    history: PropTypes.object,
    location: PropTypes.object,
    route: PropTypes.object
  };

  constructor(props) {
    super(props);

    this.state = { error: false };
  }

  componentDidMount() {
    document.addEventListener('drop', this.openDroppedFile);

    document.addEventListener('dragover', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
    });

    ipcRenderer.on('change-location', (evt, path) => {
      this.props.history.push(path);
    });

    ipcRenderer.on('open-warc-dialog', openFile.bind(this, this.props.history));
  }

  componentDidUpdate(prevProps) {
    // restore scroll postion
    if (this.props.location !== prevProps.location) {
      if (window) {
        window.scrollTo(0, 0);
      }

      // clear error state on navigation
      if (this.state.error) {
        this.setState({ error: null, info: null });
      }
    }
  }

  componentWillUnmount() {
    document.removeEventListener('drop', this.openDroppedFile);
  }

  componentDidCatch(error, info) {
    this.setState({ error });
  }

  openDroppedFile = (evt) => {
    const { history } = this.props;
    evt.preventDefault();
    evt.stopPropagation();
    const filename = evt.dataTransfer.files[0].path;

    if (filename && filename.toString().match(/\.w?arc(\.gz)?|\.har$/)) {
      history.push('/');

      ipcRenderer.send('open-warc', filename.toString());
    } else if (filename) {
      window.alert('Sorry, only WARC or ARC files (.warc, .warc.gz, .arc, .arc.gz) or HAR (.har) can be opened');
    }
  }

  appReset = () => {
    this.props.history.replace('/');
    window.location.reload();
  }

  render() {
    const { error } = this.state;

    const match = playerRoutes[0].routes.find((route) => {
      return matchPath(this.props.location.pathname, route);
    });

    const classOverride = match.classOverride;
    const containerClasses = classNames('wr-content', [classOverride]);

    if (error) {
      return (
        <div id="landingContainer">
          <PlayerNav />
          <div style={{ paddingLeft: '20px' }}>
            <h3><a onClick={this.appReset}>Error Encountered, please try again.</a></h3>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment>
        <PlayerNav route={match} />
        <section className={containerClasses}>
          {renderRoutes(this.props.route.routes)}
        </section>
      </React.Fragment>
    );
  }
}


export default withRouter(
  DragDropContext(HTML5Backend)(PlayerApp)
);
