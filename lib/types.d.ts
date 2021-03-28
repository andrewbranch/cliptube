type Diagnostic = { code: number, message: string };
type Success<T> = { success: true, value: T };
type Failure = { success: false, diagnostic: Diagnostic, error?: Error };
type Result<T> = Success<T> | Failure;

type ClipSelection = { start: number, end: number, name?: string };

interface DownloadOptions {
  url: string;
  outDir: string;
  overwrite?: boolean;
}

interface ClipOptions extends DownloadOptions {
  selections: ClipSelection[];
}

type VideoInfo = import('ytdl-core').videoInfo;
type VideoFormat = import('ytdl-core').videoFormat;

interface DownloadHandlers {
  onInfo?: (info: VideoInfo, formats: [VideoFormat] | [VideoFormat, VideoFormat]) => void,
  onDownloadProgress?: (downloaded: number, total: number) => void,
  onDownloaded?: () => void,
  onMergeStart?: (totalMs: number) => void,
  onMergeProgress?: (encodedMs: number) => void,
  onMerged?: () => void,
}

interface Host {
  log: typeof console.log & { error: typeof console.error };
  net: {
    getYouTubeInfo: (url: string) => Promise<VideoInfo>;
    downloadYouTubeVideo: (info: VideoInfo, format: VideoFormat) => import('stream').Readable;
  };
  fs: {
    exists: (path: string) => Promise<boolean>;
    createWriteStream: typeof import('fs').createWriteStream;
    mkdirp: (path: string) => Promise<void>;
  };
  config: {
    getOutputDirectory: () => string;
  };
  ffmpeg: Pick<import('@tedconf/fessonia'), 'FFmpegCommand' | 'FFmpegInput' | 'FFmpegOutput'>;
}
