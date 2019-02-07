import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';


class ClippedLink extends PureComponent {
  static propTypes = {
    className: PropTypes.string,
    link: PropTypes.string
  };

  static defaultProps = {
    className: ''
  };

  constructor(props) {
    super(props);

    this.handle = null;
    this.state = {
      show: false
    };
  }

  componentWillUnmount() {
    clearTimeout(this.handle);
  }

  clearActions = () => clearTimeout(this.handle)

  clippedLink = memoize(link => link.split('?')[0])

  furl = () => {
    clearTimeout(this.handle);
    this.handle = setTimeout(() => this.setState({ show: false }), 350);
  }

  unfurl = () => {
    clearTimeout(this.handle);
    this.handle = setTimeout(() => this.setState({ show: true }), 150);
  }

  render() {
    const { className, link } = this.props;
    const { show } = this.state;

    if (!link.includes('?')) {
      return <span className={className}>{link}</span>;
    }

    const clipped = this.clippedLink(link);

    return (
      <span className={className} onMouseLeave={this.furl} onMouseEnter={this.clearActions}>
        {
          show ?
            link :
            <React.Fragment>
              <span>{clipped}</span><button className="button-link" onMouseEnter={this.unfurl} type="button">...</button>
            </React.Fragment>
        }
      </span>
    );
  }
}


export default ClippedLink;
