import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import { truncate } from 'helpers/utils';


class ClippedLink extends PureComponent {
  static propTypes = {
    className: PropTypes.string,
    link: PropTypes.string,
    to: PropTypes.string
  };

  static defaultProps = {
    className: ''
  };

  constructor(props) {
    super(props);

    this.handle = null;
    this.state = {
      clipped: props.link.split('?')[0],
      show: false
    };
  }

  componentWillUnmount() {
    clearTimeout(this.handle);
  }

  clearActions = () => clearTimeout(this.handle)

  furl = () => {
    clearTimeout(this.handle);
    this.handle = setTimeout(() => this.setState({ show: false }), 350);
  }

  unfurl = () => {
    clearTimeout(this.handle);
    this.handle = setTimeout(() => this.setState({ show: true }), 150);
  }

  render() {
    const { className, link, to } = this.props;
    const { clipped, show } = this.state;

    if (!link.includes('?')) {
      return <Link className={className} to={to}>{link}</Link>;
    }

    return (
      <Link className={className} to={to} onMouseLeave={this.furl} onMouseEnter={this.clearActions}>
        {
          show ?
            link :
            <React.Fragment>
              <span>{clipped}</span><button className="button-link" onMouseEnter={this.unfurl} type="button">...</button>
            </React.Fragment>
        }
      </Link>
    );
  }
}


export default ClippedLink;
