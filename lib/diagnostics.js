/** @type {Diagnostic} */
export const noIdInUrl = {
  code: 1,
  message: 'Could not find video ID in YouTube link.',
};

/** @type {Diagnostic} */
export const downloadError = {
  code: 2,
  message: 'Encountered an error downloading video.',
};

/** @type {Diagnostic} */
export const invalidTimestampInput = {
  code: 3,
  message: `Invalid format for timestamp. (Valid formats for a timestamp at one minute and twenty-three seconds are '00:01:23', '01:23', and '1:23'.)`,
};

/** @type {Diagnostic} */
export const invalidDurationInput = {
  code: 3,
  message: `Invalid duration. Should be a positive integer.`,
};


/** @type {Diagnostic} */
export const noURLProtocol = {
  code: 4,
  message: `Invalid URL: missing protocol (https://).`,
};

/** @type {Diagnostic} */
export const noYouTubeId = {
  code: 5,
  message: `Invalid URL: could not find video ID.`,
};

/** @type {Diagnostic} */
export const notYouTubeURL = {
  code: 6,
  message: `Only YouTube URLs are supported.`,
};

/** @type {Diagnostic} */
export const noVideoFormat = {
  code: 7,
  message: `Could not find a video format to download.`,
};

/** @type {Diagnostic} */
export const mergeError = {
  code: 8,
  message: `An error occurred while merging downloaded video and audio.`
};

/** @type {Diagnostic} */
export const ffDownloadError = {
  code: 9,
  message: `An error occurred while installing ffmpeg and ffprobe.`
};

/** @type {Diagnostic} */
export const cutError = {
  code: 10,
  message: `An error occurred trimming the video.`
};