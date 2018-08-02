import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import { basename } from 'path';

//import { clearColl } from 'redux/modules/collection';

import './style.scss';


class Indexing extends Component {

  static contextTypes = {
    router: PropTypes.object
  };

  static propTypes = {
    dispatch: PropTypes.func,
    history: PropTypes.object,
    host: PropTypes.string
  };

  constructor(props) {
    super(props);

    this.interval = null;
    this.state = {
      data: null
    };
  }

  componentWillMount() {
    //this.props.dispatch(clearColl());
  }

  componentDidMount() {
    const { host } = this.props;
    const reqUrl = `${host}/_upload/@INIT?user=local`;

    this.interval = setInterval(() => {
      fetch(reqUrl).then(res => res.json())
                   .then(this.displayProgress)
                   .catch(err => console.log(err));
    }, 250);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  displayProgress = (data) => {
    if (data.done && data.done) {
      clearInterval(this.interval);
      this.props.history.push('/local/collection');
    } else {
      this.setState({
        file: basename(data.filename),
        progress: (((data.size / data.total_size) * 100) + 0.5) | 0
      });
    }
  }

  render() {
    const { file, progress } = this.state;
    return (
      <div id="indexingContainer">
        <div className="progress-window">
          <h1>Please wait while the archive is indexed...</h1>
          <h3>Now Indexing: { file }</h3>
          <div className="indexing-bar">
            <div className="progress" style={{ width: `${progress || 0}%` }} />
            <div className="progress-readout">{ `${progress || 0}%` }</div>
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = ({ app }) => {
  return {
    host: app.getIn(['appSettings', 'host'])
  };
};

export default withRouter(connect(mapStateToProps)(Indexing));
