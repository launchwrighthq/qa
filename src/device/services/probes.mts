// Page probes for `lw qa device eval --probe <name>`: one expression each, so it runs on every
// device target. A probe reads state and changes nothing on the page.

/**
 * Every `<video>`: the source kind, the ready and network state, decoded frames, a 32x32 luma
 * sample of the current frame, and the element at its centre. Zero decoded frames beside a black
 * luma is a picture that never decoded; an element at the centre that is not the video covers it.
 */
const VIDEO_PROBE = `(function () {
  function kind(v) {
    var s = v.currentSrc || v.getAttribute('src') || '';
    if (!s) return 'none';
    if (s.indexOf('blob:') === 0) return 'blob (MediaSource)';
    if (/\\.m3u8/.test(s)) return 'm3u8 (native HLS)';
    if (/\\.mp4/.test(s)) return 'mp4';
    return 'other';
  }
  function sample(v) {
    try {
      var c = document.createElement('canvas');
      c.width = 32;
      c.height = 32;
      var g = c.getContext('2d');
      g.drawImage(v, 0, 0, 32, 32);
      var d = g.getImageData(0, 0, 32, 32).data, sum = 0, max = 0;
      for (var i = 0; i < d.length; i += 4) {
        var l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        sum += l;
        if (l > max) max = l;
      }
      return { meanLuma: Math.round(sum / 1024), maxLuma: Math.round(max) };
    } catch (e) {
      return { error: String(e) };
    }
  }
  function label(el) {
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
  }
  var out = { href: location.href, dpr: devicePixelRatio, vw: innerWidth, vh: innerHeight, mse: typeof MediaSource, mms: typeof ManagedMediaSource, videos: [] };
  Array.prototype.slice.call(document.querySelectorAll('video')).forEach(function (v, i) {
    var r = v.getBoundingClientRect();
    var q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null;
    var rec = {
      i: i, kind: kind(v), readyState: v.readyState, networkState: v.networkState, paused: v.paused, muted: v.muted,
      t: +v.currentTime.toFixed(2), dur: +(v.duration || 0).toFixed(1), w: v.videoWidth, h: v.videoHeight,
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      quality: q ? { total: q.totalVideoFrames, dropped: q.droppedVideoFrames } : null
    };
    if (v.readyState >= 2) rec.luma = sample(v);
    var cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    if (r.width > 0 && cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight) {
      var hit = document.elementFromPoint(cx, cy);
      rec.atCentre = hit ? label(hit) : null;
    }
    out.videos.push(rec);
  });
  return out;
})()`;

export const PROBES: Readonly<Record<string, string>> = { video: VIDEO_PROBE };
