import { formatLabelForId, ratingStateForFormat } from './formatOptions.js';

const $ = (selector) => document.querySelector(selector);
const fields = ['format', 'month', 'rating', 'megaPolicy', 'naturePolicy', 'setupBoost', 'speedMode', 'speedPoints', 'excludeOther'];

let config = null;

init();

async function init() {
  config = await fetchJson('/api/config');
  fillFormats(config.formats, config.defaults);
  $('#calculate').addEventListener('click', calculate);
  $('#format').addEventListener('change', () => {
    syncRatingOptions($('#format').value, $('#rating').value);
    calculate();
  });
  $('#rating').addEventListener('change', calculate);
  $('#month').addEventListener('change', calculate);
  $('#speedMode').addEventListener('change', () => {
    syncSpeedControls();
    calculate();
  });
  log(config.log.join('\n'));
  syncSpeedControls();
  await calculate();
}

function fillFormats(formats, defaults) {
  $('#format').innerHTML = formats.map((format) => `<option value="${format.id}">${format.label}</option>`).join('');
  $('#format').value = defaults.format;
  syncRatingOptions(defaults.format, defaults.rating);
  $('#month').value = defaults.month;
  $('#megaPolicy').value = defaults.megaPolicy;
  $('#naturePolicy').value = defaults.naturePolicy;
  $('#setupBoost').value = String(defaults.setupBoost);
  $('#speedMode').value = defaults.speedMode;
  $('#speedPoints').value = defaults.speedPoints ?? '';
  syncSpeedControls();
}

function syncRatingOptions(formatId, currentRating) {
  const state = ratingStateForFormat({ formats: config.formats, formatId, currentRating });
  $('#rating').innerHTML = state.ratings.map((rating) => `<option value="${rating}">${rating}</option>`).join('');
  $('#rating').value = state.selectedRating;
}

async function calculate() {
  $('#calculate').disabled = true;
  $('#calculate').textContent = 'Calculating';
  try {
    const payload = Object.fromEntries(fields.map((id) => [id, readField(id)]));
    payload.paste = $('#paste').value;
    payload.setupBoost = Number(payload.setupBoost);
    if (payload.speedPoints !== '') payload.speedPoints = Number(payload.speedPoints);
    const result = await fetchJson('/api/optimize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (result.error) throw new Error(result.error);
    render(result);
  } catch (error) {
    log(error.message || String(error), true);
  } finally {
    $('#calculate').disabled = false;
    $('#calculate').textContent = 'Calculate';
  }
}

function syncSpeedControls() {
  const fixed = $('#speedMode').value === 'fixed';
  $('#speedPoints').disabled = !fixed;
  $('#speedPoints').required = fixed;
  if (!fixed) $('#speedPoints').value = '';
}

function render(result) {
  const formatLabel = result.formatLabel || formatLabelForId(config.formats, result.format);
  $('#summary').textContent = `${result.input.species} / ${formatLabel} / ${result.attackProfile.primaryCategory} / ${result.month} / ${result.rating} / ${result.source}`;
  $('#results').innerHTML = result.results.map((row) => `
    <tr>
      <td>${row.rank}</td>
      <td>${formatPoints(row.statPoints)}</td>
      <td>${row.nature}</td>
      <td>${formatStats(row.stats)}</td>
      <td>${row.z.toFixed(3)}</td>
      <td>${row.p.toFixed(3)}</td>
      <td>${row.v.toFixed(3)}</td>
      <td>${row.dOut.toFixed(3)}</td>
      <td>${row.m.toFixed(3)}</td>
      <td>${row.n.toFixed(5)}</td>
      <td>${row.explanation}</td>
    </tr>`).join('');
  $('#output').value = result.outputPaste;
  log([...result.explanations, ...(result.statsLog || [])].join('\n'));
}

function formatPoints(points) {
  return ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map((stat) => `${label(stat)} ${points[stat]}`).join(' / ');
}

function formatStats(stats) {
  return ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map((stat) => `${label(stat)} ${stats[stat]}`).join(' / ');
}

function label(stat) {
  return { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' }[stat];
}

function readField(id) {
  const element = $(`#${id}`);
  return element.type === 'checkbox' ? element.checked : element.value;
}

function log(message, error = false) {
  $('#log').textContent = message || '';
  $('#log').classList.toggle('error', error);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  return response.json();
}
