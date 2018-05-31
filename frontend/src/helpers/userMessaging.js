
import { supportEmail } from 'config';

export default {
  collection: {
    duplicate_name: 'A collection with the supplied name already exists.',
    no_such_collection: 'Collection not found.',
    no_such_user: 'User not found',
    no_user_specified: 'Invalid request',
    not_found: 'Collection not found.'
  },
  list: {
    invalid_order: 'Error saving order.',
    no_such_list: 'No list found.'
  },
  login: {
    duplicate_name: 'A collection with the supplied name already exists.'
  },
  registration: {
    already_registered: 'This account has already been registerd',
    duplicate_name: 'A collection with the supplied name already exists.',
    'invalid other': `Error encountered, please contact ${supportEmail}`
  },
  upload: {
    coll_not_found: 'Collection not found.',
    no_archive_data: 'Error encountered during processing.',
    not_logged_in: 'Log in and try again.',
    out_of_space: 'This account doesn\'t have enough free space for this upload.'
  }
};
