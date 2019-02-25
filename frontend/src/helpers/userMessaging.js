
import { supportEmail } from 'config';

export default {
  collection: {
    duplicate_name: 'A collection with the supplied name already exists.',
    no_such_collection: 'Collection not found.',
    no_such_user: 'User not found',
    no_user_specified: 'Invalid request',
    no_collection_specified: 'Invalid request',
    not_found: 'Collection not found.',
    invalid_coll_name: 'The collection name entered is not valid',
    invalid_temp_coll_name: 'Invalid name for temporary collection',

    // recording oriented
    no_such_recording: 'Capture Session not found.',
    copy_error: 'There was an error copying the session',
    move_error: 'There was an error moving the session'
  },
  content: {
    no_such_collection: 'Collection not found.',
    no_such_recording: 'Recording not found.',
    recording_not_open: 'This session has already been finished. Please start a new capture session',
    out_of_space: 'Sorry, you have exceeded the size available on your account.',
    rate_limit_exceeded: 'Sorry, you have exceed the rate limit. Please contact us if you think this is an error',

    // rare
    invalid_connection_source: 'Proxy access not configured properly.',
    invalid_browser_request: 'Not allowed to run remote browser from here',
    invalid_mode: 'Invalid Mode Specified',
    domain_missing: 'Cookie Domain Missing',
  },
  list: {
    invalid_order: 'Error saving order.',
    invalid_page: 'Invalid Page for Bookmark',
    no_such_list: 'No list found.',
    no_such_bookmark: 'Bookmark not found',
  },
  login: {
    invalid_login: 'Invalid Login. Please Try Again.',
    duplicate_name: 'A collection with the supplied name already exists.',
    out_of_space: 'Sorry, not enough space to import this Temporary Collection into your account.',
    invalid_coll_name: 'The collection name entered is not valid'
  },
  passwordReset: {
    already_logged_in: 'An account is already logged in.'
  },
  registration: {
    already_registered: 'This account has already been registered',
    duplicate_name: 'A collection with the supplied name already exists.',
    email_not_available: 'This email address is associated with another account.',
    invalid_code: `The registration code is not valid. Please try registering again, or contact ${supportEmail} if this error persists.`,
  },
  upload: {
    coll_not_found: 'Collection not found.',
    no_archive_data: 'Error encountered during processing.',
    not_logged_in: 'Log in and try again.',
    out_of_space: 'This account doesn\'t have enough free space for this upload.',
    incomplete_upload: 'The file upload was incomplete',
    no_file_specified: 'No upload file specified',
    upload_expired: 'Upload already finished',
  }
};
