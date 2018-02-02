import React from 'react';
import { NavLink } from 'react-router-dom';
import { withBreadcrumbs } from 'react-router-breadcrumbs-hoc';
import routes from 'routes';

import './style.scss';


function BreadcrumbsUI({ url, breadcrumbs }) {
  return (
    <ol className="wr-breadcrumb">
      {
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

export default withBreadcrumbs(routes)(BreadcrumbsUI);
