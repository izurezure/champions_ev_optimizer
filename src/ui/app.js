const $ = (selector) => document.querySelector(selector);
const fields = ['format', 'month', 'rating', 'megaPolicy', 'naturePolicy', 'setupBoost', 'excludeOther'];

let config = null;

init();

async function init() {
  config = await fetchJson('/api/config');
  fillFormats(config.formats, config.defaults);
  $('#calculate').addEventListener('click', calculate);
  $('#rating').addEventListener('change', calculate);
  $('#month').addEventListener('change', calculate);
  log(config.log.join('\n'));
  await calculate();
}

function fillFormats(formats, defaults) {
  $('#format').innerHTML = formats.map((format) => `<option value="${format.id}">${format.label}</option>`).join('');
  $('#rating').innerHTML = formats[0].ratings.map((rating) => `<option value="${rating}">${rating}</option>`).join('');
  $('#format').value = defaults.format;
  $('#rating').value = defaults.rating;
  $('#month').value = defaults.month;
  $('#megaPolicy').value = defaults.megaPolicy;
  $('#naturePolicy').value = defaults.naturePolicy;
  $('#setupBoost').value = String(defaults.setupBoost);
}

async function calculate() {
  $('#calculate').disabled = true;
  $('#calculate').textContent = 'Calculating';
  try {
    const payload = Object.fromEntries(fields.map((id) => [id, readField(id)]));
    payload.paste = $('#paste').value;
    payload.setupBoost = Number(payload.setupBoost);
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

function render(result) {
  $('#summary').textContent = `${result.input.species} / ${result.attackProfile.primaryCategory} / ${result.month} / ${result.rating} / ${result.source}`;
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
