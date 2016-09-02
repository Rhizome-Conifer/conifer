import React, { Component, PropTypes } from 'react';
import classNames from 'classnames';

/**
 * for the time being this uses a hackish css method.. TODO: move this to svg
 * http://www.cssscript.com/demo/pure-css-circular-percentage-bar/
 */
import './style.scss';


class RadialGraph extends Component {

  static propTypes = {
    legend: PropTypes.string,
    label: PropTypes.string,
    percentage: PropTypes.number,
    /* color coding for disk space readouts */
    showWarning: PropTypes.bool,
    className: PropTypes.string,
  }

  static defaultProps = {
    showWarning: false,
  }

  render() {
    const { className, label, legend, percentage, showWarning } = this.props;

    const classes = classNames('c100', `p${percentage}`);
    const perctClass = classNames({
      'green': !showWarning || percentage < 75,
      'yellow': showWarning && percentage >= 75 && percentage < 90,
      'red': showWarning && percentage >= 90,
    })

    return (
      <div className={`radial-graph ${className}`}>
        <div className={classes}>
          <span className={perctClass}>{label}</span>
          <div className='slice'>
            <div className={`bar ${perctClass}`} />
            <div className={`fill ${perctClass}`} />
          </div>
        </div>
        {
          legend &&
            <span className='legend'>{ legend }</span>
        }
      </div>
    );
  }
}

export default RadialGraph;
