import { t } from "../../../modules/i18n.js";
import { BANDS, normalizeSettings } from "./audio-settings.js";

const sessions = new Map();
const jobs = new Map();

function stateFor(tabId) {
  const session = sessions.get(tabId);
  return session
    ? { active: true, tabId, ...session.settings }
    : { active: false, tabId, ...normalizeSettings({ gain: 1, preset: "flat" }) };
}

function notify(tabId) {
  chrome.runtime.sendMessage({ target: "audio-popup", type: "audio:state", state: stateFor(tabId), activeCount: sessions.size }).catch(() => {});
  if (sessions.size === 0) chrome.runtime.sendMessage({ target: "audio-background", type: "audio:idle" }).catch(() => {});
}

function apply(session, settings) {
  session.settings = normalizeSettings(settings);
  const time = session.context.currentTime;
  session.gain.gain.setTargetAtTime(session.settings.gain, time, 0.015);
  session.filters.forEach((filter, i) => filter.gain.setTargetAtTime(session.settings.eq[i], time, 0.015));
}

async function stop(tabId) {
  const session = sessions.get(tabId);
  if (!session) return;
  sessions.delete(tabId);
  session.source.disconnect();
  session.stream.getTracks().forEach(track => { track.onended = null; track.stop(); });
  await session.context.close();
  notify(tabId);
}

async function handle(message) {
  if (message.type === "audio:status") return { activeCount: sessions.size };
  if (message.type === "audio:stop-all") {
    await Promise.all([...sessions.keys()].map(stop));
    return { activeCount: 0 };
  }
  const { tabId } = message;
  if (!Number.isInteger(tabId) || tabId < 0) throw new Error(t("volume_booster_invalid_tab"));
  if (message.type === "audio:get") return stateFor(tabId);
  if (message.type === "audio:stop") {
    await stop(tabId);
    return stateFor(tabId);
  }
  if (message.type === "audio:set") {
    const session = sessions.get(tabId);
    if (session) apply(session, message.settings);
    return stateFor(tabId);
  }
  if (message.type !== "audio:start") throw new Error(t("common_unknown_audio_operation"));
  if (sessions.has(tabId)) {
    apply(sessions.get(tabId), message.settings);
    return stateFor(tabId);
  }
  let stream;
  let context;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: message.streamId } },
      video: false
    });
    context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const filters = BANDS.map((frequency, i) => {
      const filter = context.createBiquadFilter();
      filter.type = i === 0 ? "lowshelf" : i === BANDS.length - 1 ? "highshelf" : "peaking";
      filter.frequency.value = frequency;
      filter.Q.value = 1;
      return filter;
    });
    const gain = context.createGain();
    let previous = source;
    for (const filter of filters) { previous.connect(filter); previous = filter; }
    previous.connect(gain);
    gain.connect(context.destination);
    const session = { stream, context, source, filters, gain };
    apply(session, message.settings);
    await context.resume();
    sessions.set(tabId, session);
    for (const track of stream.getTracks()) track.onended = () => { stop(tabId).catch(() => {}); };
    notify(tabId);
    return stateFor(tabId);
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop());
    if (context && context.state !== "closed") await context.close();
    throw error;
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.target !== "audio-engine" || sender.id !== chrome.runtime.id) return;
  if (message.type === "audio:ping") { reply({ ok: true }); return; }
  const previous = jobs.get(message.tabId) || Promise.resolve();
  const job = previous.catch(() => {}).then(() => handle(message));
  jobs.set(message.tabId, job);
  job.then(state => reply({ ok: true, state })).catch(error => reply({ ok: false, error: error.message })).finally(() => {
    if (jobs.get(message.tabId) === job) jobs.delete(message.tabId);
  });
  return true;
});
