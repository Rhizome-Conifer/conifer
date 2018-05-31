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
    url: PropTypes.string,
    breadcrumbs: PropTypes.array
  };

  render() {
    const { url, breadcrumbs } = this.props;

    return (
      <ol className="wr-breadcrumb">
        {
          this.context.isMobile ?
            <NavLink to="/">Webrecorder</NavLink> :
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
