import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';


class ReplayArrowButton extends Component {
  static contextTypes = {
    router: PropTypes.object
  }

  static propTypes = {
    direction: PropTypes.oneOf(['left', 'right']),
    page: PropTypes.object,
    params: PropTypes.object
  };

  shouldComponentUpdate(nextProps) {
    if (nextProps.page === this.props.page) {
      return false;
    }

    return true;
  }

  changeUrl = () => {
    const { params, page } = this.props;
    const { user, coll } = params;

    if (page === null) {
      return;
    }

    this.context.router.history.push(`/${user}/${coll}/${page.get('timestamp')}/${page.get('url')}`);
  }

  render() {
    const { direction, page } = this.props;
    const classes = classNames('btn btn-default hidden-xs', {
      disabled: page === null
    });

    return (
      <button type="button" onClick={this.changeUrl} className={classes} title={`${direction === 'right' ? 'Next' : 'Previous'} bookmark`}>
        <span className={`glyphicon glyphicon-chevron-${direction}`} />
      </button>
    );
  }
}

export default ReplayArrowButton;
