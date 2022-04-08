
import { supportEmail } from 'config';

export default {
  autopilot: {
    autoScrollBehavior: {
      timesScrolled: 'Times Autoscrolled'
    },
    deathImitatesLanguageBehavior: {
      items: 'Works Captured'
    },
    slideShareBehavior: {
      slides: 'Slides Captured',
      decks: 'Presentations Captured'
    },
    youtubeVideoBehavior: {
      loadedVideoInfo: 'Video Description Captured',
      playedVideo: 'Video Captured',
      viewedComments: 'Comments Captured'
    },
    twitterTimelineBehavior: {
      videos: 'Videos Captured',
      threadsOrReplies: 'Replies Captured',
      viewedFully: 'Tweets Captured'
    },
    twitterHashTagsBehavior: {
      videos: 'Videos Captured',
      threadsOrReplies: 'Replies Captured',
      viewedFully: 'Tweets Captured'
    },
    twitterTimelineBehaviorNew: {
      videos: 'Videos Captured',
      threadsOrReplies: 'Replies Captured',
      viewed: 'Tweets Captured'
    },
    soundCloudArtistBehavior: {
      tracksPlayed: 'Tracks Captured',
      trackListsPlayed: 'Playlists Captured'
    },
    soundCloudEmbedBehavior: {
      tracksPlayed: 'Tracks Captured',
      trackListsPlayed: 'Playlists Captured'
    },
    instagramUserBehavior: {
      viewedFully: 'Posts Captured',
      viewedStories: 'Stories Captured',
      viewedSelectedStories: 'Highlights Captured'
    },
    instagramOwnFeedBehavior: {
      viewed: 'Posts Captured',
      viewedStories: 'Stories Captured',
      viewedSelectedStories: 'Highlights Captured'
    },
    instagramPostBehavior: {
      viewed: 'Posts Captured',
      viewedStories: 'Stories Captured'
    },
    facebookUserFeed: {
      videos: 'Videos Captured',
      posts: 'Posts Captured'
    },
    facebookNewsFeed: {
      videos: 'Videos Captured',
      posts: 'Posts Captured'
    }
  },
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
    invalid_coll_name: 'The collection name entered is not valid',
    account_suspended: 'Your account has been suspended. If you believe this is in error, please contact support@conifer.rhizome.org'
  },
  passwordReset: {
    reset_wait: 'You recently submitted a reset request.',
    too_many_attempts: "You've attempted to reset your password too many times. Please wait a bit and try the process again.",
    already_logged_in: 'An account is already logged in.',
    invalid_reset_code: 'The reset code is invalid. Please try going through the reset process again.'
  },
  registration: {
    already_registered: 'This account has already been registered',
    username_not_available: 'This username is no longer available',
    duplicate_name: 'A collection with the supplied name already exists.',
    email_not_available: 'This email address is associated with another account.',
    invalid_code: `The registration code is not valid. Please try registering again, or contact ${supportEmail} if this error persists.`,
    suspicious: 'We had trouble verifying your details. Please refresh the page and try again. If this problem persists, contact support@conifer.rhizome.org',
    blocked: "The domain you're attempting to register from has been flagged for spam or abuse. If you believe this is an error, contact support@conifer.rhizome.org"
  },
  upload: {
    coll_not_found: 'Collection not found.',
    no_archive_data: 'Error encountered during processing.',
    not_logged_in: 'Log in and try again.',
    out_of_space: 'This account doesn\'t have enough free space for this upload.',
    incomplete_upload: 'The file upload was incomplete',
    no_file_specified: 'No upload file specified',
    upload_expired: 'Upload already finished',
  },
  settings: {
    invalid_password: 'The current password you provided did not work.'
  }
};
