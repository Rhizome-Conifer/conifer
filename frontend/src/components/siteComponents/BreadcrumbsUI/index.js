import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';
import { withBreadcrumbs } from 'react-router-breadcrumbs-hoc';

import routes from 'routes';

import './style.scss';


class BreadcrumbsUI extends PureComponent {
  static contextTypes = {
    isMobile: PropTypes.bool
  };

  static propTypes = {
    breadcrumbs: PropTypes.array,
    is404: PropTypes.bool,
    url: PropTypes.string
  };

  render() {
    const { url, breadcrumbs } = this.props;

    return (
      <ol className="wr-breadcrumb">
        {
          this.props.is404 ?
            null :
            breadcrumbs.map(({ breadcrumb, path, match, getLocation }) => (
              <li key={path}>
                {
                  match.url === url ?
                    <span>{breadcrumb}</span> :
                    <NavLink to={getLocation ? getLocation(match.params) : match.url}>
                      {breadcrumb}
                    </NavLink>
                }
              </li>
            ))
        }
      </ol>
    );
  }
}

export default withBreadcrumbs(routes)(BreadcrumbsUI);
